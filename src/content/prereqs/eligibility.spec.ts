import { describe, expect, it } from "vitest";

import { evaluateEligibility } from "./eligibility";
import type { EligibilityHistoryEntry, PrereqNode } from "./types";

type History = ReadonlyMap<string, EligibilityHistoryEntry>;

function hist(
  entries: Record<string, EligibilityHistoryEntry>
): History {
  return new Map(Object.entries(entries));
}

function course(
  subject: string,
  number: string,
  extra: Partial<Extract<PrereqNode, { kind: "course" }>> = {}
): PrereqNode {
  return {
    kind: "course",
    subject,
    number,
    section: "0",
    ...extra
  };
}

const EMPTY_HISTORY: History = new Map();

const TAKEN_213: History = hist({
  "COMP_SCI 213": { status: "Taken", grade: "B" }
});
const TAKEN_214_C_MINUS: History = hist({
  "COMP_SCI 214": { status: "Taken", grade: "C-" }
});
const TAKEN_213_AND_214: History = hist({
  "COMP_SCI 213": { status: "Taken", grade: "B" },
  "COMP_SCI 214": { status: "Taken", grade: "B+" }
});
const IN_PROGRESS_213: History = hist({
  "COMP_SCI 213": { status: "In Progress", grade: null }
});
const TRANSFERRED_213: History = hist({
  "COMP_SCI 213": { status: "Transferred", grade: null }
});

describe("evaluateEligibility — leaf nodes", () => {
  it("null → no-data", () => {
    expect(evaluateEligibility(null, EMPTY_HISTORY)).toEqual({
      state: "no-data",
      missing: [],
      notes: []
    });
  });

  it("none → ready", () => {
    expect(evaluateEligibility({ kind: "none" }, EMPTY_HISTORY)).toEqual({
      state: "ready",
      missing: [],
      notes: []
    });
  });

  it("satisfied course → ready", () => {
    const node = course("COMP_SCI", "213");
    const r = evaluateEligibility(node, TAKEN_213);
    expect(r.state).toBe("ready");
    expect(r.missing).toEqual([]);
  });

  it("missing course → blocked, surfaces the node", () => {
    const node = course("COMP_SCI", "213");
    const r = evaluateEligibility(node, EMPTY_HISTORY);
    expect(r.state).toBe("blocked");
    expect(r.missing).toEqual([node]);
  });

  it("consent → needs-consent", () => {
    const node: PrereqNode = { kind: "consent", source: "instructor" };
    const r = evaluateEligibility(node, EMPTY_HISTORY);
    expect(r.state).toBe("needs-consent");
    expect(r.missing).toEqual([node]);
    expect(r.notes).toContain("needs instructor consent");
  });

  it("standing → unknown", () => {
    const node: PrereqNode = { kind: "standing", level: "junior" };
    expect(evaluateEligibility(node, EMPTY_HISTORY).state).toBe("unknown");
  });

  it("topic → unknown", () => {
    const node: PrereqNode = { kind: "topic", topic: "graph theory" };
    expect(evaluateEligibility(node, EMPTY_HISTORY).state).toBe("unknown");
  });
});

