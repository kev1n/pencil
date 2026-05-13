// Per-section analytics-lens preference. Once the user explicitly
// picks a lens (Combo / Course / Prof) for a section via the dry-run
// wizard or the modal strategy tabs, we remember that choice so the
// next modal open and the schedule-chip rating both default to it —
// instead of re-running the same "Smith hasn't taught CS 213, pick
// an alternative" wizard every time. Preference is stored alongside
// the subject's CTEC index (CtecSubjectIndex.sectionLens), so "Clear
// CTEC cache" naturally wipes it too.
//
// Keying: `${catalogNumber}|${normalizedInstructor}` — same schema as
// the discovery-state map, so they share the same per-section
// identity. An empty instructor (course-wide queries) maps onto its
// own key naturally.

import { normalizeSearch } from "../../ctec-index/helpers";
import { readSubjectIndex, writeSubjectIndex } from "../../ctec-index/storage";
import type { CtecAnalyticsStrategy, CtecLinkParams } from "./types";

const VALID_LENSES: ReadonlySet<CtecAnalyticsStrategy> = new Set<CtecAnalyticsStrategy>([
  "combo",
  "course",
  "instructor"
]);

function buildSectionKey(catalogNumber: string, instructor: string): string {
  return `${catalogNumber}|${normalizeSearch(instructor)}`;
}

export function getSectionLens(
  params: CtecLinkParams
): CtecAnalyticsStrategy | null {
  const index = readSubjectIndex(params.subject);
  if (!index?.sectionLens) return null;
  const key = buildSectionKey(params.catalogNumber, params.instructor);
  const raw = index.sectionLens[key];
  if (raw && VALID_LENSES.has(raw)) return raw;
  return null;
}

// Records the user's explicit lens pick for this section. No-op when
// the subject index doesn't exist yet — every code path that writes
// preference runs after a fetch attempt, so the index has been
// created via writeSubjectIndex by then. Guarded anyway so a future
// caller can't crash on a missing index.
export function setSectionLens(
  params: CtecLinkParams,
  lens: CtecAnalyticsStrategy
): void {
  const index = readSubjectIndex(params.subject);
  if (!index) return;
  const key = buildSectionKey(params.catalogNumber, params.instructor);
  if (index.sectionLens?.[key] === lens) return;
  const next: Record<string, CtecAnalyticsStrategy> = {
    ...(index.sectionLens ?? {}),
    [key]: lens
  };
  writeSubjectIndex(params.subject, { ...index, sectionLens: next });
}

// Confirmed-via-wizard signal. The schedule chip honors `getSectionLens`
// only for sections marked confirmed — tab clicks update the lens
// preference for the modal but leave the chip rating alone (so users
// can browse Course/Prof views without changing the at-a-glance
// rating on the card). Setting this also updates the lens so callers
// can persist both in one step.
export function setSectionLensConfirmed(
  params: CtecLinkParams,
  lens: CtecAnalyticsStrategy
): void {
  const index = readSubjectIndex(params.subject);
  if (!index) return;
  const key = buildSectionKey(params.catalogNumber, params.instructor);
  const nextLens: Record<string, CtecAnalyticsStrategy> = {
    ...(index.sectionLens ?? {}),
    [key]: lens
  };
  const nextConfirmed: Record<string, true> = {
    ...(index.sectionLensConfirmed ?? {}),
    [key]: true
  };
  if (
    index.sectionLens?.[key] === lens &&
    index.sectionLensConfirmed?.[key] === true
  ) {
    return;
  }
  writeSubjectIndex(params.subject, {
    ...index,
    sectionLens: nextLens,
    sectionLensConfirmed: nextConfirmed
  });
}

export function isSectionLensConfirmed(params: CtecLinkParams): boolean {
  const index = readSubjectIndex(params.subject);
  if (!index?.sectionLensConfirmed) return false;
  const key = buildSectionKey(params.catalogNumber, params.instructor);
  return index.sectionLensConfirmed[key] === true;
}
