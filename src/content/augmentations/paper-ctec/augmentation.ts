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
import { resolveChipSection, addChipSectionToCart, loadChipClassDetails } from "./cart-flow";
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
import { enrichParams, peekEnrichedParams } from "./instructor-enrichment";
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
import type { AnalyticsModalSource, PaperCtecAnalyticsState, PaperCtecSideCardContext, PaperCtecWidgetData } from "./types";
import { html, render } from "lit-html";
import { classKey } from "./identity";
import { renderCaesarBody, renderFoot, type CaesarInfo, type CartAction } from "./modal/caesar-info";
import { readActiveTermNameFromDom } from "./paper-active-term";
import {
  injectStyles,
  renderIdle,
  renderLoading,
  renderSideCardAnalytics,
  renderStatusBar,
  renderWidget
} from "./ui";
import { attachCartAnchor } from "./schedule-ui";
import { enrollFailureText, enrollOne } from "../../enroll/register-button";
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

  // CAESAR's facts for the class each panel has shown, loaded once each;
  // `force` asks CAESAR again.
  private readonly caesarInfo = new Map<string, CaesarInfo>();
  private sheetCaesarInfo(source: AnalyticsModalSource, force = false): CaesarInfo {
    // One entry per class, whichever of its names asked.
    const key = classKey(source.key);
    const known = this.caesarInfo.get(key);
    if (known && !force) return known;
    if (known?.loading) return known;
    const settle = (info: CaesarInfo) => {
      this.caesarInfo.set(key, info);
      if (this.modal?.isOpen()) this.modal.sync(document);
      this.sideCard?.syncSideCard(document);
    };
    if (!psCreditPool.tryConsume("paper-ctec-class-info").allowed) {
      const stopped = { ...known, loading: false, error: "Too many CAESAR requests for now. Try again shortly." };
      this.caesarInfo.set(key, stopped);
      return stopped;
    }
    // A refresh keeps the last answer on screen while the new one loads.
    const loading = { ...known, loading: true };
    this.caesarInfo.set(key, loading);
    void loadChipClassDetails(this.authRecovery, source, force).then((answer) =>
      settle(
        answer.ok
          ? { loading: false, details: answer.details, fetchedAt: answer.fetchedAt }
          : { ...known, loading: false, error: answer.error }
      )
    );
    return loading;
  }

  // The panel's foot button: add to cart, then register. `note` is only
  // there when the state needs saying.
  private sheetCartAction(source: AnalyticsModalSource): CartAction {
    const { state, kick } = this.chipCart.actionFor({ key: source.key, params: source.params, titleHint: source.titleHint });
    const at = (note: string | null, label: string | null, busy = false) => ({ note, label, busy, onClick: kick });
    if (state.kind === "adding") return at(null, state.message || "Adding…", true);
    if (state.kind === "already" || state.kind === "success") return at("In your cart", "Register");
    if (state.kind === "confirm") return at("This enrolls you in CAESAR", "Confirm: enroll me");
    if (state.kind === "enrolled") return at("You’re enrolled", null);
    if (state.kind === "error") return at(state.message, "Retry");
    return at(null, "Add to cart");
  }

  // The seats-and-register bar under Paper.nu's own tab.
  private renderPanelFoot(context: PaperCtecSideCardContext, host: HTMLElement): void {
    render(
      html`<div class="bc-sheet bc-sheet--inline">${renderFoot(this.sheetCartAction(context), this.sheetCaesarInfo(context))}</div>`,
      host
    );
  }

  // The CAESAR tab of Paper.nu's Section Info panel.
  private renderCaesarTab(context: PaperCtecSideCardContext, host: HTMLElement): void {
    const info = this.sheetCaesarInfo(context);
    const where = [
      readActiveTermNameFromDom(document),
      [context.component, context.section].filter(Boolean).join(" "),
      context.instructorName
    ].filter(Boolean);
    render(
      html`<div class="bc-sheet bc-sheet--inline">
        <header class="bc-sheet-top">
          <div class="bc-sheet-top-line">
            <span class="bc-sheet-code">${context.params.subject} ${context.params.catalogNumber}</span>
          </div>
          <h2 class="bc-sheet-title">${context.titleHint}</h2>
          <p class="bc-sheet-meta">${where.join(" · ")}</p>
        </header>
        <div class="bc-sheet-body">${renderCaesarBody(info, () => void this.sheetCaesarInfo(context, true))}</div>
        ${renderFoot(this.sheetCartAction(context), info)}
      </div>`,
      host
    );
  }

  constructor() {
    void initCartCache();

    this.chipCart = createChipCartCoordinator({
      psCreditPool,
      showToast,
      addChipSectionToCart: (params, titleHint, onProgress) =>
        addChipSectionToCart(this.authRecovery, params, titleHint, onProgress),
      resolveChipSection,
      enrollClass: enrollOne,
      enrollFailureText,
      lookupBySignature,
      recordOptimisticAdd,
      subscribeCartCache,
      attachToWidgets: (key, state, onClick) => {
        for (const widget of findWidgetsByKey(document, key)) {
          attachCartAnchor(widget, state, onClick);
        }
        // The open panel shows the same state at its foot.
        if (this.modal?.isOpen()) this.modal.sync(document);
        this.sideCard?.syncSideCard(document);
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
      openAnalyticsModal: (source) => this.sideCard.openAnalytics(source),
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
      renderSideCardAnalytics,
      renderCaesarTab: (context, host) => this.renderCaesarTab(context, host),
      renderPanelFoot: (context, host) => this.renderPanelFoot(context, host),
      // Opening a class loads CAESAR's page for it: seats and facts together.
      onClassOpened: (context) => void this.sheetCaesarInfo(context),
      findCard: (key) =>
        findWidgetsByKey(document, key)[0]?.closest<HTMLElement>(
          PAPER_CTEC_CONFIG.selectors.scheduleCard
        ) ?? null
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
        cartAction: (source) => this.sheetCartAction(source),
        caesarInfo: (source) => this.sheetCaesarInfo(source),
        caesarRefresh: (source) => void this.sheetCaesarInfo(source, true),
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

    // Swap grid-card last names for the enriched full name so cache reads
    // match what the fetch wrote. `key` stays on the raw label so chip
    // identity is stable across the async enrichment landing.
    const targets = collectScheduleTargets(doc).map((target) => ({
      ...target,
      params: peekEnrichedParams(target.params, doc, () => this.scheduleRerun())
    }));
    this.chipFetch.syncTargets(targets);
    this.statusBar.syncStatusBar(doc);
    this.sideCard.syncSideCard(doc);
    this.modal.sync(doc);
  }

  // Coalesces enrichment-driven re-renders: a schedule full of cards
  // resolving at once triggers one run, not one per card.
  private rerunScheduled = false;

  private scheduleRerun(): void {
    if (this.rerunScheduled) return;
    this.rerunScheduled = true;
    requestAnimationFrame(() => {
      this.rerunScheduled = false;
      if (isFeatureEnabled(this.id)) this.run(document);
    });
  }

  cleanup(doc: Document = document): void {
    // Clear in-memory state so a re-enable doesn't carry stale chip data
    // forward without verifying the underlying cache is still valid.
    this.chipFetch.stop();
    this.chipCart.stop();
    this.caesarInfo.clear();
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
