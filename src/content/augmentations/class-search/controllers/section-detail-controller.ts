// Section-detail expand/collapse + fetch+render orchestration. Owns the
// full lifecycle of the inline detail panel (the `<li class="bc-cs-detail-row">`
// inserted under a section row when the user clicks Details):
//
//   • toggle: collapse if already open; otherwise consume a PS credit,
//     resolve CAESAR live data, and open.
//   • cache-tier read: prefer the seats-notes disk cache, fall back to
//     a fresh `lookupClass` against PeopleSoft.
//   • render: success / loading / error all flow through the
//     section-detail view, using the same wrapping `<li>` so the user
//     sees a clean transition.
//
// Extracted from augmentation.ts (Wave 5g). The controller is wired up
// once at mount and called per-click; it never holds mount-scoped state
// of its own — every dependency comes through the constructor closure.

import { isRetryablePeopleSoftTaskError, lookupClass } from "../../../peoplesoft";
import {
  formatPsCreditsWarning,
  readCachedEntry as readSeatsNotesCache,
  writeCachedEntry as writeSeatsNotesCache
} from "../../seats-notes/storage";
import { toSeatsNotesResult, toFailure as seatsNotesFailure } from "../../seats-notes/parser";
import { resolvePerSectionSeats } from "../../seats-notes/combined-section";
import { showToast } from "../../../../shared/toast";

import {
  matchCaesarGroup,
  matchCaesarSection,
  type CaesarSearchResult,
  type CaesarSection
} from "../caesar-search";
import { bareCatalogNumber } from "../catalog-format";
import type { PaperSection } from "../paper-data";
import type { ResultRow } from "../types";
import {
  renderSectionDetail,
  renderSectionDetailLoading,
  type SectionDetailData
} from "../views/section-detail";
import { paintButtonLoading } from "../views/section-row";

export type SectionDetailContext = {
  /** Pre-resolved CAESAR live data for the course (memory-cache hit
   *  guaranteed by the caller, since the user already triggered the
   *  fetch path). */
  liveResult: CaesarSearchResult;
};

export interface SectionDetailController {
  /**
   * Toggles the inline detail panel under `li`. On open it consumes one
   * PS credit (via the deps), resolves the CAESAR section row, and renders
   * (cache-warm path) or fetches + renders. On close it removes the panel.
   */
  toggle(
    row: ResultRow,
    section: PaperSection,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): Promise<void>;
  /**
   * Auto-open the detail panel if (and only if) both the catalog and
   * seats-notes caches hit synchronously. No-op otherwise — never triggers
   * a fetch or consumes a PS credit. Used by the results-renderer to
   * pre-expand sections whose data the user has already loaded once.
   * Returns true when the panel was opened.
   */
  openIfCached(
    row: ResultRow,
    section: PaperSection,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): boolean;
}

export type SectionDetailDeps = {
  doc: Document;
  /**
   * Consume a PS-credit for `owner`. Returns true on success; false (and
   * toasts the user) when the budget is exhausted. Owners shown here:
   * `details`, `refresh-detail`.
   */
  consumePsCredit(owner: string): boolean;
  /**
   * Resolve the per-course CAESAR live-data cache, re-using the catalog
   * cache where possible and toasting on hard errors. Returns null when
   * the search couldn't be resolved.
   */
  ensureLiveData(
    row: ResultRow,
    card: HTMLElement | null
  ): Promise<CaesarSearchResult | null>;
  /**
   * Sync read of the live-data store's in-memory mirror. Used for the
   * cache-warm fast path: when both this and the seats-notes cache hit, we
   * can render the panel without any "Loading…" flicker or PS credit. The
   * results-renderer pre-warms this mirror from disk on card render, so it
   * hits on the first click after a page refresh as long as the catalog
   * disk cache is fresh.
   */
  peekLiveData(row: ResultRow): CaesarSearchResult | null;
  /** Active term (STRM) selected in the Sharper Search UI. Threaded into
   *  `lookupClass` so the second CAESAR search hits the user's term — the
   *  entry page URL doesn't carry STRM, so without this the lookup falls
   *  back to CAESAR's default term and a Spring class queried under a Fall
   *  default returns "no results." */
  getTermId(): string;
};

