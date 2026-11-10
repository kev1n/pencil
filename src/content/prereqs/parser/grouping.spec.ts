import { describe, expect, it } from "vitest";

import type { PrereqNode } from "../types";
import { parsePrereq } from "./index";

// Compact rendering so each case reads as the logic it asserts.
function show(node: PrereqNode | null): string {
  if (!node) return "none";
  if (node.kind === "course") {
    return `${node.number}${node.section !== "0" ? `-${node.section}` : ""}`;
  }
  if (node.kind === "all" || node.kind === "any") {
    return `(${node.of.map(show).join(node.kind === "all" ? " & " : " | ")})`;
  }
  return node.kind;
}

const parse = (text: string): string => show(parsePrereq(text, "MATH").parsed);

describe("and/or grouping in comma lists", () => {
  it("reads ', and' as joining groups of alternatives", () => {
    expect(parse("STAT 202-0 or STAT 210-0, and COMP_SCI 110-0 or COMP_SCI 111-0")).toBe(
      "((202 | 210) & (110 | 111))"
    );
  });

  it("treats each comma chunk with its own 'or' as a separate requirement", () => {
    expect(
      parse("BIOL_SCI 202-0 or BIOL_SCI 240-0, BIOL_SCI 203-0 or BIOL_SCI 241-0, and BIOL_SCI 301-0")
    ).toBe("((202 | 240) & (203 | 241) & 301)");
  });

  it("reads 'A, B, C or D' as one list of alternatives", () => {
    expect(parse("GEN_ENG 205-1, GEN_ENG 206-1, MATH 240-0 or GEN_ENG 241-0")).toBe(
      "(205-1 | 206-1 | 240 | 241)"
    );
  });

  it("keeps the parts of one sequence required together", () => {
    expect(parse("PHYSICS 135-1, PHYSICS 135-2, PHYSICS 135-3 or PHYSICS 332-0")).toBe(
      "((135-1 & 135-2 & 135-3) | 332)"
    );
  });

  it("lets a closing escape hatch cover the whole list", () => {
    expect(parse("MATH 240-0, MATH 230-2, and STAT 320-2 or statistics graduate standing")).toBe(
      "((240 & 230-2 & 320-2) | standing)"
    );
    expect(parse("COMP_SCI 110-0, COMP_SCI 111-0, or consent of instructor")).toBe(
      "(110 | 111 | consent)"
    );
  });

  it("reads 'one of A, B, C' as alternatives", () => {
    expect(parse("Must have completed one of COMP_SCI 348, 349, 330, 339")).toBe(
      "(348 | 349 | 330 | 339)"
    );
  });

  it("does not turn 'with a C- or better' into a requirement", () => {
    expect(parse("Students must have taken CHEM 215-3 or CHEM 217-3 with a C- or better")).toBe(
      "(215-3 | 217-3)"
    );
  });

  it("lets a closing escape hatch cover a whole semicolon list", () => {
    expect(
      parse(
        "CHEM 215-2 or CHEM 212-3 or 217-3 (C- or better); MATH 230-2; PHYSICS 135-1 and PHYSICS 135-2; or consent of instructor"
      )
    ).toBe("(((215-2 | 212-3 | 217-3) & 230-2 & 135-1 & 135-2) | consent)");
  });

  it("joins a run of plain courses to the 'or' chunk that follows", () => {
    expect(parse("Gen_Eng 150, Gen_Eng 151 or Comp_Sci 150 (Programming), Math 220-1 or equivalent")).toBe(
      "((150 | 151 | 150) & 220-1)"
    );
    // An escape-hatch tail keeps every comma item required.
    expect(parse("ECON 201-0, ECON 202-0, STAT 210-0 or equivalent, BUS_INST 304-0 or equivalent")).toBe(
      "(201 & 202 & 210 & 304)"
    );
  });

  it("reads 'X and either A or B' as X plus one group of alternatives", () => {
    expect(parse("RTVF 190-0 and either THEATRE 171-0 or THEATRE 273-1")).toBe("(190 & (171 | 273-1))");
    expect(
      parse("Must be a neuroscience major, and BIOL_SCI 201-0 and either CHEM 132-0 or co-enrollment in CHEM 152-0 or CHEM 172-0")
    ).toBe("(topic & 201 & (132 | 152 | 172))");
    expect(
      parse(
        "DSGN 243-0 and either DSGN 240-0 or MECH_ENG 240-0 and either DSGN 220-0 or DSGN 320-0; or consent of the instructor"
      )
    ).toBe("((243 & (240 | 240) & (220 | 320)) | consent)");
    expect(
      parse(
        "STAT 202-0, STAT 210-0, or STAT 383-0 and either: NEUROSCI 202-0 and NEUROSCI 206-0; or NEUROSCI 311-0 and NEUROSCI 206-0; or BIOL_SCI 302-0"
      )
    ).toBe("((202 | 210 | 383) & ((202 & 206) | (311 & 206) | 302))");
  });
});

