// Course card: header (subject / catalog / units / title), description (when
// present), and the section list.
//
// Pure render. The card receives a list of pre-built section row elements
// so the section-row view can stay independent — the augmentation supplies
// the cart-cache + click wiring per row.
//
// `applyLiveDataToCard` is exported so the augmentation can paint live
// CAESAR data onto an already-mounted card whenever the LiveDataStore
// emits a refresh — without a full re-render.

import { el } from "../../../framework/dom";
import {
  matchCaesarGroup,
  matchCaesarSection,
  type CaesarSearchResult
} from "../caesar-search";
import { formatCourseIdForDisplay } from "../catalog-format";
import { foundationalDisciplinesFor } from "../discipline-match";
import type { PaperCourse } from "../paper-data";
import type { ResultRow } from "../types";

import { renderDisciplineIcon } from "./discipline-icons";

export type CourseCardProps = {
  row: ResultRow;
  /** Plan-level metadata for this course (units, distros, disciplines, description). */
  planEntry: PaperCourse | null;
  /** Pre-built section row elements (one per section). The view appends them
   *  in order — section-row.ts is the canonical builder. */
  sectionRows: HTMLLIElement[];
  /** Collapse multi-section result cards behind a native disclosure. */
  collapseSections?: boolean;
};

export function renderCourseCard(
  doc: Document,
  props: CourseCardProps
): HTMLElement {
  const card = el(doc, "div", { class: "bc-cs-course" });

  card.appendChild(buildHead(doc, props));

  if (props.planEntry?.description) {
    card.appendChild(
      el(doc, "div", {
        class: "bc-cs-course-desc",
        text: props.planEntry.description
      })
    );
  }

  const sectionList = buildSectionList(doc, props.sectionRows);
  if (props.collapseSections && props.sectionRows.length > 1) {
    card.appendChild(
      buildSectionsDisclosure(doc, props.sectionRows.length, sectionList)
    );
  } else {
    card.appendChild(sectionList);
  }

  return card;
}

// Paint live CAESAR data onto a course card that's already in the DOM.
// Updates each section row's live cell with a status pill. Returns the
// section LIs whose status pill changed so callers can re-evaluate
// cart-cache state on freshly-resolved class numbers.
export function applyLiveDataToCard(
  card: HTMLElement,
  result: CaesarSearchResult,
  wantCatalog: string
): HTMLLIElement[] {
  const matchingGroup = matchCaesarGroup(result.groups, wantCatalog);
  const sectionLis = card.querySelectorAll<HTMLLIElement>("li.bc-cs-section");
  const touched: HTMLLIElement[] = [];

  sectionLis.forEach((li) => {
    const live = li.querySelector<HTMLElement>("[data-role='live']");
    if (!live) return;
    const number = li.dataset.sectionNumber ?? "";
    const component = li.dataset.component ?? "";
    const caesar = matchingGroup ? matchCaesarSection(matchingGroup, number, component) : null;

    live.innerHTML = "";
    if (!caesar) {
      live.textContent = matchingGroup ? "(no CAESAR row)" : "(course not on CAESAR)";
      live.dataset.tone = "muted";
      return;
    }

    const status = li.ownerDocument.createElement("span");
    status.className = "bc-cs-status-pill";
    status.dataset.status = caesar.status;
    status.textContent = caesar.status;
    live.appendChild(status);
    touched.push(li);
  });

  return touched;
}

// ── Internals ──────────────────────────────────────────────────────────────

function buildHead(doc: Document, props: CourseCardProps): HTMLElement {
  const id = el(doc, "div", {
    class: "bc-cs-course-id",
    text: formatCourseIdForDisplay(props.row.course.subject, props.row.course.catalog)
  });
  const title = el(doc, "div", {
    class: "bc-cs-course-title",
    text: props.row.course.title
  });

  const units = el(doc, "div", { class: "bc-cs-course-units" });
  if (props.planEntry?.units) {
    units.textContent = `${props.planEntry.units} unit${
      props.planEntry.units === "1.00" ? "" : "s"
    }`;
  }

  // FD badges sit immediately before the units cell so they share the
  // course head's right-hand cluster. Order matches the filter chip order.
  const fdCodes = foundationalDisciplinesFor(props.row.course, props.planEntry);
  const fdRow = el(doc, "div", { class: "bc-cs-course-fds" });
  for (const code of fdCodes) fdRow.appendChild(renderDisciplineIcon(doc, code));

  const meta = el(doc, "div", { class: "bc-cs-course-meta" }, [fdRow, units]);
  return el(doc, "div", { class: "bc-cs-course-head" }, [id, title, meta]);
}

function buildSectionList(
  doc: Document,
  sectionRows: HTMLLIElement[]
): HTMLUListElement {
  const sectionList = el(doc, "ul", { class: "bc-cs-section-list" });
  for (const sectionLi of sectionRows) {
    sectionList.appendChild(sectionLi);
  }
  return sectionList;
}

function buildSectionsDisclosure(
  doc: Document,
  sectionCount: number,
  sectionList: HTMLUListElement
): HTMLElement {
  const summary = el(doc, "summary", {
    class: "bc-cs-sections-summary",
    text: `${sectionCount} sections`
  });

  return el(doc, "details", { class: "bc-cs-sections-disclosure" }, [
    summary,
    sectionList
  ]);
}
