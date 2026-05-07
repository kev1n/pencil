// Empty-state "Your classes" view — rich cards rendered against the
// cart-cache so users land on a useful overview when the search box is
// blank instead of a hint string.
//
// Reuses the same components the search-results column uses:
// `renderCourseCard` (id + title + description + section list) wrapping a
// single `renderSectionRow` (component / time / instructor / room / CTEC
// chip / Details button / live-status pill). Only the section-row's "Add
// to cart" affordance is suppressed (`showAdd: false`) — every cart entry
// is already in the cart or enrolled, so Add is meaningless.
//
// The card itself is stamped with `data-cart-status="enrolled" | "in-cart"`
// for the colored left border + status pill in the header. Both Enrolled
// and In your cart sections flow through the same path; `status` only
// flips the stamp.
//
// View stays pure. The augmentation supplies callbacks for CTEC + Details
// wiring (mirroring the search-result pipeline). When a callback is
// omitted, the corresponding affordance simply doesn't mount — useful for
// tests + the cold-paper-data state.

import { el } from "../../../framework/dom";
import type { CartEntry } from "../../../cart-cache";
import type { PaperCourse, PaperSection, PaperTermCourse } from "../paper-data";
import type { ResultRow } from "../types";
import { renderCourseCard } from "./course-card";
import { renderSectionRow } from "./section-row";

export type MyClassesProps = {
  /** paper.nu term sections used to enrich cards with title / instructors
   *  / meeting pattern / room. May be empty when the term hasn't loaded
   *  yet — the fallback path renders a minimal card from cart data. */
  paperCourses: PaperTermCourse[];
  /** Plan-level catalog index keyed by `${subject} ${catalog}`. Drives
   *  units + description on the course-card head + body. May be an empty
   *  Map; the card degrades gracefully. */
  catalogIndex: Map<string, PaperCourse>;
  enrolled: CartEntry[];
  inCart: CartEntry[];
  /**
   * Optional CTEC host registration (mirrors results-renderer's wiring
   * for live search). Fired once per built section row. Skipped when
   * paper data is unresolved (no instructor → no CTEC identity).
   */
  registerCtecHost?(
    host: HTMLElement,
    course: PaperTermCourse,
    section: PaperSection
  ): void;
  /**
   * Optional per-entry post-mount registration. Fired once with the
   * built section row + the cart entry it represents. The augmentation
   * uses this to auto-open the detail panel when the seats-notes cache
   * is already warm — without it, a fresh load of the cart view starts
   * with every panel collapsed even when the data is sitting in cache.
   */
  registerCartCard?(li: HTMLLIElement, entry: CartEntry): void;
  /**
   * Per-entry Details-button click handler. The view forwards section-
   * row's `onToggleDetails` here with the live `<li>` so the controller
   * can mount its sibling detail row. Omit on cold tests; the click
   * becomes a no-op.
   */
  onDetailsClick?(
    entry: CartEntry,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): void;
};

export function renderMyClassesView(
  doc: Document,
  props: MyClassesProps
): HTMLElement {
  // `display: contents` keeps the wrap out of the box tree so the two
  // <section> children behave as direct siblings in the results column.
  const wrap = el(doc, "div", {
    class: "bc-cs-myclasses-wrap",
    style: { display: "contents" }
  });

  if (props.enrolled.length > 0) {
    wrap.appendChild(
      renderSection(doc, "Enrolled", props.enrolled, "enrolled", props)
    );
  }
  if (props.inCart.length > 0) {
    wrap.appendChild(
      renderSection(doc, "In your cart", props.inCart, "in-cart", props)
    );
  }

  return wrap;
}

