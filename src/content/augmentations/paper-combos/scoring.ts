import { getRecentAggregationTerms } from "../../settings";
import { getCachedReportAggregate } from "../ctec-links/reports";
import { buildInstructorLastNameLabel } from "../paper-ctec/identity";
import { NEUTRAL_RATING_MIDPOINT } from "./constants";
import type { ComboSection, Combination } from "./types";

// Deduplicate sections by sectionId so the always-visible chip doesn't
// double-count when the user has multiple sections of the same course on
// paper.nu's canvas (e.g. stacked alternatives feeding the combinations
// enumerator). Combinations themselves are already deduped by
// construction, so this is a no-op for combo-driven callers.
function dedupeBySectionId(
  sections: readonly ComboSection[]
): readonly ComboSection[] {
  const seen = new Set<string>();
  const out: ComboSection[] = [];
  for (const section of sections) {
    if (seen.has(section.sectionId)) continue;
    seen.add(section.sectionId);
    out.push(section);
  }
  return out;
}

export type SortMode =
  | "rating"
  | "lazy"
  | "early-end"
  | "late-start"
  | "early-start"
  | "fewest-days"
  | "most-credits"
  | "least-credits";

export const DEFAULT_SORT_MODE: SortMode = "rating";

export const SORT_MODE_LABELS: Record<SortMode, string> = {
  rating: "Top CTEC rating",
  lazy: "Lazy mode (least hours/week)",
  "early-end": "Earliest end of day",
  "late-start": "Latest start (sleep in)",
  "early-start": "Earliest start",
  "fewest-days": "Fewest days on campus",
  "most-credits": "Most credits",
  "least-credits": "Fewest credits"
};

// Pulls the cached CTEC instructor-rating mean for one section, or null
// when nothing is cached. Mirrors paper-ctec's lookup contract: subject +
// catalog + last-name-only instructor label, terms-window from the popup
// setting.
function getSectionRating(section: ComboSection): number | null {
  const instructor = buildInstructorLastNameLabel(section.instructorNames);
  if (!instructor) return null;
  const aggregate = getCachedReportAggregate(
    {
      subject: section.subject,
      catalogNumber: section.catalog,
      instructor
    },
    section.title,
    getRecentAggregationTerms()
  );
  return aggregate?.metrics.instruction?.mean ?? null;
}

// CTEC's "Average number of hours per week" prompt — out-of-classroom
// study time, parsed at ctec-links/reports.ts:802. Same lookup contract
// as getSectionRating; returns null when no cached aggregate exists or
// when CTEC respondents skipped the hours question entirely.
function getSectionHours(section: ComboSection): number | null {
  const instructor = buildInstructorLastNameLabel(section.instructorNames);
  if (!instructor) return null;
  const aggregate = getCachedReportAggregate(
    {
      subject: section.subject,
      catalogNumber: section.catalog,
      instructor
    },
    section.title,
    getRecentAggregationTerms()
  );
  return aggregate?.metrics.hours?.mean ?? null;
}

export type KnownHoursEntry = {
  // Section label suitable for a tooltip — "COMP_SCI 211-0" etc.
  label: string;
  hours: number;
};

export type UnknownHoursEntry = {
  // Section label for sections without cached CTEC hours. The popup
  // lists these alongside the assigned mean so the user can see which
  // classes are being imputed and at what rate.
  label: string;
};

export type OutOfClassEstimate = {
  // Imputed total estimated out-of-class hours per week for the combo.
  // null when zero sections in the combo have cached CTEC hours data —
  // UI shows a dash instead of a fake number. Imputed sections contribute
  // the mean of known sections so partial-data combos still rank fairly.
  // The lazy-mode sort comparator uses this so combos that contain
  // unrated sections don't artificially float to the top.
  hours: number | null;
  rated: number;
  total: number;
  // Sum of CTEC hours across sections that have cached data. Used as the
  // chip's headline number — purely the "what we know" sum, no imputation.
  // 0 when rated === 0.
  knownSum: number;
  // Per-section detail for the chip's tooltip / formula display. Ordered
  // the same as combo.sections, but only includes sections with cached
  // hours data.
  knownValues: KnownHoursEntry[];
  // Arithmetic mean of knownValues' hours. null when rated === 0. Pulled
  // out so the chip's tooltip can spell out the formula without redoing
  // the math.
  knownMean: number | null;
  // Sections that don't have cached CTEC hours data. Ordered the same
  // as combo.sections. Empty when rated === total. The popup renders
  // these next to the assigned mean so the imputation is transparent.
  unknownValues: UnknownHoursEntry[];
};

export function estimateOutOfClassHours(
  sections: readonly ComboSection[]
): OutOfClassEstimate {
  const deduped = dedupeBySectionId(sections);
  const total = deduped.length;
  if (total === 0) {
    return {
      hours: 0,
      rated: 0,
      total: 0,
      knownSum: 0,
      knownValues: [],
      knownMean: null,
      unknownValues: []
    };
  }
  let sum = 0;
  let rated = 0;
  const knownValues: KnownHoursEntry[] = [];
  const unknownValues: UnknownHoursEntry[] = [];
  for (const section of deduped) {
    const label = `${section.subject} ${section.number}`;
    const h = getSectionHours(section);
    if (h !== null) {
      sum += h;
      rated += 1;
      knownValues.push({ label, hours: h });
    } else {
      unknownValues.push({ label });
    }
  }
  if (rated === 0) {
    return {
      hours: null,
      rated: 0,
      total,
      knownSum: 0,
      knownValues: [],
      knownMean: null,
      unknownValues
    };
  }
  const mean = sum / rated;
  return {
    hours: sum + mean * (total - rated),
    rated,
    total,
    knownSum: sum,
    knownValues,
    knownMean: mean,
    unknownValues
  };
}

