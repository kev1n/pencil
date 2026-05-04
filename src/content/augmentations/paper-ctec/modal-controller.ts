import {
  buildCtecCreditToastMessage,
  CTEC_ERROR_TOAST_MESSAGE,
  formatCtecCreditsWarning,
  tryConsumeCtecCredit
} from "../ctec-links/rate-limit";
import {
  fetchCtecCourseAnalytics,
  getCachedReportAggregate,
  getCtecCourseAnalyticsSnapshot
} from "../ctec-links/reports";
import { showToast } from "../seats-notes/toast";
import { PAPER_CTEC_CONFIG } from "./config";
import { buildModalDisplayData } from "./modal-data";
import type {
  AnalyticsModalState,
  ModalCommentSentimentFilter,
  ModalCommentSort,
  ModalRefreshFlash,
  ModalTab
} from "./modal-ui";
import { hideAnalyticsModal, readModalCommentsQuery, renderAnalyticsModal } from "./modal-ui";
import { COMMENTS_PAGE_SIZE, type ModalActiveView } from "./modal/types";
import type {
  AnalyticsModalSource,
  PaperCtecAnalyticsState,
  PaperCtecSideCardContext,
  PaperCtecWidgetData
} from "./types";

// Maps that the augmentation also writes to. Passed by reference so the
// modal can both read fresh values (via getCtecCourseAnalyticsSnapshot, the
// cache the schedule-chip fetcher writes into) and mirror state from the
// front-page widget into the modal.
export type ModalControllerSharedState = {
  resolved: Map<string, PaperCtecWidgetData>;
  inFlight: Map<string, Promise<PaperCtecWidgetData>>;
  analyticsResolved: Map<string, PaperCtecAnalyticsState>;
  // Owned by the controller but exposed via shared reference so the
  // augmentation's status-bar code can count active analytics fetches
  // alongside front-page fetches.
  analyticsInFlight: Map<string, Promise<PaperCtecAnalyticsState>>;
  loadingMessages: Map<string, { message: string; updatedAt: number }>;
};

export type ModalControllerCallbacks = {
  generation: () => number;
  isAwaitingRetry: () => boolean;
  markAwaitingRetry: () => void;
  setProgress: (key: string, message: string) => void;
  syncStatusBar: () => void;
  syncSideCard: () => void;
  // Called when a background refresh discovers new evaluations — gives the
  // augmentation a chance to update the schedule-chip mini-summary too.
  renderForKey: (key: string, data: PaperCtecWidgetData) => void;
};

// Owns full-screen modal state (which course is open, per-key view state,
// in-flight + background refresh tracking, refresh flash banners) and the
// fetch loops that feed it. The augmentation hands shared maps and a few
// callbacks in via the constructor; the controller doesn't know about the
// rest of the augmentation.
export class ModalController {
  private openModalKey: string | null = null;
  private openModalSource: AnalyticsModalSource | null = null;

  // Per-key view state. Reopening the same course restores filters; opening
  // a different course gets fresh defaults.
  private readonly modalStates = new Map<string, AnalyticsModalState>();

  // Distinct from analyticsInFlight: tracks background "check for new CTECs"
  // passes that must NOT flip the modal to a loading state. The user keeps
  // interacting with cached data while we re-poll Northwestern.
  private readonly analyticsBackgroundRefresh = new Set<string>();

  // Result of the most recent background refresh per key. Cleared on user
  // dismiss or after a setTimeout for success cases.
  private readonly analyticsRefreshFlash = new Map<string, ModalRefreshFlash>();
  private readonly analyticsRefreshFlashTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  // Per-key target count for analytics. Each user click on "+N more terms"
  // bumps this by recentTerms; the next fetch uses it as fetchLimit so we
  // pull exactly the next batch.
  private readonly analyticsTargetCount = new Map<string, number>();

  constructor(
    private readonly state: ModalControllerSharedState,
    private readonly callbacks: ModalControllerCallbacks
  ) {}

  isOpen(): boolean {
    return this.openModalSource !== null;
  }

  hasInFlight(key: string): boolean {
    return this.state.analyticsInFlight.has(key);
  }

  invalidate(): void {
    this.state.analyticsInFlight.clear();
  }

