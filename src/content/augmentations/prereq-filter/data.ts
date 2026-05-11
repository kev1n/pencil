// Shared data layer for the prereq-filter augmentation. Composes the
// course-history snapshot, the parsed-prereqs cache, and the eligibility
// evaluator into a memoized lookup the UI surfaces call.

import { logQuiet } from "../../../shared/log";
import { readCourseHistory } from "../../course-history";
import {
  evaluateEligibility,
  getParsedPrereqs,
  parsePrereq,
  type EligibilityHistoryEntry,
  type EligibilityResult,
  type ParsedPrereqMap,
  type PrereqRecord
} from "../../prereqs";
import {
  getDataMapInfo,
  getPlanCourses,
  getTermCourses,
  type DataMapInfo,
  type PaperSection,
  type PaperTermCourse
} from "../class-search/paper-data";

let prereqsPromise: Promise<ParsedPrereqMap> | null = null;
let prereqsRev: string | null = null;

// Trigger a parsed-prereqs load (cached after the first call within the
// same planRev). Safe to call repeatedly — concurrent calls dedupe.
// Composition: plan.json's course-level `p` is the base map. Term JSON's
// section-level `enrl_req` (richer — carries program/standing/co-req
// gates that CAESAR actually enforces but plan.json drops) overlays the
// base wherever a course in the latest term has a non-empty enrl_req.
export function ensureParsedPrereqs(): Promise<ParsedPrereqMap> {
  if (prereqsPromise) return prereqsPromise;
  prereqsPromise = (async () => {
    const info = await getDataMapInfo();
    const courses = await getPlanCourses();
    prereqsRev = info.plan;
    const base = await getParsedPrereqs(info.plan, courses);
    return enrichWithEnrlReqs(base, info);
  })();
  return prereqsPromise;
}

// How many recent terms to pull enrl_reqs from. Each term JSON is cached
// in chrome.storage.local once fetched (per paper-data.ts), so this is
// a one-time cost on a fresh install. Five covers a full academic year
// of course offerings — enough to catch Winter-only courses
// (e.g. COMP_SCI 302-0) without going so far back that older terms'
// drifted enrl_reqs start polluting the map.
const ENRICHMENT_TERM_COUNT = 5;

// Multi-term overlay: replace each course's plan.json `p` parse with
// its term-level `enrl_req` parse when available. Walks the most-recent
// N terms newest-first, so a course's most-recent offering wins — older
// terms only fill in courses the newer terms don't list (e.g.
// COMP_SCI 302-0 only runs in Winter, so the Fall term won't enrich it
// but Winter will). Section-canonical selection — single-section
// courses use that section's enrl_req directly; multi-section courses
// pick the LEC so the search panel + schedule grid agree on the
// authoritative version.
async function enrichWithEnrlReqs(
  base: ParsedPrereqMap,
  info: DataMapInfo
): Promise<ParsedPrereqMap> {
  const merged = new Map<string, PrereqRecord>(base);
  const termIds = pickRecentTermIds(info, ENRICHMENT_TERM_COUNT);
  const enriched = new Set<string>();

  for (const termId of termIds) {
    let term: PaperTermCourse[];
    try {
      term = await getTermCourses(termId);
    } catch (err) {
      logQuiet("prereq-filter.enrich", err);
      continue;
    }

    for (const course of term) {
      const id = `${course.subject} ${course.catalog}`;
      // Newest-term-wins — if a more recent term already provided an
      // enrl_req for this course, leave it alone. plan.json's `p` is
      // only overwritten on the first hit.
      if (enriched.has(id)) continue;
      const candidate = pickEnrlReqSection(course.sections);
      if (!candidate) continue;
      const raw = candidate.enrl_req?.trim();
      if (!raw) continue;
      const text = normalizeEnrlReq(raw);
      if (!text) continue;
      const { parsed, warnings } = parsePrereq(text, course.subject ?? null);
      if (!parsed) continue;
      merged.set(id, { id, raw, parsed, warnings });
      enriched.add(id);
    }
  }
  return merged;
}

// Picks up to `count` term ids from info.terms, ordered newest-first by
// numeric id (paper.nu's term ids are monotonically increasing). The
// "latest" field is the registrar's current "headlined" term — start
// there and walk downward.
function pickRecentTermIds(info: DataMapInfo, count: number): string[] {
  const all = Object.keys(info.terms).sort((a, b) => Number(b) - Number(a));
  return all.slice(0, count);
}

