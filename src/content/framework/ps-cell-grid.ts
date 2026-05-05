// Reusable runtime for PeopleSoft grid augmentations that inject one or more
// extra <th>/<td> cells per row, fetch data per row, and render idle/loading/
// success/error states with retry. Replaces hand-rolled state machines in
// seats-notes and ctec-links with a composable, testable runtime.
//
// Design notes:
//   - Composition, not inheritance — plugins call `createPsCellGridRuntime`
//     and own the returned `{ run, cleanup }` pair.
//   - Idempotent — `run(doc)` may be invoked many times per second (the
//     mutation observer in `runner.ts` re-runs on every PeopleSoft DOM swap).
//   - Cleanup is lossless — every <th>/<td>/<style> the runtime injects is
//     tagged with the augmentation's id so cleanup can find and remove them.
//   - In-flight dedupe via a Set<TKey> keyed by row identity.
//   - Render functions own their cell contents; the runtime owns cell
//     existence + style injection + ticker lifecycle.
//
// The render API is split into idle/loading/success/error to make state
// transitions explicit and testable. Plugins that want to short-circuit to
// success on a cache hit do so from inside `render.idle` by calling
// `controls.renderSuccess(data)` synchronously.

import { ensureStyle } from "./dom";

export interface PsCellGridColumn {
  /** Class added to each row's <td>. Used for cleanup attribution. */
  cellClass: string;
  /**
   * Class added to the column's <th>. Defaults to `cellClass` when omitted —
   * seats-notes uses distinct classes per column so the existing CSS that
   * styles header vs cell separately keeps working.
   */
  headerClass?: string;
  /** Header text. */
  label: string;
}

export interface PsCellRenderContext<TKey extends string | number = string> {
  doc: Document;
  row: HTMLElement;
  key: TKey;
  /** One <td> per column, in the same order as `config.columns`. */
  cells: HTMLTableCellElement[];
}

export interface PsCellRenderControls<TData, TKey extends string | number = string> {
  /** Trigger a fetch (deduped against in-flight requests). */
  fetch(): void;
  /** Render the success state directly without fetching. Used by cache hits. */
  renderSuccess(data: TData): void;
  /** Render the loading state directly. */
  renderLoading(): void;
  /** Render the error state directly. */
  renderError(err: unknown): void;
  /** Get the most recent context (cells reflect the live row). */
  context(): PsCellRenderContext<TKey>;
}

export interface PsCellGridConfig<TData, TKey extends string | number = string> {
  /** Stable id used for in-flight tracking + DOM owner attribution. */
  id: string;
  /**
   * Page-id gate. Either a string/array of `Page` attributes on
   * `#pt_pageinfo_win0`, or a custom predicate (receives the resolved page id
   * or `null` if the marker isn't present). Pass `() => true` to disable.
   */
  pageId: string | string[] | ((pageId: string | null) => boolean);
  /** Selector resolving to per-row <tr> elements (e.g. `tr[bufnum]`). */
  gridRowSelector: string;
  /** Columns added to each grid table. seats-notes uses 2; ctec-links uses 1. */
  columns: PsCellGridColumn[];
  /** Inline CSS appended once via `ensureStyle()`. */
  styles: string;
  /** Element id for the <style> block. */
  styleId: string;
  /**
   * Stable per-row key. `null` skips the row entirely (no cell injection).
   */
  keyForRow(row: HTMLElement): TKey | null;
  render: {
    /** First paint for a freshly-mounted row. */
    idle(
      ctx: PsCellRenderContext<TKey>,
      controls: PsCellRenderControls<TData, TKey>
    ): void;
    /** Paint while an in-flight fetch is running. */
    loading(
      ctx: PsCellRenderContext<TKey>,
      controls: PsCellRenderControls<TData, TKey>
    ): void;
    /** Paint when a fetch resolves (or cache short-circuits to success). */
    success(
      ctx: PsCellRenderContext<TKey>,
      data: TData,
      controls: PsCellRenderControls<TData, TKey>
    ): void;
    /** Paint when a fetch rejects with a non-retryable error. */
    error(
      ctx: PsCellRenderContext<TKey>,
      err: unknown,
      controls: PsCellRenderControls<TData, TKey>
    ): void;
  };
  /** Per-row fetcher. Called via `controls.fetch()`. */
  fetch(ctx: { key: TKey; row: HTMLElement; doc: Document }): Promise<TData>;
  /**
   * Returns true for errors that should NOT be rendered as a permanent error
   * state (transient transport / lock contention). Default: never retryable.
   */
  retryable?(err: unknown): boolean;
  /**
   * Optional: invoked once on the first `run(doc)` that mounts cells. Returns
   * a stop function the runtime calls on `cleanup(doc)`. Used by seats-notes
   * for the timestamp-refresh setInterval — this is the leak fix.
   */
  setupTickers?(doc: Document): () => void;
}

