import type { CaesarSearchResult } from "./caesar-search";
import type { CartButtonRegistry } from "./cart-button-registry";
import type { CartCachePainter } from "./controllers/cart-cache-painter";
import type { LiveDataPainter } from "./controllers/live-data-painter";
import type { ResultsRenderer } from "./controllers/results-renderer";
import type { SearchOrchestrator } from "./controllers/search-orchestrator";
import type { SectionDetailController } from "./controllers/section-detail-controller";
import type { TabController } from "./controllers/tab-controller";
import type { CtecCoordinator } from "./ctec/coordinator";
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
  // Weinberg Foundational Discipline narrowing. Empty set = no narrowing;
  // a non-empty set keeps rows tagged with ANY of the selected FD codes
  // (FoundationalDisciplineCode below).
  disciplines: Set<FoundationalDisciplineCode>;
};

// Weinberg's six post-2023 Foundational Disciplines. Codes mirror Weinberg's
// own FD-xx labels so the UI can shorten chips to "NS" / "EDR" / etc.
export type FoundationalDisciplineCode = "NS" | "EDR" | "SBS" | "HS" | "EET" | "LA";

// Each FD is sourced from either paper.nu's `distros` digit codes or
// `disciplines` letter codes. Natural Sciences lives in the distros stream
// (no letter code); the other five are letter-coded disciplines.
//   distros: "1" Natural Sciences
//   disciplines: A Empirical & Deductive, D Historical, E Ethical &
//                Evaluative, F Literary & Artistic, G Social & Behavioral
export const FOUNDATIONAL_DISCIPLINES: ReadonlyArray<{
  code: FoundationalDisciplineCode;
  label: string;
  short: string;
  distros?: string;
  disciplines?: string;
}> = [
  { code: "NS",  label: "Natural Sciences",                short: "Nat Sci",  distros: "1" },
  { code: "EDR", label: "Empirical & Deductive Reasoning", short: "Emp Ded",  disciplines: "A" },
  { code: "SBS", label: "Social & Behavioral Sciences",    short: "Soc Beh",  disciplines: "G" },
  { code: "HS",  label: "Historical Studies",              short: "History",  disciplines: "D" },
  { code: "EET", label: "Ethical & Evaluative Thinking",   short: "Ethics",   disciplines: "E" },
  { code: "LA",  label: "Literature & Arts",               short: "Lit Arts", disciplines: "F" }
];

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
// An orchestration record holding the concrete controller instances
// (orchestrator, painters, registries, renderer, detail controller, tabs)
// alongside the shared `filters`/`info`/`subjects` data and root DOM nodes.
// Controllers receive only the deps they need; this type just bundles them
// for the augmentation's lifecycle methods.
export type MountedState = {
  doc: Document;
  root: HTMLDivElement;
  panelEl: HTMLDivElement;
  resultsEl: HTMLDivElement;
  statusEl: HTMLDivElement;
  // Hosts the Foundational Discipline chip row. Lives in the status row so
  // the chips share the same line as "29 courses · 54 sections".
  filtersEl: HTMLDivElement;
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
  // Per-section CTEC chip + analytics-modal coordinator. Owns the
  // resolved/inFlight maps and routes Analytics clicks into the shared
  // ModalController instance held by the augmentation.
  ctecCoordinator: CtecCoordinator;
  // Course-card + section-row composer. Routes click events back into the
  // controllers above and writes results into `resultsEl`.
  resultsRenderer: ResultsRenderer;
  // Unsubscribe from cart-cache change notifications. Called on unmount so
  // the listener doesn't leak across mount cycles.
  cartUnsubscribe: (() => void) | null;
};
