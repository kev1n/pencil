// Results renderer: composes `renderCourseCard` + `renderSectionRow` (the
// pure views) with the augmentation's mount-scoped controllers (live-data
// painter, cart-cache painter, section-detail controller, add-to-cart
// controller). Outputs the per-course card DOM the user actually sees, and
// owns the empty-state "Your classes" view too.
//
// Extracted from augmentation.ts (Wave 5g). The renderer is constructed
// once at mount; it routes per-row click events back into the right
// controllers, and paints any cache hits the moment the card mounts.

import { readTermCart } from "../../../cart-cache";

import { bareCatalogNumber } from "../catalog-format";
import { readCatalogCache } from "../catalog-cache";
import type { CartButtonRegistry } from "../cart-button-registry";
import type { LiveDataStore } from "../live-data-store";
import type { PaperCourse, PaperSection, PaperTermCourse } from "../paper-data";
import type { ResultRow, SearchFilters } from "../types";
import { renderCourseCard } from "../views/course-card";
import { renderMyClassesView } from "../views/my-classes-view";
import { renderSectionRow } from "../views/section-row";
import { setStatus } from "../views/shell";
import type { CartCachePainter } from "./cart-cache-painter";
import type { LiveDataPainter } from "./live-data-painter";
import type { SectionDetailController } from "./section-detail-controller";

export interface ResultsRenderer {
  /** Render search results for the active term. Empty `rows` falls through
   *  to the empty-state view. */
  render(rows: ResultRow[]): void;
  /** Render the empty-state "Your classes" cards for the active term. */
  renderMyClasses(): void;
}

export type ResultsRendererDeps = {
  doc: Document;
  filters: SearchFilters;
  resultsEl: HTMLElement;
  statusEl: HTMLElement;
  catalogIndex: Map<string, PaperCourse>;
  /** Returns the currently-loaded paper.nu courses for the active term,
   *  or null when not yet loaded. */
  getActiveTermCourses(): PaperTermCourse[] | null;

  liveData: LiveDataStore;
  /** Build the live-cache key for `(termId, row)`. */
  liveCacheKey(row: ResultRow): string;
  cartButtons: CartButtonRegistry;

  liveDataPainter: LiveDataPainter;
  cartCachePainter: CartCachePainter;
  detailController: SectionDetailController;

  /** PS credit gate for refresh-live. Returns true on success, false
   *  (and toasts) when the budget is exhausted. */
  consumePsCredit(owner: string): boolean;
  /** Click → cart-add wizard for `(row, section)`'s Add button. */
  handleAdd(
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): void;
};

