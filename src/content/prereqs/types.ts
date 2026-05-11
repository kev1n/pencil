// Locked schema for the prereqs subsystem. The shape mirrors the parser
// in scripts/parse_prereqs.py 1:1 — round-trip parity against
// __fixtures__/prereqs-parsed.json is the parity gate for the TS port.
//
// Don't add fields without updating: parser/atoms.ts (emitter), parser.spec.ts
// (golden file already pinned to this shape), and eligibility.ts (consumer).

export type PrereqStanding =
  | "first-year"
  | "second-year"
  | "sophomore"
  | "junior"
  | "senior"
  | "advanced"
  | "graduate"
  | "freshman";

export type PrereqConsentSource =
  | "instructor"
  | "department"
  | "faculty"
  | "application"
  | "program-adviser";

export type PrereqMinGrade = "C-" | "B-";

export type PrereqConcurrent = "allowed" | "required";

// Optional scope on a standing node — e.g. "junior standing in MMSS".
// Mirrors what the Python parser emits (single { type } or { type, names }).
export type PrereqStandingScope =
  | { type: "major" | "minor" | "program" }
  | { type: "program"; names: string[] };

export type PrereqNode =
  | { kind: "all"; of: PrereqNode[] }
  | { kind: "any"; of: PrereqNode[] }
  | { kind: "none" }
  | {
      kind: "course";
      subject: string;
      number: string;
      section: string;
      minGrade?: PrereqMinGrade;
      concurrent?: PrereqConcurrent;
      equivalentOk?: boolean | null;
      recommended?: boolean | null;
    }
  | { kind: "consent"; source: PrereqConsentSource }
  | {
      kind: "standing";
      level: PrereqStanding;
      orAbove?: boolean;
      scope?: PrereqStandingScope;
      recommended?: boolean;
    }
  | { kind: "topic"; topic: string }
  | {
      kind: "placement";
      exam: "chemistry" | "language" | "math" | "department" | "AP";
      passed?: boolean;
    }
  | {
      kind: "program";
      relation: "enrolled-in" | "admitted-to" | "reserved-for";
      name: string;
    }
  | { kind: "program-membership"; program: string; negated: boolean }
  | { kind: "when"; condition: PrereqNode; then: PrereqNode }
  | {
      kind: "level-wildcard";
      levels: number[];
      subjects: string[];
      count?: number;
      orHigher?: boolean;
    }
  | { kind: "gpa"; min: number; scope?: "overall" | "major" }
  | { kind: "raw"; text: string; reason?: string };

// Single record from the fixture / runtime parser. `parsed` is `null` only
// when the input was empty after prose-stripping (rare).
export type PrereqRecord = {
  id: string;
  raw: string;
  parsed: PrereqNode | null;
  warnings: string[];
};

// === Eligibility ===========================================================
// Strictly ordered from "best" (ready) to "worst" (blocked). `any` picks the
// best across children; `all` picks the worst. Use ELIGIBILITY_RANK for
// numeric comparisons.

export type EligibilityState =
  | "ready"
  | "needs-consent"
  | "in-progress"
  | "unknown"
  | "blocked"
  | "no-data";

export const ELIGIBILITY_RANK: Record<EligibilityState, number> = {
  ready: 0,
  "needs-consent": 1,
  "in-progress": 2,
  unknown: 3,
  blocked: 4,
  "no-data": 5
};

// What the UI tooltip reads. `missing` carries the raw nodes the user is
// short on (course nodes, standing, etc.) — the renderer formats them.
export type EligibilityResult = {
  state: EligibilityState;
  missing: PrereqNode[];
  notes: string[];
};

// === Storage ==============================================================

export const PREREQS_PARSED_STORAGE_KEY = "better-caesar:prereqs-parsed:v1";

// Re-parse triggers: planRev change, OR parsedAt + TTL_MS < now. plan.json
// is "static" (paper.nu publishes new revisions infrequently), so the TTL
// is a safety net — the planRev string is the primary invalidation signal.
export const PARSED_PREREQS_TTL_MS = 75 * 24 * 60 * 60 * 1000; // 2.5 months

export type ParsedPrereqsCachePayload = {
  version: 1;
  planRev: string;
  parsedAt: number;
  byCourseId: Record<string, PrereqRecord>;
};

// === Parser entry point (locked signature) ================================
// Implementations live in parser/. Pure function — no DOM, no chrome.*.
// `parentSubject` is taken from the host course id ("COMP_SCI 213-0" →
// "COMP_SCI") so bare-number references in the prereq prose can be resolved.
export type ParsePrereq = (
  text: string,
  parentSubject: string | null
) => { parsed: PrereqNode | null; warnings: string[] };

// === Eligibility entry point (locked signature) ===========================
// Pure function. `historyByCourseKey` is keyed by `${subject} ${number}`
// (no section), value is the strongest matching CourseHistoryEntry — the
// caller pre-aggregates so the evaluator stays O(nodes) per call.
export type EvaluateEligibility = (
  node: PrereqNode | null,
  historyByCourseKey: ReadonlyMap<string, EligibilityHistoryEntry>
) => EligibilityResult;

// Slim view of CourseHistoryEntry that decouples eligibility from the
// course-history module's storage shape. The caller adapts.
export type EligibilityHistoryEntry = {
  status: "Taken" | "In Progress" | "Transferred" | "In Cart" | string;
  grade: string | null; // letter grade for Taken; null otherwise
};
