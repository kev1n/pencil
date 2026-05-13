// Build the CTEC identity (params + course key + titleHint) for a
// class-search section row. CTEC reports are matched per-instructor on
// (subject, catalogNumber, instructor), so the chip widget sits on the
// section row — not the course card — to keep multi-instructor courses
// accurate.
//
// Mirrors paper-ctec/identity.ts so the shared ModalController +
// fetchCtecReportAggregate path receives a key in the same shape both
// surfaces produce.

import type { CtecLinkParams } from "../../ctec-links/types";
import { formatCatalogForDisplay } from "../catalog-format";
import { formatInstructors } from "../filter";
import type { PaperSection, PaperTermCourse } from "../paper-data";

export type CtecSectionIdentity = {
  key: string;
  params: CtecLinkParams;
  titleHint: string;
};

export function buildCtecSectionIdentity(
  course: PaperTermCourse,
  section: PaperSection
): CtecSectionIdentity | null {
  const instructor = formatInstructors(section);
  if (!instructor || instructor === "Staff") return null;

  const params: CtecLinkParams = {
    subject: course.subject,
    // Preserve the sequence suffix (e.g. "205-3") so CTEC can disambiguate
    // sibling sequence courses; strip only paper.nu's "-0" default suffix.
    catalogNumber: formatCatalogForDisplay(course.catalog),
    instructor
  };
  const titleHint = course.title ?? "";
  const key = buildKey(params, titleHint);
  return { key, params, titleHint };
}

function buildKey(params: CtecLinkParams, titleHint: string): string {
  const title = titleHint.toLowerCase().replace(/\s+/g, " ").trim();
  return `${params.subject}:${params.catalogNumber}:${params.instructor.toLowerCase().trim()}:${title}`;
}