export function createSectionDetailController(
  deps: SectionDetailDeps
): SectionDetailController {
  const { doc } = deps;

  function fetchAndRender(
    detailRow: HTMLLIElement,
    caesar: CaesarSection,
    subject: string,
    bareCatalog: string
  ): Promise<void> {
    return runFetchAndRender(deps, detailRow, caesar, subject, bareCatalog);
  }

  function tryRenderFromCache(
    row: ResultRow,
    section: PaperSection,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): boolean {
    const cachedLive = deps.peekLiveData(row);
    if (!cachedLive) return false;
    const matchingGroup = matchCaesarGroup(cachedLive.groups, row.course.catalog);
    const caesar = matchingGroup
      ? matchCaesarSection(matchingGroup, section.section, section.component)
      : null;
    const cachedSeats = caesar ? readSeatsNotesCache(caesar.classNumber) : null;
    if (!caesar || !cachedSeats?.result) return false;

    const bareCatalog = bareCatalogNumber(row.course.catalog);
    const subject = row.course.subject;
    const detailRow = doc.createElement("li");
    detailRow.className = "bc-cs-detail-row";
    li.parentElement?.insertBefore(detailRow, li.nextSibling);
    renderRow(deps, detailRow, caesar, cachedSeats.result, cachedSeats.fetchedAt, () => {
      if (!deps.consumePsCredit("refresh-detail")) return;
      void fetchAndRender(detailRow, caesar, subject, bareCatalog);
    });
    button.dataset.expanded = "true";
    button.dataset.state = "expanded";
    button.disabled = false;
    button.textContent = "Hide";
    return true;
  }

  return {
    openIfCached(row, section, li, button) {
      // No-op if the panel is already open.
      const existing =
        li.nextElementSibling instanceof HTMLLIElement &&
        li.nextElementSibling.classList.contains("bc-cs-detail-row");
      if (existing) return false;
      return tryRenderFromCache(row, section, li, button);
    },

    async toggle(row, section, li, button) {
      // Re-entry guard: bounce a click that lands while a previous expand
      // is still resolving. Without this, every rapid double-click would
      // queue a fresh ensureLiveData + lookupClass round-trip. Must run
      // before the open-panel check below, because the loading shell now
      // mounts as a `.bc-cs-detail-row` synchronously on first click —
      // without ordering this first, the second click would treat the
      // in-flight loading shell as "already open" and tear it down.
      if (button.dataset.state === "loading") return;

      let detailRow = li.nextElementSibling instanceof HTMLLIElement && li.nextElementSibling.classList.contains("bc-cs-detail-row")
        ? (li.nextElementSibling as HTMLLIElement)
        : null;

      if (detailRow) {
        detailRow.remove();
        button.dataset.expanded = "false";
        button.dataset.state = "";
        button.disabled = false;
        button.textContent = "Details";
        return;
      }

      // Cache-warm fast path: if both the catalog and seats-notes caches
      // are already populated, render the panel synchronously without any
      // loading flicker and without consuming a PS credit. The user can
      // hit the inline Refresh button inside the panel for fresh data.
      if (tryRenderFromCache(row, section, li, button)) return;

      // Lock the UI synchronously *before* the first await so a fast
      // re-click is filtered both by the guard above and by the browser's
      // disabled-button click filter.
      button.dataset.state = "loading";
      button.disabled = true;
      paintButtonLoading(doc, button, "Loading…");

      // Mount the loading shell synchronously so "Fetching seats and notes
      // from CAESAR…" paints in the same frame as the click — without this
      // the user stares at an unchanged row while ensureLiveData resolves
      // (cold catalog cache → multi-second disk/network round-trip).
      detailRow = doc.createElement("li");
      detailRow.className = "bc-cs-detail-row";
      li.parentElement?.insertBefore(detailRow, li.nextSibling);
      renderLoading(deps, detailRow);

      // Restore the button + tear down the loading shell when the expand
      // bails out (credit exhaustion, missing data, network failure). The
      // success path overrides this back to "Hide" + expanded once the
      // panel mounts.
      const restoreIdle = (): void => {
        if (detailRow?.parentNode) detailRow.parentNode.removeChild(detailRow);
        detailRow = null;
        button.dataset.state = "";
        button.disabled = false;
        button.textContent = "Details";
      };

      // Expansion is the entry point for one or more PS chains (live load +
      // detail lookup). One credit covers the whole click; the helpers below
      // run ungated.
      if (!deps.consumePsCredit("details")) {
        restoreIdle();
        return;
      }

      // Outer try/catch — the Details `<button>` is owned by the section-row
      // template (not a `createActionButton` instance), so the factory's
      // built-in throw-handler can't fire here. `ensureLiveData` and
      // `runFetchAndRender` already catch their own errors, but a bare
      // throw from any sync helper (sessionStorage read, DOM mutation) would
      // otherwise leave the button stuck on "Loading…" forever and surface
      // as an unhandled rejection.
      try {
        // Resolve the catalog search via cache (memory → disk → fetch).
        const card = li.closest<HTMLElement>(".bc-cs-course");
        const liveResult = await deps.ensureLiveData(row, card);
        if (!liveResult) {
          showToast("Could not load CAESAR data for this course.", { tone: "error" });
          restoreIdle();
          return;
        }

        const matchingGroup = matchCaesarGroup(liveResult.groups, row.course.catalog);
        const caesar = matchingGroup
          ? matchCaesarSection(matchingGroup, section.section, section.component)
          : null;
        if (!caesar) {
          showToast("No matching CAESAR section found.", { tone: "error" });
          restoreIdle();
          return;
        }

        const bareCatalog = bareCatalogNumber(row.course.catalog);
        const subject = row.course.subject;
        const cachedDisk = readSeatsNotesCache(caesar.classNumber);
        if (cachedDisk?.result) {
          renderRow(deps, detailRow, caesar, cachedDisk.result, cachedDisk.fetchedAt, () => {
            if (!deps.consumePsCredit("refresh-detail")) return;
            void fetchAndRender(detailRow!, caesar, subject, bareCatalog);
          });
        } else {
          await fetchAndRender(detailRow, caesar, subject, bareCatalog);
        }

        button.dataset.expanded = "true";
        button.dataset.state = "expanded";
        button.disabled = false;
        button.textContent = "Hide";
      } catch (error) {
        // Reset to a retryable idle state. Skip the toast on canceled tasks
        // (a higher-priority action took over) and keep the panel torn down
        // so the next click can re-trigger cleanly.
        restoreIdle();
        if (!isRetryablePeopleSoftTaskError(error)) {
          const msg = error instanceof Error ? error.message : String(error);
          showToast(msg || "Could not load section detail.", {
            tone: "error",
            durationMs: 5000
          });
        }
      }
    }
  };
}

