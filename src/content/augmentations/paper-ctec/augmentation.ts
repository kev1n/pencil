import type { Augmentation } from "../../framework";
import {
  fetchCtecCourseAnalytics,
  fetchCtecReportAggregate,
  getCtecCourseAnalyticsSnapshot
} from "../ctec-links/reports";
import { AuthFlow } from "./auth-flow";
import { PAPER_CTEC_CONFIG } from "./config";
import { WIDGET_CLASS } from "./constants";
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

  private visibleKeys = new Set<string>();
  private readonly selectedTabs = new Map<string, "paper" | "analytics">();
  private readonly selectedAnalyticsEntries = new Map<string, string>();
  private readonly expandedCharts = new Map<string, Set<string>>();
  private readonly commentQueries = new Map<string, string>();

  private focusListenerAttached = false;
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

      if (!this.inFlight.has(target.key)) {
        this.setProgress(target.key, "Connecting to Northwestern CTEC…");
        renderLoading(target.widget);
        const jobGeneration = this.generation();
        const job = this.loadTarget(target);
        this.inFlight.set(target.key, job);
        void job.finally(() => {
          // Stale finally: the auth generation moved on so a newer job has
          // already replaced (or cleared) this entry — don't clobber it.
          if (jobGeneration !== (this.generation())) return;
          this.inFlight.delete(target.key);
          if (!this.analyticsInFlight.has(target.key)) {
            this.loadingMessages.delete(target.key);
          }
          this.syncStatusBar(document);
          this.syncSideCard(document);
        });
        continue;
      }

      if (!target.widget.textContent?.trim()) {
        renderLoading(target.widget);
      }
    }
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

  private syncStatusBar(doc: Document): void {
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
    this.ensureAnalyticsWarmFetch(context);

    const snapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    const analyticsState = this.analyticsResolved.get(context.key);

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
        loading: this.analyticsInFlight.has(context.key),
        expandedChartKeys: Array.from(this.expandedCharts.get(context.key) ?? []),
        commentQuery: this.commentQueries.get(context.key) ?? "",
        authUrl: analyticsState?.state === "auth-required" ? analyticsState.loginUrl : undefined,
        awaitingAuthRetry: this.auth?.isAwaitingRetry() ?? false,
        errorMessage: analyticsState?.state === "error" ? analyticsState.message : undefined
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
      }
    );
  }

  private ensureAnalyticsWarmFetch(context: PaperCtecSideCardContext): void {
    const existingState = this.analyticsResolved.get(context.key);
    if (existingState) {
      if (existingState.state === "found" && existingState.analytics.allFetched) return;
      if (existingState.state !== "found") return;
    }

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
      return;
    }

    const cached = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    if (cached?.allFetched) {
      this.analyticsResolved.set(context.key, { state: "found", analytics: cached });
      return;
    }

    if (this.analyticsInFlight.has(context.key)) return;

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
          this.setProgress(context.key, `Warming term history… ${message}`);
        }
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
