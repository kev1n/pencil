import type { Augmentation } from "../../framework";
import type {
  AuthPopupClosedMessage,
  OpenAuthPopupMessage,
  OpenAuthPopupResponse
} from "../../../shared/messages";
import {
  fetchCtecCourseAnalytics,
  fetchCtecReportAggregate,
  getCtecCourseAnalyticsSnapshot
} from "../ctec-links/reports";
import { PAPER_CTEC_CONFIG } from "./config";
import { WIDGET_CLASS } from "./constants";
import {
  collectScheduleTargets,
  extractSideCardContext,
  readSideCardCommentQuery
} from "./dom";
import { abortPeopleSoftTasks } from "../../peoplesoft/traffic";
import { REQUEST_OWNER as CTEC_LINKS_REQUEST_OWNER } from "../ctec-links/constants";
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
  hideAuthModal,
  hideStatusBar,
  injectStyles,
  renderAuthModal,
  renderLoading,
  renderSideCardAnalytics,
  renderStatusBar,
  renderWidget
} from "./ui";

const AUTH_MODAL_DISMISSED_STORAGE_KEY = "better-caesar:paper-ctec:auth-modal-dismissed";
const AUTH_PENDING_STORAGE_KEY = "better-caesar:paper-ctec:auth-pending";

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
  private awaitingAuthRetry = false;
  private focusListenerAttached = false;
  private popupListenerAttached = false;
  private authModalOpen = false;
  private authModalAutoShown = false;
  private authModalDismissed = false;
  private authPendingActive = false;
  private authStorageLoaded = false;
  private authGeneration = 0;

  constructor() {
    if (!isPaperHost()) return;

    this.attachPopupListener();
    void chrome.storage.local
      .get([AUTH_MODAL_DISMISSED_STORAGE_KEY, AUTH_PENDING_STORAGE_KEY])
      .then((result: Record<string, unknown>) => {
        this.authModalDismissed = result[AUTH_MODAL_DISMISSED_STORAGE_KEY] === true;
        if (result[AUTH_PENDING_STORAGE_KEY] === true) {
          this.authPendingActive = true;
          this.authModalOpen = true;
          this.authModalAutoShown = true;
          this.awaitingAuthRetry = true;
        }
        this.authStorageLoaded = true;
        this.run(document);
      });
  }

  private attachPopupListener(): void {
    if (this.popupListenerAttached) return;
    this.popupListenerAttached = true;
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (
        !message ||
        typeof message !== "object" ||
        (message as { type?: string }).type !== "auth-popup-closed"
      ) {
        return;
      }
      // Ignore stale/unexpected close events. If we weren't actively waiting for
      // a login, do nothing — let the existing focus retry handle anything new.
      if (!this.authPendingActive) return;

      const reason = (message as AuthPopupClosedMessage).reason;
      if (reason === "succeeded") {
        this.finalizeAuthSuccess(document);
      }
      // For "user-closed", leave pending in place — user can reopen via the modal.
    });
  }

  private finalizeAuthSuccess(doc: Document): void {
    // Bumping the generation invalidates any in-flight pre-login fetches —
    // their results will be dropped instead of repopulating `resolved` with
    // a stale auth-required state.
    this.authGeneration += 1;
    // Abort any pre-login PeopleSoft fetches still wedged in the global queue
    // so the new post-login fetches can actually start.
    abortPeopleSoftTasks(
      "Aborted because Northwestern login completed.",
      (task) => task.owner === CTEC_LINKS_REQUEST_OWNER
    );
    clearAuthRequiredStates(this.resolved, this.analyticsResolved);
    this.inFlight.clear();
    this.analyticsInFlight.clear();
    this.loadingMessages.clear();
    this.authPendingActive = false;
    this.awaitingAuthRetry = false;
    this.authModalOpen = false;
    this.setAuthPendingPersisted(false);
    // Intentionally NOT resetting authModalAutoShown / authModalDismissed.
    // If the silent refetch still returns auth-required (cookies not yet
    // propagated, etc.), the chip is the manual re-trigger — we don't want
    // the modal to auto-pop again right after the user just logged in.
    hideAuthModal(doc);
    hideStatusBar(doc);
    this.run(doc);
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
    const host = window.location.hostname;
    if (host !== "www.paper.nu" && host !== "paper.nu") return false;
    return !!doc.querySelector(PAPER_CTEC_CONFIG.selectors.scheduleGrid);
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
        const jobGeneration = this.authGeneration;
        const job = this.loadTarget(target);
        this.inFlight.set(target.key, job);
        void job.finally(() => {
          // If the auth generation has moved on, this job's tracking entry was
          // already replaced (or cleared) by a newer cycle. Don't clobber the
          // newer state — let the newer job's own finally clean up.
          if (jobGeneration !== this.authGeneration) return;
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
    const generation = this.authGeneration;
    try {
      const data = await fetchCtecReportAggregate(
        target.params,
        target.titleHint,
        (message) => {
          if (generation !== this.authGeneration) return;
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

      // Stale fetch from a previous auth generation — drop it. Otherwise an
      // in-flight pre-login fetch can repopulate `resolved` with auth-required
      // right after a successful login.
      if (generation !== this.authGeneration) {
        return widgetData;
      }

      this.resolved.set(target.key, widgetData);
      this.renderForKey(target.key, widgetData);
      return widgetData;
    } catch (error) {
      const widgetData: PaperCtecWidgetData = {
        state: "error",
        message: error instanceof Error ? error.message : String(error)
      };
      if (generation !== this.authGeneration) {
        return widgetData;
      }
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
      awaitingAuthRetry: this.awaitingAuthRetry
    });

    if (!status) {
      hideStatusBar(doc);
      if (!this.authPendingActive) {
        hideAuthModal(doc);
      } else {
        this.syncAuthModal(doc, undefined);
      }
      return;
    }

    renderStatusBar(doc, status);

    if (status.state === "auth-required") {
      if (
        this.authStorageLoaded &&
        !this.authModalAutoShown &&
        !this.authModalDismissed &&
        !this.authPendingActive
      ) {
        this.authModalAutoShown = true;
        this.authModalOpen = true;
      }
    } else if (status.state === "ready") {
      // Verified success — clear pending, close modal, allow future auto-shows.
      if (this.authPendingActive) {
        this.completeAuthPending();
      }
      this.authModalOpen = false;
      this.authModalAutoShown = false;
    } else if (!this.authPendingActive) {
      // Loading state with no pending — keep modal closed, don't change flags.
      this.authModalOpen = false;
    }
    // Loading state during pending: leave modal in pending mode untouched.

    this.syncAuthModal(doc, status.loginUrl);
  }

  private syncAuthModal(doc: Document, loginUrl: string | undefined): void {
    if (!this.authModalOpen && !this.authPendingActive) {
      hideAuthModal(doc);
      return;
    }

    renderAuthModal(
      doc,
      {
        loginUrl,
        awaitingAuthRetry: this.awaitingAuthRetry,
        pending: this.authPendingActive
      },
      {
        onLogin: () => this.startAuthPending(loginUrl),
        onDismiss: () => {
          this.authModalOpen = false;
          this.setAuthModalDismissed(true);
          hideAuthModal(doc);
        },
        onCancelPending: () => this.cancelAuthPending(doc)
      }
    );
  }

  private openAuthModal(): void {
    this.authModalOpen = true;
    this.authModalAutoShown = true;
    this.setAuthModalDismissed(false);
    this.syncStatusBar(document);
  }

  private startAuthPending(loginUrl: string | undefined): void {
    if (!loginUrl) return;

    const request: OpenAuthPopupMessage = { type: "open-auth-popup", loginUrl };
    void chrome.runtime
      .sendMessage(request)
      .then((response: OpenAuthPopupResponse | undefined) => {
        if (!response || !response.ok) {
          // Background couldn't open the tab — fall back so the user isn't stranded.
          window.open(loginUrl, "_blank");
        }
      })
      .catch(() => {
        window.open(loginUrl, "_blank");
      });

    this.authPendingActive = true;
    this.awaitingAuthRetry = true;
    this.authModalOpen = true;
    this.authModalAutoShown = true;
    this.setAuthModalDismissed(false);
    this.setAuthPendingPersisted(true);
    this.syncStatusBar(document);
  }

  private cancelAuthPending(doc: Document): void {
    this.authPendingActive = false;
    this.awaitingAuthRetry = false;
    this.authModalOpen = false;
    this.setAuthModalDismissed(true);
    this.setAuthPendingPersisted(false);
    hideAuthModal(doc);
  }

  private completeAuthPending(): void {
    this.authPendingActive = false;
    this.awaitingAuthRetry = false;
    this.setAuthPendingPersisted(false);
  }

  private setAuthPendingPersisted(value: boolean): void {
    void chrome.storage.local.set({ [AUTH_PENDING_STORAGE_KEY]: value });
  }

  private setAuthModalDismissed(value: boolean): void {
    this.authModalDismissed = value;
    void chrome.storage.local.set({ [AUTH_MODAL_DISMISSED_STORAGE_KEY]: value });
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
        awaitingAuthRetry: this.awaitingAuthRetry,
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
        this.awaitingAuthRetry = true;
      }
    );
  }

  private ensureAnalyticsWarmFetch(context: PaperCtecSideCardContext): void {
    const existingState = this.analyticsResolved.get(context.key);
    if (existingState) {
      if (existingState.state === "found" && existingState.analytics.allFetched) {
        return;
      }
      if (
        existingState.state === "not-found" ||
        existingState.state === "auth-required" ||
        existingState.state === "error"
      ) {
        return;
      }
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

    const generation = this.authGeneration;
    const job = start()
      .then((state) => {
        if (generation !== this.authGeneration) return state;
        this.analyticsResolved.set(context.key, state);
        return state;
      })
      .catch((error) => {
        const state: PaperCtecAnalyticsState = {
          state: "error",
          message: error instanceof Error ? error.message : String(error)
        };
        if (generation !== this.authGeneration) return state;
        this.analyticsResolved.set(context.key, state);
        return state;
      })
      .finally(() => {
        this.analyticsInFlight.delete(context.key);
        if (!this.inFlight.has(context.key)) {
          this.loadingMessages.delete(context.key);
        }
        if (generation !== this.authGeneration) return;
        this.syncStatusBar(document);
        this.syncSideCard(document);
      });

    this.analyticsInFlight.set(context.key, job);
  }

  private retryAuthRequired(doc: Document): void {
    this.authGeneration += 1;
    abortPeopleSoftTasks(
      "Aborted because Better CAESAR is retrying after auth state change.",
      (task) => task.owner === CTEC_LINKS_REQUEST_OWNER
    );
    clearAuthRequiredStates(this.resolved, this.analyticsResolved);
    this.inFlight.clear();
    this.analyticsInFlight.clear();
    this.loadingMessages.clear();

    if (this.authPendingActive) {
      hideStatusBar(doc);
      this.run(doc);
      return;
    }

    this.awaitingAuthRetry = false;
    this.authModalOpen = false;
    this.authModalAutoShown = false;
    this.setAuthModalDismissed(false);
    hideAuthModal(doc);
    hideStatusBar(doc);
    this.run(doc);
  }

  private setProgress(key: string, message: string): void {
    this.loadingMessages.set(key, { message, updatedAt: Date.now() });
    this.syncStatusBar(document);
  }

  private ensureFocusRetry(): void {
    if (this.focusListenerAttached) return;

    const retryIfNeeded = () => {
      if (!this.awaitingAuthRetry && !this.authPendingActive) return;
      if (document.visibilityState === "hidden") return;
      this.retryAuthRequired(document);
    };

    window.addEventListener("focus", retryIfNeeded);
    document.addEventListener("visibilitychange", retryIfNeeded);
    this.focusListenerAttached = true;
  }
}