export interface PsCellGridRuntime {
  run(doc?: Document): void;
  cleanup(doc?: Document): void;
}

// Per-runtime dataset attribute names. Two runtimes can target the same rows
// (seats-notes + ctec-links both decorate tr[bufnum] on the CAESAR cart page)
// and they MUST NOT share dataset markers — otherwise every mutation cycle
// they overwrite each other's keys and state, dragging loading/success rows
// back to idle, which leaves the user clicking buttons whose fetch has
// already been deduped against an in-flight request that no longer has any
// UI representation. Namespacing both attributes by `config.id` gives each
// runtime its own slot.
export function createPsCellGridRuntime<TData, TKey extends string | number = string>(
  config: PsCellGridConfig<TData, TKey>
): PsCellGridRuntime {
  const inFlight = new Set<TKey>();
  let tickerStop: (() => void) | null = null;
  let mounted = false;

  const matchesPage = buildPageMatcher(config.pageId);
  const ownerAttr = `bc-cell-grid-owner-${config.id}`;
  // Convert "ctec-links" → "bcCellGridKeyCtecLinks" so dataset assignment
  // produces `data-bc-cell-grid-key-ctec-links` — distinct per runtime.
  const idSuffix = toCamelSuffix(config.id);
  const ROW_KEY_DATASET = `bcCellGridKey${idSuffix}`;
  const ROW_STATE_DATASET = `bcCellGridState${idSuffix}`;
  const ROW_KEY_ATTR = camelToKebab(ROW_KEY_DATASET);

  function getRowCells(
    row: HTMLElement
  ): { cells: HTMLTableCellElement[]; createdAny: boolean } {
    const doc = row.ownerDocument ?? document;
    let createdAny = false;
    const cells = config.columns.map((col) => {
      const existing = row.querySelector<HTMLTableCellElement>(`:scope > .${col.cellClass}`);
      if (existing) return existing;
      const td = doc.createElement("td");
      const inheritClass = row.querySelector("td,th")?.className ?? "";
      td.className = inheritClass ? `${inheritClass} ${col.cellClass}` : col.cellClass;
      td.setAttribute(`data-${ownerAttr}`, "1");
      row.appendChild(td);
      createdAny = true;
      return td;
    });
    return { cells, createdAny };
  }

  function ensureHeaders(table: HTMLTableElement): void {
    const headerRow = table.querySelector<HTMLTableRowElement>("tr");
    if (!headerRow) return;
    const doc = table.ownerDocument ?? document;
    for (const col of config.columns) {
      const headerClass = col.headerClass ?? col.cellClass;
      if (headerRow.querySelector(`.${headerClass}`)) continue;
      const th = doc.createElement("th");
      th.scope = "col";
      th.className = `PSLEVEL1GRIDCOLUMNHDR ${headerClass}`;
      th.textContent = col.label;
      th.setAttribute(`data-${ownerAttr}`, "1");
      headerRow.appendChild(th);
    }
  }

  function setState(
    row: HTMLElement,
    state: "idle" | "loading" | "success" | "error"
  ): void {
    row.dataset[ROW_STATE_DATASET] = state;
  }

  function makeControls(
    doc: Document,
    row: HTMLElement,
    key: TKey
  ): PsCellRenderControls<TData, TKey> {
    const ctx = (): PsCellRenderContext<TKey> => ({
      doc,
      row,
      key,
      cells: getRowCells(row).cells
    });

    const renderLoading = (): void => {
      setState(row, "loading");
      config.render.loading(ctx(), controls);
    };
    const renderSuccess = (data: TData): void => {
      setState(row, "success");
      config.render.success(ctx(), data, controls);
    };
    const renderError = (err: unknown): void => {
      setState(row, "error");
      config.render.error(ctx(), err, controls);
    };
    const fetchOnce = (): void => {
      if (inFlight.has(key)) return;
      if (!row.isConnected) return;
      inFlight.add(key);
      renderLoading();
      void config
        .fetch({ key, row, doc })
        .then((data) => {
          inFlight.delete(key);
          if (!row.isConnected) return;
          renderSuccess(data);
        })
        .catch((err: unknown) => {
          inFlight.delete(key);
          if (!row.isConnected) return;
          if (config.retryable?.(err)) {
            // Drop back to idle so the next run() (or a user click) can
            // re-issue the fetch. Mirrors the existing per-plugin behavior.
            setState(row, "idle");
            config.render.idle(ctx(), controls);
            return;
          }
          renderError(err);
        });
    };

    const controls: PsCellRenderControls<TData, TKey> = {
      fetch: fetchOnce,
      renderSuccess,
      renderLoading,
      renderError,
      context: ctx
    };
    return controls;
  }

  return {
    run(doc: Document = document): void {
      if (!matchesPage(doc)) return;

      const rows = Array.from(doc.querySelectorAll<HTMLElement>(config.gridRowSelector));
      if (rows.length === 0) return;

      ensureStyle(doc, config.styleId, config.styles);

      // Header injection: walk closest("table") for every row so we cover
      // both seats-notes (2 grids) and ctec-links (1 grid) without separate
      // config. Headers are idempotent inside ensureHeaders.
      const seenTables = new Set<HTMLTableElement>();
      for (const row of rows) {
        const table = row.closest<HTMLTableElement>("table");
        if (table && !seenTables.has(table)) {
          ensureHeaders(table);
          seenTables.add(table);
        }
      }

      for (const row of rows) {
        const key = config.keyForRow(row);
        if (key === null) continue;

        const previousKey = row.dataset[ROW_KEY_DATASET];
        const sameKey = previousKey === String(key);
        const state = row.dataset[ROW_STATE_DATASET];

        // Same key, already mounted — re-ensure cells exist (PS may have
        // re-rendered the row scaffold). If a cell was missing and we just
        // recreated it (PS wiped our injections), repaint by treating it
        // like a fresh mount so the user doesn't see a permanently empty
        // cell.
        if (sameKey && state) {
          const { createdAny } = getRowCells(row);
          if (!createdAny) continue;
        }

        // First time we see this key on this row — paint idle and let the
        // plugin take over.
        row.dataset[ROW_KEY_DATASET] = String(key);
        setState(row, "idle");
        const controls = makeControls(doc, row, key);
        config.render.idle(controls.context(), controls);
      }

      if (!mounted) {
        mounted = true;
        if (config.setupTickers) {
          tickerStop = config.setupTickers(doc);
        }
      }
    },

    cleanup(doc: Document = document): void {
      inFlight.clear();
      mounted = false;
      if (tickerStop) {
        tickerStop();
        tickerStop = null;
      }

      // Remove every <th>, <td>, and <style> the runtime injected. Owner
      // attribute is unique per runtime instance so cleanup is surgical even
      // if other plugins decorate the same grid.
      for (const node of Array.from(
        doc.querySelectorAll<HTMLElement>(`[data-${ownerAttr}]`)
      )) {
        node.remove();
      }
      const styleNode = doc.getElementById(config.styleId);
      if (styleNode) styleNode.remove();

      // Drop dataset markers we wrote on rows so a re-enable doesn't see
      // stale state. Selector is per-runtime so we don't trample markers
      // belonging to a different runtime that shares the same row.
      for (const row of Array.from(
        doc.querySelectorAll<HTMLElement>(`[data-${ROW_KEY_ATTR}]`)
      )) {
        delete row.dataset[ROW_KEY_DATASET];
        delete row.dataset[ROW_STATE_DATASET];
      }
    }
  };
}

// "ctec-links" → "CtecLinks". Used to build per-runtime dataset attribute
// names. The id is plugin-author-controlled, but in practice it's lowercase
// kebab-case, so this lightweight conversion is enough.
function toCamelSuffix(id: string): string {
  return id
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

// Converts a dataset camelCase key back to its kebab-case attribute form so
// querySelectorAll can find rows we tagged. Mirrors the DOM's automatic
// camel↔kebab translation for `data-*`.
function camelToKebab(name: string): string {
  return name.replace(/([A-Z])/g, (_, c: string) => `-${c.toLowerCase()}`);
}

function buildPageMatcher(
  pageId: string | string[] | ((pageId: string | null) => boolean)
): (doc: Document) => boolean {
  if (typeof pageId === "function") {
    return (doc) => pageId(readPageId(doc));
  }
  const allowed = new Set(Array.isArray(pageId) ? pageId : [pageId]);
  return (doc) => {
    const id = readPageId(doc);
    return id !== null && allowed.has(id);
  };
}

function readPageId(doc: Document): string | null {
  return (
    doc.querySelector<HTMLElement>("#pt_pageinfo_win0")?.getAttribute("Page") ?? null
  );
}
