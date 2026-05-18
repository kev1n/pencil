// paper.nu's schedule-grid cards render only the last name ("Smith"),
// while CAESAR's CTEC directory carries full names ("Zachary B. Smith"
// vs "Alexander Smith"). Sending the bare last name into the Prof-lens
// search means same-last-name professors in a department collide — the
// reporter caught this on MATH 331-1 (Alexander Smith) pulling Zachary
// Smith's CTECs. Side-card and class-search paths already produce full
// names; this module bridges the gap for the schedule-grid card path
// by reading paper.nu's plan data, which always carries the full name
// CAESAR uses on the directory side.

import { logQuiet } from "../../../shared/log";
import { findTermCoursesByCatalog } from "../class-search/paper-data";
import { extractLastNameTokens } from "../ctec-links/helpers";
import type { CtecLinkParams } from "../ctec-links/types";
import { getActivePaperTermId } from "./paper-active-term";

// (subject, catalog, last-name-lower) → enriched full name.
// Cache miss persists `null` so we don't re-attempt enrichments we
// already proved we can't resolve.
const cache = new Map<string, string | null>();

function cacheKey(subject: string, catalog: string, lastName: string): string {
  return `${subject.toLowerCase()}|${catalog.toLowerCase()}|${lastName.toLowerCase()}`;
}

// Returns the enriched instructor string when paper.nu's section data
// unambiguously identifies a full name behind the partial label. Returns
// `params.instructor` unchanged when:
//   - the label already has a first-name component (anything multi-token),
//   - paper.nu hasn't loaded plan data yet,
//   - no section under (subject, catalog) carries an instructor whose
//     last name matches the requested label, or
//   - multiple distinct full names share the requested last name (can't
//     pick one without meeting-pattern context the caller doesn't pass).
export async function enrichInstructorName(
  params: CtecLinkParams,
  doc: Document = document
): Promise<string> {
  const original = params.instructor.trim();
  if (!original) return original;

  // Multi-token labels — "Alexander Smith", "A Smith", "Smith, Doe" —
  // already discriminate via `instructorMatches`. Only single-token
  // last-name-only inputs (paper.nu's grid card abbreviation) need help.
  if (original.split(/\s+/).filter(Boolean).length !== 1) return original;

  const last = extractLastNameTokens(original)[0];
  if (!last) return original;

  const key = cacheKey(params.subject, params.catalogNumber, last);
  if (cache.has(key)) {
    return cache.get(key) ?? original;
  }

  let enriched: string | null = null;
  try {
    const { termId } = await getActivePaperTermId(doc);
    if (termId) {
      const courses = await findTermCoursesByCatalog(
        termId,
        params.subject,
        params.catalogNumber
      );
      const fullNames = new Set<string>();
      for (const course of courses) {
        for (const section of course.sections) {
          for (const instructor of section.instructors ?? []) {
            const name = instructor.name?.trim();
            if (!name) continue;
            const candidateLast = extractLastNameTokens(name)[0];
            if (candidateLast === last) fullNames.add(name);
          }
        }
      }
      if (fullNames.size === 1) {
        enriched = [...fullNames][0] ?? null;
      }
    }
  } catch (err) {
    logQuiet("paper-ctec.enrich-instructor", err);
  }

  cache.set(key, enriched);
  return enriched ?? original;
}

// Returns params with `instructor` swapped for the enriched full name
// when available. The CtecLinkParams shape is otherwise untouched so
// downstream cache keys, retries, and UI labels all see a consistent
// identity.
export async function enrichParams(
  params: CtecLinkParams,
  doc: Document = document
): Promise<CtecLinkParams> {
  const enriched = await enrichInstructorName(params, doc);
  if (enriched === params.instructor) return params;
  return { ...params, instructor: enriched };
}

export function clearInstructorEnrichmentCache(): void {
  cache.clear();
}