describe("evaluateEligibility — combinators", () => {
  it("AND of two satisfied courses → ready", () => {
    const node: PrereqNode = {
      kind: "all",
      of: [course("COMP_SCI", "213"), course("COMP_SCI", "214")]
    };
    const r = evaluateEligibility(node, TAKEN_213_AND_214);
    expect(r.state).toBe("ready");
    expect(r.missing).toEqual([]);
  });

  it("AND of one satisfied + one missing → blocked, missing has the missing course", () => {
    const missing = course("COMP_SCI", "214");
    const node: PrereqNode = {
      kind: "all",
      of: [course("COMP_SCI", "213"), missing]
    };
    const r = evaluateEligibility(node, TAKEN_213);
    expect(r.state).toBe("blocked");
    expect(r.missing).toEqual([missing]);
  });

  it("OR of two courses, one satisfied → ready, no missing", () => {
    const node: PrereqNode = {
      kind: "any",
      of: [course("COMP_SCI", "213"), course("COMP_SCI", "214")]
    };
    const r = evaluateEligibility(node, TAKEN_213);
    expect(r.state).toBe("ready");
    expect(r.missing).toEqual([]);
  });

  it("OR of two missing → blocked", () => {
    const node: PrereqNode = {
      kind: "any",
      of: [course("COMP_SCI", "213"), course("COMP_SCI", "214")]
    };
    const r = evaluateEligibility(node, EMPTY_HISTORY);
    expect(r.state).toBe("blocked");
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("OR of missing-course + consent → needs-consent (consent wins over blocked)", () => {
    const node: PrereqNode = {
      kind: "any",
      of: [course("COMP_SCI", "213"), { kind: "consent", source: "instructor" }]
    };
    const r = evaluateEligibility(node, EMPTY_HISTORY);
    expect(r.state).toBe("needs-consent");
  });

  it("nested all > any > course composition resolves correctly", () => {
    const node: PrereqNode = {
      kind: "all",
      of: [
        course("COMP_SCI", "213"),
        {
          kind: "any",
          of: [course("MATH", "228-1"), course("MATH", "230-1")]
        }
      ]
    };
    const history = hist({
      "COMP_SCI 213": { status: "Taken", grade: "A" },
      "MATH 230-1": { status: "Taken", grade: "B" }
    });
    expect(evaluateEligibility(node, history).state).toBe("ready");
  });
});

describe("evaluateEligibility — minGrade", () => {
  it("minGrade pass: Taken with B vs minGrade C- → ready", () => {
    const node = course("COMP_SCI", "213", { minGrade: "C-" });
    expect(evaluateEligibility(node, TAKEN_213).state).toBe("ready");
  });

  it("minGrade fail: Taken with C- vs minGrade B- → blocked", () => {
    const node = course("COMP_SCI", "214", { minGrade: "B-" });
    const r = evaluateEligibility(node, TAKEN_214_C_MINUS);
    expect(r.state).toBe("blocked");
    expect(r.missing).toEqual([node]);
  });

  it("minGrade with In Progress → ready (no grade comparison)", () => {
    const node = course("COMP_SCI", "213", { minGrade: "B-" });
    expect(evaluateEligibility(node, IN_PROGRESS_213).state).toBe("ready");
  });

  it("minGrade with Transferred → ready (no grade comparison)", () => {
    const node = course("COMP_SCI", "213", { minGrade: "B-" });
    expect(evaluateEligibility(node, TRANSFERRED_213).state).toBe("ready");
  });
});

describe("evaluateEligibility — when (program-membership condition)", () => {
  it("when with unknown condition → propagates unknown over the then branch", () => {
    const node: PrereqNode = {
      kind: "when",
      condition: { kind: "program-membership", program: "MMSS", negated: false },
      then: course("COMP_SCI", "213")
    };
    const r = evaluateEligibility(node, TAKEN_213);
    expect(r.state).toBe("unknown");
  });
});

describe("evaluateEligibility — recommended", () => {
  it("recommended course never blocks, regardless of history", () => {
    const node = course("COMP_ENG", "203", { recommended: true });
    const r = evaluateEligibility(node, EMPTY_HISTORY);
    expect(r.state).toBe("ready");
    expect(r.missing).toEqual([]);
    expect(r.notes).toContain("recommended: COMP_ENG 203");
  });

  it("AND of required + recommended-missing → required wins, AND is ready iff required is satisfied", () => {
    const required = course("COMP_SCI", "213");
    const recommended = course("COMP_ENG", "203", { recommended: true });
    const node: PrereqNode = { kind: "all", of: [required, recommended] };
    // With required satisfied, whole thing is ready (recommended doesn't block).
    expect(evaluateEligibility(node, TAKEN_213).state).toBe("ready");
    // With required missing, whole thing is blocked but recommended is NOT in missing.
    const blocked = evaluateEligibility(node, EMPTY_HISTORY);
    expect(blocked.state).toBe("blocked");
    expect(blocked.missing).toHaveLength(1);
    expect(blocked.missing[0]).toBe(required);
  });
});

describe("evaluateEligibility — concurrent notes", () => {
  it("concurrent: allowed surfaces a note when satisfied", () => {
    const node = course("COMP_SCI", "213", { concurrent: "allowed" });
    const r = evaluateEligibility(node, TAKEN_213);
    expect(r.state).toBe("ready");
    expect(r.notes).toContain("concurrent enrollment allowed");
  });

  it("concurrent: required surfaces a note when satisfied", () => {
    const node = course("COMP_SCI", "213", { concurrent: "required" });
    const r = evaluateEligibility(node, TAKEN_213);
    expect(r.state).toBe("ready");
    expect(r.notes).toContain("concurrent enrollment required");
  });
});
