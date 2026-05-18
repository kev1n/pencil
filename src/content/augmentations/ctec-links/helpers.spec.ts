import { describe, expect, it } from "vitest";

import { buildInstructorLastNameLabel } from "../paper-ctec/identity";
import { instructorMatches } from "./helpers";

describe("instructorMatches", () => {
  it("matches identical full names", () => {
    expect(instructorMatches("Alexander Smith", "Alexander Smith")).toBe(true);
  });

  it("matches by last name when neither side carries a first name", () => {
    expect(instructorMatches("Smith", "Smith")).toBe(true);
  });

  it("rejects same last name with different first initials", () => {
    expect(instructorMatches("Zachary Smith", "Alexander Smith")).toBe(false);
    expect(instructorMatches("Alexander Smith", "Zachary Smith")).toBe(false);
  });

  it("rejects when the row carries first name but request is label-only", () => {
    // A bare "Smith" request can't safely claim Zachary Smith's row —
    // we'd rather surface "not found" than the wrong professor's data.
    expect(instructorMatches("Alexander Smith", "Smith")).toBe(false);
    expect(instructorMatches("Zachary B. Smith", "Smith")).toBe(false);
  });

  it("matches when the request carries first name but row only has last", () => {
    // CAESAR effectively never sends label-only rows, but if it did the
    // request is at least as specific as the row, so accepting is safe.
    expect(instructorMatches("Smith", "Alexander Smith")).toBe(true);
  });

  it("matches when first initial agrees regardless of trailing tokens", () => {
    expect(instructorMatches("A. Smith", "Alexander Smith")).toBe(true);
    expect(instructorMatches("Alexander S. Smith", "Alexander Smith")).toBe(true);
  });

  it("ignores Jr / Sr suffix when comparing", () => {
    expect(instructorMatches("Alexander Smith Jr", "Alexander Smith")).toBe(true);
    expect(instructorMatches("Alexander Smith Jr", "Zachary Smith Jr")).toBe(false);
  });

  it("matches when any co-instructor agrees, order-independent", () => {
    expect(
      instructorMatches("John Hartman, Stacey Wolcott", "Stacey Wolcott")
    ).toBe(true);
    expect(
      instructorMatches("Stacey Wolcott, John Hartman", "John Hartman")
    ).toBe(true);
  });

  it("rejects co-instructor lists when no last name overlaps", () => {
    expect(
      instructorMatches("John Hartman, Stacey Wolcott", "Alexander Smith")
    ).toBe(false);
  });

  it("treats an empty requested name as wildcard (course lens)", () => {
    expect(instructorMatches("Alexander Smith", "")).toBe(true);
  });
});

describe("buildInstructorLastNameLabel", () => {
  it("preserves first initial alongside last name", () => {
    expect(buildInstructorLastNameLabel(["Alexander Smith"])).toBe("A Smith");
    expect(buildInstructorLastNameLabel(["Zachary Smith"])).toBe("Z Smith");
  });

  it("falls back to last-name-only when only a single token is provided", () => {
    expect(buildInstructorLastNameLabel(["Smith"])).toBe("Smith");
  });

  it("strips a trailing Jr / Sr suffix", () => {
    expect(buildInstructorLastNameLabel(["Alexander Smith Jr."])).toBe("A Smith");
  });

  it("joins multiple instructors with a comma", () => {
    expect(
      buildInstructorLastNameLabel(["Alexander Smith", "John Doe"])
    ).toBe("A Smith, J Doe");
  });

  it("yields labels that round-trip through instructorMatches", () => {
    const alexLabel = buildInstructorLastNameLabel(["Alexander Smith"]);
    const zachLabel = buildInstructorLastNameLabel(["Zachary Smith"]);
    expect(instructorMatches("Alexander Smith", alexLabel)).toBe(true);
    expect(instructorMatches("Zachary Smith", alexLabel)).toBe(false);
    expect(instructorMatches("Zachary Smith", zachLabel)).toBe(true);
  });
});
