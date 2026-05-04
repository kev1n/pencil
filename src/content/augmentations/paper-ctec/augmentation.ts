import type { Augmentation } from "../../framework";
import { getRecentAggregationTerms, isFeatureEnabled } from "../../settings";
import {
  buildCtecCreditToastMessage,
  CTEC_ERROR_TOAST_MESSAGE,
  tryConsumeCtecCredit
} from "../ctec-links/rate-limit";
import {
  fetchCtecReportAggregate,
  getCachedReportAggregate,
  getCtecCourseAnalyticsSnapshot,
  hasCachedReportAggregate
} from "../ctec-links/reports";
import { showToast } from "../seats-notes/toast";
import { AuthFlow } from "./auth-flow";
import { buildModalDisplayData, type ModalDisplayData } from "./modal-data";
import { PAPER_CTEC_CONFIG } from "./config";
import {
  ANALYTICS_MODAL_ID,
  AUTH_MODAL_ID,
  CARD_BORDER_ON_HOVER_FEATURE_ID,
  NO_HOVER_LIFT_CLASS,
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_TABS_CLASS,
  STATUS_BAR_ID,
  STYLE_ID,
  WIDGET_CLASS
} from "./constants";
import {
  collectScheduleTargets,
  extractSideCardContext,
  teardownCardForCleanup
} from "./dom";
import { ModalController } from "./modal-controller";
import { buildStatusBarData, clearAuthRequiredStates } from "./session";
import type {
  AnalyticsModalSource,
  PaperCtecAnalyticsState,
  PaperCtecTarget,
  PaperCtecWidgetData
} from "./types";
import {
  injectStyles,
  renderIdle,
  renderLoading,
  renderSideCardAnalytics,
  renderStatusBar,
  renderWidget
} from "./ui";
import { addChipSectionToCart } from "./cart-flow";
import { attachCartAnchor, type CartAnchorState } from "./schedule-ui";

const CART_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A";
const CART_SUCCESS_RESET_MS = 10_000;

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

// Top-level orchestration for the paper.nu augmentation. Owns the schedule-
// card widget state (front-page CTEC summaries) and the side-card / status-
// bar lifecycle. Modal lifecycle is delegated to ModalController, which
// shares a few maps with us via the constructor: front-page widget state
// flows into the modal as auth-required/not-found mirroring, and a
// successful background refresh flows back into the schedule chip via
// renderForKey.
export class PaperCtecAugmentation implements Augmentation {
  readonly id = "paper-ctec";

  private readonly inFlight = new Map<string, Promise<PaperCtecWidgetData>>();
  private readonly resolved = new Map<string, PaperCtecWidgetData>();
  private readonly analyticsResolved = new Map<string, PaperCtecAnalyticsState>();
  // Owned here (not on the controller) because syncStatusBar needs to count
  // active analytics fetches alongside front-page fetches. Shared by reference
  // with the modal controller, which writes to it.
  private readonly analyticsInFlight = new Map<string, Promise<PaperCtecAnalyticsState>>();
  private readonly loadingMessages = new Map<
    string,
    { message: string; updatedAt: number }
  >();
  // Keys the user has explicitly asked to load (clicked "Load CTEC" on the
  // schedule chip). Survives invalidateAndRerun so the fetch resumes
  // automatically after a login retry without requiring another click.
  private readonly userActivated = new Set<string>();

  private visibleKeys = new Set<string>();
  private readonly selectedTabs = new Map<string, "paper" | "analytics">();

  // Per-card "+ Cart" button state. Persists across the framework's
  // per-mutation re-renders so the user sees mid-flight progress and the
  // success/error result. Success/already entries auto-reset to idle after
  // CART_SUCCESS_RESET_MS; errors stay sticky so the user sees what
  // happened until they retry.
  private readonly cartStates = new Map<string, CartAnchorState>();
  private readonly cartInFlight = new Set<string>();
  private readonly cartResetTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Per-key snapshot of the data needed to open the modal. syncTargets
  // populates this from currently-visible targets so renderForKey /
  // renderLoadingForKey can wire the analytics-button callback even when
  // they don't have direct access to a PaperCtecTarget.
  private readonly targetSources = new Map<string, AnalyticsModalSource>();

