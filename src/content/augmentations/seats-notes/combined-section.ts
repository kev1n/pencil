// Resolver for combined-section per-section seat numbers. CAESAR's detail
// page pools enrollment across cross-listed sections (e.g. COMP_SCI 346 +
// COMP_ENG 346 share one "Combined Section Capacity: 60") so users can't
// tell how many seats are allocated to the section they care about. We
// reconstruct it from two sources:
//
//   - per-section ENROLLED comes from CAESAR's own "Combined Section" grid
//     (already in the response we fetched; parsed into combinedSectionRows).
//   - per-section CAPACITY comes from paper.nu's term catalog. paper.nu
//     stores each cross-listed section as its own course entry with its
//     own `capacity` field, so a hash lookup by subject+catalog returns
//     this section's slice.
//
// Returns null when either half is missing — callers fall back to the
// generic disclaimer.

import { getTermCourseByKey } from "../class-search/paper-data";
import { logDebug, logQuiet } from "../../../shared/log";

import type { CombinedSectionRow, SeatsNotesSuccess } from "./types";

const SCOPE = "seats-notes.combined-section";

export type PerSectionSeats = {
  capacity: number;
  enrolled: number;
  available: number;
  waitlist: number | null;
  status: string | null;
  // Identifies which combined-grid row we matched against (for display +
  // debugging). e.g. "COMP_SCI 346-0-1".
  label: string;
};

export async function resolvePerSectionSeats(
  result: SeatsNotesSuccess,
  termId: string | null
): Promise<PerSectionSeats | null> {
  if (!result.isCombinedSection) {
    logDebug(SCOPE, "skip: not a combined section");
    return null;
  }
  if (!termId) {
    logDebug(SCOPE, "skip: no termId (STRM not detected on page)");
    return null;
  }

  // Defensive: older cached entries may pre-date the combinedSectionRows
  // field. Treat undefined as empty so we don't throw.
  const rows = result.combinedSectionRows ?? [];
  const row = findMatchingRow(rows, result.requestedClassNumber);
  if (!row) {
    logDebug(SCOPE, "skip: no SCTN_CMBND row matched requested classNumber", {
      requested: result.requestedClassNumber,
      rowsLen: rows.length,
      rowClassNumbers: rows.map((r) => r.classNumber)
    });
    return null;
  }

  const parsedLabel = splitLabel(row.label);
  if (!parsedLabel) {
    logDebug(SCOPE, "skip: could not split label", { label: row.label });
    return null;
  }

  try {
    const course = await getTermCourseByKey(
      termId,
      parsedLabel.subject,
      parsedLabel.catalog
    );
    if (!course) {
      logDebug(SCOPE, "skip: paper.nu has no course at this key", {
        termId,
        key: `${parsedLabel.subject}|${parsedLabel.catalog}`
      });
      return null;
    }

    const section = course.sections.find(
      (s) =>
        normalizeSectionNum(s.section) === parsedLabel.section &&
        (row.component ? s.component === row.component : true)
    );
    if (!section?.capacity) {
      logDebug(SCOPE, "skip: paper.nu course found but no section.capacity", {
        wantedSection: parsedLabel.section,
        wantedComponent: row.component,
        availableSections: course.sections.map((s) => ({
          section: s.section,
          component: s.component,
          capacity: s.capacity
        }))
      });
      return null;
    }

    const capacity = parseCount(section.capacity);
    const enrolled = parseCount(row.enrolled);
    if (capacity === null || enrolled === null) {
      logDebug(SCOPE, "skip: capacity or enrolled didn't parse to number", {
        rawCapacity: section.capacity,
        rawEnrolled: row.enrolled
      });
      return null;
    }

    logDebug(SCOPE, "resolved", {
      label: row.label,
      capacity,
      enrolled,
      available: Math.max(0, capacity - enrolled)
    });
    return {
      capacity,
      enrolled,
      available: Math.max(0, capacity - enrolled),
      waitlist: parseCount(row.waitlist),
      status: row.status,
      label: row.label
    };
  } catch (err) {
    logQuiet(SCOPE, err);
    return null;
  }
}

function findMatchingRow(
  rows: CombinedSectionRow[],
  classNumber: string
): CombinedSectionRow | null {
  return rows.find((r) => r.classNumber === classNumber) ?? null;
}

// CAESAR's combined-grid label is "SUBJ CCC-C-S" (e.g. "COMP_SCI 346-0-1");
// paper.nu's catalog field is "CCC-C" (e.g. "346-0"). Split into the three
// pieces so we can key the lookup correctly.
function splitLabel(
  label: string
): { subject: string; catalog: string; section: string } | null {
  const tokens = label.trim().split(/\s+/);
  if (tokens.length < 2) return null;
  const subject = tokens[0]!;
  const rest = tokens.slice(1).join("-");
  // Catalog convention: "346-0-1" → catalog "346-0", section "1".
  const lastDash = rest.lastIndexOf("-");
  if (lastDash <= 0) return null;
  const catalog = rest.slice(0, lastDash);
  const section = normalizeSectionNum(rest.slice(lastDash + 1));
  return { subject, catalog, section };
}

// paper.nu may store sections as "1" or "01" — strip leading zeros for
// comparison.
function normalizeSectionNum(s: string): string {
  return s.replace(/^0+/, "") || "0";
}

function parseCount(value: string | null): number | null {
  if (value === null) return null;
  const n = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
