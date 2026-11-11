import { describe, expect, it } from "vitest";
import { enumerateCombinations } from "./combinations";
import { sectionsConflict, timesOverlap } from "./overlap";
import type { ComboPool, ComboSection, MeetingBlock } from "./types";

function block(day: number, sH: number, sM: number, eH: number, eM: number): MeetingBlock {
  return {
    day,
    start: { h: sH, m: sM },
    end: { h: eH, m: eM },
    patternIndex: 0
  };
}

function makeSection(
  sectionId: string,
  courseId: string,
  blocks: MeetingBlock[]
): ComboSection {
  return {
    sectionId,
    courseId,
    subject: courseId.split(":")[0] ?? "X",
    catalog: "100-0",
    number: "100-0",
    title: "Test",
    section: "20",
    component: "LEC",
    instructorNames: ["Prof"],
    blocks,
    raw: {} as ComboSection["raw"]
  };
}

function pool(sections: ComboSection[], unitsByCourse: Record<string, number> = {}): ComboPool {
  const groups = new Map<string, ComboSection[]>();
  const byId = new Map<string, ComboSection>();
  for (const s of sections) {
    byId.set(s.sectionId, s);
    const arr = groups.get(s.courseId) ?? [];
    arr.push(s);
    groups.set(s.courseId, arr);
  }
  return {
    termId: "5000",
    groups: Array.from(groups.entries()).map(([courseId, secs]) => ({
      courseId,
      label: courseId,
      units: unitsByCourse[courseId] ?? 1,
      sections: secs
    })),
    byId
  };
}

describe("timesOverlap", () => {
  it("treats touching boundaries as overlap (matches paper.nu)", () => {
    const a1 = { h: 9, m: 0 };
    const a2 = { h: 10, m: 0 };
    const b1 = { h: 10, m: 0 };
    const b2 = { h: 11, m: 0 };
    expect(timesOverlap(a1, a2, b1, b2)).toBe(true);
  });

  it("returns false for clearly disjoint times", () => {
    const a1 = { h: 9, m: 0 };
    const a2 = { h: 9, m: 50 };
    const b1 = { h: 10, m: 0 };
    const b2 = { h: 11, m: 0 };
    expect(timesOverlap(a1, a2, b1, b2)).toBe(false);
  });
});

describe("sectionsConflict", () => {
  it("detects same-day pattern overlap across multi-pattern sections", () => {
    const lecAndLab = makeSection("X;LL", "X:100", [
      block(0, 9, 0, 10, 0),
      block(2, 14, 0, 15, 0)
    ]);
    const conflictingDis = makeSection("Y;DD", "Y:100", [
      block(2, 14, 30, 15, 30)
    ]);
    expect(sectionsConflict(lecAndLab, conflictingDis)).toBe(true);
  });

  it("ignores same-time overlap on different days", () => {
    const a = makeSection("A", "X:100", [block(0, 9, 0, 10, 0)]);
    const b = makeSection("B", "Y:100", [block(1, 9, 0, 10, 0)]);
    expect(sectionsConflict(a, b)).toBe(false);
  });
});

