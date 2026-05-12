// seats-notes augmentation — assembled on top of the shared
// `createPsCellGridRuntime` (Wave 4). The runtime owns page-id checks,
// header/cell injection, and ticker lifecycle; this file owns the per-row
// fetch flow, cache short-circuit, credit-pool gating, and toast surfacing.

import type { Augmentation } from "../../framework";
import {
  createPsCellGridRuntime,
  isRetryablePeopleSoftTaskError,
  lookupClass
} from "../../peoplesoft";
import { showToast } from "../../../shared/toast";
import {
  CLASS_LINK_SELECTOR,
  GRID_TABLE_SELECTORS,
  NOTES_CELL_CLASS,
  NOTES_HEADER_CLASS,
  SEATS_CELL_CLASS,
  SEATS_HEADER_CLASS,
  STYLE_ID
} from "./constants";
import {
  extractClassNumber,
  extractCourseIdentifier,
  isDisabledClassRow,
  readActiveStrm
} from "./helpers";
import { toFailure, toSeatsNotesResult } from "./parser";
import { resolvePerSectionSeats, type PerSectionSeats } from "./combined-section";
import { logDebug } from "../../../shared/log";
import {
  buildPeopleSoftCreditToast,
  formatPsCreditsWarning,
  initStorage,
  readCachedEntry,
  tryConsumePeopleSoftCredit,
  writeCachedEntry
} from "./storage";
import type { SeatsNotesResult } from "./types";
import {
  paintIdle,
  paintLoaded,
  paintLoading,
  SEATS_NOTES_STYLES,
  startTimestampTicker
} from "./ui";

// Per-row fetch metadata threaded through TData. The runtime caches the
// result of `fetch()` against the row; the augmentation reads `fetchedAt`
// here to render "Loaded N min ago" timestamps.
type SeatsNotesFetched = {
  result: SeatsNotesResult;
  fetchedAt: number;
  // Populated only when the result is a combined-section success AND we
  // could resolve both halves (paper.nu capacity + CAESAR per-section
  // enrolled). null when the disclaimer fallback is used.
  perSection: PerSectionSeats | null;
};

type Cells = {
  seatsCell: HTMLTableCellElement;
  notesCell: HTMLTableCellElement;
};

export class SeatsNotesAugmentation implements Augmentation {
  readonly id = "seats-notes";

  private storageReady = false;
  // Sentinel of pending refresh after the user clicks. Indexed by class
  // number — used to decide whether to surface the credit-warning toast on
  // the success path (refresh) vs the cache short-circuit (silent).
  private readonly pendingRefresh = new Set<string>();

