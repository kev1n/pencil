import type { CtecAnalyticsStrategy } from "../../ctec-links/types";
import type { ModalCommentTone, ModalDisplayData } from "../modal-data";

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

// Initial number of comments rendered, and the increment per "Show more"
// click. Keeps the sheet quick to open on courses with hundreds of
// evaluations while still giving a meaningful first screen.
export const COMMENTS_PAGE_SIZE = 50;

export type ModalCommentSentimentFilter = "all" | ModalCommentTone;

// Result line shown after a "Check for new CTECs" pass. Lives in the sheet
// header; the augmentation owns lifecycle (set on completion, auto-dismiss
// for success, sticky for errors).
export type ModalRefreshFlash =
  | { kind: "success"; addedCount: number }
  | { kind: "error"; message: string };

export type AnalyticsModalState = {
  // Which term the whole sheet shows. Null means all loaded terms.
  selectedTermId: string | null;
  commentsQuery: string;
  commentsSentimentFilter: ModalCommentSentimentFilter;
  // Number of comments rendered. Pagination cap: courses with hundreds of
  // evaluations would otherwise build thousands of DOM nodes per render.
  // "Show more" grows this; it resets when a filter changes.
  commentsVisibleCount: number;
  // Non-null while the "pick a broader view" wizard is showing in place of
  // the report.
  dryRun: DryRunState | null;
  // Set when the user explicitly cancels out of the wizard. Suppresses the
  // auto-open-on-not-found behavior so users don't get re-trapped in the
  // same wizard they just dismissed. Cleared when the user re-opens it,
  // switches strategy, or closes the sheet.
  dryRunDismissed: boolean;
  // Active preset persisted from the most recent wizard confirm. Used
  // by the display layer to filter rows beyond the lens-level filter
  // — picking "Only Smith" or "by-catalog: CS 213" actually changes
  // what shows up in the body, not just what we promise to load.
  // Reset to null on lens switch (the prior lens's preset doesn't
  // apply to the new lens's rows).
  activePreset: DryRunPreset | null;
};

export type AnalyticsModalCallbacks = {
  onClose: () => void;
  // Null selects all terms.
  onTermChange: (id: string | null) => void;
  onCommentsSentimentChange: (filter: ModalCommentSentimentFilter) => void;
  onRefresh: () => void;
  // Ask CAESAR again for this class's seats and facts.
  onCaesarRefresh?: () => void;
  onLoadMore: () => void;
  onDismissRefreshFlash: () => void;
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
  // CAESAR's own facts about this class; the foot shows seats and grading.
  caesarInfo?: import("./caesar-info").CaesarInfo | null;
  // The panel's foot: add this class to the CAESAR cart, or register for
  // it once it is there. No button once enrolled.
  cartAction?: import("./caesar-info").CartAction | null;
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