function renderSection(
  doc: Document,
  label: string,
  entries: CartEntry[],
  status: "in-cart" | "enrolled",
  props: MyClassesProps
): HTMLElement {
  const heading = el(doc, "div", { class: "bc-cs-myclasses-heading" }, [
    el(doc, "span", { class: "bc-cs-myclasses-label", text: label }),
    el(doc, "span", { class: "bc-cs-myclasses-count", text: `${entries.length}` })
  ]);

  // Group entries by course so a saved LEC + DIS pair render as one
  // course card with two section rows, mirroring how search-result
  // course cards stack a course's sections inside a single shell.
  // Preserves insertion order of the first entry per group.
  const groups = new Map<string, CartEntry[]>();
  for (const entry of entries) {
    const key = `${entry.subject}:${entry.catalog}`;
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }

  const grid = el(doc, "div", { class: "bc-cs-myclasses-grid" });
  for (const group of groups.values()) {
    grid.appendChild(renderCard(doc, group, status, props));
  }

  return el(doc, "section", { class: "bc-cs-myclasses" }, [heading, grid]);
}

function renderCard(
  doc: Document,
  entries: CartEntry[],
  status: "in-cart" | "enrolled",
  props: MyClassesProps
): HTMLElement {
  // Resolve every entry against paper.nu — `findPaperSection` picks the
  // matching section per entry. Multiple entries for the same course
  // (e.g. LEC + DIS) all resolve against the same `paper.course`.
  const resolved = entries.map((entry) => ({
    entry,
    paper:
      props.paperCourses.length > 0
        ? findPaperSection(props.paperCourses, entry)
        : null
  }));

  // Cold-paper-data path: nothing in this group resolved against the
  // term cache yet. Render a thin shell with the first entry's id so
  // the user still sees something; the renderer re-runs once paper data
  // arrives and replaces it with the rich card.
  const firstResolved = resolved.find((r) => r.paper);
  if (!firstResolved?.paper) {
    return renderFallbackCard(doc, entries[0]!, status);
  }

  const course = firstResolved.paper.course;
  const planEntry = props.catalogIndex.get(`${course.subject} ${course.catalog}`) ?? null;

  // One section row per entry that successfully resolved. Cold entries
  // in the same group are temporarily skipped — they'll appear on the
  // next render.
  const sectionRows: HTMLLIElement[] = [];
  const sectionsForRow: PaperSection[] = [];
  for (const { entry, paper } of resolved) {
    if (!paper) continue;
    sectionRows.push(buildSectionLi(doc, entry, paper, props));
    sectionsForRow.push(paper.section);
  }

  const row: ResultRow = { course, sections: sectionsForRow };
  const card = renderCourseCard(doc, { row, planEntry, sectionRows });
  card.dataset.cartStatus = status;

  // Header status pill — sits flush right of the units cell via
  // `[data-cart-status]` extending the head grid in styles/results.ts.
  const head = card.querySelector<HTMLElement>(".bc-cs-course-head");
  if (head) {
    head.appendChild(
      el(doc, "span", {
        class: "bc-cs-cart-badge",
        dataset: { status },
        text: status === "enrolled" ? "Enrolled" : "In cart"
      })
    );
  }

  return card;
}

function buildSectionLi(
  doc: Document,
  entry: CartEntry,
  paper: { course: PaperTermCourse; section: PaperSection },
  props: MyClassesProps
): HTMLLIElement {
  // The section row's framework click handler routes through
  // onToggleDetails; we forward it with the live `<li>` so the cart-
  // card details controller can mount its sibling detail row.
  const liRef: { el: HTMLLIElement | null } = { el: null };
  const sectionLi = renderSectionRow(doc, {
    section: paper.section,
    sigKey: encodeSigKey(entry),
    showActions: true,
    showAdd: false,
    registerAddButton: () => {
      /* Add suppressed — entry is already in cart / enrolled. */
    },
    registerCtecHost: (host) => {
      if (props.registerCtecHost) {
        props.registerCtecHost(host, paper.course, paper.section);
      }
    },
    onAddToCart: () => {
      /* No-op — Add is hidden in this surface. */
    },
    onToggleDetails: () => {
      if (!liRef.el) return;
      const btn = liRef.el.querySelector<HTMLButtonElement>(
        ".bc-cs-details-btn"
      );
      if (btn) props.onDetailsClick?.(entry, liRef.el, btn);
    }
  });
  liRef.el = sectionLi;
  props.registerCartCard?.(sectionLi, entry);
  return sectionLi;
}

