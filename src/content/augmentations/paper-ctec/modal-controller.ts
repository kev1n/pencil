import {
  fetchCtecCourseAnalytics,
  getCachedChipAggregate,
  getCtecCourseAnalyticsSnapshot,
  hasStrategyBeenExplored
} from "../ctec-links/reports";
import {
  isCourseLensRedundant,
  isInstructorLensRedundant
} from "../ctec-links/lens-redundancy";
import {
  getSectionLens,
  setSectionLens,
  setSectionLensConfirmed
} from "../ctec-links/section-lens";
import type { CtecAnalyticsStrategy } from "../ctec-links/types";
import { getCtecStrategy } from "../../settings";
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
import {
  applyCoursePool,
  applyInstructorPool,
  buildInitialDryRunState,
  enterChooseStage,
  enterPickStage,
  rowsToCandidates,
  setPreset
} from "./modal/dry-run";
import {
  discoverCourseRows,
  type CourseDiscoveryResult
} from "../ctec-links/fetcher";
import {
  discoverInstructorRows,
  type InstructorDiscoveryResult
} from "../ctec-links/fetcher-instructor";
import type { DryRunPoolStatus, DryRunPreset } from "./modal/types";
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
      PAPER_CTEC_CONFIG.aggregate.recentTerms,
      getSectionLens(context.params) ?? getCtecStrategy()
    );
    if (countParsedEntries(resumeSnapshot) < previousTarget) {
      this.data.kickBatch(context, /* increment */ false);
    }
  }

  openModal(source: AnalyticsModalSource): void {
    this.openModalSource = source;
    this.openModalKey = source.key;

    // Re-arm the dry-run auto-open on every fresh open.
    const existing = this.modalStates.get(source.key);
    if (existing) existing.dryRunDismissed = false;

    const sectionLens = getSectionLens(source.params);
    const lens = sectionLens ?? getCtecStrategy();

    // Mirror the chip's not-found verdict into analyticsResolved so the
    // dry-run dialog can auto-open without a redundant fetch. Skipped
    // when a section preference exists — that verdict came from combo,
    // not the user's preferred lens.
    const chipState = this.state.resolved.get(source.key);
    if (
      !sectionLens &&
      chipState?.state === "not-found" &&
      !this.state.analyticsResolved.has(source.key)
    ) {
      this.state.analyticsResolved.set(source.key, { state: "not-found" });
    }

    const knownNotFound =
      this.state.analyticsResolved.get(source.key)?.state === "not-found";
    const cached = knownNotFound
      ? null
      : getCtecCourseAnalyticsSnapshot(
          source.params,
          source.titleHint,
          PAPER_CTEC_CONFIG.aggregate.recentTerms,
          lens
        );
    const hasParsed = cached
      ? cached.entries.some((e) => e.status === "ready")
      : false;
    if (
      !knownNotFound &&
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

    const strategy = getSectionLens(source.params) ?? getCtecStrategy();
    const snapshot = getCtecCourseAnalyticsSnapshot(
      source.params,
      source.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms,
      strategy
    );
    // Cap broader-lens displays to the recent-terms window so course /
    // instructor modes don't accumulate every cached entry that
    // happens to pass the broader filter — the user picked a preset
    // like "Last 3 sections" and expects exactly that many rows.
    // Combo stays uncapped: it has its own "Load N more" affordance
    // for growing the list.
    const displayLimit =
      strategy === "combo"
        ? undefined
        : PAPER_CTEC_CONFIG.aggregate.recentTerms;
    const preliminaryState = this.modalStates.get(source.key);
    const data =
      snapshot && snapshot.entries.length > 0
        ? buildModalDisplayData(
            snapshot,
            source.params,
            source.titleHint,
            strategy,
            displayLimit,
            preliminaryState?.activePreset ?? null
          )
        : null;

    const modalState = this.ensureModalState(source.key, data?.terms[0]?.id ?? null);
    if (data && !data.terms.find((term) => term.id === modalState.selectedTermId)) {
      modalState.selectedTermId = data.terms[0]?.id ?? null;
    }

    const analyticsState = this.state.analyticsResolved.get(source.key);
    const parsedCount = countParsedEntries(snapshot);
    const totalEntries = snapshot?.entries.length ?? 0;

    // Auto-open the dry-run dialog whenever the active lens has produced
    // not-found AND the user hasn't already dismissed the dialog for
    // this modal session. Seeds with both strategies' alternatives so
    // the user can pick across pathways without having to choose a
    // target up front. Guarded against re-opening by setting
    // dryRun !== null below — the next sync sees this and skips.
    const isNotFoundForAutoOpen = analyticsState?.state === "not-found";
    if (
      isNotFoundForAutoOpen &&
      !modalState.dryRun &&
      !modalState.dryRunDismissed
    ) {
      modalState.dryRun = buildInitialDryRunState();
      this.kickDryRunDiscovery(source, source.key);
    }
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
    // Whenever a fetch is in flight AND we've cleared the verdict cache
    // for this key, show a clean loading panel instead of the stale
    // body. Captures both first-time lens switches (no exploration
    // marker yet) and explicit user reloads via dry-run confirm
    // (analyticsResolved deleted) — without this, an Adjust-selection
    // refresh on an already-explored lens just keeps painting the
    // cached data and looks like nothing happened.
    const freshLensLoading =
      this.state.analyticsInFlight.has(source.key) &&
      !this.state.analyticsResolved.has(source.key);

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
        refreshFlash: this.data.getRefreshFlash(source.key),
        strategy,
        freshLensLoading,
        courseLensRedundant: isCourseLensRedundant(source.params),
        instructorLensRedundant: isInstructorLensRedundant(source.params)
      },
      modalState,
      this.buildCallbacks(source, modalState)
    );
  }

  // Kicks both alternative-pathway discoveries in parallel, folding
  // each result into the dry-run state as it lands. Course discovery
  // is almost always cache-warm thanks to the side-effect cache in
  // fetcher.ts (combo / course fetches populate it); instructor
  // discovery always needs the T-endpoint round-trip unless cached
  // from a prior dry-run open in the same tab session.
  private kickDryRunDiscovery(source: AnalyticsModalSource, key: string): void {
    const params = {
      subject: source.params.subject,
      catalogNumber: source.params.catalogNumber,
      instructor: source.params.instructor
    };

    const applyAndSync = (
      mutator: (state: import("./modal/types").DryRunState) =>
        import("./modal/types").DryRunState
    ): void => {
      const state = this.modalStates.get(key);
      if (!state?.dryRun) return;
      state.dryRun = mutator(state.dryRun);
      this.sync(document);
    };

    void discoverCourseRows(params).then((result) => {
      applyAndSync((dryRun) =>
        applyCoursePool(
          dryRun,
          courseResultToPoolStatus(result)
        )
      );
    });

    void discoverInstructorRows(params).then((result) => {
      applyAndSync((dryRun) =>
        applyInstructorPool(
          dryRun,
          instructorResultToPoolStatus(result, source.params.instructor)
        )
      );
    });
  }

  // Writes the section's lens preference and clears the per-key caches
  // so the modal + chip re-derive against the new lens slice. Kicks a
  // fetch only when the new lens has never been explored — combo's
  // cached entries pass the broader filter as a subset, so a naive
  // "hasParsed?" check would skip the first-time fetch.
  private switchStrategy(
    source: AnalyticsModalSource,
    strategy: CtecAnalyticsStrategy
  ): void {
    const currentLens = getSectionLens(source.params) ?? getCtecStrategy();
    if (currentLens === strategy) return;
    setSectionLens(source.params, strategy);
    const modalState = this.modalStates.get(source.key);
    if (modalState) modalState.activePreset = null;
    this.state.resolved.delete(source.key);
    this.state.analyticsResolved.delete(source.key);
    this.data.clearRefreshFlash(source.key);
    this.data.clearTargetCount(source.key);

    const alreadyExplored = hasStrategyBeenExplored(source.params, strategy);
    if (
      !alreadyExplored &&
      !this.state.analyticsInFlight.has(source.key) &&
      !this.state.inFlight.has(source.key)
    ) {
      this.data.kickBatch(source);
    }
    this.sync(document);
    this.callbacks.renderForKey(source.key, this.deriveChipWidgetData(source));
  }

  // Derives a fresh PaperCtecWidgetData for the chip from the active
  // section lens. Used after a lens switch so the schedule chip
  // repaints with the new aggregate (or a "not-found" pill) on the
  // very next paint, instead of waiting for the next mutation
  // observer tick. Returns "not-found" when no data is cached for
  // the lens — the chip already handles that state.
  private deriveChipWidgetData(source: AnalyticsModalSource): PaperCtecWidgetData {
    const aggregate = getCachedChipAggregate(
      source.params,
      source.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    if (aggregate) return { state: "found", aggregate };
    return { state: "not-found" };
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
      },
      onStrategyChange: (strategy: CtecAnalyticsStrategy) => {
        // The user is explicitly steering — suppress the auto-open
        // wizard for this modal session. Combo lands the user on the
        // not-found body (no wizard), Course/Prof open the matching
        // pick stage (which is wizard UI but launched by the user, not
        // auto). Either way they shouldn't be re-routed into the
        // "Pick an alternative" flow against their will.
        s.dryRunDismissed = true;
        // If the chosen lens already has cached data, treat the tab
        // click like a direct strategy switch — write the section
        // preference, drop the per-key caches, no wizard. This is
        // the common case after the user has loaded multiple lenses
        // for the section and is toggling between them in the
        // header.
        const alreadyExplored = hasStrategyBeenExplored(source.params, strategy);
        if (strategy === "combo" || alreadyExplored) {
          this.switchStrategy(source, strategy);
          return;
        }
        // Course / Prof, no cached data yet → preview through the
        // wizard's pick stage. We don't write section preference
        // here; that happens on Confirm so a cancel leaves the
        // user's prior pick (or unset state) intact.
        s.dryRun = enterPickStage(buildInitialDryRunState(), strategy);
        this.kickDryRunDiscovery(source, source.key);
        sync();
      },
      // Opens the dry-run overlay. When the active lens is course or
      // instructor, drop straight into that lens's pick stage so the
      // user can adjust their preset without re-traversing the
      // alternatives picker — they're already viewing that pathway.
      // From combo, open at the choose stage like a fresh entry.
      // Discovery for both pools is kicked in parallel either way so
      // counts hydrate independently and Back from pick still works.
      onOpenDryRun: () => {
        s.dryRunDismissed = false;
        const activeStrategy = getSectionLens(source.params) ?? getCtecStrategy();
        const fresh = buildInitialDryRunState();
        s.dryRun =
          activeStrategy === "course" || activeStrategy === "instructor"
            ? enterPickStage(fresh, activeStrategy, s.activePreset)
            : fresh;
        this.kickDryRunDiscovery(source, source.key);
        sync();
      },
      onDryRunChooseSource: (chosen: CtecAnalyticsStrategy) => {
        if (!s.dryRun) return;
        // No-op when the chosen pool isn't ready yet — the card itself
        // is rendered disabled in that state, but defending here keeps
        // the state machine total.
        s.dryRun = enterPickStage(s.dryRun, chosen);
        sync();
      },
      onDryRunBack: () => {
        if (!s.dryRun) return;
        s.dryRun = enterChooseStage(s.dryRun);
        sync();
      },
      onDryRunSelectPreset: (preset: DryRunPreset) => {
        if (!s.dryRun) return;
        s.dryRun = setPreset(s.dryRun, preset);
        sync();
      },
      onDryRunConfirm: () => {
        if (!s.dryRun) return;
        const stage = s.dryRun.stage;
        if (stage.kind !== "pick") return;
        // Persist the section's lens AND the preset choice. The
        // display layer reads `activePreset` to filter the rows it
        // shows beyond the lens-level filter — so "Only Smith" or
        // "by-catalog: CS 213" actually changes what renders.
        // (The fetcher still pulls top N by recency; preset-driven
        // row targeting at the fetch layer is a follow-up.)
        const target = stage.source;
        s.dryRun = null;
        s.dryRunDismissed = true;
        s.activePreset = stage.preset;
        setSectionLensConfirmed(source.params, target);
        // Clear chip + modal verdict caches — they were keyed to the
        // prior (combo) lens. Without this the chip stays "not-found"
        // and the modal-body keeps the not-found callout even after
        // the new lens loads. The chip widget repaints below via
        // renderForKey once we have new aggregate data; meanwhile
        // dropping resolved triggers Load-CTEC fallback rendering on
        // the next syncTargets tick if the modal closes before the
        // batch completes.
        this.state.resolved.delete(source.key);
        this.state.analyticsResolved.delete(source.key);
        this.data.clearRefreshFlash(source.key);
        this.data.clearTargetCount(source.key);
        if (
          !this.state.analyticsInFlight.has(source.key) &&
          !this.state.inFlight.has(source.key)
        ) {
          // forceRefreshLinks=true so the user gets visible feedback even
          // when the lens is already explored — without it, kickBatch
          // would return cached entries immediately and the modal would
          // re-render the same view they were looking at, hiding the
          // fact that Load fired at all.
          this.data.kickBatch(source, true, true);
        }
        this.sync(document);
        this.callbacks.renderForKey(source.key, this.deriveChipWidgetData(source));
      },
      onDryRunCancel: () => {
        s.dryRun = null;
        s.dryRunDismissed = true;
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
      commentsVisibleCount: COMMENTS_PAGE_SIZE,
      dryRun: null,
      dryRunDismissed: false,
      activePreset: null
    };
    this.modalStates.set(key, fresh);
    return fresh;
  }
}

