// Course card: header (subject / catalog / units / title), distro/discipline
// tag pills, refresh button, description, and the section list.
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
import type { PaperCourse } from "../paper-data";
import { PAPER_DISCIPLINE_LABELS, PAPER_DISTRO_LABELS, type ResultRow } from "../types";

export type CourseCardProps = {
  row: ResultRow;
  /** Plan-level metadata for this course (units, distros, disciplines, description). */
  planEntry: PaperCourse | null;
  /** Pre-built section row elements (one per section). The view appends them
   *  in order — section-row.ts is the canonical builder. */
  sectionRows: HTMLLIElement[];
  /** User-clicked refresh of CAESAR live data. The view manages the spinner
   *  affordance after dispatch; the augmentation handles the actual fetch. */
  onRefresh(): void;
};

export function renderCourseCard(
  doc: Document,
  props: CourseCardProps
): HTMLElement {
  const card = el(doc, "div", { class: "bc-cs-course" });

  card.appendChild(buildHead(doc, props));
  card.appendChild(buildTags(doc, props));

  if (props.planEntry?.description) {
    card.appendChild(
      el(doc, "div", {
        class: "bc-cs-course-desc",
        text: props.planEntry.description
      })
    );
  }

  const sectionList = el(doc, "ul", { class: "bc-cs-section-list" });
  for (const sectionLi of props.sectionRows) {
    sectionList.appendChild(sectionLi);
  }
  card.appendChild(sectionList);

  return card;
}

// Paint live CAESAR data onto a course card that's already in the DOM.
// Reveals the refresh affordance and updates each section row's live cell
// with a status pill. Returns the section LIs whose status pill changed so
// callers can re-evaluate cart-cache state on freshly-resolved class
// numbers.
export function applyLiveDataToCard(
  card: HTMLElement,
  result: CaesarSearchResult,
  wantCatalog: string
): HTMLLIElement[] {
  const refreshBtn = card.querySelector<HTMLButtonElement>(".bc-cs-refresh-btn");
  if (refreshBtn) refreshBtn.style.display = "";

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

  return el(doc, "div", { class: "bc-cs-course-head" }, [id, title, units]);
}

function buildTags(doc: Document, props: CourseCardProps): HTMLElement {
  const tags = el(doc, "div", { class: "bc-cs-course-tags" });

  if (props.row.course.school) {
    tags.appendChild(
      el(doc, "span", {
        class: "bc-cs-tag",
        dataset: { kind: "school" },
        text: props.row.course.school
      })
    );
  }

  if (props.planEntry?.distros) {
    for (const code of props.planEntry.distros) {
      const label = PAPER_DISTRO_LABELS[code];
      if (!label) continue;
      tags.appendChild(
        el(doc, "span", {
          class: "bc-cs-tag",
          dataset: { kind: "distro" },
          text: `Dist ${code} · ${label}`
        })
      );
    }
  }

  if (props.planEntry?.disciplines) {
    for (const code of props.planEntry.disciplines) {
      const label = PAPER_DISCIPLINE_LABELS[code];
      if (!label) continue;
      tags.appendChild(
        el(doc, "span", {
          class: "bc-cs-tag",
          dataset: { kind: "discipline" },
          text: `Disc ${code} · ${label}`
        })
      );
    }
  }

  // Refresh button — hidden until live data is loaded. Lets the user
  // bypass the 15-min catalog cache when they want fresher seat status.
  const refreshBtn = el(doc, "button", {
    class: "bc-cs-refresh-btn",
    text: "↻",
    attrs: {
      type: "button",
      title: "Refresh seat status from CAESAR",
      "aria-label": "Refresh seat status from CAESAR"
    },
    dataset: { role: "refresh-live" },
    style: { display: "none" },
    on: {
      click: () => {
        // Spinner state managed by the caller via dataset transitions —
        // see ClassSearchAugmentation.refreshLiveData.
        props.onRefresh();
      }
    }
  });
  tags.appendChild(refreshBtn);

  return tags;
}
