import { COMBO_HARD_CAP } from "./constants";
import { sectionsConflict } from "./overlap";
import type { ComboPool, ComboSection, Combination } from "./types";

export type EnumerateOptions = {
  // Maximum number of sections per combination (one per course). The
  // enumerator looks for combos at exactly this size first; if none fit
  // (because too many courses time-conflict), it walks down to maxSize-1,
  // then maxSize-2, etc. and returns the first non-empty size class.
  // This matches the user's mental model of "max" as a ceiling, not an
  // exact count — they expect to see *some* schedule even if it can't
  // pack every course on canvas.
  maxSize: number;
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
  // The size class that actually produced results. Differs from
  // requestedSize when the enumerator walked down because the requested
  // size was infeasible. UI uses this to surface the "had to drop a
  // course" status to the user.
  effectiveSize: number;
  requestedSize: number;
};

export function enumerateCombinations(
  pool: ComboPool,
  options: EnumerateOptions
): EnumerateResult {
  const cap = options.hardCap ?? COMBO_HARD_CAP;
  const groups = pool.groups;
  const requestedSize = Math.min(
    Math.max(0, options.maxSize),
    groups.length
  );

  if (groups.length === 0) {
    return {
      combinations: [],
      truncated: false,
      conflictingPins: false,
      effectiveSize: 0,
      requestedSize
    };
  }

  const pinnedByCourse = new Map<string, ComboSection>();
  for (const sectionId of options.pinnedSectionIds) {
    const section = pool.byId.get(sectionId);
    if (!section) continue;
    pinnedByCourse.set(section.courseId, section);
  }

  // A pin only counts if its course is represented in the current pool.
  const pinnedList: ComboSection[] = [];
  const pinnedCourseIds = new Set<string>();
  for (const group of groups) {
    const pinned = pinnedByCourse.get(group.courseId);
    if (pinned) {
      pinnedList.push(pinned);
      pinnedCourseIds.add(group.courseId);
    }
  }

  for (let i = 0; i < pinnedList.length; i++) {
    for (let j = i + 1; j < pinnedList.length; j++) {
      if (sectionsConflict(pinnedList[i], pinnedList[j])) {
        return {
          combinations: [],
          truncated: false,
          conflictingPins: true,
          effectiveSize: 0,
          requestedSize
        };
      }
    }
  }

  if (pinnedList.length > requestedSize) {
    return {
      combinations: [],
      truncated: false,
      conflictingPins: true,
      effectiveSize: 0,
      requestedSize
    };
  }

  const freeGroups = groups.filter((g) => !pinnedCourseIds.has(g.courseId));
  // Walk from `requestedSize` down to `pinnedList.length` (inclusive). The
  // pinnedList floor is enforced because every pin must appear; we can't
  // generate combos smaller than the pin set.
  const minSize = Math.max(pinnedList.length, 0);
  for (let target = requestedSize; target >= minSize; target--) {
    if (target < 1 && groups.length > 0) break;
    const result = enumerateAtSize({
      pinnedList,
      freeGroups,
      target,
      cap
    });
    if (result.combinations.length > 0) {
      return {
        combinations: result.combinations,
        truncated: result.truncated,
        conflictingPins: false,
        effectiveSize: target,
        requestedSize
      };
    }
    if (result.truncated) {
      // Hit the hard cap inside this size class — no point descending,
      // because smaller sizes have a strictly larger search space and
      // would also truncate (or worse).
      return {
        combinations: result.combinations,
        truncated: true,
        conflictingPins: false,
        effectiveSize: target,
        requestedSize
      };
    }
  }

  return {
    combinations: [],
    truncated: false,
    conflictingPins: false,
    effectiveSize: 0,
    requestedSize
  };
}

type EnumerateAtSizeArgs = {
  pinnedList: ComboSection[];
  freeGroups: ComboPool["groups"];
  target: number;
  cap: number;
};

type EnumerateAtSizeResult = {
  combinations: Combination[];
  truncated: boolean;
};

// Backtracking enumerator over free groups: pick exactly
// `target - pinnedList.length` sections, one per group, no time conflicts
// with each other or with pins. Pure helper — no orchestrator state, no
// pin or conflict validation (caller already did that).
function enumerateAtSize({
  pinnedList,
  freeGroups,
  target,
  cap
}: EnumerateAtSizeArgs): EnumerateAtSizeResult {
  const freePicksNeeded = target - pinnedList.length;
  const combinations: Combination[] = [];
  let truncated = false;

  const current: ComboSection[] = [...pinnedList];

  if (freePicksNeeded === 0) {
    combinations.push({
      sectionIds: pinnedList.map((s) => s.sectionId),
      sections: [...pinnedList],
      score: 0,
      ratedCount: 0
    });
    return { combinations, truncated };
  }

  const backtrack = (idx: number, picked: number): void => {
    if (truncated) return;
    if (combinations.length >= cap) {
      truncated = true;
      return;
    }
    if (picked === freePicksNeeded) {
      combinations.push({
        sectionIds: current.map((s) => s.sectionId),
        sections: [...current],
        score: 0,
        ratedCount: 0
      });
      return;
    }

    const groupsLeft = freeGroups.length - idx;
    const stillNeeded = freePicksNeeded - picked;
    if (groupsLeft < stillNeeded) return;
    if (idx >= freeGroups.length) return;

    const group = freeGroups[idx];

    // Branch 1: skip this group — only allowed if dropping it still leaves
    // enough downstream groups to fill the target.
    if (groupsLeft - 1 >= stillNeeded) {
      backtrack(idx + 1, picked);
      if (truncated) return;
    }

    // Branch 2: try every section in this group, skipping conflicts.
    for (const section of group.sections) {
      let conflict = false;
      for (const c of current) {
        if (sectionsConflict(c, section)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;
      current.push(section);
      backtrack(idx + 1, picked + 1);
      current.pop();
      if (truncated) return;
    }
  };

  backtrack(0, 0);
  return { combinations, truncated };
}