describe("enumerateCombinations", () => {
  it("takes a lecture and a discussion of the same course together", () => {
    const lec = makeSection("L", "A", [block(0, 9, 0, 10, 0)]);
    const d1 = { ...makeSection("D1", "A", [block(3, 9, 0, 10, 0)]), component: "DIS" };
    const d2 = { ...makeSection("D2", "A", [block(3, 11, 0, 12, 0)]), component: "DIS" };
    const b1 = makeSection("B1", "B", [block(3, 9, 0, 10, 0)]);
    const result = enumerateCombinations(pool([lec, d1, d2, b1]), {
      maxCredits: 2,
      minCredits: 1,
      pinnedSectionIds: new Set(["D2"])
    });
    const ids = result.combinations.map((c) => [...c.sectionIds].sort().join("+"));
    // The pinned discussion comes with its lecture, never alone, and the
    // course still counts once toward credits.
    expect(ids.sort()).toEqual(["B1+D2+L", "D2+L"]);
    expect(result.combinations.map((c) => c.totalUnits).sort()).toEqual([1, 2]);
  });

  it("returns one combination per (one-section-per-course) tuple when nothing conflicts", () => {
    const a1 = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const a2 = makeSection("A2", "A", [block(0, 13, 0, 14, 0)]);
    const b1 = makeSection("B1", "B", [block(1, 9, 0, 10, 0)]);
    const b2 = makeSection("B2", "B", [block(1, 11, 0, 12, 0)]);
    const result = enumerateCombinations(pool([a1, a2, b1, b2]), {
      maxCredits: 2,
      minCredits: 2,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(4);
    expect(result.effectiveCredits).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.conflictingPins).toBe(false);
  });

  it("prunes pairs that conflict", () => {
    const a1 = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b1 = makeSection("B1", "B", [block(0, 9, 30, 10, 30)]);
    const b2 = makeSection("B2", "B", [block(0, 11, 0, 12, 0)]);
    const result = enumerateCombinations(pool([a1, b1, b2]), {
      maxCredits: 2,
      minCredits: 2,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(1);
    expect(result.combinations[0].sectionIds.sort()).toEqual(["A1", "B2"]);
  });

  it("respects pinned sections and rejects conflicting pins", () => {
    const a1 = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b1 = makeSection("B1", "B", [block(0, 9, 30, 10, 30)]);
    const result = enumerateCombinations(pool([a1, b1]), {
      maxCredits: 2,
      pinnedSectionIds: new Set(["A1", "B1"])
    });
    expect(result.combinations).toHaveLength(0);
    expect(result.conflictingPins).toBe(true);
  });

  it("forces pinned sections into every result", () => {
    const a1 = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const a2 = makeSection("A2", "A", [block(0, 13, 0, 14, 0)]);
    const b1 = makeSection("B1", "B", [block(1, 9, 0, 10, 0)]);
    const result = enumerateCombinations(pool([a1, a2, b1]), {
      maxCredits: 2,
      minCredits: 2,
      pinnedSectionIds: new Set(["A1"])
    });
    expect(result.combinations).toHaveLength(1);
    expect(result.combinations[0].sectionIds.sort()).toEqual(["A1", "B1"]);
  });

  it("returns combos at the highest reachable credit total when budget caps the schedule", () => {
    // 3 unit-1 courses, max=2 credits → only 2-credit combos, none of all 3.
    // min=max=2 keeps the assertion precise to "exactly 2 credits".
    const a = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b = makeSection("B1", "B", [block(0, 11, 0, 12, 0)]);
    const c = makeSection("C1", "C", [block(0, 13, 0, 14, 0)]);
    const result = enumerateCombinations(pool([a, b, c]), {
      maxCredits: 2,
      minCredits: 2,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(3);
    expect(result.effectiveCredits).toBe(2);
    expect(result.requestedCredits).toBe(2);
  });

  it("falls back to a smaller credit total when the requested budget can't be packed", () => {
    // 3 courses, A and B conflict. No 3-credit combo fits — at the 2-credit
    // floor we still get {A,C} and {B,C}. min=max=2 narrows to those two.
    const a = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b = makeSection("B1", "B", [block(0, 9, 30, 10, 30)]);
    const c = makeSection("C1", "C", [block(0, 13, 0, 14, 0)]);
    const result = enumerateCombinations(pool([a, b, c]), {
      maxCredits: 3,
      minCredits: 2,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(2);
    expect(result.effectiveCredits).toBe(2);
    expect(result.requestedCredits).toBe(3);
    const ids = result.combinations
      .map((c) => c.sectionIds.slice().sort().join(","))
      .sort();
    expect(ids).toEqual(["A1,C1", "B1,C1"]);
  });

  it("filters out combos that exceed the credit budget", () => {
    // A and B are 1-unit each, C is 2-unit. min=max=2.
    // {A,B,C}=4 exceeds max; {A,B} and {C} both hit exactly 2.
    const a = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b = makeSection("B1", "B", [block(1, 9, 0, 10, 0)]);
    const c = makeSection("C1", "C", [block(2, 9, 0, 10, 0)]);
    const result = enumerateCombinations(
      pool([a, b, c], { A: 1, B: 1, C: 2 }),
      { maxCredits: 2, minCredits: 2, pinnedSectionIds: new Set() }
    );
    expect(result.effectiveCredits).toBe(2);
    const ids = result.combinations
      .map((cb) => cb.sectionIds.slice().sort().join(","))
      .sort();
    expect(ids).toEqual(["A1,B1", "C1"]);
  });

  it("returns every combo in the [min, max] credits window", () => {
    // 3 unit-1 courses, all non-conflicting. minCredits=2, maxCredits=3
    // means the 1-credit single-course combos drop out, but every 2- and
    // 3-credit combo in the window is returned: {A,B}, {A,C}, {B,C},
    // and {A,B,C}. The cycle UI then sorts by the active sort mode.
    const a = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b = makeSection("B1", "B", [block(0, 11, 0, 12, 0)]);
    const c = makeSection("C1", "C", [block(0, 13, 0, 14, 0)]);
    const result = enumerateCombinations(pool([a, b, c]), {
      maxCredits: 3,
      minCredits: 2,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(4);
    const ids = result.combinations
      .map((c) => c.sectionIds.slice().sort().join(","))
      .sort();
    expect(ids).toEqual(["A1,B1", "A1,B1,C1", "A1,C1", "B1,C1"]);
    expect(result.effectiveCredits).toBe(3);
    expect(result.requestedMinCredits).toBe(2);
  });

  it("returns empty when no combo can satisfy the min-credits floor", () => {
    // A and B conflict, so no 3-credit combo fits. minCredits=3 then
    // empties the result entirely (the 2-credit fallback is below floor).
    const a = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b = makeSection("B1", "B", [block(0, 9, 30, 10, 30)]);
    const c = makeSection("C1", "C", [block(0, 13, 0, 14, 0)]);
    const result = enumerateCombinations(pool([a, b, c]), {
      maxCredits: 3,
      minCredits: 3,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(0);
    expect(result.effectiveCredits).toBe(0);
    expect(result.requestedMinCredits).toBe(3);
  });

  it("returns empty (without crash) when there are no courses", () => {
    const result = enumerateCombinations(pool([]), {
      maxCredits: 4,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.conflictingPins).toBe(false);
  });
});
