import { getRecentAggregationTerms } from "../../settings";
import { getCachedReportAggregate } from "../ctec-links/reports";
import { buildInstructorLastNameLabel } from "../paper-ctec/identity";
import { NEUTRAL_RATING_MIDPOINT } from "./constants";
import type { ComboSection, Combination } from "./types";

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

function endOfDayMinutes(combo: Combination): number {
  let latest = 0;
  for (const section of combo.sections) {
    for (const block of section.blocks) {
      const minutes = block.end.h * 60 + block.end.m;
      if (minutes > latest) latest = minutes;
    }
  }
  return latest;
}

// Sort: highest score first; ties go to the combo that ends earliest in the
// day (the "go home sooner" tiebreak feels right for a schedule planner).
// Final tiebreak: lexicographic over section IDs so the order is stable
// across renders.
export function sortCombinations(combos: Combination[]): Combination[] {
  const scored = combos.map((combo) => {
    const { score, ratedCount } = scoreCombination(combo);
    return { ...combo, score, ratedCount };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const endA = endOfDayMinutes(a);
    const endB = endOfDayMinutes(b);
    if (endA !== endB) return endA - endB;
    const keyA = a.sectionIds.join("|");
    const keyB = b.sectionIds.join("|");
    return keyA.localeCompare(keyB);
  });
  return scored;
}