  private readonly runtime = createPsCellGridRuntime<SeatsNotesFetched, string>({
    id: "seats-notes",
    // Both grids only render on the cart page; restrict the row selector to
    // the two scroll containers PeopleSoft uses there. Page-id check below
    // is permissive (always true) because the existing augmentation never
    // gated on it — it relied on selector specificity.
    pageId: () => true,
    gridRowSelector: GRID_TABLE_SELECTORS.map((s) => `${s} tr[bufnum]`).join(", "),
    columns: [
      { cellClass: SEATS_CELL_CLASS, headerClass: SEATS_HEADER_CLASS, label: "Seats" },
      { cellClass: NOTES_CELL_CLASS, headerClass: NOTES_HEADER_CLASS, label: "Notes" }
    ],
    styleId: STYLE_ID,
    styles: SEATS_NOTES_STYLES,

    keyForRow: (row) => {
      const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
      if (!link) return null;
      return extractClassNumber(link.textContent ?? "");
    },

    render: {
      idle: (ctx, controls) => {
        const cells = toCells(ctx.cells);
        const cached = readCachedEntry(ctx.key);
        if (cached) {
          // Cache short-circuit — render the loaded card synchronously so
          // the user never sees a blank/idle flash. perSection upgrade is
          // handled by the success handler's background resolver.
          controls.renderSuccess({
            result: cached.result,
            fetchedAt: cached.fetchedAt,
            perSection: null
          });
          return;
        }
        paintIdle(cells, ctx.key, () => controls.fetch(), isDisabledClassRow(ctx.row));
      },
      loading: (ctx) => {
        paintLoading(toCells(ctx.cells), ctx.key);
      },
      success: (ctx, data, controls) => {
        const cells = toCells(ctx.cells);
        const onRefresh = () => {
          this.pendingRefresh.add(ctx.key);
          controls.fetch();
        };
        // Always paint synchronously with whatever data we have. CAESAR's
        // live per-section enrolled is already in data.result — the only
        // thing the perSection upgrade adds is paper.nu's per-section cap.
        paintLoaded(cells, data.result, data.fetchedAt, ctx.key, onRefresh, data.perSection);

        // Background upgrade for combined sections that haven't been
        // resolved yet (cache short-circuit, or fresh fetch before
        // paper.nu's term JSON warms). When paper.nu data lands, re-paint
        // the same cells with real per-section numbers. No-op if the row
        // scrolled out of the DOM in the meantime.
        if (data.result.ok && data.result.isCombinedSection && !data.perSection) {
          logDebug("seats-notes.upgrade", "kicking off paper.nu resolve", {
            classNumber: ctx.key,
            combinedRows: data.result.combinedSectionRows?.length ?? "undefined"
          });
          void this.maybeResolvePerSection(data.result).then((perSection) => {
            logDebug("seats-notes.upgrade", "resolve returned", {
              classNumber: ctx.key,
              perSection,
              cellConnected: cells.seatsCell.isConnected
            });
            if (!perSection || !cells.seatsCell.isConnected) return;
            paintLoaded(cells, data.result, data.fetchedAt, ctx.key, onRefresh, perSection);
          });
        }
      },
      error: (ctx, _err, controls) => {
        // The augmentation always wraps errors into a failure result via
        // `toFailure`, so this branch is reserved for unexpected throws —
        // surface as a load failure card and offer a retry through the
        // standard refresh button.
        const failureResult: SeatsNotesResult = {
          ok: false,
          error: _err instanceof Error ? _err.message : "Unknown error."
        };
        paintLoaded(
          toCells(ctx.cells),
          failureResult,
          Date.now(),
          ctx.key,
          () => controls.fetch(),
          null
        );
      }
    },

    fetch: async ({ key, row }) => {
      const credit = tryConsumePeopleSoftCredit(Date.now(), "seats-notes");
      if (!credit.ok) {
        showToast(buildPeopleSoftCreditToast(credit.waitMs), {
          tone: "warn",
          durationMs: 6000
        });
        // Throw a retryable error so the runtime drops back to idle without
        // showing a permanent error card.
        throw new RateLimitedError();
      }

      const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
      const { subject, catalog } = extractCourseIdentifier(link?.textContent ?? "");

      let result: SeatsNotesResult;
      try {
        const lookupResponse = await lookupClass(
          {
            type: "lookup-class",
            classNumber: key,
            subjectHint: subject,
            catalogHint: catalog
          },
          {
            priority: "background",
            owner: "seats-notes",
            label: `Load seats/notes for class ${key}`
          }
        );
        result = toSeatsNotesResult(lookupResponse);
      } catch (error) {
        if (isRetryablePeopleSoftTaskError(error)) {
          throw error;
        }
        result = toFailure(error);
      }

      const fetchedAt = Date.now();
      writeCachedEntry(key, { result, fetchedAt });

      const isRefresh = this.pendingRefresh.delete(key);
      const warning = formatPsCreditsWarning(fetchedAt);
      if (warning) {
        const verb = isRefresh ? "Refreshed" : "Loaded";
        showToast(`${verb}. ${warning}.`, { tone: "warn", durationMs: 5000 });
      }

      // Don't await paper.nu here — return synchronously so the cell paints
      // CAESAR's data immediately. The success handler kicks off the
      // perSection upgrade in the background.
      return { result, fetchedAt, perSection: null };
    },

    retryable: (err) =>
      isRetryablePeopleSoftTaskError(err) || err instanceof RateLimitedError,

    setupTickers: (doc) => startTimestampTicker(doc)
  });

  constructor() {
    void initStorage().then(() => {
      this.storageReady = true;
      this.runtime.run();
    });
  }

  // Wraps the resolver. Bails fast for non-combined / failure results so we
  // don't pay the paper.nu cache touch.
  private async maybeResolvePerSection(
    result: SeatsNotesResult
  ): Promise<PerSectionSeats | null> {
    if (!result.ok || !result.isCombinedSection) return null;
    const termId = readActiveStrm();
    if (!termId) return null;
    return resolvePerSectionSeats(result, termId);
  }

  run(doc?: Document): void {
    if (!this.storageReady) return;
    this.runtime.run(doc);
  }

  cleanup(doc?: Document): void {
    this.pendingRefresh.clear();
    this.runtime.cleanup(doc);
  }
}

function toCells(cells: HTMLTableCellElement[]): Cells {
  return {
    seatsCell: cells[0]!,
    notesCell: cells[1]!
  };
}

class RateLimitedError extends Error {
  constructor() {
    super("Rate limited");
    this.name = "RateLimitedError";
  }
}