// Re-export to keep the legacy ModalRefreshFlash import location stable.
export type { ModalRefreshFlash };

// Translation between fetcher result shapes and the dry-run pool
// statuses the UI consumes. Empty `found` results get folded into
// `empty` so the choose-stage card renders "None found" rather than
// "0 sections found", and auth/access/error states get plain English.
function courseResultToPoolStatus(
  result: CourseDiscoveryResult
): DryRunPoolStatus {
  if (result.state === "found") {
    if (result.rows.length === 0) return { kind: "empty" };
    return {
      kind: "ready",
      rows: rowsToCandidates(result.rows, "course", "course")
    };
  }
  if (result.state === "not-found") return { kind: "empty" };
  if (result.state === "no-access") return { kind: "no-access" };
  if (result.state === "auth-required") {
    return { kind: "auth-required", loginUrl: result.loginUrl };
  }
  return { kind: "error", message: result.message };
}

function instructorResultToPoolStatus(
  result: InstructorDiscoveryResult,
  instructor: string
): DryRunPoolStatus {
  // Empty instructor field would have matched every row in the T
  // directory and produced nonsense — better to short-circuit to
  // "empty" so the card shows the user a clean "no prof to look up"
  // message instead of a wall of unrelated sections.
  if (!instructor.trim()) return { kind: "empty" };

  if (result.state === "found") {
    if (result.rows.length === 0) return { kind: "empty" };
    return {
      kind: "ready",
      rows: rowsToCandidates(result.rows, "instructor", "instr")
    };
  }
  if (result.state === "not-found") return { kind: "empty" };
  if (result.state === "no-access") return { kind: "no-access" };
  if (result.state === "auth-required") {
    return { kind: "auth-required", loginUrl: result.loginUrl };
  }
  return { kind: "error", message: result.message };
}

function countParsedEntries(
  snapshot: ReturnType<typeof getCtecCourseAnalyticsSnapshot>
): number {
  if (!snapshot) return 0;
  return snapshot.entries.filter(
    (entry) => entry.status === "ready" || entry.status === "unavailable"
  ).length;
}
