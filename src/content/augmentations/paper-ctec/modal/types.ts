import type { CtecAnalyticsStrategy } from "../../ctec-links/types";
import type { ModalCommentTone, ModalDisplayData, ModalMetricKind } from "../modal-data";

// One CTEC report candidate the dry-run dialog can present. `source`
// labels which strategy this row "came from" so the available-list can
// group them by alternative pathway. PROTOTYPE: shape is what we'd
// persist; the data populating it is currently mocked, see
// `buildInitialDryRunState` in `modal/dry-run.ts`.
export type DryRunCandidate = {
  id: string;
  source: CtecAnalyticsStrategy;
  term: string;
  instructor: string;
  // Short course label, e.g. "ECON 281". Distinct from `description`
  // because the description is the raw CAESAR string ("ECON 281-0-30
  // ECONOMETRICS"); the catalog label is what we want in the row chip.
  catalogLabel: string;
  description: string;
};

// Two-step wizard: first the user picks WHICH alternative pathway to
// explore (choose stage — just a count summary, no row detail), then
// the picker UI for that pathway opens (pick stage). Pick stage shows
// a list of preset queries — no individual-row picking — so the user
// has a clear, opinionated default and a few easy substitutes.
export type DryRunStage =
  | { kind: "choose" }
  | { kind: "pick"; source: CtecAnalyticsStrategy; preset: DryRunPreset };

// A preset filter the user chooses on the pick stage. Each one
// resolves to a concrete set of candidate rows when applied.
//   recent              — most recent N sections from the pool, unfiltered
//   diverse-instructors — one section per professor, up to N distinct (course mode only)
//   by-catalog          — every section of one specific class (instructor mode only)
//   by-instructor       — every section by one specific professor (course mode only)
export type DryRunPreset =
  | { kind: "recent" }
  | { kind: "diverse-instructors" }
  | { kind: "by-catalog"; catalog: string; title: string; count: number }
  | { kind: "by-instructor"; instructor: string; count: number };

// Per-pathway discovery status. Lets the choose stage tell the user
// what's happening — loading, error, no access, or "N sections found"
// — without conflating the two pools' independent lifecycles.
export type DryRunPoolStatus =
  | { kind: "loading" }
  | { kind: "ready"; rows: DryRunCandidate[] }
  | { kind: "empty" }
  | { kind: "no-access" }
  | { kind: "auth-required"; loginUrl: string }
  | { kind: "error"; message: string };

export type DryRunState = {
  // Current wizard stage.
  stage: DryRunStage;
  // Hard cap on how many rows the eventual fetch should pull. Still
  // honored when applying a preset — `recent` slices to capacity,
  // `by-*` filters can return more (the fetcher caps from there).
  capacity: number;
  // Per-pathway discovery state. Lets the choose stage show loading
  // skeletons / error chips per card. Updated by the controller after
  // discoverCourseRows / discoverInstructorRows resolve.
  coursePool: DryRunPoolStatus;
  instructorPool: DryRunPoolStatus;
};

// Initial number of comment cards rendered when the comments tab opens, and
// the increment per "Show more" click. Sized to keep tab-switch latency
// imperceptible (~50 cards = a few ms of DOM work) while still giving users
// a meaningful first screen of comments before they decide to expand.
export const COMMENTS_PAGE_SIZE = 50;

export type ModalCommentSentimentFilter = "all" | ModalCommentTone;
export type ModalCommentSort =
  | "recent"
  | "longest"
  | "shortest"
  | "mostPositive"
  | "mostCritical";
export type ModalTab = "overview" | "comments" | "terms";

// Active selection in the overview KPI strip. A specific metric kind shows
// that metric's trend + distribution; "global" swaps in the heatmap +
// stacked + trend-lines view that summarizes all metrics together.
export type ModalActiveView = ModalMetricKind | "global";

// Result banner shown after a "Check for new CTECs" pass. Lives in modal
// header; the augmentation owns lifecycle (set on completion, auto-dismiss
// for success, sticky for errors).
export type ModalRefreshFlash =
  | { kind: "success"; addedCount: number }
  | { kind: "error"; message: string };

export type AnalyticsModalState = {
  tab: ModalTab;
  activeMetric: ModalActiveView;
  selectedTermId: string | null;
  commentsQuery: string;
  commentsSentimentFilter: ModalCommentSentimentFilter;
  commentsActiveTopic: string | null;
  commentsTermFilter: string;
  commentsSortBy: ModalCommentSort;
  // When false, the global-view heatmap shows only the most recent N terms
  // (where N is the user's "recent terms aggregation" setting). The toggle
  // is only meaningful when more terms are loaded than that window.
  heatmapExpanded: boolean;
  // Number of comment cards rendered in the comments tab. Pagination cap —
  // courses with hundreds of evaluations would otherwise build thousands of
  // DOM nodes on every tab switch and block the main thread for ~hundreds
  // of ms. User clicks "Show more" to grow this; persists across re-renders
  // so filtering/sorting after expanding doesn't reset the visible window.
  commentsVisibleCount: number;
  // Non-null when the dry-run preview dialog is open. Lets the user
  // inspect + reorder + toggle which CTECs would be pulled before the
  // network call goes out. PROTOTYPE only — confirmation currently
  // hands off to the existing switchStrategy path without consuming
  // the user's selection.
  dryRun: DryRunState | null;
  // Set when the user explicitly cancels out of the dry-run dialog.
  // Suppresses the auto-open-on-not-found behavior so users don't get
  // re-trapped in the same dialog they just dismissed. Cleared when
  // the user explicitly re-opens via the "Reopen preview" button on
  // the not-found body, when they switch strategy, or on modal close.
  dryRunDismissed: boolean;
  // Active preset persisted from the most recent dry-run confirm. Used
  // by the display layer to filter rows beyond the lens-level filter
  // — picking "Only Smith" or "by-catalog: CS 213" actually changes
  // what shows up in the body, not just what we promise to load.
  // Reset to null on lens switch (the prior lens's preset doesn't
  // apply to the new lens's rows).
  activePreset: DryRunPreset | null;
};

