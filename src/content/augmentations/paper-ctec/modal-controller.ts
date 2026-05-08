import {
  fetchCtecCourseAnalytics,
  getCtecCourseAnalyticsSnapshot
} from "../ctec-links/reports";
import { PAPER_CTEC_CONFIG } from "./config";
import { buildModalDisplayData } from "./modal-data";
import {
  COMMENTS_PAGE_SIZE,
  createModalDataController,
  createModalView,
  type AnalyticsModalState,
  type ModalActiveView,
  type ModalCommentSentimentFilter,
  type ModalCommentSort,
  type ModalDataController,
  type ModalRefreshFlash,
  type ModalTab,
  type ModalView
} from "./modal";
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
  inFlight: Map<string, Promise<PaperCtecWidgetData | null>>;
  analyticsResolved: Map<string, PaperCtecAnalyticsState>;
  // Owned by the controller but exposed via shared reference so the
  // augmentation's status-bar code can count active analytics fetches
  // alongside front-page fetches.
  analyticsInFlight: Map<string, Promise<PaperCtecAnalyticsState>>;
  loadingMessages: Map<string, { message: string; updatedAt: number }>;
};

export type ModalControllerCallbacks = {
  setProgress: (key: string, message: string) => void;
  syncStatusBar: () => void;
  syncSideCard: () => void;
  // Called when a background refresh discovers new evaluations — gives the
  // augmentation a chance to update the schedule-chip mini-summary too.
  renderForKey: (key: string, data: PaperCtecWidgetData) => void;
  // Wraps fetchCtecCourseAnalytics through withAuthRecovery so the modal's
  // batch + refresh fetches benefit from the same silent → popup-and-retry
  // cascade used by the schedule chip. Returns null when the user cancels
  // the auth-recovery popup.
  fetchAnalytics: typeof fetchCtecCourseAnalytics;
};

// Bridges the augmentation to the modal subsystem. Owns:
//  - per-key AnalyticsModalState (preserves filters across reopens)
//  - the open/close lifecycle (which course is showing right now)
//  - mirroring front-page widget state into the modal's analytics map
//  - resume-if-needed semantics for interrupted batches
//
// Fetch logic lives in ModalDataController; rendering lives in ModalView.
// Wave 6c shrunk this from ~600 LOC to ~150 by extracting both.
export class ModalController {
  private openModalKey: string | null = null;
  private openModalSource: AnalyticsModalSource | null = null;

  // Per-key view state. Reopening the same course restores filters; opening
  // a different course gets fresh defaults.
  private readonly modalStates = new Map<string, AnalyticsModalState>();

  private readonly view: ModalView;
  private readonly data: ModalDataController;

  constructor(
    private readonly state: ModalControllerSharedState,
    private readonly callbacks: ModalControllerCallbacks
  ) {
    this.view = createModalView({ doc: document });
    this.data = createModalDataController({
      state: this.state,
      callbacks: {
        setProgress: (key, message) => this.callbacks.setProgress(key, message),
        syncStatusBar: () => this.callbacks.syncStatusBar(),
        syncSideCard: () => this.callbacks.syncSideCard(),
        syncView: () => this.sync(document),
        renderForKey: (key, data) => this.callbacks.renderForKey(key, data)
      },
      fetcher: this.callbacks.fetchAnalytics
    });
  }

  isOpen(): boolean {
    return this.openModalSource !== null;
  }

  hasInFlight(key: string): boolean {
    return this.state.analyticsInFlight.has(key);
  }

  invalidate(): void {
    this.state.analyticsInFlight.clear();
    this.data.reset();
  }

  // Mirror front-page widget not-found state onto the analytics state map
  // so the modal can show the right callout without doing its own fetch.
  // Pure derivation — no network. Called by the augmentation while syncing
  // the side card. Auth-required is no longer surfaced as a chip state
  // (withAuthRecovery handles credentials transparently), so there's
  // nothing to mirror for that case.
  mirrorFrontPageState(context: PaperCtecSideCardContext): void {
    const existingState = this.state.analyticsResolved.get(context.key);
    if (existingState && existingState.state !== "found") return;

    const frontPageState = this.state.resolved.get(context.key);
    if (frontPageState?.state === "not-found") {
      this.state.analyticsResolved.set(context.key, { state: "not-found" });
    }
  }