  private focusListenerAttached = false;
  private syncingStatusBar = false;
  private readonly auth?: AuthFlow;
  private readonly modal: ModalController;

  constructor() {
    if (isPaperHost()) {
      this.auth = new AuthFlow({
        onInvalidate: (doc) => this.invalidateAndRerun(doc)
      });
    }

    this.modal = new ModalController(
      {
        resolved: this.resolved,
        inFlight: this.inFlight,
        analyticsResolved: this.analyticsResolved,
        analyticsInFlight: this.analyticsInFlight,
        loadingMessages: this.loadingMessages
      },
      {
        generation: () => this.generation(),
        isAwaitingRetry: () => this.auth?.isAwaitingRetry() ?? false,
        markAwaitingRetry: () => this.auth?.markAwaitingRetry(),
        setProgress: (key, message) => this.setProgress(key, message),
        syncStatusBar: () => this.syncStatusBar(document),
        syncSideCard: () => this.syncSideCard(document),
        renderForKey: (key, data) => this.renderForKey(key, data)
      }
    );
  }

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;

    injectStyles();
    this.ensureFocusRetry();
    this.syncCardHoverStyle(doc);

    const targets = collectScheduleTargets(doc);
    this.visibleKeys = new Set(targets.map((target) => target.key));

    this.syncTargets(targets);
    this.syncStatusBar(doc);
    this.syncSideCard(doc);
    this.modal.sync(doc);
  }

  cleanup(doc: Document = document): void {
    // Clear in-memory state so a re-enable doesn't carry stale chip data
    // forward without verifying the underlying cache is still valid.
    this.inFlight.clear();
    this.resolved.clear();
    this.analyticsResolved.clear();
    this.analyticsInFlight.clear();
    this.loadingMessages.clear();
    this.userActivated.clear();
    this.visibleKeys.clear();
    this.selectedTabs.clear();
    this.cartStates.clear();
    this.cartInFlight.clear();
    for (const timer of this.cartResetTimers.values()) clearTimeout(timer);
    this.cartResetTimers.clear();
    this.targetSources.clear();
    this.modal.invalidate();

    // Per-card teardown: widgets, anchors, hover preview, dense-card flatten.
    for (const card of Array.from(
      doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.scheduleCard)
    )) {
      teardownCardForCleanup(card);
    }

    // Strip lingering widget/anchor/preview nodes that aren't anchored to a
    // card we currently see (e.g. cards that were unmounted between renders).
    for (const orphan of Array.from(
      doc.querySelectorAll<HTMLElement>(
        `.${WIDGET_CLASS}, .${WIDGET_CLASS}-actions-anchor, .${WIDGET_CLASS}-preview`
      )
    )) {
      orphan.remove();
    }

    // Schedule grid hover-lift override.
    for (const grid of Array.from(
      doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.scheduleGrid)
    )) {
      grid.classList.remove(NO_HOVER_LIFT_CLASS);
    }

    // Side panel: drop our tabs + analytics panel and unhide any paper.nu
    // children that were hidden while the Analytics tab was active.
    for (const panel of Array.from(
      doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardPanel)
    )) {
      panel.querySelector<HTMLElement>(`.${SIDECARD_TABS_CLASS}`)?.remove();
      panel.querySelector<HTMLElement>(`.${SIDECARD_ANALYTICS_PANEL_CLASS}`)?.remove();
      for (const child of Array.from(panel.children)) {
        if (child instanceof HTMLElement && child.hidden) child.hidden = false;
      }
    }

    doc.getElementById(STATUS_BAR_ID)?.remove();
    doc.getElementById(AUTH_MODAL_ID)?.remove();
    doc.getElementById(ANALYTICS_MODAL_ID)?.remove();
    doc.getElementById(STYLE_ID)?.remove();
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
    clearAuthRequiredStates(this.resolved, this.analyticsResolved);
    this.inFlight.clear();
    this.modal.invalidate();
    this.loadingMessages.clear();
    this.run(doc);
  }

  private syncTargets(targets: PaperCtecTarget[]): void {
    for (const target of targets) {
      target.widget.dataset.bcPaperCtecKey = target.key;
      const source: AnalyticsModalSource = {
        key: target.key,
        params: target.params,
        titleHint: target.titleHint
      };
      this.targetSources.set(target.key, source);
      const openAnalytics = () => this.modal.openModal(source);

      // Independent of CTEC fetch state — always render the cart button so
      // the user can add to cart without ever loading CTECs first. Skip
      // user-created custom sections (paper.nu marks them with a dashed
      // border): they have no instructor to disambiguate against and don't
      // correspond to anything in CAESAR.
      if (!isCustomScheduleCard(target.card)) {
        attachCartAnchor(
          target.widget,
          this.cartStates.get(target.key) ?? { kind: "idle" },
          () => this.kickChipCart(target)
        );
      }

      const getPreviewData = this.previewDataCallbackFor(target.key);

      const resolved = this.resolved.get(target.key);
      if (resolved) {
        renderWidget(
          target.widget,
          resolved,
          () => this.openAuthModal(),
          openAnalytics,
          getPreviewData
        );
        continue;
      }

      if (this.inFlight.has(target.key)) {
        if (!target.widget.textContent?.trim()) {
          renderLoading(target.widget, "CTEC…", openAnalytics);
        }
        continue;
      }

      // Sync cache hit: render without touching the network. This covers
      // repeat visits where the subject index already has parsed reports
      // for the recent terms.
      const cachedAggregate = getCachedReportAggregate(
        target.params,
        target.titleHint,
        getRecentAggregationTerms()
      );
      if (cachedAggregate) {
        const widgetData: PaperCtecWidgetData = {
          state: "found",
          aggregate: cachedAggregate
        };
        this.resolved.set(target.key, widgetData);
        renderWidget(
          target.widget,
          widgetData,
          () => this.openAuthModal(),
          openAnalytics,
          getPreviewData
        );
        continue;
      }

      // User previously clicked "Load CTEC" on this card and the fetch was
      // interrupted (e.g. auth-required → invalidateAndRerun). Resume.
      if (this.userActivated.has(target.key)) {
        this.kickTargetFetch(target);
        continue;
      }

      // Not cached — wait for an explicit user click before hitting CAESAR.
      // No Analytics button until the user actually loads CTECs.
      renderIdle(target.widget, () => this.kickTargetFetch(target));
    }
  }

  private kickTargetFetch(target: PaperCtecTarget): void {
    if (this.inFlight.has(target.key)) return;
    if (this.resolved.has(target.key)) return;

    const credit = tryConsumeCtecCredit(Date.now());
    if (!credit.ok) {
      showToast(buildCtecCreditToastMessage(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

    this.userActivated.add(target.key);

    this.setProgress(target.key, "Connecting to Northwestern CTEC…");
    renderLoading(target.widget);

    const jobGeneration = this.generation();
    const job = this.loadTarget(target);
    this.inFlight.set(target.key, job);
    void job.finally(() => {
      if (jobGeneration !== this.generation()) return;
      this.inFlight.delete(target.key);
      if (!this.modal.hasInFlight(target.key)) {
        this.loadingMessages.delete(target.key);
      }
      this.syncStatusBar(document);
      this.syncSideCard(document);
      this.modal.sync(document);
    });
  }

  private async loadTarget(target: PaperCtecTarget): Promise<PaperCtecWidgetData> {
    const generation = this.generation();
    const isStale = () => generation !== this.generation();
    try {
      const data = await fetchCtecReportAggregate(
        target.params,
        target.titleHint,
        (message) => {
          if (isStale()) return;
          this.renderLoadingForKey(target.key, message);
        },
        {
          fetchLimit: PAPER_CTEC_CONFIG.aggregate.recentTerms,
          aggregateLimit: getRecentAggregationTerms()
        }
      );

      const widgetData: PaperCtecWidgetData =
        data.state === "found"
          ? { state: "found", aggregate: data.aggregate }
          : data;

      if (isStale()) return widgetData;
      this.resolved.set(target.key, widgetData);
      this.renderForKey(target.key, widgetData);
      if (widgetData.state === "error") {
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
      }
      return widgetData;
    } catch (error) {
      const widgetData: PaperCtecWidgetData = {
        state: "error",
        message: error instanceof Error ? error.message : String(error)
      };
      if (isStale()) return widgetData;
      this.resolved.set(target.key, widgetData);
      this.renderForKey(target.key, widgetData);
      showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
      return widgetData;
    }
  }

  private renderLoadingForKey(key: string, message: string): void {
    this.setProgress(key, message);
    const openAnalytics = this.openAnalyticsCallbackFor(key);
    for (const widget of this.findWidgetsByKey(document, key)) {
      renderLoading(widget, message, openAnalytics);
    }
  }

  private renderForKey(key: string, data: PaperCtecWidgetData): void {
    const openAnalytics = this.openAnalyticsCallbackFor(key);
    const getPreviewData = this.previewDataCallbackFor(key);
    for (const widget of this.findWidgetsByKey(document, key)) {
      renderWidget(
        widget,
        data,
        () => this.openAuthModal(),
        openAnalytics,
        getPreviewData
      );
    }
    this.syncStatusBar(document);
    this.syncSideCard(document);
    this.modal.sync(document);
  }

  private openAnalyticsCallbackFor(key: string): (() => void) | undefined {
    const source = this.targetSources.get(key);
    if (!source) return undefined;
    return () => this.modal.openModal(source);
  }

  // Lazy snapshot reader for the schedule-chip hover preview. Reads from
  // the in-memory subject index — no network — and converts to ModalDisplayData
  // so the popup can reuse the modal's hours-density renderer. Returns null
  // when nothing usable is cached yet (e.g. the chip is showing a stale
  // aggregate but the index has been wiped).
  private previewDataCallbackFor(
    key: string
  ): (() => ModalDisplayData | null) | undefined {
    const source = this.targetSources.get(key);
    if (!source) return undefined;
    return () => {
      const snapshot = getCtecCourseAnalyticsSnapshot(
        source.params,
        source.titleHint,
        PAPER_CTEC_CONFIG.aggregate.recentTerms
      );
      if (!snapshot || snapshot.entries.length === 0) return null;
      return buildModalDisplayData(snapshot, source.params, source.titleHint);
    };
  }

  private findWidgetsByKey(doc: Document, key: string): HTMLElement[] {
    return Array.from(
      doc.querySelectorAll<HTMLElement>(
        `.${WIDGET_CLASS}[data-bc-paper-ctec-key="${CSS.escape(key)}"]`
      )
    );
  }

  // Re-entrancy guard: status-bar / modal renders mutate document.body,
  // which can trip listeners (paper.nu's React tree, our own focus retry,
  // third-party extensions) into firing synchronous callbacks back into the
  // augmentation. Without this guard those rare loops blow the stack.
  private syncStatusBar(doc: Document): void {
    if (this.syncingStatusBar) return;
    this.syncingStatusBar = true;
    try {
      const status = buildStatusBarData({
        visibleKeys: this.visibleKeys,
        resolved: this.resolved,
        analyticsResolved: this.analyticsResolved,
        inFlight: this.inFlight,
        analyticsInFlight: this.analyticsInFlight,
        loadingMessages: this.loadingMessages,
        awaitingAuthRetry: this.auth?.isAwaitingRetry() ?? false
      });
      if (status) renderStatusBar(doc, status);
      this.auth?.syncFromStatus(doc, status);
    } finally {
      this.syncingStatusBar = false;
    }
  }

  private openAuthModal(): void {
    if (!this.auth) return;
    this.auth.openManually();
    this.syncStatusBar(document);
  }

  private generation(): number {
    return this.auth?.getGeneration() ?? 0;
  }

  private syncSideCard(doc: Document): void {
    const context = extractSideCardContext(doc);
    if (!context) return;

    this.modal.mirrorFrontPageState(context);
    this.modal.resumeIfNeeded(context);

    const analyticsAvailable =
      this.userActivated.has(context.key) ||
      this.resolved.has(context.key) ||
      this.inFlight.has(context.key) ||
      hasCachedReportAggregate(
        context.params,
        context.titleHint,
        getRecentAggregationTerms()
      );

    // Reset the selected tab back to "paper" if Analytics is no longer
    // surfaced — otherwise a stale "analytics" choice would leave the panel
    // in an empty state.
    const requestedTab = this.selectedTabs.get(context.key) ?? "paper";
    const selectedTab = analyticsAvailable ? requestedTab : "paper";

    renderSideCardAnalytics(
      context,
      { selectedTab, analyticsAvailable },
      (tab) => {
        this.selectedTabs.set(context.key, tab);
        // Selecting the CTEC Analytics tab opens the modal. The side panel
        // itself just hosts a launcher button now — all rich content lives
        // in the modal.
        if (tab === "analytics") {
          this.modal.openModal(context);
        }
        this.syncSideCard(document);
      },
      () => {
        this.modal.openModal(context);
      }
    );
  }

  private kickChipCart(target: PaperCtecTarget): void {
    const key = target.key;
    if (this.cartInFlight.has(key)) return;
    this.cartInFlight.add(key);
    this.clearCartResetTimer(key);
    this.setCartState(key, { kind: "adding", message: "Looking up section…" });

    void (async () => {
      const result = await addChipSectionToCart(
        target.params,
        target.titleHint,
        (message) => this.setCartState(key, { kind: "adding", message })
      );

      if (result.ok) {
        this.setCartState(key, {
          kind: "success",
          classNumber: result.classNumber
        });
        this.scheduleCartReset(key);
        showToast(
          `Added ${target.params.subject} ${target.params.catalogNumber} ${result.sectionLabel} (#${result.classNumber}) to your CAESAR shopping cart.`,
          {
            tone: "success",
            durationMs: 6000,
            action: { label: "View cart", run: () => window.open(CART_URL, "_blank") }
          }
        );
      } else if (result.alreadyInCart && result.classNumber) {
        this.setCartState(key, {
          kind: "already",
          classNumber: result.classNumber
        });
        this.scheduleCartReset(key);
        showToast(
          `${target.params.subject} ${target.params.catalogNumber} #${result.classNumber} is already in your CAESAR shopping cart.`,
          {
            tone: "info",
            durationMs: 5000,
            action: { label: "View cart", run: () => window.open(CART_URL, "_blank") }
          }
        );
      } else {
        this.setCartState(key, { kind: "error", message: result.error });
        showToast(`Couldn't add to cart: ${result.error}`, {
          tone: "error",
          durationMs: 7000
        });
      }

      this.cartInFlight.delete(key);
    })();
  }

  private setCartState(key: string, state: CartAnchorState): void {
    this.cartStates.set(key, state);
    for (const widget of this.findWidgetsByKey(document, key)) {
      const target = this.targetSources.get(key);
      if (!target) continue;
      // Re-attach with the latest state. We need a target ref to wire the
      // click handler; use the cached AnalyticsModalSource as a stand-in
      // since the click only needs the chip identity (subject + catalog +
      // instructor + topic), not the live PaperCtecTarget DOM node.
      attachCartAnchor(widget, state, () => this.kickChipCartFromSource(target));
    }
  }

  private kickChipCartFromSource(source: AnalyticsModalSource): void {
    // Reconstruct a minimal target — kickChipCart only reads target.key,
    // target.params, and target.titleHint, so we can synthesize one.
    this.kickChipCart({
      key: source.key,
      params: source.params,
      titleHint: source.titleHint,
      card: document.body, // unused by kickChipCart
      widget: document.body // unused by kickChipCart
    } as PaperCtecTarget);
  }

  private scheduleCartReset(key: string): void {
    this.clearCartResetTimer(key);
    const timer = setTimeout(() => {
      this.cartResetTimers.delete(key);
      this.cartStates.delete(key);
      for (const widget of this.findWidgetsByKey(document, key)) {
        const source = this.targetSources.get(key);
        if (!source) continue;
        attachCartAnchor(widget, { kind: "idle" }, () => this.kickChipCartFromSource(source));
      }
    }, CART_SUCCESS_RESET_MS);
    this.cartResetTimers.set(key, timer);
  }

  private clearCartResetTimer(key: string): void {
    const existing = this.cartResetTimers.get(key);
    if (existing) clearTimeout(existing);
    this.cartResetTimers.delete(key);
  }

  private setProgress(key: string, message: string): void {
    this.loadingMessages.set(key, { message, updatedAt: Date.now() });
    this.syncStatusBar(document);
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
