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
   * Force-refresh every detail row currently mounted under `card` against
   * the supplied search result. Used by the per-course refresh flow, which
   * already pulled fresh CAESAR data and now wants any open detail panels
   * to reflect it. No-op when `result` doesn't match the course.
   */
  refreshOpenPanels(
    row: ResultRow,
    card: HTMLElement,
    result: CaesarSearchResult
  ): void;
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
};

export function createSectionDetailController(
  deps: SectionDetailDeps
): SectionDetailController {
  const { doc } = deps;

  function fetchAndRender(
    detailRow: HTMLLIElement,
    caesar: CaesarSection,
    bareCatalog: string
  ): Promise<void> {
    return runFetchAndRender(deps, detailRow, caesar, bareCatalog);
  }

  return {
    async toggle(row, section, li, button) {
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

      // Re-entry guard: bounce a click that lands while a previous expand
      // is still resolving. Without this, every rapid double-click would
      // queue a fresh ensureLiveData + lookupClass round-trip.
      if (button.dataset.state === "loading") return;

      // Lock the UI synchronously *before* the first await so a fast
      // re-click is filtered both by the guard above and by the browser's
      // disabled-button click filter.
      button.dataset.state = "loading";
      button.disabled = true;
      button.textContent = "Loading…";

      // Restore the button when the expand bails out (credit exhaustion,
      // missing data, network failure). The success path overrides this
      // back to "Hide" + expanded once the panel mounts.
      const restoreIdle = (): void => {
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

        detailRow = doc.createElement("li");
        detailRow.className = "bc-cs-detail-row";
        li.parentElement?.insertBefore(detailRow, li.nextSibling);

        const bareCatalog = bareCatalogNumber(row.course.catalog);
        const cachedDisk = readSeatsNotesCache(caesar.classNumber);
        if (cachedDisk?.result) {
          renderRow(deps, detailRow, caesar, cachedDisk.result, cachedDisk.fetchedAt, () => {
            if (!deps.consumePsCredit("refresh-detail")) return;
            void fetchAndRender(detailRow!, caesar, bareCatalog);
          });
        } else {
          await fetchAndRender(detailRow, caesar, bareCatalog);
        }

        button.dataset.expanded = "true";
        button.dataset.state = "expanded";
        button.disabled = false;
        button.textContent = "Hide";
      } catch (error) {
        // Reset to a retryable idle state. Skip the toast on canceled tasks
        // (a higher-priority action took over) and keep the panel torn down
        // so the next click can re-trigger cleanly.
        if (detailRow && detailRow.isConnected) detailRow.remove();
        restoreIdle();
        if (!isRetryablePeopleSoftTaskError(error)) {
          const msg = error instanceof Error ? error.message : String(error);
          showToast(msg || "Could not load section detail.", {
            tone: "error",
            durationMs: 5000
          });
        }
      }
    },

    refreshOpenPanels(row, card, result) {
      const matchingGroup = matchCaesarGroup(result.groups, row.course.catalog);
      if (!matchingGroup) return;
      const detailRows = card.querySelectorAll<HTMLLIElement>("li.bc-cs-detail-row");
      for (const detailRow of Array.from(detailRows)) {
        const sectionLi = detailRow.previousElementSibling;
        if (!(sectionLi instanceof HTMLLIElement)) continue;
        const sectionNumber = sectionLi.dataset.sectionNumber ?? "";
        const component = sectionLi.dataset.component ?? "";
        const caesar = matchCaesarSection(matchingGroup, sectionNumber, component);
        if (!caesar) continue;
        const bareCatalog = bareCatalogNumber(row.course.catalog);
        void fetchAndRender(detailRow, caesar, bareCatalog);
      }
    }
  };
}

// 4xx classes live under TGS even when undergrads can take them; this
// matches the heuristic in caesar-search.ts and ctec-links/subject-careers.
export function isGradCatalog(bareCatalog: string): boolean {
  const num = parseInt(bareCatalog, 10);
  return Number.isFinite(num) && num >= 400;
}

// ── Internals ──────────────────────────────────────────────────────────────

async function runFetchAndRender(
  deps: SectionDetailDeps,
  detailRow: HTMLLIElement,
  caesar: CaesarSection,
  bareCatalog: string
): Promise<void> {
  if (!detailRow.isConnected) return;
  renderLoading(deps, detailRow);
  try {
    // Hint TGS first for 4xx so lookupClass's career fallback list
    // doesn't waste a request trying UGRD on grad-only classes.
    const careerHint = isGradCatalog(bareCatalog) ? "TGS" : "UGRD";
    const lookupResponse = await lookupClass(
      {
        type: "lookup-class",
        classNumber: caesar.classNumber,
        careerHint
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
        void runFetchAndRender(deps, detailRow, caesar, bareCatalog);
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
        void runFetchAndRender(deps, detailRow, caesar, bareCatalog);
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
  detailRow.innerHTML = "";
  detailRow.appendChild(
    renderSectionDetail(deps.doc, {
      header: {
        sectionLabel: caesar.sectionLabel,
        daysTime: caesar.daysTime,
        room: caesar.room
      },
      detail: result,
      fetchedAt,
      onRefresh
    })
  );
}
