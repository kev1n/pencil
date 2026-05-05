// Empty-state "Your classes" view: compact cards rendered against the
// cart-cache so the user lands on a useful overview when the search box
// is blank instead of a hint string.
//
// Pure render — `findPaperSection` + the meeting/instructor formatters
// stay here as helpers because they are one-shot derivations that happen
// during render and don't outlive the call.

import { el } from "../../../framework/dom";
import type { CartEntry } from "../../../cart-cache";
import { formatCourseIdForDisplay } from "../catalog-format";
import {
  formatInstructors,
  formatMeetingPattern,
  meetingPatternCount
} from "../filter";
import type { PaperSection, PaperTermCourse } from "../paper-data";

export type MyClassesProps = {
  /** Currently-loaded paper.nu term sections used to enrich cards with
   *  title / instructors / meeting pattern. May be empty when the term
   *  hasn't finished loading. */
  paperCourses: PaperTermCourse[];
  enrolled: CartEntry[];
  inCart: CartEntry[];
};

export function renderMyClassesView(
  doc: Document,
  props: MyClassesProps
): HTMLElement {
  // `display: contents` keeps the wrap out of the box tree so the two
  // <section> children behave as direct siblings in the results column —
  // matching the pre-extraction DOM layout exactly.
  const wrap = el(doc, "div", {
    class: "bc-cs-myclasses-wrap",
    style: { display: "contents" }
  });

  if (props.enrolled.length > 0) {
    wrap.appendChild(
      renderSection(doc, "Enrolled", props.enrolled, "enrolled", props.paperCourses)
    );
  }
  if (props.inCart.length > 0) {
    wrap.appendChild(
      renderSection(doc, "In your cart", props.inCart, "in-cart", props.paperCourses)
    );
  }

  return wrap;
}

function renderSection(
  doc: Document,
  label: string,
  entries: CartEntry[],
  status: "in-cart" | "enrolled",
  paperCourses: PaperTermCourse[]
): HTMLElement {
  const heading = el(doc, "div", { class: "bc-cs-myclasses-heading" }, [
    el(doc, "span", { class: "bc-cs-myclasses-label", text: label }),
    el(doc, "span", { class: "bc-cs-myclasses-count", text: `${entries.length}` })
  ]);

  const grid = el(doc, "div", { class: "bc-cs-myclasses-grid" });
  for (const entry of entries) {
    grid.appendChild(renderCard(doc, entry, status, paperCourses));
  }

  return el(doc, "section", { class: "bc-cs-myclasses" }, [heading, grid]);
}

function renderCard(
  doc: Document,
  entry: CartEntry,
  status: "in-cart" | "enrolled",
  paperCourses: PaperTermCourse[]
): HTMLElement {
  const card = el(doc, "div", {
    class: "bc-cs-myclass-card",
    dataset: { status }
  });

  const header = el(doc, "div", { class: "bc-cs-myclass-head" }, [
    el(doc, "span", {
      class: "bc-cs-myclass-id",
      text: formatCourseIdForDisplay(entry.subject, entry.catalog)
    }),
    el(doc, "span", {
      class: "bc-cs-myclass-section",
      text: entry.sectionLabel
    })
  ]);

  const meta = el(doc, "div", { class: "bc-cs-myclass-meta" }, [
    el(doc, "span", {
      class: "bc-cs-myclass-badge",
      dataset: { status },
      text: status === "enrolled" ? "Enrolled" : "In cart"
    })
  ]);

  // Enrich with paper.nu data when we have it loaded — title at minimum,
  // plus instructor + meeting pattern if the section resolves cleanly.
  const paper = paperCourses.length > 0 ? findPaperSection(paperCourses, entry) : null;
  if (paper?.course.title) {
    card.append(
      header,
      el(doc, "div", { class: "bc-cs-myclass-title", text: paper.course.title }),
      meta
    );
  } else {
    card.append(header, meta);
  }

  if (paper?.section) {
    const lines: string[] = [];
    const patterns = meetingPatternCount(paper.section);
    const meetings: string[] = [];
    for (let i = 0; i < patterns; i += 1) {
      const m = formatMeetingPattern(paper.section, i);
      if (m) meetings.push(m);
    }
    if (meetings.length > 0) lines.push(meetings.join(" · "));
    const instr = formatInstructors(paper.section);
    if (instr) lines.push(instr);
    if (lines.length > 0) {
      card.appendChild(
        el(doc, "div", {
          class: "bc-cs-myclass-detail",
          text: lines.join(" — ")
        })
      );
    }
  }

  return card;
}

// Look up the paper.nu course + section that a cart entry points to so
// the "Your classes" cards can render title + instructor + meetings.
// Tolerates paper.nu's catalog ("111") vs CAESAR's ("111-0") drift the
// same way `matchCaesarGroup` does.
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
    for (const section of course.sections) {
      const sNum = (section.section ?? "").replace(/^0+/, "") || "0";
      if (sNum !== normSec) continue;
      if ((section.component ?? "").toUpperCase() !== normComp) continue;
      return { course, section };
    }
  }
  return null;
}