// Per the user's spec: when a course has exactly one section, that
// section's enrl_req IS the course-level prereq. With multiple sections
// we still need a canonical pick — prefer LEC (the lecture is the
// authoritative gate; LAB/DIS sections share its enrl_req via CAESAR),
// then fall back to the first non-empty enrl_req of any component.
function pickEnrlReqSection(sections: readonly PaperSection[]): PaperSection | null {
  const withReq = sections.filter((s) => s.enrl_req && s.enrl_req.trim().length > 0);
  if (withReq.length === 0) return null;
  if (withReq.length === 1) return withReq[0];
  return (
    withReq.find((s) => s.component === "LEC" || s.component === "LECT") ?? withReq[0]
  );
}

// Pull the Pre-requisite clause out of an enrl_req string and normalize
// it for the parser. Returns null if no Pre-requisite clause is found
// (e.g. the registrar wrote "PreReg: reserved for X majors only", which
// is a registration-reservation notice rather than a prereq) — in that
// case the caller should NOT override plan.json's `p` parse, because
// running the parser over a non-prereq statement just produces topic
// noise that erases the real prereq data underneath.
//
// Subject aliases are normalized here too (CS→COMP_SCI etc) so the
// parser produces course nodes whose subject matches CAESAR's catalog
// and the user's course-history entries — without this the prereq
// evaluator decides a Northwestern student "doesn't have CS 212" when
// they obviously do under its real catalog code COMP_SCI 212.
function normalizeEnrlReq(raw: string): string | null {
  const cleaned = raw.trim().replace(/^Enrollment Requirements?:\s*/i, "").trim();
  // Look for an explicit Pre-requisite clause. The registrar uses
  // several variants — "Prerequisite:", "Pre-requisite:", "Pre-Req:",
  // "Pre-Reg" is intentionally NOT one of these. Anything before the
  // clause (Anti-Req notes, restrictions, etc.) is dropped.
  const clause = extractPrereqClause(cleaned);
  if (!clause) return null;
  return normalizeSubjectAliases(clause).trim() || null;
}

const PREREQ_CLAUSE_RE =
  /\b(?:Pre-?\s*requisites?|Pre-?\s*req)\s*:\s*([\s\S]+?)(?=\s*(?:Co-?\s*requisites?|Co-?\s*req|Anti-?\s*req|Anti-?\s*requisites?|Restriction|Reserved|Registration|Pre-?\s*Reg|Note)\s*:|$)/i;

function extractPrereqClause(text: string): string | null {
  const m = PREREQ_CLAUSE_RE.exec(text);
  if (!m) return null;
  const clause = m[1].trim().replace(/[\s.;,]+$/, "");
  return clause.length > 0 ? clause : null;
}

// Full English department names that appear in enrl_req prose
// (e.g. "Biomedical Engineering 270 or Mechanical Engineering 241").
// The prereq parser's subject regex is `[A-Za-z][A-Za-z_]+` which
// can't match anything with a space — without this pass, the parser
// would extract "Engineering" or "Science" as the subject, miss every
// history lookup, and report the user doesn't have a course they
// clearly do. Listed longest-first so the broader patterns match
// before their substrings (e.g. "Civil and Environmental Engineering"
// before "Civil Engineering").
const FULL_DEPARTMENT_NAMES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bCivil\s+and\s+Environmental\s+Engineering\b/gi, "CIV_ENV"],
  [/\bAfrican\s+American\s+Studies?\b/gi, "AF_AM_ST"],
  [/\bAsian\s+American\s+Studies?\b/gi, "ASIAN_AM"],
  [/\bAsian\s+Languages?\s+(?:and|&)\s+Cultures?\b/gi, "ASIAN_LC"],
  [/\bComputer\s+Science\b/gi, "COMP_SCI"],
  [/\bComputer\s+Engineering\b/gi, "COMP_ENG"],
  [/\bElectrical\s+Engineering\b/gi, "ELEC_ENG"],
  [/\bBiomedical\s+Engineering\b/gi, "BMD_ENG"],
  [/\bMechanical\s+Engineering\b/gi, "MECH_ENG"],
  [/\bIndustrial\s+Engineering\b/gi, "IND_ENG"],
  [/\bChemical\s+Engineering\b/gi, "CHEM_ENG"],
  [/\bMaterials?\s+Science\b/gi, "MAT_SCI"],
  [/\bBiological\s+Sciences?\b/gi, "BIOL_SCI"],
  [/\bGeneral\s+Engineering\b/gi, "GEN_ENG"],
  [/\bCivil\s+Engineering\b/gi, "CIV_ENV"],
  [/\bEnvironmental\s+Engineering\b/gi, "CIV_ENV"],
  [/\bArt\s+History\b/gi, "ART_HIST"],
  [/\bAmerican\s+Studies?\b/gi, "AMER_ST"],
  [/\bHindi[-\s]+Urdu\b/gi, "HIND_URD"]
];

