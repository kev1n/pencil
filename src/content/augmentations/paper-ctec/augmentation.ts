import {
  initCartCache,
  lookupBySignature,
  recordOptimisticAdd,
  subscribe as subscribeCartCache
} from "../../cart-cache";
import type { Augmentation } from "../../framework";
import { getRecentAggregationTerms, isFeatureEnabled } from "../../settings";
import { resolveChipSection, addChipSectionToCart } from "./cart-flow";
import { ctecCreditPool, psCreditPool } from "../../../shared/credit-pool";
import { showToast } from "../../../shared/toast";
import { CTEC_ERROR_TOAST_MESSAGE } from "../ctec-links/rate-limit";
import {
  fetchCtecReportAggregate,
  getCachedReportAggregate,
  getCtecCourseAnalyticsSnapshot,
  hasCachedReportAggregate
} from "../ctec-links/reports";
import { AuthFlow } from "./auth-flow";
import { buildModalDisplayData } from "./modal-data";
import { PAPER_CTEC_CONFIG } from "./config";
import {
  CARD_BORDER_ON_HOVER_FEATURE_ID,
  NO_HOVER_LIFT_CLASS
} from "./constants";
import {
  collectScheduleTargets,
  extractSideCardContext,
  findWidgetsByKey,
  teardownPageForCleanup
} from "./dom";
import { ModalController } from "./modal-controller";
import { buildStatusBarData, clearAuthRequiredStates } from "./session";
import type { PaperCtecAnalyticsState } from "./types";
import {
  injectStyles,
  renderIdle,
  renderLoading,
  renderSideCardAnalytics,
  renderStatusBar,
  renderWidget
} from "./ui";
import { attachCartAnchor } from "./schedule-ui";
import {
  createChipCartCoordinator,
  type ChipCartCoordinator,
  type ChipIdentity
} from "./chip-cart-coordinator";
import {
  createChipFetchCoordinator,
  type ChipFetchCoordinator
} from "./chip-fetch-coordinator";
import {
  createStatusBarCoordinator,
  type StatusBarCoordinator
} from "./status-bar-coordinator";
import {
  createSideCardCoordinator,
  type SideCardCoordinator
} from "./side-card-coordinator";

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

// paper.nu sets `border-style: dashed` on user-created custom schedule
// blocks (ScheduleClass.tsx). Real CAESAR sections render with `solid`,
// so the inline-style check is enough to filter out customs.
function isCustomScheduleCard(card: HTMLElement): boolean {
  return card.style.borderStyle === "dashed";
}

// Top-level orchestration for the paper.nu augmentation. Wave 6d slimmed
// this to a wiring layer over four coordinators (chip-fetch, chip-cart,
// status-bar, side-card) plus AuthFlow + ModalController. State that
// crosses coordinators (resolved / inFlight / loadingMessages, etc.)
// lives on chip-fetch and is referenced by status-bar / modal via getter
// callbacks.
export class PaperCtecAugmentation implements Augmentation {
  readonly id = "paper-ctec";

  private readonly chipFetch: ChipFetchCoordinator;
  private readonly chipCart: ChipCartCoordinator;
  private readonly statusBar: StatusBarCoordinator;
  private readonly sideCard: SideCardCoordinator;
  // analyticsResolved + analyticsInFlight are owned by ModalController but
  // shared by reference here so the status-bar derivation can count
  // analytics fetches alongside front-page fetches.
  private readonly analyticsResolved = new Map<string, PaperCtecAnalyticsState>();
  private readonly analyticsInFlight = new Map<string, Promise<PaperCtecAnalyticsState>>();

  private focusListenerAttached = false;
  private readonly auth?: AuthFlow;
  private readonly modal: ModalController;

