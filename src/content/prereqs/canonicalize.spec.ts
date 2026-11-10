import { describe, expect, it } from "vitest";

import type { PaperCourse } from "../augmentations/class-search/paper-data";
import { aliasCourseId, buildCourseCatalog, canonicalizePrereqs } from "./canonicalize";
import type { PrereqNode, PrereqRecord } from "./types";

function course(id: string, terms: string[] = ["5050"]): PaperCourse {
  const [subject, catalog] = id.split(" ");
  return { id, subject, catalog, name: id, units: "1", terms };
}

const catalog = buildCourseCatalog([
  course("CHEM 215-1"),
  course("CHEM 210-1", ["4830"]),
  course("CHEM 306-0"),
  course("STAT 202-0"),
  course("STAT 202-CN", ["4900"]),
  course("STAT 232-0", ["4810"]),
  course("DSGN 106-1"),
  course("DSGN 106-2"),
  course("COMP_ENG 203-0"),
  course("COMP_SCI 213-0"),
  course("ELEC_ENG 202-0"),
  course("GERMAN 303-0"),
  course("MATH 240-0"),
  course("MATH 310-2"),
  course("CLIN_PSY 490-1", ["4960"]),
  course("CLIN_PSY 490-2"),
  course("BLK_ST 259-0")
]);

const c = (subject: string, number: string, section = "0"): PrereqNode => ({
  kind: "course",
  subject,
  number,
  section
});

function run(host: string, parsed: PrereqNode): PrereqNode | null {
  const record: PrereqRecord = { id: host, raw: "", parsed, warnings: [] };
  return canonicalizePrereqs(new Map([[host, record]]), catalog).get(host)?.parsed ?? null;
}

describe("canonicalizePrereqs", () => {
  it("rewrites a renumbered course to its current number", () => {
    expect(run("CHEM 306-0", c("CHEM", "210", "1"))).toEqual(c("CHEM", "215", "1"));
    expect(aliasCourseId("CHEM 210-1")).toBe("CHEM 215-1");
  });

  it("follows a renamed department only to numbers that still exist", () => {
    expect(run("CHEM 306-0", c("AF_AM_ST", "259"))).toEqual(c("BLK_ST", "259"));
    expect(run("CHEM 306-0", c("AF_AM_ST", "999"))?.kind).toBe("raw");
    expect(aliasCourseId("GNDR_ST 235-0")).toBe("GSS 235-0");
  });

  it("collapses alternates that alias onto the same course", () => {
    expect(
      run("CHEM 306-0", { kind: "any", of: [c("CHEM", "210", "1"), c("CHEM", "215", "1")] })
    ).toEqual(c("CHEM", "215", "1"));
  });

  it("drops a retired alternate when a live one sits beside it", () => {
    expect(run("CHEM 306-0", { kind: "any", of: [c("STAT", "232"), c("STAT", "202")] })).toEqual(
      c("STAT", "202")
    );
  });

  it("keeps a retired course that is the only option", () => {
    expect(run("CHEM 306-0", c("STAT", "232"))).toEqual(c("STAT", "232"));
  });

  it("swaps a dead suffix or bare number for the live variant", () => {
    expect(run("CHEM 306-0", c("STAT", "202", "CN"))).toEqual(c("STAT", "202"));
    expect(run("CHEM 306-0", c("DSGN", "106"))).toEqual(c("DSGN", "106", "1"));
  });

  it("never swaps one sequence part for another", () => {
    expect(run("CLIN_PSY 490-2", c("CLIN_PSY", "490", "1"))).toEqual(c("CLIN_PSY", "490", "1"));
  });

  it("resolves EECS to the department that still carries the number", () => {
    expect(run("COMP_ENG 203-0", c("EECS", "203"))).toEqual(c("COMP_ENG", "203"));
    expect(run("COMP_ENG 203-0", c("EECS", "213"))).toEqual(c("COMP_SCI", "213"));
  });

  it("turns misparsed level phrases into level wildcards", () => {
    expect(run("GERMAN 303-0", c("TWO", "200", "LEVEL"))).toEqual({
      kind: "level-wildcard",
      levels: [200],
      subjects: ["GERMAN"],
      count: 2
    });
  });

  it("reads a stray word before a bare number as the host department", () => {
    expect(run("MATH 310-2", c("CONTAINING", "240"))).toEqual(c("MATH", "240"));
    expect(run("MATH 310-2", c("NONSENSE", "999"))).toEqual({
      kind: "raw",
      text: "NONSENSE 999",
      reason: "unknown-subject"
    });
  });

  it("keeps one copy when a renumbered course lands on a sibling", () => {
    const graded: PrereqNode = {
      kind: "course",
      subject: "CHEM",
      number: "215",
      section: "1",
      minGrade: "C-"
    };
    expect(
      run("CHEM 306-0", { kind: "any", of: [c("CHEM", "210", "1"), graded, c("STAT", "202")] })
    ).toEqual({ kind: "any", of: [c("CHEM", "215", "1"), c("STAT", "202")] });
  });
});
