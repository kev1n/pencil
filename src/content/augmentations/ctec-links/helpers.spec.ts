import { describe, expect, it } from "vitest";

import { buildInstructorLastNameLabel } from "../paper-ctec/identity";
import type { CtecIndexedEntry } from "../../ctec-index/types";
import { NOT_FOUND_ACTION_ID } from "./constants";
import {
  ctecLookupCourses,
  entryMatchesByCourse,
  entryMatchesCourse,
  instructorMatches,
  notFoundDescription
} from "./helpers";

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

describe("former course numbers", () => {
  const entry = (description: string, instructor = "Vincent St-Amour"): CtecIndexedEntry => ({
    actionId: "MYLINK1$0",
    term: "2026 Spring",
    description,
    instructor,
    blueraUrl: "https://example.test/report",
    error: null,
    searchText: ""
  });
  const notFound = (description: string): CtecIndexedEntry => ({
    actionId: NOT_FOUND_ACTION_ID,
    term: "",
    description,
    instructor: "",
    blueraUrl: null,
    error: "not-found",
    searchText: "208"
  });

  it("looks up a renumbered course under its old number too", () => {
    expect(ctecLookupCourses("COMP_SCI", "208")).toEqual([
      { subject: "COMP_SCI", catalogNumber: "208" },
      { subject: "COMP_SCI", catalogNumber: "214" }
    ]);
    expect(ctecLookupCourses("MATH", "220-1")).toEqual([
      { subject: "MATH", catalogNumber: "220-1" },
      { subject: "MATH", catalogNumber: "220" }
    ]);
    expect(ctecLookupCourses("COMP_SCI", "211")).toHaveLength(1);
  });

  it("looks up a renamed department under its old code", () => {
    expect(ctecLookupCourses("GSS", "220")).toEqual([
      { subject: "GSS", catalogNumber: "220" },
      { subject: "GNDR_ST", catalogNumber: "220" }
    ]);
  });

  it("skips a former number that belonged to another department", () => {
    // ENGLISH 220 was COMP_LIT 210, but ENGLISH has its own 210.
    expect(ctecLookupCourses("ENGLISH", "220")).toHaveLength(1);
  });

  it("counts evaluations filed under the old number", () => {
    const old = entry("COMP_SCI 214-0-1 Data Structures & Algorithms");
    expect(entryMatchesCourse(old, "COMP_SCI", "208", "Vincent St-Amour")).toBe(true);
    expect(entryMatchesCourse(old, "COMP_SCI", "208", "Sara Sood")).toBe(false);
    expect(entryMatchesByCourse(old, "COMP_SCI", "208")).toBe(true);
    expect(entryMatchesByCourse(old, "COMP_SCI", "211")).toBe(false);
    // The old number does not pick up the new one's evaluations.
    expect(entryMatchesByCourse(entry("COMP_SCI 208-0-1 Data Structures"), "COMP_SCI", "214")).toBe(false);
  });

  it("ignores a not-found marker that never searched the old number", () => {
    expect(entryMatchesByCourse(notFound("COMP_SCI 208"), "COMP_SCI", "208")).toBe(false);
    expect(
      entryMatchesByCourse(notFound(notFoundDescription("COMP_SCI", "208")), "COMP_SCI", "208")
    ).toBe(true);
  });
});
