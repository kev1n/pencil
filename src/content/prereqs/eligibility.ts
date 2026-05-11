// Pure prereq evaluator. Maps a parsed PrereqNode + the user's course
// history into an EligibilityResult the UI can render. No DOM, no chrome.*,
// no I/O — every input is passed in by the caller.

import {
  ELIGIBILITY_RANK,
  type EligibilityHistoryEntry,
  type EligibilityResult,
  type EligibilityState,
  type EvaluateEligibility,
  type PrereqNode
} from "./types";

const NO_DATA: EligibilityResult = { state: "no-data", missing: [], notes: [] };

// Letter grades in descending order. Anything not in this table — pass/fail
// codes ("P", "S", "CR"), placeholders ("W", "I"), empty strings — never
// satisfies a minGrade requirement.
const GRADE_ORDER: readonly string[] = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F"
];

function gradeRank(grade: string): number {
  const idx = GRADE_ORDER.indexOf(grade.toUpperCase());
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

function meetsMinGrade(grade: string, min: string): boolean {
  const g = gradeRank(grade);
  const m = gradeRank(min);
  if (g === Number.POSITIVE_INFINITY || m === Number.POSITIVE_INFINITY) return false;
  return g <= m;
}

function ready(): EligibilityResult {
  return { state: "ready", missing: [], notes: [] };
}

function bestOf(results: readonly EligibilityResult[]): EligibilityResult {
  if (results.length === 0) return ready();
  let bestRank = ELIGIBILITY_RANK[results[0].state];
  for (const r of results) {
    const rank = ELIGIBILITY_RANK[r.state];
    if (rank < bestRank) bestRank = rank;
  }
  const winners = results.filter((r) => ELIGIBILITY_RANK[r.state] === bestRank);
  // The "best" state could appear multiple times; use the first one's state
  // so it's deterministic. ready winners contribute no missing/notes.
  const state = winners[0].state;
  if (state === "ready") {
    const notes: string[] = [];
    for (const w of winners) notes.push(...w.notes);
    return { state, missing: [], notes };
  }
  const missing: PrereqNode[] = [];
  const notes: string[] = [];
  for (const w of winners) {
    missing.push(...w.missing);
    notes.push(...w.notes);
  }
  return { state, missing, notes };
}

function worstOf(results: readonly EligibilityResult[]): EligibilityResult {
  if (results.length === 0) return ready();
  let worstRank = ELIGIBILITY_RANK[results[0].state];
  for (const r of results) {
    const rank = ELIGIBILITY_RANK[r.state];
    if (rank > worstRank) worstRank = rank;
  }
  const state: EligibilityState = (
    Object.keys(ELIGIBILITY_RANK) as EligibilityState[]
  ).find((k) => ELIGIBILITY_RANK[k] === worstRank) as EligibilityState;
  const missing: PrereqNode[] = [];
  const notes: string[] = [];
  for (const r of results) {
    // ready children are satisfied; their missing/notes don't carry forward.
    if (r.state === "ready") {
      notes.push(...r.notes);
      continue;
    }
    missing.push(...r.missing);
    notes.push(...r.notes);
  }
  return { state, missing, notes };
}

// Canonical course-identity key shared with `buildHistoryMap` in the
// prereq-filter augmentation. The registrar treats "-0" as "no section
// subdivision" — drop it so a prereq node `{number:"111", section:"0"}`
// matches a history row "COMP_SCI 111-0". Multi-quarter sequences
// (MATH 220-1, 220-2) keep their section so they stay distinct.
function courseKey(node: Extract<PrereqNode, { kind: "course" }>): string {
  const section = node.section && node.section !== "0" ? `-${node.section}` : "";
  return `${node.subject} ${node.number}${section}`;
}

function evaluateCourse(
  node: Extract<PrereqNode, { kind: "course" }>,
  history: ReadonlyMap<string, EligibilityHistoryEntry>
): EligibilityResult {
  const key = courseKey(node);
  const entry = history.get(key);
  const notes: string[] = [];
  if (node.concurrent === "required") notes.push("concurrent enrollment required");
  else if (node.concurrent === "allowed") notes.push("concurrent enrollment allowed");

  // recommended != required. The parser tags soft suggestions ("X
  // recommended") with `recommended: true`; they must never block. Surface
  // a hint so the UI can mark the course as advisory.
  if (node.recommended) {
    return {
      state: "ready",
      missing: [],
      notes: [...notes, `recommended: ${key}`]
    };
  }

  if (!entry) {
    return { state: "blocked", missing: [node], notes };
  }
  const status = entry.status;
  if (status === "Taken") {
    if (node.minGrade) {
      const grade = entry.grade ?? "";
      if (!meetsMinGrade(grade, node.minGrade)) {
        return {
          state: "blocked",
          missing: [node],
          notes: [...notes, `minimum grade ${node.minGrade} not met`]
        };
      }
    }
    return { state: "ready", missing: [], notes };
  }
  if (status === "Transferred" || status === "In Progress") {
    // Per spec: In Progress fully satisfies (no soft-pass downgrade), and
    // minGrade is only enforced on Taken with a real letter grade.
    return { state: "ready", missing: [], notes };
  }
  return { state: "blocked", missing: [node], notes };
}

export const evaluateEligibility: EvaluateEligibility = (node, historyByCourseKey) => {
  if (node === null) return { ...NO_DATA };
  return evaluateNode(node, historyByCourseKey);
};

function evaluateNode(
  node: PrereqNode,
  history: ReadonlyMap<string, EligibilityHistoryEntry>
): EligibilityResult {
  switch (node.kind) {
    case "none":
      return ready();
    case "course":
      return evaluateCourse(node, history);
    case "consent":
      return {
        state: "needs-consent",
        missing: [node],
        notes: [`needs ${node.source} consent`]
      };
    case "standing":
      // No standing inference in v1; revisit when access-gate exposes
      // grad-year so we can derive class standing without asking the user.
      return { state: "unknown", missing: [node], notes: [] };
    case "topic":
    case "raw":
    case "level-wildcard":
    case "program":
    case "program-membership":
    case "placement":
    case "gpa":
      return { state: "unknown", missing: [node], notes: [] };
    case "all": {
      if (node.of.length === 0) return ready();
      const children = node.of.map((c) => evaluateNode(c, history));
      return worstOf(children);
    }
    case "any": {
      if (node.of.length === 0) return ready();
      const children = node.of.map((c) => evaluateNode(c, history));
      return bestOf(children);
    }
    case "when": {
      const cond = evaluateNode(node.condition, history);
      // Conditions today are always program-membership (or similar) which we
      // can't verify, so cond.state will be "unknown". We optimistically
      // evaluate `then` so the UI can still surface what would be required,
      // then tag the whole result `unknown` to signal the gate is uncertain.
      const branch = evaluateNode(node.then, history);
      if (cond.state === "unknown") {
        return { ...branch, state: "unknown" };
      }
      if (cond.state === "ready") return branch;
      // condition definitively false → requirement is vacuously satisfied.
      return ready();
    }
  }
}

// Re-export so consumers don't need to know the implementation file layout.
export type { EligibilityHistoryEntry, EligibilityResult, PrereqNode };