  // Mirror front-page widget state (auth-required / not-found) onto the
  // analytics state map so the modal can show the right callout without
  // doing its own fetch. Pure derivation — no network. Called by the
  // augmentation while syncing the side card.
  mirrorFrontPageState(context: PaperCtecSideCardContext): void {
    const existingState = this.state.analyticsResolved.get(context.key);
    if (existingState && existingState.state !== "found") return;

    const frontPageState = this.state.resolved.get(context.key);
    if (frontPageState?.state === "not-found") {
      this.state.analyticsResolved.set(context.key, { state: "not-found" });
      return;
    }
    if (frontPageState?.state === "auth-required") {
      this.state.analyticsResolved.set(context.key, {
        state: "auth-required",
        loginUrl: frontPageState.loginUrl
      });
    }
  }

  // Resume an in-progress batch after a login retry: if the user previously
  // asked for a batch and we haven't reached that target yet, kick again.
  // Only fires when `analyticsResolved` has been cleared (the post-login
  // `clearAuthRequiredStates` path). Any other resolved state — found,
  // not-found, error — is terminal until the user takes an explicit action.
  // Without that guard the side-card sync runs on every paper.nu mutation
  // tick and would spin kickBatch on error/found states, fanning CAESAR
  // traffic out to the per-hour rate limit.
  resumeIfNeeded(context: PaperCtecSideCardContext): void {
    const previousTarget = this.analyticsTargetCount.get(context.key);
    if (previousTarget === undefined) return;
    if (this.state.analyticsInFlight.has(context.key)) return;
    if (this.state.analyticsResolved.has(context.key)) return;

    const resumeSnapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    if (countParsedEntries(resumeSnapshot) < previousTarget) {
      this.kickBatch(context, /* increment */ false);
    }
  }

