import { COMBO_HARD_CAP } from "./constants";
import { sectionsConflict } from "./overlap";
import type { ComboPool, ComboSection, Combination, CourseGroup } from "./types";

export type EnumerateOptions = {
  // Maximum total units (Northwestern "credits") allowed in any
  // combination. The enumerator returns the largest-credit combos that
  // fit within this budget without overlapping in time.
  maxCredits: number;
  // Minimum total units required. Combos with fewer credits are
  // discarded before the "highest credit class wins" reduction. Defaults
  // to 0 (no floor).
  minCredits?: number;
  // Section IDs the user has pinned. Every produced combination must
  // include each pinned section. Conflicting pins yield an empty result.
  pinnedSectionIds: ReadonlySet<string>;
  // Hard upper bound on the number of combinations enumerated. Defaults
  // to COMBO_HARD_CAP — pathological inputs (large product space) won't
  // OOM the page, the UI just truncates and surfaces a warning.
  hardCap?: number;
};

export type EnumerateResult = {
  combinations: Combination[];
  truncated: boolean;
  conflictingPins: boolean;
  // Total credits in the combos we returned (all returned combos share
  // this total — we keep only the highest-credit class).
  effectiveCredits: number;
  requestedCredits: number;
  // Echoes the floor the caller requested (defaults to 0). Used by the
  // UI to render an accurate status message when filtering empties out
  // the result.
  requestedMinCredits: number;
};

const FLOAT_EPS = 1e-6;

export function enumerateCombinations(
  pool: ComboPool,
  options: EnumerateOptions
): EnumerateResult {
  const cap = options.hardCap ?? COMBO_HARD_CAP;
  const groups = pool.groups;
  const requestedCredits = Math.max(0, options.maxCredits);
  const requestedMinCredits = Math.max(0, options.minCredits ?? 0);

  if (groups.length === 0) {
    return {
      combinations: [],
      truncated: false,
      conflictingPins: false,
      effectiveCredits: 0,
      requestedCredits,
      requestedMinCredits
    };
  }

  const pinnedBySlot = new Map<string, ComboSection>();
  for (const sectionId of options.pinnedSectionIds) {
    const section = pool.byId.get(sectionId);
    if (!section) continue;
    pinnedBySlot.set(pinSlot(section), section);
  }

  // A pin only counts if its course is represented in the current pool.
  const groupIds = new Set(groups.map((g) => g.courseId));
  const pinnedList = Array.from(pinnedBySlot.values()).filter((s) =>
    groupIds.has(s.courseId)
  );
  const pinnedCourseIds = new Set(pinnedList.map((s) => s.courseId));
  let pinnedCredits = 0;
  for (const group of groups) {
    if (pinnedCourseIds.has(group.courseId)) pinnedCredits += group.units;
  }

  const conflictingPins = (): EnumerateResult => ({
    combinations: [],
    truncated: false,
    conflictingPins: true,
    effectiveCredits: 0,
    requestedCredits,
    requestedMinCredits
  });

  for (let i = 0; i < pinnedList.length; i++) {
    for (let j = i + 1; j < pinnedList.length; j++) {
      if (sectionsConflict(pinnedList[i], pinnedList[j])) return conflictingPins();
    }
  }

  if (pinnedCredits > requestedCredits + FLOAT_EPS) return conflictingPins();

  // Courses with a pin come first and can't be skipped.
  const slots: CourseSlot[] = groups
    .map((group) => ({
      units: group.units,
      required: pinnedCourseIds.has(group.courseId),
      bundles: bundlesFor(group, pinnedBySlot)
    }))
    .sort((a, b) => Number(b.required) - Number(a.required));

  const all = enumerateAll({ slots, maxCredits: requestedCredits, cap });

  if (all.combinations.length === 0) {
    return {
      combinations: [],
      truncated: all.truncated,
      conflictingPins: false,
      effectiveCredits: 0,
      requestedCredits,
      requestedMinCredits
    };
  }

  // Return EVERY combo whose total credits land in the [min, max] window.
  // Earlier versions filtered down to the highest-credit class only,
  // but that hid the very combos a user wants when they widen the range
  // (lowering min from 3 to 2 should *add* 2-credit options, not no-op
  // because the 5-credit class still dominates). Sort modes still drive
  // the cycle order, so the "best" surfaces first regardless.
  const inWindow = all.combinations.filter(
    (c) => c.totalUnits + FLOAT_EPS >= requestedMinCredits
  );

  if (inWindow.length === 0) {
    return {
      combinations: [],
      truncated: all.truncated,
      conflictingPins: false,
      effectiveCredits: 0,
      requestedCredits,
      requestedMinCredits
    };
  }

  let highest = 0;
  for (const combo of inWindow) {
    if (combo.totalUnits > highest) highest = combo.totalUnits;
  }

  return {
    combinations: inWindow,
    truncated: all.truncated,
    conflictingPins: false,
    effectiveCredits: highest,
    requestedCredits,
    requestedMinCredits
  };
}

