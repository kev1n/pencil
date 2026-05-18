import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../class-search/paper-data", () => ({
  findTermCoursesByCatalog: vi.fn()
}));

vi.mock("./paper-active-term", () => ({
  getActivePaperTermId: vi.fn()
}));

const { findTermCoursesByCatalog } = await import("../class-search/paper-data");
const { getActivePaperTermId } = await import("./paper-active-term");
const {
  enrichInstructorName,
  enrichParams,
  clearInstructorEnrichmentCache
} = await import("./instructor-enrichment");

const findMock = vi.mocked(findTermCoursesByCatalog);
const termMock = vi.mocked(getActivePaperTermId);

function mockTermAndCourses(
  sections: Array<{ instructors: Array<{ name: string }> }>
): void {
  termMock.mockResolvedValue({ termId: "9999", source: "dom" });
  findMock.mockResolvedValue([
    { sections } as unknown as Awaited<ReturnType<typeof findTermCoursesByCatalog>>[number]
  ]);
}

beforeEach(() => {
  clearInstructorEnrichmentCache();
  findMock.mockReset();
  termMock.mockReset();
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
    expect(findMock).toHaveBeenCalledWith("9999", "MATH", "331-1");
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
