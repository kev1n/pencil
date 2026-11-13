// Schedule combinations: every way the term's classes fit together without
// overlapping, found and ranked by the extension's own code.
import { enumerateCombinations } from "@ext/content/augmentations/paper-combos/combinations";
import { groupByCourse, parseUnits, toComboSection } from "@ext/content/augmentations/paper-combos/data";
import {
  DEFAULT_SORT_MODE,
  SORT_MODE_LABELS,
  sortCombinations,
  type SortMode
} from "@ext/content/augmentations/paper-combos/scoring";
import type { Combination, ComboSection } from "@ext/content/augmentations/paper-combos/types";
import {
  loadCredits,
  loadSortMode,
  saveCredits,
  saveSortMode,
  type CreditsPrefs
} from "@ext/content/augmentations/paper-combos/zones";
import { getPlanCourses } from "@ext/content/augmentations/class-search/paper-data";
import { overallRating, savedCtec } from "./ctec";
import type { TermClass } from "./term-classes";

export { DEFAULT_SORT_MODE, loadCredits, loadSortMode, saveCredits, saveSortMode, SORT_MODE_LABELS };
export type { Combination, CreditsPrefs, SortMode };

// A combination's saved ratings: the mean rating, and hours a week with
// unrated classes counted at the mean of the rated ones.
export type ComboRating = { rating: number | null; hours: number | null; rated: number };
export function rateCombo(combo: Combination): ComboRating {
  const ratings: number[] = [];
  const hours: number[] = [];
  for (const section of combo.sections) {
    const ctec = savedCtec(
      { course_id: "", subject: section.subject, catalog: section.catalog, title: section.title, sections: [] },
      section.raw
    );
    const rating = overallRating(ctec);
    if (rating !== undefined) ratings.push(rating);
    const h = ctec?.metrics.hours?.mean;
    if (typeof h === "number") hours.push(h);
  }
  const mean = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length;
  return {
    rating: ratings.length ? mean(ratings) : null,
    hours: hours.length ? mean(hours) * combo.sections.length : null,
    rated: ratings.length
  };
}

export type Combos = {
  list: Combination[];
  // More exist than were worked out.
  truncated: boolean;
  // The pinned and enrolled classes can't all be taken together.
  conflictingPins: boolean;
};

// Enrolled classes are fixed; cart and planned ones are the choices. Pins
// are section ids the student wants in every result.
export async function buildCombos(
  termId: string,
  classes: TermClass[],
  options: { credits: CreditsPrefs; sort: SortMode; pins: ReadonlySet<string> }
): Promise<Combos> {
  const sections: ComboSection[] = [];
  const byId = new Map<string, ComboSection>();
  const pins = new Set(options.pins);
  for (const entry of classes) {
    const section = entry.section && toComboSection(entry.section);
    if (!section || byId.has(section.sectionId)) continue;
    sections.push(section);
    byId.set(section.sectionId, section);
    if (entry.state === "enrolled") pins.add(section.sectionId);
  }
  const units = new Map<string, number>();
  for (const course of await getPlanCourses().catch(() => [])) units.set(course.id, parseUnits(course.units));

  const result = enumerateCombinations(
    { termId, groups: groupByCourse(sections, units), byId },
    { maxCredits: options.credits.maxCredits, minCredits: options.credits.minCredits, pinnedSectionIds: pins }
  );
  let list = sortCombinations(result.combinations, options.sort);
  // The extension looks ratings up by last name, which the app's saved
  // ratings are not filed under, so these two orders use the app's numbers.
  if (options.sort === "rating" || options.sort === "lazy") {
    const rated = new Map(list.map((combo) => [combo, rateCombo(combo)]));
    const value = (combo: Combination) =>
      options.sort === "rating" ? -(rated.get(combo)!.rating ?? 3) : (rated.get(combo)!.hours ?? Infinity);
    list = [...list].sort((a, b) => value(a) - value(b) || b.totalUnits - a.totalUnits);
  }
  return {
    list,
    truncated: result.truncated,
    conflictingPins: result.conflictingPins
  };
}