// ── Internals ──────────────────────────────────────────────────────────────

async function runFetchAndRender(
  deps: SectionDetailDeps,
  detailRow: HTMLLIElement,
  caesar: CaesarSection,
  subject: string,
  bareCatalog: string
): Promise<void> {
  if (!detailRow.isConnected) return;
  renderLoading(deps, detailRow);
  try {
    // Pass the course identifier so `buildCareerCandidates` can widen its
    // search beyond UGRD+TGS using nu-careers — needed for classes that
    // only live under Law, SPS, Kellogg-grad, etc.
    const lookupResponse = await lookupClass(
      {
        type: "lookup-class",
        classNumber: caesar.classNumber,
        subjectHint: subject,
        catalogHint: bareCatalog,
        termId: deps.getTermId()
      },
      {
        priority: "background",
        owner: "class-search-detail",
        label: `Load section details for class ${caesar.classNumber}`
      }
    );
    const result = toSeatsNotesResult(lookupResponse);
    const fetchedAt = Date.now();
    writeSeatsNotesCache(caesar.classNumber, { result, fetchedAt });
    if (detailRow.isConnected) {
      renderRow(deps, detailRow, caesar, result, fetchedAt, () => {
        if (!deps.consumePsCredit("refresh-detail")) return;
        void runFetchAndRender(deps, detailRow, caesar, subject, bareCatalog);
      });
    }
    const warning = formatPsCreditsWarning(fetchedAt);
    if (warning) {
      const verb = result.ok ? "Loaded" : "Tried";
      showToast(`${verb} section detail. ${warning}.`, { tone: "warn", durationMs: 5000 });
    }
  } catch (error) {
    if (isRetryablePeopleSoftTaskError(error)) return;
    const failure = seatsNotesFailure(error);
    if (detailRow.isConnected) {
      renderRow(deps, detailRow, caesar, failure, Date.now(), () => {
        if (!deps.consumePsCredit("refresh-detail")) return;
        void runFetchAndRender(deps, detailRow, caesar, subject, bareCatalog);
      });
    }
  }
}

function renderLoading(deps: SectionDetailDeps, detailRow: HTMLLIElement): void {
  detailRow.innerHTML = "";
  detailRow.appendChild(renderSectionDetailLoading(deps.doc));
}

function renderRow(
  deps: SectionDetailDeps,
  detailRow: HTMLLIElement,
  caesar: CaesarSection,
  result: SectionDetailData,
  fetchedAt: number,
  onRefresh: () => void
): void {
  // `caesar` is still threaded through for the cache write upstream — the
  // detail view itself no longer paints a header (the section row already
  // shows section label / time / room one line up).
  void caesar;
  paint(null);

  // Combined-section enhancement: kick off the per-section resolver in the
  // background and re-paint when paper.nu data lands. No-op for non-combined
  // sections or unresolvable lookups.
  if (result.ok && result.isCombinedSection) {
    void (async () => {
      const termId = deps.getTermId();
      const perSection = await resolvePerSectionSeats(result, termId);
      if (perSection && detailRow.isConnected) paint(perSection);
    })();
  }

  function paint(perSection: Parameters<typeof renderSectionDetail>[1]["perSection"]): void {
    detailRow.innerHTML = "";
    detailRow.appendChild(
      renderSectionDetail(deps.doc, {
        detail: result,
        fetchedAt,
        onRefresh,
        perSection
      })
    );
  }
}