  // Resume an in-progress batch after a login retry: if the user previously
  // asked for a batch and we haven't reached that target yet, kick again.
  // The analyticsResolved + analyticsInFlight guards keep this off the
  // hot mutation-tick loop — without them syncSideCard would spin
  // kickBatch on every tick and fan out CAESAR traffic.
  resumeIfNeeded(context: PaperCtecSideCardContext): void {
    const previousTarget = this.data.getTargetCount(context.key);
    if (previousTarget === undefined) return;
    if (this.state.analyticsInFlight.has(context.key)) return;
    if (this.state.analyticsResolved.has(context.key)) return;

    const resumeSnapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    if (countParsedEntries(resumeSnapshot) < previousTarget) {
      this.data.kickBatch(context, /* increment */ false);
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
      this.data.kickBatch(source);
    }
    this.sync(document);
  }

  closeModal(): void {
    this.openModalSource = null;
    this.openModalKey = null;
    this.view.close();
  }

  // Renders or hides the full-screen overlay based on openModalSource. The
  // modal is decoupled from the side panel: the source is captured at open
  // time (from the side card OR a schedule-chip analytics button) and
  // persists until close. Called every augmentation cycle so cached data
  // updates flow into the modal even while the user is interacting with it
  // — typing in the search input is preserved by lit-html's diffing
  // (the input element retains identity across renders).
  sync(_doc: Document = document): void {
    const source = this.openModalSource;
    if (!source) {
      this.view.close();
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

    const modalState = this.ensureModalState(source.key, data?.terms[0]?.id ?? null);
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
    const backgroundRefreshing = this.data.isBackgroundRefreshing(source.key);
    // Background refresh deliberately stays out of the modal-wide loading
    // state so the user can keep using cached data while we re-poll.
    const loading =
      this.state.analyticsInFlight.has(source.key) || this.state.inFlight.has(source.key);
    const errorMessage =
      analyticsState?.state === "error" ? analyticsState.message : null;
    const notFound = analyticsState?.state === "not-found";
    const canLoadMore = !loading && remainingTerms > 0 && !notFound;

    this.view.open(
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
        errorMessage,
        notFound,
        // Refresh is the user's recovery path when the resumeIfNeeded
        // auto-retry was disabled (see commit 0391fd7). Allow it on error
        // even with no data, otherwise an errored fetch with no parsed
        // entries leaves the modal as a dead end.
        canRefresh: !!data || !!errorMessage,
        canLoadMore,
        loadMoreBatchSize: PAPER_CTEC_CONFIG.aggregate.recentTerms,
        remainingTerms,
        parsedTermCount: parsedCount,
        backgroundRefreshing,
        refreshFlash: this.data.getRefreshFlash(source.key)
      },
      modalState,
      this.buildCallbacks(source, modalState)
    );
  }

  // Wires the modal's event surface. Most handlers mutate state +
  // resync; comment-filter handlers also reset commentsVisibleCount so
  // filtering after a "Show more" expansion drops back to the first page.
  private buildCallbacks(
    source: AnalyticsModalSource,
    s: AnalyticsModalState
  ) {
    const sync = () => this.sync(document);
    const resetPage = () => {
      s.commentsVisibleCount = COMMENTS_PAGE_SIZE;
    };
    const set = <K extends keyof AnalyticsModalState>(
      key: K,
      value: AnalyticsModalState[K],
      andResetPage = false
    ) => {
      s[key] = value;
      if (andResetPage) resetPage();
      sync();
    };
    return {
      onClose: () => this.closeModal(),
      // Re-entering Comments resets pagination so a previously-expanded
      // tab doesn't re-build hundreds of cards on each re-open.
      onTabChange: (tab: ModalTab) => set("tab", tab, tab === "comments"),
      onMetricChange: (kind: ModalActiveView) => set("activeMetric", kind),
      onTermChange: (id: string) => set("selectedTermId", id),
      onCommentsSentimentChange: (f: ModalCommentSentimentFilter) =>
        set("commentsSentimentFilter", f, true),
      onCommentsTopicChange: (t: string | null) =>
        set("commentsActiveTopic", t, true),
      onCommentsTermFilterChange: (t: string) =>
        set("commentsTermFilter", t, true),
      onCommentsSortChange: (sort: ModalCommentSort) =>
        set("commentsSortBy", sort, true),
      onToggleHeatmapExpanded: () =>
        set("heatmapExpanded", !s.heatmapExpanded),
      onRefresh: () => this.data.kickRefresh(source),
      onLoadMore: () => this.data.kickBatch(source),
      onDismissRefreshFlash: () => {
        this.data.clearRefreshFlash(source.key);
        sync();
      }
    };
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

// Re-export to keep the legacy ModalRefreshFlash import location stable.
export type { ModalRefreshFlash };

function countParsedEntries(
  snapshot: ReturnType<typeof getCtecCourseAnalyticsSnapshot>
): number {
  if (!snapshot) return 0;
  return snapshot.entries.filter(
    (entry) => entry.status === "ready" || entry.status === "unavailable"
  ).length;
}
