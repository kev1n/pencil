import type { CaesarSearchResult } from "./caesar-search";
import type {
  DataMapInfo,
  PaperCourse,
  PaperSection,
  PaperTermCourse,
  SubjectInfo
} from "./paper-data";

export type SearchFilters = {
  termId: string;
  // Free-text query — paper.nu-style. Whitespace-separated tokens, each
  // matched (regex, `x` as digit wildcard) against the combined haystack of
  // subject display name, subject symbol, catalog number, and title.
  query: string;
};

export type ResultRow = {
  course: PaperTermCourse;
  sections: PaperSection[];
};

export const PAPER_DISTRO_LABELS: Record<string, string> = {
  "1": "Natural Sciences",
  "2": "Formal Studies",
  "3": "Social & Behavioral Sciences",
  "4": "Historical Studies",
  "5": "Ethics & Values",
  "6": "Literature & Fine Arts",
  "7": "Interdisciplinary"
};

export const PAPER_DISCIPLINE_LABELS: Record<string, string> = {
  A: "Empirical & Deductive Reasoning",
  B: "Formal & Computational Reasoning",
  C: "Quantitative Reasoning",
  D: "Historical Studies",
  E: "Ethical & Evaluative Thinking",
  F: "Literary & Artistic Analysis",
  G: "Social & Behavioral Inquiry"
};

// Tab id for the Better/Classic toggle. Persisted in sessionStorage by
// `page-detection.ts → readActiveTab/writeActiveTab`.
export type TabId = "better" | "classic";

// Per-course CAESAR live data, keyed by `${termId}|${subject}|${bareCatalog}`.
// Sections that share a bare catalog (e.g. "111-0" + "111-SG") come from
// the same CAESAR search response.
export type CourseLiveCache = {
  status: "loading" | "ready" | "error";
  result?: CaesarSearchResult;
  error?: string;
};

// Mount-time state for the class-search augmentation. Held by the
// augmentation class for the lifetime of a single mount; rebuilt from
// scratch when CAESAR navigates off and back onto the search page.
//
// NOTE: This is the canonical "god object" for class-search and will be
// carved up in later waves (5b-5g). Keep as-is for now — the goal of 5a
// is to relocate the type without changing its shape.
export type MountedState = {
  doc: Document;
  root: HTMLDivElement;
  panelEl: HTMLDivElement;
  resultsEl: HTMLDivElement;
  statusEl: HTMLDivElement;
  filters: SearchFilters;
  info: DataMapInfo;
  subjects: Record<string, SubjectInfo>;
  catalogIndex: Map<string, PaperCourse>;
  career: string;
  institution: string;
  loadedTerms: Map<string, PaperTermCourse[]>;
  searchDebounce: number | null;
  liveCache: Map<string, CourseLiveCache>;
  activeTab: TabId;
  // Per-section Add buttons currently mounted on screen. Keyed by
  // `${termId}|${subject}|${catalog}|${sectionLabel}` (the signature the
  // cart cache also uses) so a subscribe-driven repaint can find them
  // without walking the whole DOM. Buttons remove themselves from this
  // map when their <li> disconnects.
  cartButtons: Map<string, HTMLButtonElement>;
  // Unsubscribe from cart-cache change notifications. Called on unmount so
  // the listener doesn't leak across mount cycles.
  cartUnsubscribe: (() => void) | null;
  // Last tab `applyTabVisibility` actually applied to the DOM. Without
  // this, every mutation observer tick would re-toggle the native-hider
  // style and panel display.
  appliedTab: TabId | null;
};
