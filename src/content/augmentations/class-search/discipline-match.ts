// Shared Foundational Discipline tag-matching helpers. Used by the search
// filter (does this course satisfy any of the user's chip selections?) and
// by the card view (which FD badges should I render?). Centralized here so
// the tag-source rules (course-level vs section-level, distros vs
// disciplines fields) live in exactly one place.

import type { PaperCourse, PaperSection, PaperTermCourse } from "./paper-data";
import { FOUNDATIONAL_DISCIPLINES } from "./types";
import type { FoundationalDisciplineCode } from "./types";

export function matchesAnyDiscipline(
  course: PaperTermCourse,
  catalogIndex: Map<string, PaperCourse>,
  codes: ReadonlySet<FoundationalDisciplineCode>
): boolean {
  const catalog = catalogIndex.get(`${course.subject} ${course.catalog}`);
  for (const code of codes) {
    const fd = FOUNDATIONAL_DISCIPLINES.find((f) => f.code === code);
    if (!fd) continue;
    if (catalog && courseHasFdTag(catalog, fd)) return true;
    for (const section of course.sections) {
      if (sectionHasFdTag(section, fd)) return true;
    }
  }
  return false;
}

// Returns the FDs this course satisfies, in display order (the order
// declared in FOUNDATIONAL_DISCIPLINES — same order the chips render).
export function foundationalDisciplinesFor(
  course: PaperTermCourse,
  planEntry: PaperCourse | null
): FoundationalDisciplineCode[] {
  const matched = new Set<FoundationalDisciplineCode>();
  for (const fd of FOUNDATIONAL_DISCIPLINES) {
    if (planEntry && courseHasFdTag(planEntry, fd)) {
      matched.add(fd.code);
      continue;
    }
    for (const section of course.sections) {
      if (sectionHasFdTag(section, fd)) {
        matched.add(fd.code);
        break;
      }
    }
  }
  return FOUNDATIONAL_DISCIPLINES.filter((fd) => matched.has(fd.code)).map((fd) => fd.code);
}

function courseHasFdTag(
  course: PaperCourse,
  fd: { distros?: string; disciplines?: string }
): boolean {
  if (fd.distros && course.distros && course.distros.includes(fd.distros)) return true;
  if (fd.disciplines && course.disciplines && course.disciplines.includes(fd.disciplines))
    return true;
  return false;
}

function sectionHasFdTag(
  section: PaperSection,
  fd: { distros?: string; disciplines?: string }
): boolean {
  if (fd.distros && section.distros && section.distros.includes(fd.distros)) return true;
  if (fd.disciplines && section.disciplines && section.disciplines.includes(fd.disciplines))
    return true;
  return false;
}
