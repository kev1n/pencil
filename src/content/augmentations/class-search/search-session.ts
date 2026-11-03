import { logQuiet } from "../../../shared/log";
import type { DataMapInfo } from "./paper-data";
import { FOUNDATIONAL_DISCIPLINES, type SearchFilters } from "./types";

const STORAGE_KEY = "better-caesar:class-search:session:v1";

type NativeSearchContext = {
  nativeTerm: string | null;
  career: string;
  institution: string;
};

type SearchSnapshot = NativeSearchContext & {
  termId: string;
  query: string;
  disciplines: string[];
  expandedCourses: string[];
  scrollTop: number;
};

export function createSearchSession(
  root: HTMLElement,
  context: NativeSearchContext,
  info: DataMapInfo
) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  let saved: Partial<SearchSnapshot> | null = null;
  try {
    saved = JSON.parse(win?.sessionStorage.getItem(STORAGE_KEY) ?? "null");
  } catch (err) {
    logQuiet("class-search.readSearchSession", err);
  }

  // A newly selected native CAESAR term or career takes precedence over
  // the last Sharper Search view.
  if (
    saved?.career !== context.career ||
    saved.institution !== context.institution ||
    (saved.nativeTerm !== context.nativeTerm && saved.termId !== context.nativeTerm) ||
    typeof saved.termId !== "string" ||
    !Object.hasOwn(info.terms, saved.termId)
  ) {
    saved = null;
  }

  const filters: SearchFilters = {
    termId: saved?.termId ?? context.nativeTerm ?? info.latest,
    query: typeof saved?.query === "string" ? saved.query : "",
    disciplines: new Set(
      FOUNDATIONAL_DISCIPLINES
        .filter(({ code }) => Array.isArray(saved?.disciplines) && saved.disciplines.includes(code))
        .map(({ code }) => code)
    )
  };
  const expandedCourses = new Set(
    Array.isArray(saved?.expandedCourses)
      ? saved.expandedCourses.filter((course) => typeof course === "string")
      : []
  );
  const savedScroll = saved?.scrollTop;
  let scrollTop = typeof savedScroll === "number" && Number.isFinite(savedScroll)
    ? Math.max(0, savedScroll)
    : 0;
  let scroller: Element | null = null;
  let restoreFrame: number | undefined;
  let restoringScroll = false;

  function save(): void {
    const snapshot: SearchSnapshot = {
      ...context,
      termId: filters.termId,
      query: filters.query,
      disciplines: [...filters.disciplines],
      expandedCourses: [...expandedCourses],
      scrollTop
    };
    try {
      win?.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      logQuiet("class-search.saveSearchSession", err);
    }
  }

  function trackScroll(event: Event): void {
    if (!root.isConnected || !scroller || restoringScroll) return;
    if (event.target === scroller || (event.target === doc && scroller === (doc.scrollingElement ?? doc.documentElement))) {
      scrollTop = scroller.scrollTop;
    }
  }

  function applyScroll(): void {
    restoreFrame = win?.requestAnimationFrame(() => {
      restoreFrame = undefined;
      restoringScroll = false;
      if (!root.isConnected || !scroller) return;
      scroller = getScroller(root);
      scroller.scrollTop = scrollTop;
    });
  }

  function pauseScroll(): void {
    win?.removeEventListener("load", applyScroll);
    if (restoreFrame !== undefined) win?.cancelAnimationFrame(restoreFrame);
    restoreFrame = undefined;
    restoringScroll = false;
    scroller = null;
  }

  doc.addEventListener("scroll", trackScroll, { capture: true, passive: true });
  win?.addEventListener("pagehide", save);

  return {
    filters,
    expandedCourses,
    save,
    setCourseExpanded(courseId: string, expanded: boolean): void {
      if (expanded === expandedCourses.has(courseId)) return;
      if (expanded) expandedCourses.add(courseId);
      else expandedCourses.delete(courseId);
      save();
    },
    restoreScroll(): void {
      if (scroller || !root.isConnected) return;
      scroller = getScroller(root);
      // The browser may set its initial scroll position after the catalog
      // renders. Restore once the document is loaded and layout is ready.
      if (scrollTop === 0) return;
      restoringScroll = true;
      if (doc.readyState === "complete") applyScroll();
      else win?.addEventListener("load", applyScroll, { once: true });
    },
    pauseScroll,
    changeTerm(termId: string): void {
      filters.termId = termId;
      expandedCourses.clear();
      scrollTop = 0;
      pauseScroll();
      save();
    },
    dispose(): void {
      save();
      pauseScroll();
      doc.removeEventListener("scroll", trackScroll, true);
      win?.removeEventListener("pagehide", save);
    }
  };
}

function getScroller(root: HTMLElement): Element {
  const doc = root.ownerDocument;
  for (let ancestor = root.parentElement; ancestor && ancestor !== doc.body; ancestor = ancestor.parentElement) {
    const overflow = doc.defaultView?.getComputedStyle(ancestor).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && ancestor.scrollHeight > ancestor.clientHeight) {
      return ancestor;
    }
  }
  return doc.scrollingElement ?? doc.documentElement;
}
