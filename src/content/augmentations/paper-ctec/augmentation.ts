import {
  initCartCache,
  lookupBySignature,
  recordOptimisticAdd,
  subscribe as subscribeCartCache
} from "../../cart-cache";
import type { Augmentation } from "../../framework";
import {
  getRecentAggregationTerms,
  isFeatureEnabled,
  subscribeCtecStrategy
} from "../../settings";
import { resolveChipSection, addChipSectionToCart } from "./cart-flow";
import { ctecCreditPool, psCreditPool } from "../../../shared/credit-pool";
import { showToast } from "../../../shared/toast";
import { isCtecAccessDenied } from "../../ctec-index/access";
import { CTEC_ERROR_TOAST_MESSAGE } from "../ctec-links/rate-limit";
import {
  getCachedChipAggregate,
  getChipCourseAnalyticsSnapshot,
  hasCachedReportAggregate,
  type CtecReportAggregateResult
} from "../ctec-links/reports";
import type { CtecLinkParams } from "../ctec-links/types";
import {
  createAuthRecovery,
  type AuthRecovery
} from "../class-search/auth-recovery";
import { fetchAggregateWithAuth, fetchAnalyticsWithAuth } from "../../auth/ctec-fetch";
import { enrichParams } from "./instructor-enrichment";
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
import { buildStatusBarData } from "./session";
import type { PaperCtecAnalyticsState, PaperCtecWidgetData } from "./types";
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

  // Drives the "open SSO popup tab + auto-retry" handshake. Single instance
  // shared across chip-fetch (Load CTEC), chip-cart (Add to cart), and the
  // modal's batch + refresh fetches so concurrent failures coalesce onto
  // one popup.
  private readonly authRecovery: AuthRecovery = createAuthRecovery({
    chromeRuntime: chrome.runtime,
    windowLocation: { assign: (url: string | URL) => window.location.assign(url) }
  });
  private readonly modal: ModalController;
  private unsubscribeStrategy: (() => void) | null = null;

  constructor() {
    void initCartCache();

    this.chipCart = createChipCartCoordinator({
      psCreditPool,
      showToast,
      addChipSectionToCart: (params, titleHint, onProgress) =>
        addChipSectionToCart(this.authRecovery, params, titleHint, onProgress),
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
      fetchAggregate: (params, titleHint, onProgress, options) =>
        this.fetchAggregateForChip(params, titleHint, onProgress, options),
      enrichParams: (params) => enrichParams(params, document),
      getCachedAggregate: getCachedChipAggregate,
      getCourseAnalyticsSnapshot: getChipCourseAnalyticsSnapshot,
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
      isCtecAccessDenied,
      openAnalyticsModal: (source) => this.modal.openModal(source),
      renderIdle,
      renderLoading,
      renderWidget,
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
        setProgress: (key, message) => this.setProgress(key, message),
        syncStatusBar: () => this.statusBar.syncStatusBar(document),
        syncSideCard: () => this.sideCard.syncSideCard(document),
        renderForKey: (key, data) => this.chipFetch.renderForKey(key, data),
        fetchAnalytics: (params, titleHint, recentAggregateLimit, onProgress, fetchLimit, forceRefreshLinks) =>
          fetchAnalyticsWithAuth(
            this.authRecovery,
            params,
            titleHint,
            recentAggregateLimit,
            onProgress,
            fetchLimit,
            forceRefreshLinks
          ),
        enrichParams: (params) => enrichParams(params, document)
      }
    );

    this.chipCart.start();

    // Strategy switches invalidate every chip's resolved aggregate (the
    // map is keyed on (subject, catalog, instructor) only — strategy is
    // implicit in the lookup, so a stored aggregate from one lens would
    // bleed into another lens's render). Clearing forces syncTargets to
    // re-derive from the per-strategy cache slice on its next pass. We
    // also clear analyticsResolved so the modal's not-found / error
    // verdict from a prior lens doesn't shadow the new lens.
    this.unsubscribeStrategy = subscribeCtecStrategy(() => {
      this.chipFetch.state.resolved.clear();
      this.analyticsResolved.clear();
      this.run(document);
    });
  }

  private async fetchAggregateForChip(
    params: CtecLinkParams,
    titleHint: string,
    onProgress: (message: string) => void,
    options: { fetchLimit: number; aggregateLimit: number }
  ): Promise<PaperCtecWidgetData | null> {
    const result = await fetchAggregateWithAuth(
      this.authRecovery,
      params,
      titleHint,
      onProgress,
      options
    );
    return result === null ? null : aggregateResultToWidgetData(result);
  }

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;

    injectStyles();
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
    this.authRecovery.dispose();
    this.unsubscribeStrategy?.();
    this.unsubscribeStrategy = null;

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

  private setProgress(key: string, message: string): void {
    this.chipFetch.state.loadingMessages.set(key, { message, updatedAt: Date.now() });
    this.statusBar.syncStatusBar(document);
  }
}

function aggregateResultToWidgetData(
  result: CtecReportAggregateResult
): PaperCtecWidgetData {
  if (result.state === "found") {
    return { state: "found", aggregate: result.aggregate };
  }
  if (result.state === "no-access") return { state: "no-access" };
  if (result.state === "not-found") return { state: "not-found" };
  return { state: "error", message: result.message };
}