describe("prose that is not a requirement", () => {
  it("folds 'or equivalent' into the course before it", () => {
    expect(parse("PHYSICS 135-1 or equivalent and MATH 230-2 and MATH 240-0; PHYSICS 250-0 or MATH 250-0 or equivalent")).toBe(
      "(135-1 & 230-2 & 240 & (250 | 250))"
    );
    expect(parse("IEMS 401-0 or equivalent (i.e. graduate-level statistics and probability)")).toBe("401");
    const node = parsePrereq("CHEM 342-2 or equivalent and CHEM 350-2 (C- or better)", "CHEM").parsed;
    expect(node).toMatchObject({ kind: "all", of: [{ number: "342", equivalentOk: true }, { number: "350" }] });
  });

  it("reads grade phrases as grades", () => {
    const node = parsePrereq(
      "Student must have received a C- or higher or be currently enrolled in CHEM 215-1",
      "CHEM"
    ).parsed;
    expect(node).toEqual({ kind: "course", subject: "CHEM", number: "215", section: "1", minGrade: "C-" });
    expect(parse("grades of C- or higher in both BIOL_SCI 220-CN and CHEM 132-CN")).toBe("(220-CN & 132-CN)");
    expect(parse("Students must have taken 398-1 and passed with a B- or better")).toBe("398-1");
  });

  it("drops 'completed or currently enrolled in' wording", () => {
    expect(
      parse(
        "completed or currently enrolled in a course in the equivalency group containing 240-0, completed or currently enrolled in a course in the equivalency group containing 310-1"
      )
    ).toBe("(240 & 310-1)");
    expect(parse("prior completion of or concurrent enrollment in MATH 228-2")).toBe("228-2");
    expect(parse("Students must be enrolled or have completed CHEM 215-1")).toBe("215-1");
    expect(parse("Students must currently be enrolled in or have taken and passed Spanish 101-1 or have sufficient placement test score")).toBe(
      "(101-1 | placement)"
    );
    expect(parse("Students must have taken and passed BUSCOM 906-0 Contract Law")).toBe("906");
    // A qualifier in front of the phrase is kept.
    expect(parse("This class is restricted to first-year ISP students who have completed or are currently enrolled in MATH 281-1")).toContain(
      "topic"
    );
  });

  it("drops dangling connectives and registration boilerplate", () => {
    expect(
      parse("Students must have completed CHEM 171-0 and CHEM 181-0 with a C- or better, and must be taken concurrently with CHEM 172-0")
    ).toBe("(171 & 181 & 172)");
    expect(
      parse("MATH 228-2. Add both classes to the shopping cart and submit together for successful registration")
    ).toBe("228-2");
    expect(parse("Students must have taken IEMS 302, 303, and 317 in order to register for this course")).toBe(
      "(302 & 303 & 317)"
    );
    expect(parse("To enroll, students must have completed BIOL_SCI 202-0 or BIOL_SCI 240-0, and BIOL_SCI 301-0")).toBe(
      "((202 | 240) & 301)"
    );
    expect(parse("Students must have completed CHEM_ENG 132-0, 152-0, or 172-0")).toBe("(132 | 152 | 172)");
  });

  it("reads an AP-score clause as one placement, never splitting its 'and'", () => {
    const node = parsePrereq(
      "Must be enrolled in or have passed SPANISH 200-0 or SPANISH 204-0, have an AP score of 5 for heritage students, an AP of 5 in the Spanish Language and Literature exams for non-heritage students, or Spanish Language Placement Exam score",
      "SPANISH"
    ).parsed;
    expect(node).toEqual({
      kind: "any",
      of: [
        { kind: "course", subject: "SPANISH", number: "200", section: "0" },
        { kind: "course", subject: "SPANISH", number: "204", section: "0" },
        { kind: "placement", exam: "AP" },
        { kind: "placement", exam: "language" }
      ]
    });
  });

  it("reads 'AP N in X, Y or Z' as one placement", () => {
    expect(
      parse("AP 4 in Spanish, French or Italian; instructor permission, or sufficient score on placement test.")
    ).toBe("(placement | consent | placement)");
    // Semicolons without an AP clause still join requirements.
    expect(parse("1 quarter of chemistry; 1 quarter of geoscience, environmental sciences, or biological sciences")).toBe(
      "(topic & (topic | topic | topic))"
    );
  });

  it("pairs 'AP credit for B' with B and keeps the rest of the list required", () => {
    const node = parsePrereq(
      "To register, students must have completed PSYCH 201 with a C- or higher, STAT 210 with a B or higher, or have AP credit (score of 5) for STAT 210",
      "PSYCH"
    ).parsed;
    expect(node).toEqual({
      kind: "all",
      of: [
        { kind: "course", subject: "PSYCH", number: "201", section: "0", minGrade: "C-" },
        {
          kind: "any",
          of: [
            { kind: "course", subject: "STAT", number: "210", section: "0" },
            { kind: "placement", exam: "AP" }
          ]
        }
      ]
    });
    // A credit naming an earlier item groups it with the items after it;
    // a "REQ:" label and a trailing sentence are not requirements.
    expect(
      parse(
        "REQ: To register, students must have completed PSYCH 201 with a C- or higher, STAT 202 with a B or higher, STAT 210 with a B or higher, or have AP credit (score of 5) for STAT 202. No first-year students"
      )
    ).toBe("(201 & (202 | 210 | placement))");
    // Without a "for <listed course>" the Oxford list stays alternatives.
    expect(parse("FRENCH 202-0, AP score of 5, or consent of instructor")).toBe("(202 | placement | consent)");
  });

  it("keeps C- and B- grade notes on the course they follow", () => {
    expect(parsePrereq("Students must have passed Korean 111-1 with at least a C- or be placed in according to placement test results", "KOREAN").parsed).toMatchObject({
      kind: "any",
      of: [{ number: "111", section: "1", minGrade: "C-" }, { kind: "placement" }]
    });
    expect(parsePrereq("Students must have taken 398-1 and passed with a B- or better", "SOCIOL").parsed).toMatchObject({
      minGrade: "B-"
    });
  });

  it("applies a grade after an 'and' run to every course in it", () => {
    // Courses carrying a grade show as "171*".
    const graded = (text: string): string => show(parsePrereq(text, "CHEM").parsed);
    const leaves = (text: string): string => {
      const walk = (n: PrereqNode | null): string =>
        !n
          ? "none"
          : n.kind === "course"
            ? `${n.number}${n.minGrade ? "*" : ""}`
            : n.kind === "all" || n.kind === "any"
              ? `(${n.of.map(walk).join(n.kind === "all" ? " & " : " | ")})`
              : n.kind;
      return walk(parsePrereq(text, "CHEM").parsed);
    };
    expect(leaves("CHEM 171 and 181 with a grade of C- or better OR you must currently be enrolled in CHEM 171")).toBe(
      "((171* & 181*) | 171)"
    );
    expect(leaves("CHEM 342-1 and CHEM 342-2 (C- or better)")).toBe("(342* & 342*)");
    expect(leaves("CHEM 101-0, CHEM 171-0 and CHEM 181-0 with a C- or better")).toBe("(101* & 171* & 181*)");
    // Never across an "or" or a semicolon.
    expect(leaves("CHEM 171-0 or CHEM 181-0 with a C- or better")).toBe("(171 | 181*)");
    expect(graded("CHEM 171-0 or CHEM 181-0 with a C- or better")).toBe(graded("CHEM 171-0 or CHEM 181-0"));
    expect(leaves("CHEM 101-0 and CHEM 171-0; CHEM 181-0 with a C- or better")).toBe("(101 & 171 & 181*)");
    expect(leaves("CHEM 215-3 or 217-3, and CHEM 235-3 (C- or better)")).toBe("((215 | 217) & 235*)");
    expect(leaves("CHEM 215-3 or CHEM 212-3, and CHEM 235-3 (C- or better)")).toBe("((215 | 212) & 235*)");
  });

  it("reads graduate-student wording as graduate standing", () => {
    const at = (text: string): PrereqNode | null => {
      const node = parsePrereq(text, "CIV_ENV").parsed;
      return node && node.kind === "any" ? node.of[node.of.length - 1] : node;
    };
    expect(at("CIV_ENV 221-0, or be a graduate student")).toEqual({ kind: "standing", level: "graduate" });
    expect(at("BMD_ENG 271 or be a BME Graduate student")).toEqual({
      kind: "standing",
      level: "graduate",
      scope: { type: "program", names: ["BME"] }
    });
    expect(at("COMP_SCI 110-0 or be a CS Masters student")).toEqual({
      kind: "standing",
      level: "graduate",
      scope: { type: "program", names: ["CS Masters"] }
    });
    expect(at("BIOL_SCI 201 or be a BMD_ENG Graduate student to enroll")).toMatchObject({
      scope: { names: ["BMD_ENG"] }
    });
    // Lowercase prose in front is not a program name.
    expect(parse("knowledge of graduate students")).toBe("topic");
    expect(parse("Senior Undergraduates")).toBe("topic");
  });

  it("keeps real requirements written as prose", () => {
    expect(parse("strong background in high school algebra")).toBe("topic");
    expect(parse("COMP_SCI 208-0 or CS MS or CS PhD")).toBe("(208 | topic | topic)");
    expect(parse("MATH 228-1 or graduate standing")).toBe("(228-1 | standing)");
  });
});