export function createResultsRenderer(deps: ResultsRendererDeps): ResultsRenderer {
  function buildCourseCard(row: ResultRow): HTMLElement {
    const planEntry =
      deps.catalogIndex.get(`${row.course.subject} ${row.course.catalog}`) ?? null;

    const sectionRows: HTMLLIElement[] = [];
    for (const section of row.sections) {
      sectionRows.push(buildSectionRow(row, section));
    }

    // Holder pattern: `onRefresh` closes over `cardRef.el` so it can resolve
    // the card after `renderCourseCard` returns. The callback only fires on
    // user click, by which point we've populated cardRef.el.
    const cardRef: { el: HTMLElement | null } = { el: null };
    const onRefresh = (): void => {
      if (!cardRef.el) return;
      if (!deps.consumePsCredit("refresh-live")) return;
      const refreshBtn = cardRef.el.querySelector<HTMLButtonElement>(".bc-cs-refresh-btn");
      if (!refreshBtn) return;
      void deps.liveDataPainter.refreshLiveData(row, cardRef.el, refreshBtn);
    };
    const card = renderCourseCard(deps.doc, {
      row,
      planEntry,
      sectionRows,
      onRefresh
    });
    cardRef.el = card;

    // Eagerly paint live data on render. Try the in-memory cache first
    // (warmed by an earlier action this session), then fall back to the
    // persistent catalog cache (15-min TTL across sessions). Only on a
    // cold cache do section rows render without status badges, and the
    // first Details/Add click on the course populates them.
    const liveKey = deps.liveCacheKey(row);
    const memHit = deps.liveData.get(liveKey);
    if (memHit?.status === "ready" && memHit.result) {
      deps.liveDataPainter.applyLiveDataToCard(row, card, memHit.result);
    } else {
      const diskHit = readCatalogCache(
        deps.filters.termId,
        row.course.subject,
        bareCatalogNumber(row.course.catalog)
      );
      if (diskHit) {
        deps.liveData.mergeLiveCache(liveKey, diskHit.result.groups);
        deps.liveDataPainter.applyLiveDataToCard(row, card, diskHit.result);
      }
    }

    return card;
  }

  function buildSectionRow(row: ResultRow, section: PaperSection): HTMLLIElement {
    const sigKey = deps.cartButtons.encodeSigKey({
      termId: deps.filters.termId,
      subject: row.course.subject,
      catalog: row.course.catalog,
      sectionLabel: `${section.section}-${section.component}`
    });

    // Holder so the click callbacks can find their own row after render —
    // the row needs its own ref to pass to `toggleSectionDetails`.
    const liRef: { el: HTMLLIElement | null } = { el: null };
    const li = renderSectionRow(deps.doc, {
      section,
      sigKey,
      registerAddButton: (button) => {
        deps.cartButtons.register(sigKey, button);
        deps.cartCachePainter.applyForSection(row, section, button);
      },
      onAddToCart: () => {
        if (!liRef.el) return;
        const addBtn = liRef.el.querySelector<HTMLButtonElement>(".bc-cs-add");
        if (addBtn) deps.handleAdd(row, section, addBtn);
      },
      onToggleDetails: () => {
        if (!liRef.el) return;
        const detailsBtn = liRef.el.querySelector<HTMLButtonElement>(".bc-cs-details-btn");
        if (detailsBtn) {
          void deps.detailController.toggle(row, section, liRef.el, detailsBtn);
        }
      }
    });
    liRef.el = li;
    return li;
  }

  function renderMyClasses(): void {
    const { doc, resultsEl, statusEl } = deps;
    resultsEl.innerHTML = "";

    const termCart = readTermCart(deps.filters.termId);
    const enrolled = termCart ? Object.values(termCart.enrolled) : [];
    const inCart = termCart ? Object.values(termCart.cart) : [];
    const courses = deps.getActiveTermCourses();
    const totalCourses = courses?.length ?? 0;

    if (enrolled.length === 0 && inCart.length === 0) {
      const hint = doc.createElement("div");
      hint.className = "bc-cs-empty";
      hint.textContent =
        'Start typing — try "comp_sci 111", "econ 21x", or "machine learning". Classes you add will show up here for quick reference.';
      resultsEl.appendChild(hint);
      setStatus(doc, statusEl, "ok", `Term loaded · ${totalCourses.toLocaleString()} courses available`);
      return;
    }

    resultsEl.appendChild(
      renderMyClassesView(doc, {
        paperCourses: courses ?? [],
        enrolled,
        inCart
      })
    );

    const total = enrolled.length + inCart.length;
    setStatus(
      doc,
      statusEl,
      "ok",
      `${total} class${total === 1 ? "" : "es"} on file · ${totalCourses.toLocaleString()} courses searchable`
    );
  }

  function render(rows: ResultRow[]): void {
    const { doc, resultsEl, statusEl } = deps;
    resultsEl.innerHTML = "";

    if (deps.filters.query.trim().length === 0) {
      renderMyClasses();
      return;
    }

    if (rows.length === 0) {
      const empty = doc.createElement("div");
      empty.className = "bc-cs-empty";
      empty.textContent = "No matches. Try loosening filters or switching terms.";
      resultsEl.appendChild(empty);
      setStatus(doc, statusEl, "ok", "0 results");
      return;
    }

    let totalSections = 0;
    for (const row of rows) {
      totalSections += row.sections.length;
      resultsEl.appendChild(buildCourseCard(row));
    }
    setStatus(
      doc,
      statusEl,
      "ok",
      `${rows.length} course${rows.length === 1 ? "" : "s"} · ${totalSections} section${totalSections === 1 ? "" : "s"}`
    );
  }

  return { render, renderMyClasses };
}