export type AnalyticsModalCallbacks = {
  onClose: () => void;
  onTabChange: (tab: ModalTab) => void;
  onMetricChange: (kind: ModalActiveView) => void;
  onTermChange: (id: string) => void;
  onCommentsSentimentChange: (filter: ModalCommentSentimentFilter) => void;
  onCommentsTopicChange: (topic: string | null) => void;
  onCommentsTermFilterChange: (term: string) => void;
  onCommentsSortChange: (sort: ModalCommentSort) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onDismissRefreshFlash: () => void;
  onToggleHeatmapExpanded: () => void;
  // Switches the active analytics lens. Persists globally — the chip
  // rating on schedule cards and any future modal opens both pick up the
  // user's last choice. Triggers a re-fetch when the new lens has no
  // cached data yet.
  onStrategyChange: (strategy: CtecAnalyticsStrategy) => void;
  // Opens the dry-run preview dialog. Starts on the `choose` wizard
  // stage; the user picks which alternative pathway to drill into,
  // then the `pick` stage opens. Used by the "Reopen preview"
  // recovery button on the not-found body.
  onOpenDryRun: () => void;
  // Wizard navigation. Pick: advance from `choose` into the preset
  // picker for `source`. Back: return from `pick` to `choose`.
  onDryRunChooseSource: (source: CtecAnalyticsStrategy) => void;
  onDryRunBack: () => void;
  // Switch which preset is active in the pick stage. Same source,
  // different filter (recent / by-catalog / by-instructor / diverse).
  onDryRunSelectPreset: (preset: DryRunPreset) => void;
  // Confirms the active preset, closes the dialog, and hands off to
  // the strategy-switch + fetch path. PROTOTYPE: the preset itself is
  // not yet threaded into the fetch — the existing batched fetcher
  // picks its own top N for the chosen strategy.
  onDryRunConfirm: () => void;
  onDryRunCancel: () => void;
};

export type AnalyticsModalInput = {
  // Always available — even when no data has loaded yet, we know the
  // course identity from the schedule card or side panel.
  identity: {
    subject: string;
    catalog: string;
    title: string;
    instructor: string;
    sectionTerm: string;
  };
  data: ModalDisplayData | null;
  loading: boolean;
  errorMessage: string | null;
  notFound: boolean;
  canRefresh: boolean;
  canLoadMore: boolean;
  loadMoreBatchSize: number;
  remainingTerms: number;
  parsedTermCount: number;
  // True while a background "check for new CTECs" is running. The modal stays
  // fully usable; only the refresh button shows a small "Checking…" state.
  backgroundRefreshing: boolean;
  // Result of the last completed refresh, shown as a dismissable banner under
  // the header. Cleared by the augmentation after success auto-dismiss or on
  // user dismissal.
  refreshFlash: ModalRefreshFlash | null;
  // Active analytics lens — drives the segmented selector in the header,
  // the adaptive disclaimer copy, and which slice of CTEC data populates
  // the body. Read from chrome.storage.local at render time so the modal
  // reflects the user's global preference (and changes here persist back).
  strategy: CtecAnalyticsStrategy;
  // True when the active lens has never produced a discovery pass AND a
  // fetch is currently in flight. Suppresses showing the combo-lens
  // subset as "loaded" data for course/instructor lenses on first visit.
  freshLensLoading: boolean;
  // True when broadening to the Course lens would surface the same rows
  // as Combo (only one prof has ever taught this course in cache). Hides
  // the option from the header selector and dry-run choose stage.
  courseLensRedundant: boolean;
  // True when broadening to the Instructor lens would surface the same
  // rows as Combo (this prof has only ever taught this one course in
  // the subject). Hides the option from the header selector and dry-run
  // choose stage.
  instructorLensRedundant: boolean;
};

// Per-tone visual metadata used by the comment cards (left border + tag pill)
// and by the comments-rail dot row. Sentiment rail dots reuse `color` only.
// Colors flow from the design tokens (--bc-color-sentiment-*) so the palette
// adapts to the active theme + dark-mode mirror automatically.
export const TONE_META: Record<ModalCommentTone, { color: string; bg: string; label: string }> = {
  pos: {
    color: "var(--bc-color-sentiment-pos-fg)",
    bg: "var(--bc-color-sentiment-pos-bg)",
    label: "Positive"
  },
  neg: {
    color: "var(--bc-color-sentiment-neg-fg)",
    bg: "var(--bc-color-sentiment-neg-bg)",
    label: "Critical"
  },
  mix: {
    color: "var(--bc-color-sentiment-mix-fg)",
    bg: "var(--bc-color-sentiment-mix-bg)",
    label: "Mixed"
  },
  neu: {
    color: "var(--bc-color-sentiment-neu-fg)",
    bg: "var(--bc-color-sentiment-neu-bg)",
    label: "Neutral"
  }
};

export const TOPIC_TONE_COLORS: Record<ModalCommentTone, string> = {
  pos: "var(--bc-color-sentiment-pos-fg)",
  mix: "var(--bc-color-sentiment-mix-fg)",
  neu: "var(--bc-color-sentiment-neu-fg)",
  neg: "var(--bc-color-sentiment-neg-fg)"
};

export const TOPIC_TONE_LABELS: Record<ModalCommentTone, string> = {
  pos: "positive",
  mix: "mixed",
  neu: "neutral",
  neg: "critical"
};
