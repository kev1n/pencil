import type { ModalCommentTone, ModalDisplayData, ModalMetricKind } from "../modal-data";

export type ModalCommentSentimentFilter = "all" | ModalCommentTone;
export type ModalCommentSort = "recent" | "longest" | "shortest";
export type ModalTab = "overview" | "comments" | "terms";

// Result banner shown after a "Check for new CTECs" pass. Lives in modal
// header; the augmentation owns lifecycle (set on completion, auto-dismiss
// for success, sticky for errors).
export type ModalRefreshFlash =
  | { kind: "success"; addedCount: number }
  | { kind: "auth"; loginUrl: string }
  | { kind: "error"; message: string };

export type AnalyticsModalState = {
  tab: ModalTab;
  activeMetric: ModalMetricKind;
  selectedTermId: string | null;
  commentsQuery: string;
  commentsSentimentFilter: ModalCommentSentimentFilter;
  commentsActiveTopic: string | null;
  commentsTermFilter: string;
  commentsSortBy: ModalCommentSort;
};

export type AnalyticsModalCallbacks = {
  onClose: () => void;
  onTabChange: (tab: ModalTab) => void;
  onMetricChange: (kind: ModalMetricKind) => void;
  onTermChange: (id: string) => void;
  onCommentsSentimentChange: (filter: ModalCommentSentimentFilter) => void;
  onCommentsTopicChange: (topic: string | null) => void;
  onCommentsTermFilterChange: (term: string) => void;
  onCommentsSortChange: (sort: ModalCommentSort) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onLogin: () => void;
  onDismissRefreshFlash: () => void;
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
  authUrl: string | null;
  awaitingAuth: boolean;
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
export const TONE_META: Record<ModalCommentTone, { color: string; bg: string; label: string }> = {
  pos: { color: "#15803d", bg: "#ecfdf5", label: "Positive" },
  neg: { color: "#9f1239", bg: "#fff1f2", label: "Critical" },
  mix: { color: "#a16207", bg: "#fefce8", label: "Mixed" },
  neu: { color: "#7a596a", bg: "#f6ecf2", label: "Neutral" }
};

export const TOPIC_TONE_COLORS: Record<ModalCommentTone, string> = {
  pos: "#15803d",
  mix: "#a16207",
  neu: "#7a596a",
  neg: "#9f1239"
};

export const TOPIC_TONE_LABELS: Record<ModalCommentTone, string> = {
  pos: "positive",
  mix: "mixed",
  neu: "neutral",
  neg: "critical"
};
