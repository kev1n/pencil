import type { ModalCommentTone, ModalDisplayData, ModalMetricKind } from "../modal-data";

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
