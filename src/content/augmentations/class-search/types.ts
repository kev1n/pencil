import type { CaesarSearchResult } from "./caesar-search";
import type { CartButtonRegistry } from "./cart-button-registry";
import type { CartCachePainter } from "./controllers/cart-cache-painter";
import type { LiveDataPainter } from "./controllers/live-data-painter";
import type { ResultsRenderer } from "./controllers/results-renderer";
import type { SearchOrchestrator } from "./controllers/search-orchestrator";
import type { SectionDetailController } from "./controllers/section-detail-controller";
import type { TabController } from "./controllers/tab-controller";
import type { LiveDataStore } from "./live-data-store";
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
  // Search debounce + per-term paper-data cache. Owned by
  // `controllers/search-orchestrator.ts`; the augmentation routes input
  // events / term-select changes into it.
  searchOrchestrator: SearchOrchestrator<PaperTermCourse[]>;
  // Per-course CAESAR live data cache (memory → disk → fetch). Owned by
  // `live-data-store.ts`; the augmentation drives painting / toast on top.
  liveData: LiveDataStore;
  // Better/Classic tab state + native-hider lifecycle. Owned by
  // `controllers/tab-controller.ts`.
  tabs: TabController;
  // Per-section Add buttons currently mounted on screen. Owned by
  // `cart-button-registry.ts`; keyed by the cart-cache signature so a
  // subscribe-driven repaint can find them without walking the whole DOM.
  cartButtons: CartButtonRegistry;
  // Live-data ⇄ DOM painter. Owns `ensureLiveData` / `refreshLiveData` /
  // `applyLiveDataToCard`. Constructed once per mount.
  liveDataPainter: LiveDataPainter;
  // Cart-cache ⇄ Add button painter. Owns the lookup-and-apply path used
  // by initial render, by post-live-data repaint, and by the cart-cache
  // subscribe callback.
  cartCachePainter: CartCachePainter;
  // Inline section-detail panel orchestrator. Owns toggle / fetch + render.
  detailController: SectionDetailController;
  // Course-card + section-row composer. Routes click events back into the
  // controllers above and writes results into `resultsEl`.
  resultsRenderer: ResultsRenderer;
  // Unsubscribe from cart-cache change notifications. Called on unmount so
  // the listener doesn't leak across mount cycles.
  cartUnsubscribe: (() => void) | null;
};