  constructor() {
    if (isPaperHost()) {
      this.auth = new AuthFlow({
        onInvalidate: (doc) => this.invalidateAndRerun(doc)
      });
    }

    void initCartCache();

    this.chipCart = createChipCartCoordinator({
      psCreditPool,
      showToast,
      addChipSectionToCart,
      resolveChipSection,
      lookupBySignature,
      recordOptimisticAdd,
      subscribeCartCache,
      attachToWidgets: (key, state, onClick) => {
        for (const widget of findWidgetsByKey(document, key)) {
          attachCartAnchor(widget, state, onClick);
        }
      }
    });

    this.chipFetch = createChipFetchCoordinator({
      ctecCreditPool,
      showToast,
      fetchAggregate: fetchCtecReportAggregate,
      getCachedAggregate: getCachedReportAggregate,
      getCourseAnalyticsSnapshot: getCtecCourseAnalyticsSnapshot,
      getAggregateLimit: getRecentAggregationTerms,
      getFetchLimit: () => PAPER_CTEC_CONFIG.aggregate.recentTerms,
      buildModalDisplayData,
      ctecErrorToastMessage: CTEC_ERROR_TOAST_MESSAGE,
      attachCartButton: (target) => {
        const chip: ChipIdentity = {
          key: target.key,
          params: target.params,
          titleHint: target.titleHint
        };
        attachCartAnchor(
          target.widget,
          this.chipCart.getState(target.key) ?? { kind: "idle" },
          () => this.chipCart.kickChipCart(chip)
        );
        // Lazy: resolve once per chip, then if the cart cache has an entry
        // for this section, surface "in cart" / "enrolled" immediately.
        void this.chipCart.seedCartStateFromCache(chip);
      },
      isCustomScheduleCard,
      openAuthModal: () => this.openAuthModal(),
      openAnalyticsModal: (source) => this.modal.openModal(source),
      renderIdle,
      renderLoading,
      renderWidget,
      generation: () => this.generation(),
      setProgress: (key, message) => this.setProgress(key, message),
      syncStatusBar: () => this.statusBar.syncStatusBar(document),
      syncSideCard: () => this.sideCard.syncSideCard(document),
      syncModal: () => this.modal.sync(document),
      modalHasInFlight: (key) => this.modal.hasInFlight(key)
    });

    this.statusBar = createStatusBarCoordinator({
      getVisibleKeys: () => this.chipFetch.state.visibleKeys,
      getResolved: () => this.chipFetch.state.resolved,
      getAnalyticsResolved: () => this.analyticsResolved,
      getInFlight: () => this.chipFetch.state.inFlight,
      getAnalyticsInFlight: () => this.analyticsInFlight,
      getLoadingMessages: () => this.chipFetch.state.loadingMessages,
      authFlow: () => this.auth,
      buildStatusBarData,
      renderStatusBar
    });

    this.sideCard = createSideCardCoordinator({
      extractSideCardContext,
      modalController: () => this.modal,
      hasUserActivated: (key) => this.chipFetch.hasUserActivated(key),
      getResolved: () => this.chipFetch.state.resolved,
      getInFlight: () => this.chipFetch.state.inFlight,
      hasCachedReportAggregate,
      getAggregateLimit: () => getRecentAggregationTerms(),
      renderSideCardAnalytics
    });

    this.modal = new ModalController(
      {
        resolved: this.chipFetch.state.resolved,
        inFlight: this.chipFetch.state.inFlight,
        analyticsResolved: this.analyticsResolved,
        analyticsInFlight: this.analyticsInFlight,
        loadingMessages: this.chipFetch.state.loadingMessages
      },
      {
        generation: () => this.generation(),
        isAwaitingRetry: () => this.auth?.isAwaitingRetry() ?? false,
        markAwaitingRetry: () => this.auth?.markAwaitingRetry(),
        setProgress: (key, message) => this.setProgress(key, message),
        syncStatusBar: () => this.statusBar.syncStatusBar(document),
        syncSideCard: () => this.sideCard.syncSideCard(document),
        renderForKey: (key, data) => this.chipFetch.renderForKey(key, data)
      }
    );

    this.chipCart.start();
  }

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;

    injectStyles();
    this.ensureFocusRetry();
    this.syncCardHoverStyle(doc);

    const targets = collectScheduleTargets(doc);
    this.chipFetch.syncTargets(targets);
    this.statusBar.syncStatusBar(doc);
    this.sideCard.syncSideCard(doc);
    this.modal.sync(doc);
  }

  cleanup(doc: Document = document): void {
    // Clear in-memory state so a re-enable doesn't carry stale chip data
    // forward without verifying the underlying cache is still valid.
    this.chipFetch.stop();
    this.chipCart.stop();
    this.sideCard.stop(doc);
    this.statusBar.stop(doc);
    this.analyticsResolved.clear();
    this.analyticsInFlight.clear();
    this.modal.invalidate();

    teardownPageForCleanup(doc);
  }

  private appliesToPage(doc: Document): boolean {
    if (!isPaperHost()) return false;
    return !!doc.querySelector(PAPER_CTEC_CONFIG.selectors.scheduleGrid);
  }

  private syncCardHoverStyle(doc: Document): void {
    const grid = doc.querySelector<HTMLElement>(PAPER_CTEC_CONFIG.selectors.scheduleGrid);
    if (!grid) return;
    grid.classList.toggle(
      NO_HOVER_LIFT_CLASS,
      isFeatureEnabled(CARD_BORDER_ON_HOVER_FEATURE_ID)
    );
  }

  private invalidateAndRerun(doc: Document): void {
    clearAuthRequiredStates(this.chipFetch.state.resolved, this.analyticsResolved);
    this.chipFetch.invalidateAfterAuth();
    this.modal.invalidate();
    this.run(doc);
  }

  private openAuthModal(): void {
    if (!this.auth) return;
    this.auth.openManually();
    this.statusBar.syncStatusBar(document);
  }

  private generation(): number {
    return this.auth?.getGeneration() ?? 0;
  }

  private setProgress(key: string, message: string): void {
    this.chipFetch.state.loadingMessages.set(key, { message, updatedAt: Date.now() });
    this.statusBar.syncStatusBar(document);
  }

  private ensureFocusRetry(): void {
    if (this.focusListenerAttached || !this.auth) return;
    const auth = this.auth;

    const retryIfNeeded = () => {
      if (!auth.shouldRetryOnFocus()) return;
      if (document.visibilityState === "hidden") return;
      auth.retry(document);
    };

    window.addEventListener("focus", retryIfNeeded);
    document.addEventListener("visibilitychange", retryIfNeeded);
    this.focusListenerAttached = true;
  }
}