// Cold-paper-data fallback. Renders the absolute minimum so the user
// sees the course id + status while paper.nu finishes loading. Once
// loaded, the renderer re-runs and replaces this with the rich card.
function renderFallbackCard(
  doc: Document,
  entry: CartEntry,
  status: "in-cart" | "enrolled"
): HTMLElement {
  const id = el(doc, "span", {
    class: "bc-cs-course-id",
    text: `${entry.subject} ${entry.catalog}`
  });
  const badge = el(doc, "span", {
    class: "bc-cs-cart-badge",
    dataset: { status },
    text: status === "enrolled" ? "Enrolled" : "In cart"
  });
  const head = el(doc, "div", { class: "bc-cs-course-head" }, [id, badge]);

  const card = el(doc, "div", { class: "bc-cs-course" }, [head]);
  card.dataset.cartStatus = status;
  if (entry.description) {
    card.appendChild(
      el(doc, "div", { class: "bc-cs-course-desc", text: entry.description })
    );
  }
  return card;
}

// Encode a stable sig key for the section row's Add button (still
// rendered as a hidden marker by the registry even when we suppress
// the actual button) — keeps the view's contract with the framework
// stable. Format must match cart-button-registry's encodeSigKey, but
// for this surface the registry isn't consulted, so we just need a
// non-empty string.
function encodeSigKey(entry: CartEntry): string {
  return `${entry.subject}|${entry.catalog}|${entry.sectionLabel}`;
}

// Look up the paper.nu course + section that a cart entry points to so
// the "Your classes" cards can render title + instructor + meetings.
// Tolerates paper.nu's catalog ("111") vs CAESAR's ("111-0") drift the
// same way `matchCaesarGroup` does, and tolerates the cart-page hydrator
// storing sectionLabel as bare "1" (no component) — when the component
// half is missing we prefer LEC, then SEM, then any first match. Without
// this fallback every cart card hydrated from CAESAR's actual cart page
// (vs an optimistic add via the Sharper Search flow) showed no
// instructor / meetings / room / date range / CTEC chip.
const COMPONENT_PRIORITY = ["LEC", "SEM", "STU", "PED"];

export function findPaperSection(
  courses: PaperTermCourse[],
  entry: CartEntry
): { course: PaperTermCourse; section: PaperSection } | null {
  const wantSubject = entry.subject;
  const wantCatalog = entry.catalog.toLowerCase();
  const wantStripped = wantCatalog.replace(/-0$/, "");
  const [wantSecNum, wantComp] = entry.sectionLabel.split("-");
  const normSec = (wantSecNum ?? "").replace(/^0+/, "") || "0";
  const normComp = (wantComp ?? "").toUpperCase();

  for (const course of courses) {
    if (course.subject !== wantSubject) continue;
    const have = course.catalog.toLowerCase();
    if (
      have !== wantCatalog &&
      have !== wantStripped &&
      have.replace(/-0$/, "") !== wantStripped
    ) {
      continue;
    }

    // Collect every section sharing the cart's section number, then pick
    // the one whose component best fits. Single-pass over the course's
    // sections — courses tend to have a handful of sections so this is
    // cheap.
    const candidates: PaperSection[] = [];
    for (const section of course.sections) {
      const sNum = (section.section ?? "").replace(/^0+/, "") || "0";
      if (sNum !== normSec) continue;
      if (normComp) {
        if ((section.component ?? "").toUpperCase() === normComp) {
          return { course, section };
        }
        continue;
      }
      candidates.push(section);
    }

    if (candidates.length === 0) continue;
    const bestComp = COMPONENT_PRIORITY.find((comp) =>
      candidates.some((s) => (s.component ?? "").toUpperCase() === comp)
    );
    const picked =
      candidates.find((s) => (s.component ?? "").toUpperCase() === bestComp) ??
      candidates[0];
    return { course, section: picked! };
  }
  return null;
}