  openModal(source: AnalyticsModalSource): void {
    this.openModalSource = source;
    this.openModalKey = source.key;

    // Auto-kick a fetch if there's no data yet and no fetch in flight.
    // Without this the modal would open into the "No reports loaded yet"
    // state and require the user to click Load — but they already
    // expressed intent by opening the modal.
    const cached = getCtecCourseAnalyticsSnapshot(
      source.params,
      source.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    const hasParsed = cached
      ? cached.entries.some((e) => e.status === "ready")
      : false;
    if (
      !hasParsed &&
      !this.state.analyticsInFlight.has(source.key) &&
      !this.state.inFlight.has(source.key)
    ) {
      this.kickBatch(source);
    }
    this.sync(document);
  }

  closeModal(): void {
    this.openModalSource = null;
    this.openModalKey = null;
    hideAnalyticsModal(document);
  }

  // Renders or hides the full-screen overlay based on openModalSource. The
  // modal is decoupled from the side panel: the source is captured at open
  // time (from the side card OR a schedule-chip analytics button) and
  // persists until close. Called every augmentation cycle so cached data
  // updates flow into the modal even while the user is interacting with it
  // — typing in the search input is preserved by reading the live value
  // before each re-render.
  sync(doc: Document): void {
    const source = this.openModalSource;
    if (!source) {
      hideAnalyticsModal(doc);
      return;
    }

    const snapshot = getCtecCourseAnalyticsSnapshot(
      source.params,
      source.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    const data =
      snapshot && snapshot.entries.length > 0
        ? buildModalDisplayData(snapshot, source.params, source.titleHint)
        : null;

    const currentQuery = readModalCommentsQuery(doc);
    const modalState = this.ensureModalState(source.key, data?.terms[0]?.id ?? null);
    if (currentQuery !== null) {
      modalState.commentsQuery = currentQuery;
    }
    if (data && !data.terms.find((term) => term.id === modalState.selectedTermId)) {
      modalState.selectedTermId = data.terms[0]?.id ?? null;
    }

    const analyticsState = this.state.analyticsResolved.get(source.key);
    const parsedCount = countParsedEntries(snapshot);
    const totalEntries = snapshot?.entries.length ?? 0;
    // Persisted across reloads via the subject index — gives us the actual
    // count of un-fetched PS rows so the button can decrement "(N left)" as
    // batches load instead of being stuck on the snapshot's pending-vs-parsed
    // delta (which is usually 0 between batches).
    const pendingDiscoveryCount = snapshot?.pendingDiscoveryCount ?? 0;
    const pendingReportCount = Math.max(0, totalEntries - parsedCount);
    const remainingTerms = pendingDiscoveryCount + pendingReportCount;
    const backgroundRefreshing = this.analyticsBackgroundRefresh.has(source.key);
    // Background refresh deliberately stays out of the modal-wide loading
    // state so the user can keep using cached data while we re-poll.
    const loading =
      this.state.analyticsInFlight.has(source.key) || this.state.inFlight.has(source.key);
    const authUrl =
      analyticsState?.state === "auth-required" ? analyticsState.loginUrl : null;
    const errorMessage =
      analyticsState?.state === "error" ? analyticsState.message : null;
    const notFound = analyticsState?.state === "not-found";
    const canLoadMore = !loading && remainingTerms > 0 && !authUrl && !notFound;

    renderAnalyticsModal(
      doc,
      {
        identity: {
          subject: source.params.subject,
          catalog: source.params.catalogNumber,
          title: source.titleHint || `${source.params.subject} ${source.params.catalogNumber}`,
          instructor: source.params.instructor,
          sectionTerm: data?.course.sectionTerm ?? ""
        },
        data,
        loading,
        authUrl,
        awaitingAuth: this.callbacks.isAwaitingRetry(),
        errorMessage,
        notFound,
        // Refresh is the user's recovery path when the resumeIfNeeded
        // auto-retry was disabled (see commit 0391fd7). Allow it on error
        // even with no data, otherwise an errored fetch with no parsed
        // entries leaves the modal as a dead end.
        canRefresh: !authUrl && (!!data || !!errorMessage),
        canLoadMore,
        loadMoreBatchSize: PAPER_CTEC_CONFIG.aggregate.recentTerms,
        remainingTerms,
        parsedTermCount: parsedCount,
        backgroundRefreshing,
        refreshFlash: this.analyticsRefreshFlash.get(source.key) ?? null
      },
      modalState,
      {
        onClose: () => this.closeModal(),
        onTabChange: (tab: ModalTab) => {
          modalState.tab = tab;
          // Re-entering the comments tab should always start with a fresh
          // first page, otherwise a previously-expanded session would
          // re-render hundreds of cards and re-introduce the latency
          // pagination is here to fix.
          if (tab === "comments") modalState.commentsVisibleCount = COMMENTS_PAGE_SIZE;
          this.sync(document);
        },
        onMetricChange: (kind: ModalActiveView) => {
          modalState.activeMetric = kind;
          this.sync(document);
        },
        onTermChange: (id: string) => {
          modalState.selectedTermId = id;
          this.sync(document);
        },
        onCommentsSentimentChange: (filter: ModalCommentSentimentFilter) => {
          modalState.commentsSentimentFilter = filter;
          modalState.commentsVisibleCount = COMMENTS_PAGE_SIZE;
          this.sync(document);
        },
        onCommentsTopicChange: (topic: string | null) => {
          modalState.commentsActiveTopic = topic;
          modalState.commentsVisibleCount = COMMENTS_PAGE_SIZE;
          this.sync(document);
        },
        onCommentsTermFilterChange: (term: string) => {
          modalState.commentsTermFilter = term;
          modalState.commentsVisibleCount = COMMENTS_PAGE_SIZE;
          this.sync(document);
        },
        onCommentsSortChange: (sort: ModalCommentSort) => {
          modalState.commentsSortBy = sort;
          modalState.commentsVisibleCount = COMMENTS_PAGE_SIZE;
          this.sync(document);
        },
        onRefresh: () => this.kickRefresh(source),
        onLoadMore: () => this.kickBatch(source),
        onLogin: () => this.callbacks.markAwaitingRetry(),
        onDismissRefreshFlash: () => {
          this.clearRefreshFlash(source.key);
          this.sync(document);
        },
        onToggleHeatmapExpanded: () => {
          modalState.heatmapExpanded = !modalState.heatmapExpanded;
          this.sync(document);
        }
      }
    );
  }

  // Fetches the next batch of recentTerms-sized term reports for this course.
  // Each user-initiated call bumps the per-key target so the underlying
  // fetchLimit grows by recentTerms — pulling exactly the next batch of
  // unparsed entries. `increment=false` is used to resume an interrupted
  // batch (e.g. after a login retry) without bumping the target.
  kickBatch(context: AnalyticsModalSource, increment = true): void {
    if (this.state.analyticsInFlight.has(context.key)) return;

    const credit = tryConsumeCtecCredit(Date.now(), "modal-load-more");
    if (!credit.ok) {
      showToast(buildCtecCreditToastMessage(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

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
      const currentFrontPageJob = this.state.inFlight.get(context.key);
      if (currentFrontPageJob) {
        await currentFrontPageJob.catch(() => undefined);
      }

      const result = await fetchCtecCourseAnalytics(
        context.params,
        context.titleHint,
        PAPER_CTEC_CONFIG.aggregate.recentTerms,
        (message) => {
          this.callbacks.setProgress(context.key, `Loading term history… ${message}`);
        },
        nextTarget
      );

      return result.state === "found"
        ? { state: "found", analytics: result.analytics }
        : result;
    };

    const generation = this.callbacks.generation();
    const isStale = () => generation !== this.callbacks.generation();
    const job = start()
      .then((state) => {
        if (isStale()) return state;
        this.state.analyticsResolved.set(context.key, state);
        if (state.state === "error") {
          showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        } else {
          const warning = formatCtecCreditsWarning();
          if (warning) {
            showToast(`Loaded CTEC. ${warning}.`, { tone: "warn", durationMs: 5000 });
          }
        }
        return state;
      })
      .catch((error) => {
        const state: PaperCtecAnalyticsState = {
          state: "error",
          message: error instanceof Error ? error.message : String(error)
        };
        if (isStale()) return state;
        this.state.analyticsResolved.set(context.key, state);
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        return state;
      })
      .finally(() => {
        this.state.analyticsInFlight.delete(context.key);
        if (!this.state.inFlight.has(context.key)) {
          this.state.loadingMessages.delete(context.key);
        }
        if (isStale()) return;
        this.callbacks.syncStatusBar();
        this.callbacks.syncSideCard();
        this.sync(document);
      });

    this.state.analyticsInFlight.set(context.key, job);
  }

  // Background "check for new CTECs": re-pulls the link list from
  // Northwestern (forceRefreshLinks=true) so newly-published evaluations are
  // discovered, then fetches reports only for entries we haven't seen
  // before. Existing cached reportSummary data is preserved across the
  // refresh so the modal, side card, and schedule chip stay fully populated
  // and usable. Distinct from kickBatch (which the modal's load-more uses)
  // because it does NOT use analyticsInFlight — that flag drives the
  // modal's global loading state, which we explicitly want to avoid here.
  private kickRefresh(context: AnalyticsModalSource): void {
    if (this.analyticsBackgroundRefresh.has(context.key)) return;
    if (this.state.analyticsInFlight.has(context.key)) return;

    const credit = tryConsumeCtecCredit(Date.now(), "modal-refresh");
    if (!credit.ok) {
      showToast(buildCtecCreditToastMessage(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

    this.analyticsBackgroundRefresh.add(context.key);
    // Clear any prior flash so the user doesn't see stale success/error
    // from the previous run while a new check is in flight.
    this.clearRefreshFlash(context.key);

    const previousSnapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    const previousParsed = countParsedEntries(previousSnapshot);
    const previousTotal = previousSnapshot?.entries.length ?? 0;
    const previousTarget = this.analyticsTargetCount.get(context.key) ?? previousParsed;
    const refreshTarget = Math.max(previousTarget, PAPER_CTEC_CONFIG.aggregate.recentTerms);
    this.analyticsTargetCount.set(context.key, refreshTarget);

    // Re-render so the refresh button immediately shows "Checking…".
    this.sync(document);

    const generation = this.callbacks.generation();
    const isStale = () => generation !== this.callbacks.generation();

    void (async () => {
      try {
        const result = await fetchCtecCourseAnalytics(
          context.params,
          context.titleHint,
          PAPER_CTEC_CONFIG.aggregate.recentTerms,
          undefined,
          refreshTarget,
          /* forceRefreshLinks */ true
        );

        if (isStale()) return;

        if (result.state === "found") {
          this.state.analyticsResolved.set(context.key, {
            state: "found",
            analytics: result.analytics
          });
          const updatedSnapshot = getCtecCourseAnalyticsSnapshot(
            context.params,
            context.titleHint,
            PAPER_CTEC_CONFIG.aggregate.recentTerms
          );
          const newTotal = updatedSnapshot?.entries.length ?? 0;
          const addedCount = Math.max(0, newTotal - previousTotal);
          this.setRefreshFlash(context.key, { kind: "success", addedCount });
          const warning = formatCtecCreditsWarning();
          if (warning) {
            showToast(`Refreshed CTEC. ${warning}.`, { tone: "warn", durationMs: 5000 });
          }
          // Refresh the schedule chip's mini-summary too — newly-published
          // terms can shift the aggregated rating/responses count. Pull the
          // updated aggregate straight from cache without going through the
          // chip's loading state.
          const refreshedAggregate = getCachedReportAggregate(
            context.params,
            context.titleHint,
            PAPER_CTEC_CONFIG.aggregate.recentTerms
          );
          if (refreshedAggregate) {
            const widgetData: PaperCtecWidgetData = {
              state: "found",
              aggregate: refreshedAggregate
            };
            this.state.resolved.set(context.key, widgetData);
            this.callbacks.renderForKey(context.key, widgetData);
          }
        } else if (result.state === "auth-required") {
          this.state.analyticsResolved.set(context.key, {
            state: "auth-required",
            loginUrl: result.loginUrl
          });
          this.setRefreshFlash(context.key, {
            kind: "auth",
            loginUrl: result.loginUrl
          });
        } else if (result.state === "error") {
          this.state.analyticsResolved.set(context.key, {
            state: "error",
            message: result.message
          });
          this.setRefreshFlash(context.key, {
            kind: "error",
            message: result.message
          });
          showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        } else if (result.state === "not-found") {
          // Existing data stays; flag it as up-to-date with zero added.
          this.setRefreshFlash(context.key, { kind: "success", addedCount: 0 });
        }
      } catch (error) {
        if (isStale()) return;
        this.setRefreshFlash(context.key, {
          kind: "error",
          message: error instanceof Error ? error.message : String(error)
        });
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
      } finally {
        this.analyticsBackgroundRefresh.delete(context.key);
        // Don't `return` from finally — that swallows any pending throw from
        // the try/catch chain. Skip the post-refresh sync work instead.
        if (!isStale()) {
          this.callbacks.syncStatusBar();
          this.callbacks.syncSideCard();
          this.sync(document);
        }
      }
    })();
  }

  private setRefreshFlash(key: string, flash: ModalRefreshFlash): void {
    this.analyticsRefreshFlash.set(key, flash);
    const existingTimer = this.analyticsRefreshFlashTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    this.analyticsRefreshFlashTimers.delete(key);
    if (flash.kind === "success") {
      const timer = setTimeout(() => {
        this.analyticsRefreshFlashTimers.delete(key);
        if (this.analyticsRefreshFlash.get(key) === flash) {
          this.analyticsRefreshFlash.delete(key);
          this.sync(document);
        }
      }, 6000);
      this.analyticsRefreshFlashTimers.set(key, timer);
    }
  }

  private clearRefreshFlash(key: string): void {
    const timer = this.analyticsRefreshFlashTimers.get(key);
    if (timer) clearTimeout(timer);
    this.analyticsRefreshFlashTimers.delete(key);
    this.analyticsRefreshFlash.delete(key);
  }

  private ensureModalState(
    key: string,
    fallbackTermId: string | null
  ): AnalyticsModalState {
    const existing = this.modalStates.get(key);
    if (existing) return existing;

    const fresh: AnalyticsModalState = {
      tab: "overview",
      activeMetric: "global",
      selectedTermId: fallbackTermId,
      commentsQuery: "",
      commentsSentimentFilter: "all",
      commentsActiveTopic: null,
      commentsTermFilter: "all",
      commentsSortBy: "recent",
      heatmapExpanded: false,
      commentsVisibleCount: COMMENTS_PAGE_SIZE
    };
    this.modalStates.set(key, fresh);
    return fresh;
  }
}

function countParsedEntries(
  snapshot: ReturnType<typeof getCtecCourseAnalyticsSnapshot>
): number {
  if (!snapshot) return 0;
  return snapshot.entries.filter(
    (entry) => entry.status === "ready" || entry.status === "unavailable"
  ).length;
}
