// Empty-state "Your classes" view: rich cards rendered against the
// cart-cache so the user lands on a useful overview when the search box
// is blank instead of a hint string.
//
// Pure render — `findPaperSection` + the meeting/instructor formatters
// stay here as helpers because they are one-shot derivations that happen
// during render and don't outlive the call.
//
// The card surfaces every metadata lane we already have for the section
// (course id, title + topic, units, distro / discipline / school tags,
// per-pattern meeting+room lines, instructor, CAESAR class number,
// capacity, section date range, course description). Everything degrades
// gracefully when paper.nu data hasn't loaded yet — the head + status
// badge always render.

import { el } from "../../../framework/dom";
import type { CartEntry } from "../../../cart-cache";
import { formatCourseIdForDisplay } from "../catalog-format";
import {
  formatInstructors,
  formatMeetingPattern,
  formatRoom,
  meetingPatternCount
} from "../filter";
import type { PaperCourse, PaperSection, PaperTermCourse } from "../paper-data";
import { PAPER_DISCIPLINE_LABELS, PAPER_DISTRO_LABELS } from "../types";

export type MyClassesProps = {
  /** Currently-loaded paper.nu term sections used to enrich cards with
   *  title / instructors / meeting pattern / room. May be empty when the
   *  term hasn't finished loading. */
  paperCourses: PaperTermCourse[];
  /** Plan-level catalog index keyed by `${subject} ${catalog}`. Used to
   *  pull units, distros, disciplines, and the long-form description for
   *  each card. May be an empty Map; the card degrades gracefully. */
  catalogIndex: Map<string, PaperCourse>;
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

  const grid = el(doc, "div", { class: "bc-cs-myclasses-grid" });
  for (const entry of entries) {
    grid.appendChild(renderCard(doc, entry, status, props));
  }

  return el(doc, "section", { class: "bc-cs-myclasses" }, [heading, grid]);
}

function renderCard(
  doc: Document,
  entry: CartEntry,
  status: "in-cart" | "enrolled",
  props: MyClassesProps
): HTMLElement {
  const card = el(doc, "div", {
    class: "bc-cs-myclass-card",
    dataset: { status }
  });

  // Resolve paper.nu data first so the plan lookup can prefer the
  // resolved catalog (`111-0`) over whatever's stored on the cart entry
  // (which can drift — e.g. CAESAR uses bare `111`).
  const paper =
    props.paperCourses.length > 0 ? findPaperSection(props.paperCourses, entry) : null;
  const planEntry = paper
    ? props.catalogIndex.get(`${paper.course.subject} ${paper.course.catalog}`) ?? null
    : props.catalogIndex.get(`${entry.subject} ${entry.catalog}`) ?? null;

  // Head: course id, section label, status badge.
  card.appendChild(
    el(doc, "div", { class: "bc-cs-myclass-head" }, [
      el(doc, "span", {
        class: "bc-cs-myclass-id",
        text: formatCourseIdForDisplay(entry.subject, entry.catalog)
      }),
      el(doc, "span", {
        class: "bc-cs-myclass-section",
        text: entry.sectionLabel
      }),
      el(doc, "span", {
        class: "bc-cs-myclass-badge",
        dataset: { status },
        text: status === "enrolled" ? "Enrolled" : "In cart"
      })
    ])
  );

  // Title: course title + topic when the section is topic-based (e.g.
  // ENGLISH 270 "Topics in Literature: Speculative Fiction"). Falls back
  // to the cart-page description when paper.nu data hasn't loaded.
  const titleText = formatTitle(paper, entry);
  if (titleText) {
    card.appendChild(
      el(doc, "div", { class: "bc-cs-myclass-title", text: titleText })
    );
  }

  // Tags: units, distros, disciplines, school. Mirrors the search-result
  // course-card tag row but compact.
  const tags = buildTags(doc, planEntry, paper?.course ?? null);
  if (tags.childElementCount > 0) card.appendChild(tags);

  // Per-pattern meeting + room lines. Each meeting pattern (some courses
  // have two, e.g. lecture MoWe + Fri lab) gets its own line so the room
  // sits next to the time it applies to.
  if (paper?.section) {
    const patterns = meetingPatternCount(paper.section);
    for (let i = 0; i < patterns; i += 1) {
      const m = formatMeetingPattern(paper.section, i);
      const r = formatRoom(paper.section, i);
      const text = [m, r].filter((s): s is string => Boolean(s)).join(" · ");
      if (!text) continue;
      card.appendChild(
        el(doc, "div", { class: "bc-cs-myclass-detail", text })
      );
    }

    const instr = formatInstructors(paper.section);
    if (instr) {
      card.appendChild(
        el(doc, "div", {
          class: "bc-cs-myclass-detail",
          dataset: { kind: "instructor" },
          text: instr
        })
      );
    }
  }

  // Meta line: class number + capacity + date range. Uses a thin
  // monospace-ish look so it reads as raw facts.
  const metaParts: string[] = [];
  if (entry.classNumber) metaParts.push(`#${entry.classNumber}`);
  if (paper?.section.capacity) metaParts.push(`cap ${paper.section.capacity}`);
  if (paper?.section.start_date && paper.section.end_date) {
    metaParts.push(`${paper.section.start_date} – ${paper.section.end_date}`);
  }
  if (metaParts.length > 0) {
    card.appendChild(
      el(doc, "div", { class: "bc-cs-myclass-facts", text: metaParts.join(" · ") })
    );
  }

  // Course-level description. Clamped via CSS to keep cards compact.
  if (planEntry?.description) {
    card.appendChild(
      el(doc, "div", {
        class: "bc-cs-myclass-desc",
        text: planEntry.description
      })
    );
  }

  return card;
}

function formatTitle(
  paper: { course: PaperTermCourse; section: PaperSection } | null,
  entry: CartEntry
): string {
  const title = paper?.course.title ?? entry.description ?? "";
  const topic = paper?.section.topic;
  if (title && topic) return `${title} — ${topic}`;
  return title;
}

function buildTags(
  doc: Document,
  planEntry: PaperCourse | null,
  course: PaperTermCourse | null
): HTMLElement {
  const tags = el(doc, "div", { class: "bc-cs-myclass-tags" });

  if (planEntry?.units) {
    const units = planEntry.units;
    tags.appendChild(
      el(doc, "span", {
        class: "bc-cs-myclass-tag",
        dataset: { kind: "units" },
        text: `${units} unit${units === "1.00" ? "" : "s"}`
      })
    );
  }

  if (planEntry?.distros) {
    for (const code of planEntry.distros) {
      const label = PAPER_DISTRO_LABELS[code];
      if (!label) continue;
      tags.appendChild(
        el(doc, "span", {
          class: "bc-cs-myclass-tag",
          dataset: { kind: "distro" },
          text: `Dist ${code} · ${label}`
        })
      );
    }
  }

  if (planEntry?.disciplines) {
    for (const code of planEntry.disciplines) {
      const label = PAPER_DISCIPLINE_LABELS[code];
      if (!label) continue;
      tags.appendChild(
        el(doc, "span", {
          class: "bc-cs-myclass-tag",
          dataset: { kind: "discipline" },
          text: `Disc ${code} · ${label}`
        })
      );
    }
  }

  const school = course?.school ?? planEntry?.school;
  if (school) {
    tags.appendChild(
      el(doc, "span", {
        class: "bc-cs-myclass-tag",
        dataset: { kind: "school" },
        text: school
      })
    );
  }

  return tags;
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
