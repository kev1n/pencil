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
});
