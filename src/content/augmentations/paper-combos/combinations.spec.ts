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

function pool(sections: ComboSection[]): ComboPool {
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
      block(0, 9, 0, 10, 0), // Mon lecture
      block(2, 14, 0, 15, 0) // Wed lab
    ]);
    const conflictingDis = makeSection("Y;DD", "Y:100", [
      block(2, 14, 30, 15, 30) // Wed conflicts with the lab
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
  it("returns one combination per (one-section-per-course) tuple when nothing conflicts", () => {
    const a1 = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const a2 = makeSection("A2", "A", [block(0, 13, 0, 14, 0)]);
    const b1 = makeSection("B1", "B", [block(1, 9, 0, 10, 0)]);
    const b2 = makeSection("B2", "B", [block(1, 11, 0, 12, 0)]);
    const result = enumerateCombinations(pool([a1, a2, b1, b2]), {
      maxSize: 2,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(4);
    expect(result.truncated).toBe(false);
    expect(result.conflictingPins).toBe(false);
  });

  it("prunes pairs that conflict", () => {
    const a1 = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b1 = makeSection("B1", "B", [block(0, 9, 30, 10, 30)]); // conflicts with A1
    const b2 = makeSection("B2", "B", [block(0, 11, 0, 12, 0)]);
    const result = enumerateCombinations(pool([a1, b1, b2]), {
      maxSize: 2,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(1);
    expect(result.combinations[0].sectionIds.sort()).toEqual(["A1", "B2"]);
  });

  it("respects pinned sections and rejects conflicting pins", () => {
    const a1 = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b1 = makeSection("B1", "B", [block(0, 9, 30, 10, 30)]);
    const result = enumerateCombinations(pool([a1, b1]), {
      maxSize: 2,
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
      maxSize: 2,
      pinnedSectionIds: new Set(["A1"])
    });
    expect(result.combinations).toHaveLength(1);
    expect(result.combinations[0].sectionIds.sort()).toEqual(["A1", "B1"]);
  });

  it("falls back to combinations of size < courses when maxSize is smaller", () => {
    const a = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b = makeSection("B1", "B", [block(0, 11, 0, 12, 0)]);
    const c = makeSection("C1", "C", [block(0, 13, 0, 14, 0)]);
    const result = enumerateCombinations(pool([a, b, c]), {
      maxSize: 2,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(3);
    // All combos at the requested size — no descent needed.
    expect(result.effectiveSize).toBe(2);
    expect(result.requestedSize).toBe(2);
  });

  it("walks down to the largest feasible size when full size has no fit", () => {
    // Three courses, but A and B's only sections conflict on Mon morning.
    // No 3-class combo fits without overlap. Should fall back to 2-class
    // combos, which include {A,C} and {B,C}.
    const a = makeSection("A1", "A", [block(0, 9, 0, 10, 0)]);
    const b = makeSection("B1", "B", [block(0, 9, 30, 10, 30)]);
    const c = makeSection("C1", "C", [block(0, 13, 0, 14, 0)]);
    const result = enumerateCombinations(pool([a, b, c]), {
      maxSize: 3,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toHaveLength(2);
    expect(result.effectiveSize).toBe(2);
    expect(result.requestedSize).toBe(3);
    const ids = result.combinations
      .map((c) => c.sectionIds.slice().sort().join(","))
      .sort();
    expect(ids).toEqual(["A1,C1", "B1,C1"]);
  });

  it("respects the hard cap and signals truncation", () => {
    const sections: ComboSection[] = [];
    // 3 courses, 4 sections each = 64 combos. Cap at 10.
    for (const courseLetter of ["A", "B", "C"]) {
      for (let i = 0; i < 4; i++) {
        sections.push(
          makeSection(
            `${courseLetter}${i}`,
            courseLetter,
            [block(i, 9, 0, 10, 0)]
          )
        );
      }
    }
    const result = enumerateCombinations(pool(sections), {
      maxSize: 3,
      pinnedSectionIds: new Set(),
      hardCap: 10
    });
    expect(result.combinations.length).toBe(10);
    expect(result.truncated).toBe(true);
  });

  it("returns empty (without crash) when there are no courses", () => {
    const result = enumerateCombinations(pool([]), {
      maxSize: 4,
      pinnedSectionIds: new Set()
    });
    expect(result.combinations).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.conflictingPins).toBe(false);
  });
});
