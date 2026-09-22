// paper.nu's schedule-grid cards render only last names ("Smith", or
// "Wolcott, McMullan" for co-taught sections), while CAESAR's CTEC rows
// carry full names ("Zachary B. Smith" vs "Alexander Smith"). A bare last
// name is too vague for `instructorMatches` to claim a row that knows the
// first initial, so without enrichment the combo lens never matches —
// and before that guard, same-last-name professors collided (MATH 331-1:
// Alexander Smith pulling Zachary Smith's CTECs). Side-card and
// class-search paths already produce full names; this module bridges the
// gap for the schedule-grid card path.
//
// Each last name in the label resolves independently:
//   1. the sections the user actually has on their paper.nu schedule for
//      this course — picks the right professor even when another section
//      of the same course is taught by someone with the same last name;
//   2. every section of the course in the active term;
//   3. otherwise the last name stays as-is.

import { logQuiet } from "../../../shared/log";
import { getTermCourses, type PaperSection } from "../class-search/paper-data";
import { parseInstructorNames } from "../ctec-links/helpers";
import type { CtecLinkParams } from "../ctec-links/types";
import { readPaperScheduleSnapshot } from "../paper-combos/data";
import { getActivePaperTermId } from "./paper-active-term";

// Results are revalidated after this long so a term switch, a schedule
// edit, or paper.nu data that wasn't loaded yet on the first try all
// correct themselves without a reload.
const REVALIDATE_MS = 5000;

type CacheEntry = { value: string; checkedAt: number };

// (subject, catalog, label) → enriched label.
const cache = new Map<string, CacheEntry>();
const pendingLookups = new Set<string>();

function cacheKey(params: CtecLinkParams): string {
  return `${params.subject.toLowerCase()}|${params.catalogNumber.toLowerCase()}|${params.instructor.trim().toLowerCase()}`;
}

// Only labels with at least one last-name-only entry need help.
// "Alexander Smith" / "A Smith" already discriminate on their own.
function needsEnrichment(label: string): boolean {
  return parseInstructorNames(label).some((name) => name.firstInitial === null);
}

// Full names from `sections` whose last name matches, deduped.
function fullNamesFor(
  sections: PaperSection[],
  last: string
): Set<string> {
  const names = new Set<string>();
  for (const section of sections) {
    for (const instructor of section.instructors ?? []) {
      const name = instructor.name?.trim();
      if (!name) continue;
      const parsed = parseInstructorNames(name)[0];
      if (parsed?.last === last && parsed.firstInitial) names.add(name);
    }
  }
  return names;
}

// "497-0" and "497" are the same course; "205-3" stays distinct from "205-1".
function bareCatalog(catalog: string): string {
  return catalog.trim().toLowerCase().replace(/-0$/, "");
}

async function resolveLabel(params: CtecLinkParams, doc: Document): Promise<string> {
  const original = params.instructor.trim();
  const { termId } = await getActivePaperTermId(doc);
  if (!termId) return original;

  // Match on each section's own number, not the course's: paper.nu files
  // cross-listed sections under one course (COMP_SCI 397-0 holds the
  // 497-0 sections too), so a course-keyed lookup for 497 finds nothing.
  const wanted = bareCatalog(params.catalogNumber);
  const termSections = (await getTermCourses(termId)).flatMap((course) =>
    course.sections.filter(
      (s) =>
        s.subject === params.subject &&
        bareCatalog(s.number ?? s.catalog) === wanted
    )
  );
  if (termSections.length === 0) return original;

  const schedule = await readPaperScheduleSnapshot();
  const scheduledIds =
    schedule?.termId === termId ? new Set(schedule.sectionIds) : new Set<string>();
  const scheduledSections = termSections.filter((s) => scheduledIds.has(s.section_id));

  const parts = original.split(",").map((part) => {
    const trimmed = part.trim();
    const parsed = parseInstructorNames(trimmed)[0];
    if (!parsed || parsed.firstInitial) return trimmed;
    for (const pool of [scheduledSections, termSections]) {
      const names = fullNamesFor(pool, parsed.last);
      if (names.size === 1) return [...names][0]!;
      // Ambiguous inside the user's own schedule — the broader term pool
      // can only be more ambiguous, so stop here.
      if (names.size > 1) return trimmed;
    }
    return trimmed;
  });
  return parts.filter(Boolean).join(", ");
}

// Returns the enriched instructor label, or `params.instructor` unchanged
// when nothing could be resolved.
export async function enrichInstructorName(
  params: CtecLinkParams,
  doc: Document = document
): Promise<string> {
  const original = params.instructor.trim();
  if (!needsEnrichment(original)) return original;

  const key = cacheKey(params);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.checkedAt < REVALIDATE_MS) return cached.value;

  let value = original;
  try {
    value = await resolveLabel(params, doc);
  } catch (err) {
    logQuiet("paper-ctec.enrich-instructor", err);
  }
  cache.set(key, { value, checkedAt: Date.now() });
  return value;
}

// Returns params with `instructor` swapped for the enriched label when
// available. The CtecLinkParams shape is otherwise untouched so
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

// Sync counterpart for render paths. Cache reads (chip cached aggregate,
// hover preview, analytics modal) must use the same enriched name the
// fetch wrote under. Returns the last known enrichment immediately; when
// there is none yet or it's stale, kicks one async lookup and calls
// `onResolved` if the answer changed so the caller can re-render.
export function peekEnrichedParams(
  params: CtecLinkParams,
  doc: Document,
  onResolved: () => void
): CtecLinkParams {
  if (!needsEnrichment(params.instructor)) return params;
  const key = cacheKey(params);
  const cached = cache.get(key);
  const stale = !cached || Date.now() - cached.checkedAt >= REVALIDATE_MS;
  if (stale && !pendingLookups.has(key)) {
    pendingLookups.add(key);
    const previous = cached?.value ?? params.instructor.trim();
    void enrichInstructorName(params, doc).then((value) => {
      pendingLookups.delete(key);
      if (value !== previous) onResolved();
    });
  }
  const value = cached?.value;
  return value && value !== params.instructor ? { ...params, instructor: value } : params;
}

export function clearInstructorEnrichmentCache(): void {
  cache.clear();
  pendingLookups.clear();
}