// One course as the enumerator sees it. A bundle is one way to take the
// course: one section of each component the user put on the schedule
// (a lecture plus a discussion, say), with no clash inside the bundle.
type CourseSlot = {
  units: number;
  required: boolean;
  bundles: ComboSection[][];
};

export function pinSlot(
  section: Pick<ComboSection, "courseId" | "component">
): string {
  return `${section.courseId}|${section.component}`;
}

function bundlesFor(
  group: CourseGroup,
  pinnedBySlot: ReadonlyMap<string, ComboSection>
): ComboSection[][] {
  const byComponent = new Map<string, ComboSection[]>();
  for (const component of group.components ?? []) byComponent.set(component, []);
  for (const section of group.sections) {
    const list = byComponent.get(section.component);
    if (list) list.push(section);
    else byComponent.set(section.component, [section]);
  }

  let bundles: ComboSection[][] = [[]];
  for (const [component, sections] of byComponent) {
    const pinned = pinnedBySlot.get(`${group.courseId}|${component}`);
    const choices = pinned ? [pinned] : sections;
    const next: ComboSection[][] = [];
    for (const bundle of bundles) {
      for (const section of choices) {
        if (bundle.some((picked) => sectionsConflict(picked, section))) continue;
        next.push([...bundle, section]);
      }
    }
    bundles = next;
  }
  return bundles;
}

type EnumerateAllArgs = {
  slots: CourseSlot[];
  maxCredits: number;
  cap: number;
};

type EnumerateAllResult = {
  combinations: Combination[];
  truncated: boolean;
};

// Backtracking over courses. At each course we try (a) skipping it,
// unless it has a pin, or (b) adding any of its bundles that doesn't
// conflict with the current selection AND keeps total units within the
// budget. Emits every valid combo that fits the budget; the caller
// filters by the credit floor.
function enumerateAll({
  slots,
  maxCredits,
  cap
}: EnumerateAllArgs): EnumerateAllResult {
  const combinations: Combination[] = [];
  let truncated = false;

  const current: ComboSection[] = [];
  let runningCredits = 0;

  const emit = (): boolean => {
    if (current.length === 0) return true;
    if (combinations.length >= cap) {
      truncated = true;
      return false;
    }
    combinations.push({
      sectionIds: current.map((s) => s.sectionId),
      sections: [...current],
      score: 0,
      ratedCount: 0,
      totalUnits: runningCredits
    });
    return true;
  };

  const backtrack = (idx: number): boolean => {
    if (truncated) return false;
    if (combinations.length >= cap) {
      truncated = true;
      return false;
    }
    if (idx >= slots.length) {
      return emit();
    }

    const slot = slots[idx];

    // Branch 1: skip this course.
    if (!slot.required && !backtrack(idx + 1)) return false;

    // Branch 2: try every bundle of this course, skipping conflicts.
    if (runningCredits + slot.units <= maxCredits + FLOAT_EPS) {
      for (const bundle of slot.bundles) {
        const conflict = bundle.some((section) =>
          current.some((picked) => sectionsConflict(picked, section))
        );
        if (conflict) continue;
        current.push(...bundle);
        runningCredits += slot.units;
        const ok = backtrack(idx + 1);
        current.length -= bundle.length;
        runningCredits -= slot.units;
        if (!ok) return false;
      }
    }

    return true;
  };

  backtrack(0);
  return { combinations, truncated };
}