// Multi-word canonical subjects rendered as space-separated tokens in
// the enrl_req prose (paper.nu's source text uses spaces where CAESAR's
// catalog uses underscores). Folded back to underscores so the parser
// recognizes them as a single subject token.
const MULTI_WORD_SUBJECT_PAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bBIOL\s+SCI\b/g, "BIOL_SCI"],
  [/\bCIV\s+ENV\b/g, "CIV_ENV"],
  [/\bCOMP\s+SCI\b/g, "COMP_SCI"],
  [/\bCOMP\s+ENG\b/g, "COMP_ENG"],
  [/\bELEC\s+ENG\b/g, "ELEC_ENG"],
  [/\bBMD\s+ENG\b/g, "BMD_ENG"],
  [/\bMECH\s+ENG\b/g, "MECH_ENG"],
  [/\bIND\s+ENG\b/g, "IND_ENG"],
  [/\bCHEM\s+ENG\b/g, "CHEM_ENG"],
  [/\bMAT\s+SCI\b/g, "MAT_SCI"],
  [/\bMS\s+FT\b/g, "MS_FT"],
  [/\bMS-FT\b/g, "MS_FT"],
  [/\bAF\s+AM\s+ST\b/g, "AF_AM_ST"],
  [/\bASIAN\s+AM\b/g, "ASIAN_AM"],
  [/\bASIAN\s+LC\b/g, "ASIAN_LC"],
  [/\bART\s+HIST\b/g, "ART_HIST"],
  [/\bAMER\s+ST\b/g, "AMER_ST"],
  [/\bMUS_COMP\b/g, "MUS_COMP"]
];

// Casual abbreviations that students + registrars use in enrl_req prose
// instead of CAESAR's full catalog subject codes. Replace the abbrev
// directly when it appears before a 3-digit course number.
const SUBJECT_ABBREV: Record<string, string> = {
  CS: "COMP_SCI",
  CE: "COMP_ENG",
  EE: "ELEC_ENG",
  BME: "BMD_ENG",
  ME: "MECH_ENG",
  IE: "IND_ENG",
  CHE: "CHEM_ENG",
  CHEME: "CHEM_ENG",
  MSE: "MAT_SCI",
  // EECS is the legacy combined department, now split into COMP_SCI +
  // ELEC_ENG. Map to COMP_SCI as the modal default; a parsed `EECS 203`
  // (signals/systems territory) would technically be ELEC_ENG, but
  // mapping to COMP_SCI keeps the data-structures cases right and
  // surfaces a still-recognizable course pill instead of a freeform
  // topic. The user's tree will be slightly off for EE-flavored EECS
  // references, which is better than being wrong for everyone.
  EECS: "COMP_SCI"
};

function normalizeSubjectAliases(text: string): string {
  let s = text;
  // Full English department names FIRST — "Computer Science 212" must
  // collapse to "COMP_SCI 212" before either the space-collapse or the
  // casual-abbrev pass, which would otherwise extract "Science" or
  // "Computer" as bogus subjects and miss the history lookup.
  for (const [pattern, canonical] of FULL_DEPARTMENT_NAMES) {
    s = s.replace(pattern, canonical);
  }
  // Multi-word abbreviated subjects — "BIOL SCI 239" → "BIOL_SCI 239".
  // Token like "SCI" in "BIOL SCI 239" would otherwise get caught by
  // the casual-abbrev pass below.
  for (const [pattern, canonical] of MULTI_WORD_SUBJECT_PAIRS) {
    s = s.replace(pattern, canonical);
  }
  // Casual abbreviations — only when followed by a 3-digit course
  // number so we don't eat "CS" inside "BS in CS" or similar prose.
  s = s.replace(/\b([A-Z][A-Z]+)\s+(\d{3}(?:-[A-Za-z0-9]+)?)\b/g, (match, abbrev, num) => {
    const canonical = SUBJECT_ABBREV[abbrev];
    return canonical ? `${canonical} ${num}` : match;
  });
  return s;
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
