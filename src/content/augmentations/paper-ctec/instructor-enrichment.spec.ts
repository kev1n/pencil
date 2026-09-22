import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../class-search/paper-data", () => ({
  getTermCourses: vi.fn()
}));

vi.mock("./paper-active-term", () => ({
  getActivePaperTermId: vi.fn()
}));

vi.mock("../paper-combos/data", () => ({
  readPaperScheduleSnapshot: vi.fn()
}));

const { getTermCourses } = await import("../class-search/paper-data");
const { getActivePaperTermId } = await import("./paper-active-term");
const { readPaperScheduleSnapshot } = await import("../paper-combos/data");
const {
  enrichInstructorName,
  enrichParams,
  peekEnrichedParams,
  clearInstructorEnrichmentCache
} = await import("./instructor-enrichment");

const findMock = vi.mocked(getTermCourses);
const termMock = vi.mocked(getActivePaperTermId);
const scheduleMock = vi.mocked(readPaperScheduleSnapshot);

function mockTermAndCourses(
  sections: Array<{ section_id?: string; instructors: Array<{ name: string }> }>,
  subject = "MATH",
  number = "331-1"
): void {
  termMock.mockResolvedValue({ termId: "9999", source: "dom" });
  findMock.mockResolvedValue([
    {
      sections: sections.map((section) => ({ subject, number, ...section }))
    } as unknown as Awaited<ReturnType<typeof getTermCourses>>[number]
  ]);
}

beforeEach(() => {
  clearInstructorEnrichmentCache();
  findMock.mockReset();
  termMock.mockReset();
  scheduleMock.mockReset();
  scheduleMock.mockResolvedValue(null);
});

describe("enrichInstructorName", () => {
  const params = {
    subject: "MATH",
    catalogNumber: "331-1",
    instructor: "Smith"
  };

  it("returns unchanged when the instructor already has a first name", async () => {
    const result = await enrichInstructorName({
      ...params,
      instructor: "Alexander Smith"
    });
    expect(result).toBe("Alexander Smith");
    expect(termMock).not.toHaveBeenCalled();
  });

  it("returns unchanged when the instructor is empty", async () => {
    const result = await enrichInstructorName({ ...params, instructor: "" });
    expect(result).toBe("");
    expect(termMock).not.toHaveBeenCalled();
  });

  it("resolves a single-token label via paper.nu term data", async () => {
    mockTermAndCourses([
      { instructors: [{ name: "Alexander Smith" }] }
    ]);
    const result = await enrichInstructorName(params);
    expect(result).toBe("Alexander Smith");
    expect(findMock).toHaveBeenCalledWith("9999");
  });

  it("matches across multiple sections sharing the same prof", async () => {
    mockTermAndCourses([
      { instructors: [{ name: "Alexander Smith" }] },
      { instructors: [{ name: "Alexander Smith" }] }
    ]);
    const result = await enrichInstructorName(params);
    expect(result).toBe("Alexander Smith");
  });

  it("returns unchanged when two distinct full names share the last name", async () => {
    mockTermAndCourses([
      { instructors: [{ name: "Alexander Smith" }] },
      { instructors: [{ name: "Zachary Smith" }] }
    ]);
    const result = await enrichInstructorName(params);
    expect(result).toBe("Smith");
  });

  it("returns unchanged when the last name does not appear in term data", async () => {
    mockTermAndCourses([
      { instructors: [{ name: "Jane Doe" }] }
    ]);
    const result = await enrichInstructorName(params);
    expect(result).toBe("Smith");
  });

  it("caches results so a repeat call doesn't refetch", async () => {
    mockTermAndCourses([
      { instructors: [{ name: "Alexander Smith" }] }
    ]);
    await enrichInstructorName(params);
    await enrichInstructorName(params);
    expect(findMock).toHaveBeenCalledTimes(1);
  });

  it("returns unchanged when paper.nu has no active term", async () => {
    termMock.mockResolvedValue({ termId: "", source: "fallback" });
    findMock.mockResolvedValue([]);
    const result = await enrichInstructorName(params);
    expect(result).toBe("Smith");
    expect(findMock).not.toHaveBeenCalled();
  });

  it("swallows lookup errors and returns the original label", async () => {
    termMock.mockResolvedValue({ termId: "9999", source: "dom" });
    findMock.mockRejectedValue(new Error("idb dead"));
    const result = await enrichInstructorName(params);
    expect(result).toBe("Smith");
  });
});

describe("enrichParams", () => {
  it("substitutes the enriched name into a fresh params object", async () => {
    mockTermAndCourses([
      { instructors: [{ name: "Alexander Smith" }] }
    ]);
    const original = {
      subject: "MATH",
      catalogNumber: "331-1",
      instructor: "Smith"
    };
    const enriched = await enrichParams(original);
    expect(enriched).not.toBe(original);
    expect(enriched.instructor).toBe("Alexander Smith");
    expect(enriched.subject).toBe("MATH");
    expect(enriched.catalogNumber).toBe("331-1");
  });

  it("returns the same reference when no enrichment was possible", async () => {
    const original = {
      subject: "MATH",
      catalogNumber: "331-1",
      instructor: "Alexander Smith"
    };
    const enriched = await enrichParams(original);
    expect(enriched).toBe(original);
  });
});

