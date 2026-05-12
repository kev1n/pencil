import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolvePerSectionSeats } from "../combined-section";
import type { SeatsNotesSuccess } from "../types";

const getTermCourseByKeyMock = vi.fn();

vi.mock("../../class-search/paper-data", () => ({
  getTermCourseByKey: (...args: unknown[]) => getTermCourseByKeyMock(...args)
}));

function makeCombinedResult(overrides: Partial<SeatsNotesSuccess> = {}): SeatsNotesSuccess {
  return {
    ok: true,
    requestedClassNumber: "16045",
    criteriaClassNumber: "16045",
    classCapacity: "60",
    enrollmentTotal: "20",
    availableSeats: "40",
    waitListCapacity: "0",
    waitListTotal: "0",
    classAttributes: null,
    enrollmentRequirements: null,
    classNotes: null,
    isCombinedSection: true,
    combinedSectionRows: [
      {
        classNumber: "12187",
        label: "COMP_ENG 346-0-1",
        component: "LEC",
        status: "Open",
        enrolled: "0",
        waitlist: "0"
      },
      {
        classNumber: "16045",
        label: "COMP_SCI 346-0-1",
        component: "LEC",
        status: "Closed",
        enrolled: "20",
        waitlist: "0"
      }
    ],
    ...overrides
  };
}

beforeEach(() => {
  getTermCourseByKeyMock.mockReset();
});

describe("resolvePerSectionSeats", () => {
  it("returns null for non-combined sections without fetching paper.nu data", async () => {
    const result = await resolvePerSectionSeats(
      makeCombinedResult({ isCombinedSection: false, combinedSectionRows: [] }),
      "4720"
    );
    expect(result).toBeNull();
    expect(getTermCourseByKeyMock).not.toHaveBeenCalled();
  });

  it("returns null when termId is missing", async () => {
    const result = await resolvePerSectionSeats(makeCombinedResult(), null);
    expect(result).toBeNull();
    expect(getTermCourseByKeyMock).not.toHaveBeenCalled();
  });

  it("computes per-section seats when paper.nu cap + grid enrolled both resolve", async () => {
    getTermCourseByKeyMock.mockResolvedValue({
      course_id: "COMP_SCI;346-0",
      subject: "COMP_SCI",
      catalog: "346-0",
      title: "Microcontroller System Design",
      sections: [
        { section: "1", component: "LEC", capacity: "30" },
        { section: "20", component: "LAB", capacity: "30" }
      ]
    });

    const result = await resolvePerSectionSeats(makeCombinedResult(), "4720");
    expect(result).toEqual({
      capacity: 30,
      enrolled: 20,
      available: 10,
      waitlist: 0,
      status: "Closed",
      label: "COMP_SCI 346-0-1"
    });
    expect(getTermCourseByKeyMock).toHaveBeenCalledWith("4720", "COMP_SCI", "346-0");
  });

  it("returns null when the section row doesn't match the requested class number", async () => {
    const result = await resolvePerSectionSeats(
      makeCombinedResult({ requestedClassNumber: "99999" }),
      "4720"
    );
    expect(result).toBeNull();
  });

  it("returns null when paper.nu has the course but no capacity field on the section", async () => {
    getTermCourseByKeyMock.mockResolvedValue({
      course_id: "COMP_SCI;346-0",
      subject: "COMP_SCI",
      catalog: "346-0",
      title: "X",
      sections: [{ section: "1", component: "LEC" }]
    });
    const result = await resolvePerSectionSeats(makeCombinedResult(), "4720");
    expect(result).toBeNull();
  });
});
