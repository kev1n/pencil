import type { Augmentation } from "../../framework";
import { isFeatureEnabled } from "../../settings";
import { clearCtecCacheForCourse } from "../ctec-links/fetcher";
import {
  fetchCtecCourseAnalytics,
  fetchCtecReportAggregate,
  getCachedReportAggregate,
  getCtecCourseAnalyticsSnapshot
} from "../ctec-links/reports";
import { AuthFlow } from "./auth-flow";
import { PAPER_CTEC_CONFIG } from "./config";
import {
  CARD_BORDER_ON_HOVER_FEATURE_ID,
  NO_HOVER_LIFT_CLASS,
  WIDGET_CLASS
} from "./constants";
import {
  collectScheduleTargets,
  extractSideCardContext,
  readSideCardCommentQuery
} from "./dom";
import {
  buildStatusBarData,
  captureCommentQuery,
  clearAuthRequiredStates,
  resolveSelectedEntryId,
  toggleExpandedChart
} from "./session";
import type {
  PaperCtecAnalyticsState,
  PaperCtecSideCardContext,
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

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

export class PaperCtecAugmentation implements Augmentation {
  readonly id = "paper-ctec";

  private readonly inFlight = new Map<string, Promise<PaperCtecWidgetData>>();
  private readonly resolved = new Map<string, PaperCtecWidgetData>();
  private readonly analyticsInFlight = new Map<string, Promise<PaperCtecAnalyticsState>>();
  private readonly analyticsResolved = new Map<string, PaperCtecAnalyticsState>();
  private readonly loadingMessages = new Map<string, { message: string; updatedAt: number }>();
  // Keys the user has explicitly asked to load (clicked "Load CTEC" on the
  // schedule chip). Survives invalidateAndRerun so the fetch resumes
  // automatically after a login retry without requiring another click.
  private readonly userActivated = new Set<string>();
  // Per-key target count for the side-card analytics. Each user click on
  // "Load 3 more terms" bumps this by recentTerms; the next fetch uses it as
  // the fetchLimit so we only pull the next batch.
  private readonly analyticsTargetCount = new Map<string, number>();

  private visibleKeys = new Set<string>();
  private readonly selectedTabs = new Map<string, "paper" | "analytics">();
  private readonly selectedAnalyticsEntries = new Map<string, string>();
  private readonly expandedCharts = new Map<string, Set<string>>();
  private readonly commentQueries = new Map<string, string>();

  private focusListenerAttached = false;
  private syncingStatusBar = false;
  private readonly auth?: AuthFlow;

  constructor() {
    if (!isPaperHost()) return;
    this.auth = new AuthFlow({
      onInvalidate: (doc) => this.invalidateAndRerun(doc)
    });
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
    this.analyticsInFlight.clear();
    this.loadingMessages.clear();
    this.run(doc);
  }

  private syncTargets(targets: PaperCtecTarget[]): void {
    for (const target of targets) {
      target.widget.dataset.bcPaperCtecKey = target.key;

      const resolved = this.resolved.get(target.key);
      if (resolved) {
        renderWidget(target.widget, resolved, () => this.openAuthModal());
        continue;
      }

      if (this.inFlight.has(target.key)) {
        if (!target.widget.textContent?.trim()) {
          renderLoading(target.widget);
        }
        continue;
      }

      // Sync cache hit: render without touching the network. This covers
      // repeat visits where the subject index already has parsed reports for
      // the recent terms.
      const cachedAggregate = getCachedReportAggregate(
        target.params,
        target.titleHint,
        PAPER_CTEC_CONFIG.aggregate.recentTerms
      );
      if (cachedAggregate) {
        const widgetData: PaperCtecWidgetData = {
          state: "found",
          aggregate: cachedAggregate
        };
        this.resolved.set(target.key, widgetData);
        renderWidget(target.widget, widgetData, () => this.openAuthModal());
        continue;
      }

      // User previously clicked "Load CTEC" on this card and the fetch was
      // interrupted (e.g. auth-required → invalidateAndRerun). Resume.
      if (this.userActivated.has(target.key)) {
        this.kickTargetFetch(target);
        continue;
      }

      // Not cached — wait for an explicit user click before hitting CAESAR.
      renderIdle(target.widget, () => this.kickTargetFetch(target));
    }
  }

  private kickTargetFetch(target: PaperCtecTarget): void {
    if (this.inFlight.has(target.key)) return;
    if (this.resolved.has(target.key)) return;
    this.userActivated.add(target.key);

    this.setProgress(target.key, "Connecting to Northwestern CTEC…");
    renderLoading(target.widget);

    const jobGeneration = this.generation();
    const job = this.loadTarget(target);
    this.inFlight.set(target.key, job);
    void job.finally(() => {
      if (jobGeneration !== this.generation()) return;
      this.inFlight.delete(target.key);
      if (!this.analyticsInFlight.has(target.key)) {
        this.loadingMessages.delete(target.key);
      }
      this.syncStatusBar(document);
      this.syncSideCard(document);
    });
  }

  private async loadTarget(target: PaperCtecTarget): Promise<PaperCtecWidgetData> {
    const generation = this.generation();
    const isStale = () => generation !== (this.generation());
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
          aggregateLimit: PAPER_CTEC_CONFIG.aggregate.recentTerms
        }
      );

      const widgetData: PaperCtecWidgetData =
        data.state === "found"
          ? { state: "found", aggregate: data.aggregate }
          : data;

      if (isStale()) return widgetData;
      this.resolved.set(target.key, widgetData);
      this.renderForKey(target.key, widgetData);
      return widgetData;
    } catch (error) {
      const widgetData: PaperCtecWidgetData = {
        state: "error",
        message: error instanceof Error ? error.message : String(error)
      };
      if (isStale()) return widgetData;
      this.resolved.set(target.key, widgetData);
      this.renderForKey(target.key, widgetData);
      return widgetData;
    }
  }

  private renderLoadingForKey(key: string, message: string): void {
    this.setProgress(key, message);
    for (const widget of this.findWidgetsByKey(document, key)) {
      renderLoading(widget, message);
    }
  }

  private renderForKey(key: string, data: PaperCtecWidgetData): void {
    for (const widget of this.findWidgetsByKey(document, key)) {
      renderWidget(widget, data, () => this.openAuthModal());
    }
    this.syncStatusBar(document);
    this.syncSideCard(document);
  }

  private findWidgetsByKey(doc: Document, key: string): HTMLElement[] {
    return Array.from(
      doc.querySelectorAll<HTMLElement>(
        `.${WIDGET_CLASS}[data-bc-paper-ctec-key="${CSS.escape(key)}"]`
      )
    );
  }

  // Re-entrancy guard: status-bar / modal renders mutate document.body, which
  // can trip listeners (paper.nu's React tree, our own focus retry, third-
  // party extensions) into firing synchronous callbacks back into the
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

    captureCommentQuery(
      this.commentQueries,
      context.key,
      readSideCardCommentQuery(context)
    );
    this.mirrorFrontPageStateForAnalytics(context);

    // Resume an in-progress batch after a login retry: if the user previously
    // asked for a batch and we haven't reached that target yet, kick again.
    const previousTarget = this.analyticsTargetCount.get(context.key);
    if (
      previousTarget !== undefined &&
      !this.analyticsInFlight.has(context.key) &&
      this.analyticsResolved.get(context.key)?.state !== "auth-required" &&
      this.analyticsResolved.get(context.key)?.state !== "not-found"
    ) {
      const resumeSnapshot = getCtecCourseAnalyticsSnapshot(
        context.params,
        context.titleHint,
        PAPER_CTEC_CONFIG.aggregate.recentTerms
      );
      if (countParsedEntries(resumeSnapshot) < previousTarget) {
        this.kickAnalyticsBatch(context, /* increment */ false);
      }
    }

    const snapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    const analyticsState = this.analyticsResolved.get(context.key);
    const parsedCount = countParsedEntries(snapshot);
    const totalEntries = snapshot?.entries.length ?? 0;
    const loading = this.analyticsInFlight.has(context.key);
    const canLoadMore =
      !loading &&
      totalEntries > parsedCount &&
      !analyticsState?.state?.startsWith("auth") &&
      analyticsState?.state !== "not-found";

    renderSideCardAnalytics(
      context,
      {
        selectedTab: this.selectedTabs.get(context.key) ?? "paper",
        selectedEntryId: resolveSelectedEntryId(
          this.selectedAnalyticsEntries,
          context.key,
          snapshot
        ),
        recentTerms: PAPER_CTEC_CONFIG.aggregate.recentTerms,
        snapshot,
        loading,
        expandedChartKeys: Array.from(this.expandedCharts.get(context.key) ?? []),
        commentQuery: this.commentQueries.get(context.key) ?? "",
        authUrl: analyticsState?.state === "auth-required" ? analyticsState.loginUrl : undefined,
        awaitingAuthRetry: this.auth?.isAwaitingRetry() ?? false,
        errorMessage: analyticsState?.state === "error" ? analyticsState.message : undefined,
        canLoadMoreTerms: canLoadMore,
        loadMoreBatchSize: PAPER_CTEC_CONFIG.aggregate.recentTerms,
        remainingTerms: Math.max(0, totalEntries - parsedCount),
        parsedTermCount: parsedCount,
        notFound: analyticsState?.state === "not-found"
      },
      (tab) => {
        this.selectedTabs.set(context.key, tab);
        this.syncSideCard(document);
      },
      (entryId) => {
        this.selectedAnalyticsEntries.set(context.key, entryId);
        this.syncSideCard(document);
      },
      (chartKey) => {
        toggleExpandedChart(this.expandedCharts, context.key, chartKey);
        this.syncSideCard(document);
      },
      () => {
        this.auth?.markAwaitingRetry();
      },
      () => {
        this.kickAnalyticsBatch(context);
      },
      () => {
        this.kickAnalyticsRefresh(context);
      }
    );
  }

  // Mirror terminal front-page state (auth-required / not-found) onto the
  // analytics state map so the side card can show the right callout without
  // doing its own fetch. Pure derivation — no network.
  private mirrorFrontPageStateForAnalytics(context: PaperCtecSideCardContext): void {
    const existingState = this.analyticsResolved.get(context.key);
    if (existingState && existingState.state !== "found") return;

    const frontPageState = this.resolved.get(context.key);
    if (frontPageState?.state === "not-found") {
      this.analyticsResolved.set(context.key, { state: "not-found" });
      return;
    }
    if (frontPageState?.state === "auth-required") {
      this.analyticsResolved.set(context.key, {
        state: "auth-required",
        loginUrl: frontPageState.loginUrl
      });
    }
  }

  // Fetches the next batch of recentTerms-sized term reports for this course.
  // Each user-initiated call bumps the per-key target count so the underlying
  // fetchLimit grows by recentTerms — pulling exactly the next batch of
  // unparsed entries. `increment=false` is used to resume an interrupted
  // batch (e.g. after a login retry) without bumping the target.
  private kickAnalyticsBatch(
    context: PaperCtecSideCardContext,
    increment = true
  ): void {
    if (this.analyticsInFlight.has(context.key)) return;

    const batchSize = PAPER_CTEC_CONFIG.aggregate.recentTerms;
    const snapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      batchSize
    );
    const parsedCount = countParsedEntries(snapshot);
    const previousTarget = this.analyticsTargetCount.get(context.key) ?? parsedCount;
    const nextTarget = increment
      ? Math.max(previousTarget, parsedCount) + batchSize
      : Math.max(previousTarget, parsedCount + batchSize);
    this.analyticsTargetCount.set(context.key, nextTarget);

    const start = async (): Promise<PaperCtecAnalyticsState> => {
      const currentFrontPageJob = this.inFlight.get(context.key);
      if (currentFrontPageJob) {
        await currentFrontPageJob.catch(() => undefined);
      }

      const result = await fetchCtecCourseAnalytics(
        context.params,
        context.titleHint,
        PAPER_CTEC_CONFIG.aggregate.recentTerms,
        (message) => {
          this.setProgress(context.key, `Loading term history… ${message}`);
        },
        nextTarget
      );

      return result.state === "found"
        ? { state: "found", analytics: result.analytics }
        : result;
    };

    const generation = this.generation();
    const isStale = () => generation !== (this.generation());
    const job = start()
      .then((state) => {
        if (isStale()) return state;
        this.analyticsResolved.set(context.key, state);
        return state;
      })
      .catch((error) => {
        const state: PaperCtecAnalyticsState = {
          state: "error",
          message: error instanceof Error ? error.message : String(error)
        };
        if (isStale()) return state;
        this.analyticsResolved.set(context.key, state);
        return state;
      })
      .finally(() => {
        this.analyticsInFlight.delete(context.key);
        if (!this.inFlight.has(context.key)) {
          this.loadingMessages.delete(context.key);
        }
        if (isStale()) return;
        this.syncStatusBar(document);
        this.syncSideCard(document);
      });

    this.analyticsInFlight.set(context.key, job);
  }

  // Drops the cached entries for this course (subject + catalog + instructor)
  // and re-fetches up to the user's previously-loaded depth. This is the only
  // path that re-checks Northwestern for newly-published evaluations after a
  // course has already been loaded once — useful when a recent term's CTECs
  // become available weeks after the term ended.
  private kickAnalyticsRefresh(context: PaperCtecSideCardContext): void {
    if (this.analyticsInFlight.has(context.key)) return;

    const previousSnapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    const previousParsed = countParsedEntries(previousSnapshot);
    const previousTarget = this.analyticsTargetCount.get(context.key) ?? previousParsed;
    const refreshTarget = Math.max(previousTarget, PAPER_CTEC_CONFIG.aggregate.recentTerms);

    clearCtecCacheForCourse(
      context.params.subject,
      context.params.catalogNumber,
      context.params.instructor
    );

    // Drop the resolved/derived state so the schedule chip and side card both
    // re-fetch on the next sync cycle.
    this.resolved.delete(context.key);
    this.analyticsResolved.delete(context.key);
    this.analyticsTargetCount.set(context.key, refreshTarget);

    // Forces the schedule chip to re-fetch on its next syncTargets pass
    // (alongside the analytics batch we kick off below).
    this.userActivated.add(context.key);

    this.kickAnalyticsBatch(context, /* increment */ false);
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

function countParsedEntries(
  snapshot: ReturnType<typeof getCtecCourseAnalyticsSnapshot>
): number {
  if (!snapshot) return 0;
  return snapshot.entries.filter((entry) => entry.status === "ready" || entry.status === "unavailable").length;
}
