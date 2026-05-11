// Shared data layer for the prereq-filter augmentation. Composes the
// course-history snapshot, the parsed-prereqs cache, and the eligibility
// evaluator into a memoized lookup the UI surfaces call.

import { readCourseHistory } from "../../course-history";
import {
  evaluateEligibility,
  getParsedPrereqs,
  type EligibilityHistoryEntry,
  type EligibilityResult,
  type ParsedPrereqMap
} from "../../prereqs";
import { getDataMapInfo, getPlanCourses } from "../class-search/paper-data";

let prereqsPromise: Promise<ParsedPrereqMap> | null = null;
let prereqsRev: string | null = null;

// Trigger a parsed-prereqs load (cached after the first call within the
// same planRev). Safe to call repeatedly — concurrent calls dedupe.
export function ensureParsedPrereqs(): Promise<ParsedPrereqMap> {
  if (prereqsPromise) return prereqsPromise;
  prereqsPromise = (async () => {
    const info = await getDataMapInfo();
    const courses = await getPlanCourses();
    prereqsRev = info.plan;
    return getParsedPrereqs(info.plan, courses);
  })();
  return prereqsPromise;
}

export function getParsedPrereqsRev(): string | null {
  return prereqsRev;
}

// CourseHistoryEntry → EligibilityHistoryEntry lookup keyed by
// "${subject} ${number}" (matches the parser's course-node identity). We
// pick the strongest record per (subject, number): Taken with grade ranks
// first, then In Progress, then Transferred, then In Cart.
const STATUS_PRIORITY: Record<string, number> = {
  Taken: 0,
  "In Progress": 1,
  Transferred: 2,
  "In Cart": 3
};

// Canonical key matching the prereqs evaluator's `courseKey` (eligibility.ts):
// "COMP_SCI 111-0" → "COMP_SCI 111" (the registrar's "-0" means no section
// subdivision, so we drop it). Sequence courses ("MATH 220-1", "220-2")
// keep the suffix because they're distinct courses.
function historyKey(subject: string, number: string): string {
  const bare = number.replace(/-0$/, "");
  return `${subject} ${bare}`;
}

export function buildHistoryMap(): Map<string, EligibilityHistoryEntry> {
  const out = new Map<string, EligibilityHistoryEntry>();
  const cache = readCourseHistory();
  for (const entry of cache.entries) {
    const key = historyKey(entry.subject, entry.number);
    const status = entry.status ?? "";
    const candidate: EligibilityHistoryEntry = {
      status,
      grade: entry.grade
    };
    const existing = out.get(key);
    if (!existing) {
      out.set(key, candidate);
      continue;
    }
    const a = STATUS_PRIORITY[existing.status] ?? 99;
    const b = STATUS_PRIORITY[candidate.status] ?? 99;
    if (b < a) out.set(key, candidate);
  }
  return out;
}

export function evaluateCourseId(
  courseId: string,
  parsedMap: ParsedPrereqMap,
  history: ReadonlyMap<string, EligibilityHistoryEntry>
): EligibilityResult {
  const record = parsedMap.get(courseId);
  if (!record) return { state: "no-data", missing: [], notes: [] };
  return evaluateEligibility(record.parsed, history);
}

export function getRawForCourseId(
  courseId: string,
  parsedMap: ParsedPrereqMap
): string | null {
  return parsedMap.get(courseId)?.raw ?? null;
}

export function getParsedNodeForCourseId(
  courseId: string,
  parsedMap: ParsedPrereqMap
): import("../../prereqs").PrereqNode | null {
  return parsedMap.get(courseId)?.parsed ?? null;
}

// Reset the in-process caches. Used by the augmentation's cleanup() so the
// next mount picks up a fresh planRev.
export function resetDataLayer(): void {
  prereqsPromise = null;
  prereqsRev = null;
}
