// CAESAR's detail page pools enrollment across cross-listed sections
// (e.g. COMP_SCI 346 + COMP_ENG 346 share one "Combined Section Capacity:
// 60") and never exposes the per-section breakdown — there's no field in
// the response that says "this section gets 30 of those 60". pencil.nu
// reconstructs it by stitching two sources:
//
//   - per-section ENROLLED comes from the SCTN_CMBND grid in the same
//     CAESAR response (already parsed into combinedSectionRows).
//   - per-section CAPACITY comes from paper.nu's term catalog, where
//     each cross-listed section is its own course entry with its own cap.
//
// Returns null when either half is missing — callers fall back to the
// generic disclaimer.
import { parseClassText } from "../../cart-cache/parse-cart-page";
import { normalizeSectionNumber } from "../class-search/caesar-search/parser";
import { getTermCourseByKey } from "../class-search/paper-data";
import { logQuiet } from "../../../shared/log";

import { parseCount } from "./helpers";
import type { SeatsNotesSuccess } from "./types";

export type PerSectionSeats = {
  capacity: number;
  enrolled: number;
  available: number;
  waitlist: number | null;
  status: string | null;
  label: string;
};

export async function resolvePerSectionSeats(
  result: SeatsNotesSuccess,
  termId: string | null
): Promise<PerSectionSeats | null> {
  if (!result.isCombinedSection || !termId) return null;

  const row = result.combinedSectionRows.find(
    (r) => r.classNumber === result.requestedClassNumber
  );
  if (!row) return null;

  // row.label is "SUBJ catalog-section" (component already split out);
  // parseClassText wants "SUBJ catalog-section (classNbr)".
  const parsed = parseClassText(`${row.label} (${row.classNumber})`);
  if (!parsed) return null;

  try {
    const course = await getTermCourseByKey(termId, parsed.subject, parsed.catalog);
    if (!course) return null;

    const wantSection = normalizeSectionNumber(parsed.sectionLabel);
    const section = course.sections.find(
      (s) =>
        normalizeSectionNumber(s.section) === wantSection &&
        (row.component ? s.component === row.component : true)
    );
    const capacity = parseCount(section?.capacity);
    const enrolled = parseCount(row.enrolled);
    if (capacity === null || enrolled === null) return null;

    return {
      capacity,
      enrolled,
      available: Math.max(0, capacity - enrolled),
      waitlist: parseCount(row.waitlist),
      status: row.status,
      label: row.label
    };
  } catch (err) {
    logQuiet("seats-notes.combined-section", err);
    return null;
  }
}
