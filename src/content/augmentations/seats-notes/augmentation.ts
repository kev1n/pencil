import type { Augmentation } from "../../framework";
import { isRetryablePeopleSoftTaskError, lookupClass } from "../../peoplesoft";
import { CLASS_LINK_SELECTOR } from "./constants";
import { extractCareerHint, extractClassNumber, queryTargetTables } from "./helpers";
import { toFailure, toSeatsNotesResult } from "./parser";
import {
  RATE_LIMIT_MAX,
  getRateLimitState,
  initStorage,
  readCachedEntry,
  recordFetch,
  writeCachedEntry
} from "./storage";
import { showToast } from "./toast";
import type { RowCells, RowTarget, SeatsNotesResult } from "./types";
import {
  ensureCustomCells,
  ensureCustomHeaders,
  getCellState,
  injectStyles,
  renderIdle,
  renderLoaded,
  renderLoading
} from "./ui";

export class SeatsNotesAugmentation implements Augmentation {
  readonly id = "seats-notes";

  private readonly inFlight = new Set<string>();
  private storageReady = false;

  constructor() {
    void initStorage().then(() => {
      this.storageReady = true;
      this.run();
    });
  }

  run(_doc: Document = document): void {
    if (!this.storageReady) return;
    const tables = queryTargetTables();
    if (tables.length === 0) return;

    injectStyles();

    for (const table of tables) {
      ensureCustomHeaders(table);
      const rows = table.querySelectorAll<HTMLTableRowElement>("tr[bufnum]");
      for (const row of Array.from(rows)) {
        this.processRow(row);
      }
    }
  }

  private processRow(row: HTMLTableRowElement): void {
    const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
    if (!link) return;
    const classNumber = extractClassNumber(link.textContent ?? "");
    if (!classNumber) return;

    const cells = ensureCustomCells(row);

    if (
      cells.seatsCell.dataset.classNumber === classNumber &&
      getCellState(cells) !== undefined
    ) {
      return;
    }

    const target: RowTarget = {
      classNumber,
      careerHint: extractCareerHint(link.textContent ?? ""),
      cells
    };

    this.hydrate(target);
  }

  private hydrate(target: RowTarget): void {
    if (this.inFlight.has(target.classNumber)) {
      renderLoading(target.cells, target.classNumber);
      return;
    }

    const cached = readCachedEntry(target.classNumber);
    if (cached) {
      this.renderLoadedWithRefresh(target, cached.result, cached.fetchedAt);
      return;
    }

    renderIdle(target.cells, target.classNumber, () => {
      void this.fetchOne(target, false);
    });
  }

  private renderLoadedWithRefresh(
    target: RowTarget,
    result: SeatsNotesResult,
    fetchedAt: number
  ): void {
    renderLoaded(target.cells, result, fetchedAt, target.classNumber, () => {
      void this.fetchOne(target, true);
    });
  }

  private async fetchOne(target: RowTarget, isRefresh: boolean): Promise<void> {
    if (this.inFlight.has(target.classNumber)) return;
    if (!isRowConnected(target.cells)) return;

    const now = Date.now();
    const rate = getRateLimitState(now);
    if (rate.recentCount >= RATE_LIMIT_MAX) {
      const waitMs = rate.nextAvailableAt ? rate.nextAvailableAt - now : 0;
      const waitMin = Math.max(1, Math.ceil(waitMs / 60_000));
      showToast(
        `Limit reached: ${RATE_LIMIT_MAX} loads per 30 min to reduce CAESAR load. Try again in ${waitMin} min.`,
        { tone: "warn", durationMs: 6000 }
      );
      return;
    }

    this.inFlight.add(target.classNumber);
    renderLoading(target.cells, target.classNumber);
    recordFetch(now);

    let result: SeatsNotesResult;
    try {
      const lookupResponse = await lookupClass(
        {
          type: "lookup-class",
          classNumber: target.classNumber,
          careerHint: target.careerHint
        },
        { priority: "background", owner: "seats-notes" }
      );
      result = toSeatsNotesResult(lookupResponse);
    } catch (error) {
      if (isRetryablePeopleSoftTaskError(error)) {
        this.inFlight.delete(target.classNumber);
        renderIdle(target.cells, target.classNumber, () => {
          void this.fetchOne(target, isRefresh);
        });
        return;
      }
      result = toFailure(error);
    }

    this.inFlight.delete(target.classNumber);

    const fetchedAt = Date.now();
    writeCachedEntry(target.classNumber, { result, fetchedAt });

    if (isRowConnected(target.cells)) {
      this.renderLoadedWithRefresh(target, result, fetchedAt);
    }

    const remaining = Math.max(0, RATE_LIMIT_MAX - getRateLimitState(fetchedAt).recentCount);
    const verb = isRefresh ? "Refreshed" : "Loaded";
    showToast(
      `${verb}. ${remaining} of ${RATE_LIMIT_MAX} loads left this 30 min (cap reduces CAESAR load).`
    );
  }
}

function isRowConnected(cells: RowCells): boolean {
  return cells.seatsCell.isConnected && cells.notesCell.isConnected;
}