// Combination score = mean of available CTEC ratings, with the neutral
// midpoint (3 on the 0–6 scale) imputed for sections that have no cached
// aggregate. Keeps unrated electives from sinking an otherwise-strong combo
// while still rewarding combos where every section has a real rating.
export function scoreCombination(combo: Combination): {
  score: number;
  ratedCount: number;
} {
  if (combo.sections.length === 0) return { score: 0, ratedCount: 0 };
  let total = 0;
  let rated = 0;
  for (const section of combo.sections) {
    const rating = getSectionRating(section);
    if (rating !== null) {
      total += rating;
      rated += 1;
    } else {
      total += NEUTRAL_RATING_MIDPOINT;
    }
  }
  return { score: total / combo.sections.length, ratedCount: rated };
}

function latestEndMinutes(combo: Combination): number {
  let latest = 0;
  for (const section of combo.sections) {
    for (const block of section.blocks) {
      const minutes = block.end.h * 60 + block.end.m;
      if (minutes > latest) latest = minutes;
    }
  }
  return latest;
}

function earliestStartMinutes(combo: Combination): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const section of combo.sections) {
    for (const block of section.blocks) {
      const minutes = block.start.h * 60 + block.start.m;
      if (minutes < earliest) earliest = minutes;
    }
  }
  return Number.isFinite(earliest) ? earliest : 0;
}

function distinctMeetingDays(combo: Combination): number {
  const days = new Set<number>();
  for (const section of combo.sections) {
    for (const block of section.blocks) {
      days.add(block.day);
    }
  }
  return days.size;
}

function totalCredits(combo: Combination): number {
  return combo.totalUnits;
}

// Stable lexicographic key — every sort uses this as the final tiebreak
// so cycling combos never reshuffles within a tie group across renders.
function stableKey(combo: Combination): string {
  return combo.sectionIds.slice().sort().join("|");
}

// Each sort mode returns a comparator. The "rating" sort keeps the
// original two-level behavior (rating desc, end-of-day asc) so it
// reads identically to the previous default. New modes apply the
// requested primary order, then fall back to rating + end-of-day so
// near-ties still surface high-quality combos.
function compareForMode(
  mode: SortMode
): (a: Combination, b: Combination) => number {
  return (a, b) => {
    let primary = 0;
    switch (mode) {
      case "rating":
        primary = b.score - a.score;
        break;
      case "lazy": {
        // Out-of-class hours asc. Combos with zero hours data (hours ===
        // null) sink to the bottom — sorting them by an imputed number
        // would be a lie. Ties on the hours total prefer combos with
        // more rated sections (less imputation = more honest).
        const aEst = estimateOutOfClassHours(a.sections);
        const bEst = estimateOutOfClassHours(b.sections);
        const aH = aEst.hours;
        const bH = bEst.hours;
        if (aH === null && bH === null) primary = 0;
        else if (aH === null) primary = 1;
        else if (bH === null) primary = -1;
        else primary = aH - bH;
        if (primary === 0) primary = bEst.rated - aEst.rated;
        break;
      }
      case "early-end":
        primary = latestEndMinutes(a) - latestEndMinutes(b);
        break;
      case "late-start":
        // Highest earliest-start wins (so the user can sleep in).
        primary = earliestStartMinutes(b) - earliestStartMinutes(a);
        break;
      case "early-start":
        primary = earliestStartMinutes(a) - earliestStartMinutes(b);
        break;
      case "fewest-days":
        primary = distinctMeetingDays(a) - distinctMeetingDays(b);
        break;
      case "most-credits":
        primary = totalCredits(b) - totalCredits(a);
        break;
      case "least-credits":
        primary = totalCredits(a) - totalCredits(b);
        break;
    }
    if (primary !== 0) return primary;
    // Credits-desc tiebreak ahead of rating: when the primary order
    // doesn't differentiate, prefer the fuller schedule. Without this,
    // the new [min,max] window surfaced lower-credit combos in front
    // of higher-credit ones whose primary metric happened to tie.
    // Safe for the credits-* sort modes too — combos that tie on the
    // primary credit comparison have equal totalUnits anyway, so this
    // line is a no-op there.
    if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits;
    if (b.score !== a.score) return b.score - a.score;
    const endA = latestEndMinutes(a);
    const endB = latestEndMinutes(b);
    if (endA !== endB) return endA - endB;
    return stableKey(a).localeCompare(stableKey(b));
  };
}

export function sortCombinations(
  combos: Combination[],
  mode: SortMode = DEFAULT_SORT_MODE
): Combination[] {
  const scored = combos.map((combo) => {
    const { score, ratedCount } = scoreCombination(combo);
    return { ...combo, score, ratedCount };
  });
  scored.sort(compareForMode(mode));
  return scored;
}

export function isSortMode(value: string): value is SortMode {
  return (
    value === "rating" ||
    value === "lazy" ||
    value === "early-end" ||
    value === "late-start" ||
    value === "early-start" ||
    value === "fewest-days" ||
    value === "most-credits" ||
    value === "least-credits"
  );
}