describe("enrichInstructorName — schedule and co-taught labels", () => {
  const params = { subject: "MATH", catalogNumber: "331-1", instructor: "Smith" };

  it("picks the scheduled section's professor when two share a last name", async () => {
    mockTermAndCourses([
      { section_id: "a", instructors: [{ name: "Alexander Smith" }] },
      { section_id: "z", instructors: [{ name: "Zachary Smith" }] }
    ]);
    scheduleMock.mockResolvedValue({ termId: "9999", sectionIds: ["z"] });
    expect(await enrichInstructorName(params)).toBe("Zachary Smith");
  });

  it("ignores a schedule saved for a different term", async () => {
    mockTermAndCourses([
      { section_id: "a", instructors: [{ name: "Alexander Smith" }] },
      { section_id: "z", instructors: [{ name: "Zachary Smith" }] }
    ]);
    scheduleMock.mockResolvedValue({ termId: "1111", sectionIds: ["z"] });
    expect(await enrichInstructorName(params)).toBe("Smith");
  });

  it("enriches every last name in a co-taught label", async () => {
    mockTermAndCourses([
      {
        section_id: "s",
        instructors: [{ name: "Stacey Wolcott" }, { name: "Kevin McMullan" }]
      }
    ], "DSGN", "381-0");
    const result = await enrichInstructorName({
      subject: "DSGN",
      catalogNumber: "381-0",
      instructor: "Wolcott, McMullan"
    });
    expect(result).toBe("Stacey Wolcott, Kevin McMullan");
  });

  it("keeps an unresolvable name while enriching the rest", async () => {
    mockTermAndCourses(
      [{ section_id: "s", instructors: [{ name: "Stacey Wolcott" }] }],
      "DSGN",
      "381-0"
    );
    const result = await enrichInstructorName({
      subject: "DSGN",
      catalogNumber: "381-0",
      instructor: "Wolcott, McMullan"
    });
    expect(result).toBe("Stacey Wolcott, McMullan");
  });
});

describe("enrichInstructorName — cross-listed numbers", () => {
  it("matches a section by its own number when paper.nu files it under the cross-list", async () => {
    termMock.mockResolvedValue({ termId: "9999", source: "dom" });
    // paper.nu stores COMP_SCI 397-0/497-0 as one course keyed 397-0; the
    // 497 listing only shows up on the section.
    findMock.mockResolvedValue([
      {
        catalog: "397-0",
        sections: [
          { subject: "COMP_SCI", number: "397-0", section_id: "x", instructors: [{ name: "Marcelo Worsley" }] },
          { subject: "COMP_SCI", number: "497-0", section_id: "x", instructors: [{ name: "Marcelo Worsley" }] }
        ]
      } as unknown as Awaited<ReturnType<typeof getTermCourses>>[number]
    ]);
    const result = await enrichInstructorName({
      subject: "COMP_SCI",
      catalogNumber: "497",
      instructor: "Worsley"
    });
    expect(result).toBe("Marcelo Worsley");
  });

  it("does not cross sequence numbers", async () => {
    mockTermAndCourses([{ instructors: [{ name: "Alexander Smith" }] }], "MATH", "331-2");
    expect(
      await enrichInstructorName({ subject: "MATH", catalogNumber: "331-1", instructor: "Smith" })
    ).toBe("Smith");
  });
});

describe("peekEnrichedParams", () => {
  const params = { subject: "MATH", catalogNumber: "331-1", instructor: "Smith" };

  it("returns raw params first, then the enriched name after the lookup lands", async () => {
    mockTermAndCourses([{ section_id: "a", instructors: [{ name: "Alexander Smith" }] }]);
    const onResolved = vi.fn();
    expect(peekEnrichedParams(params, document, onResolved)).toBe(params);
    await vi.waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
    expect(peekEnrichedParams(params, document, onResolved).instructor).toBe(
      "Alexander Smith"
    );
  });

  it("retries after paper.nu data was missing on the first try", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      termMock.mockResolvedValue({ termId: "", source: "fallback" });
      const onResolved = vi.fn();
      peekEnrichedParams(params, document, onResolved);
      await vi.waitFor(() => expect(termMock).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onResolved).not.toHaveBeenCalled();

      mockTermAndCourses([{ section_id: "a", instructors: [{ name: "Alexander Smith" }] }]);
      vi.setSystemTime(Date.now() + 10_000);
      peekEnrichedParams(params, document, onResolved);
      await vi.waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
    } finally {
      vi.useRealTimers();
    }
  });
});
