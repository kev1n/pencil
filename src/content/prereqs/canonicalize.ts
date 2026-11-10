// Post-parse cleanup of course references. Registrar prose (paper.nu's
// `p`, CAESAR's enrollment requirements, the catalog) keeps citing
// retired course numbers, old department codes and bare numbers, and the
// parser reads phrases like "two 200-level courses" as a course called
// "TWO 200-LEVEL". This pass rewrites every course node against the live
// catalog so the tree only shows courses a student can actually take.
//
// Pure — no DOM, no chrome.*.

import type { PaperCourse } from "../augmentations/class-search/paper-data";
import type { PrereqNode, PrereqRecord } from "./types";

type CourseNode = Extract<PrereqNode, { kind: "course" }>;

// Renumbered courses, old id -> current id. Sourced 2026-11-10 from
// department pages, archived catalog editions and registrar text; each
// line group names its evidence.
const COURSE_ALIASES: Readonly<Record<string, string>> = {
  // Organic chemistry: 210 -> 215 (Fall 2021), majors' 212 -> 217 and
  // labs 232 -> 237 (Fall 2023, catalog credit exclusions).
  "CHEM 210-1": "CHEM 215-1",
  "CHEM 210-2": "CHEM 215-2",
  "CHEM 210-3": "CHEM 215-3",
  "CHEM 210-A": "CHEM 215-A",
  "CHEM 210-B": "CHEM 215-B",
  "CHEM 210-C": "CHEM 215-C",
  "CHEM 212-1": "CHEM 217-1",
  "CHEM 212-2": "CHEM 217-2",
  "CHEM 212-3": "CHEM 217-3",
  "CHEM 232-1": "CHEM 237-1",
  "CHEM 232-2": "CHEM 237-2",
  // Biology core, 2021 (catalog "credit not allowed for both" pairs).
  "BIOL_SCI 215-0": "BIOL_SCI 201-0",
  "BIOL_SCI 215-CN": "BIOL_SCI 201-CN",
  "BIOL_SCI 219-0": "BIOL_SCI 202-0",
  "BIOL_SCI 219-CN": "BIOL_SCI 202-CN",
  "BIOL_SCI 217-0": "BIOL_SCI 310-0",
  "BIOL_SCI 220-0": "BIOL_SCI 233-0",
  "BIOL_SCI 221-0": "BIOL_SCI 232-0",
  "BIOL_SCI 222-0": "BIOL_SCI 234-0",
  "BIOL_SCI 308-0": "BIOL_SCI 301-0",
  // Calculus renumbering, Fall 2019 (math department calculus guide).
  "MATH 212-0": "MATH 218-1",
  "MATH 213-0": "MATH 218-2",
  "MATH 214-0": "MATH 218-3",
  "MATH 220-0": "MATH 220-1",
  "MATH 224-0": "MATH 220-2",
  "MATH 230-0": "MATH 230-1",
  "MATH 234-0": "MATH 230-2",
  // Earth and environmental sciences, 2025-26 (department descriptions).
  "ENVR_SCI 201-0": "EARTH 210-0",
  "ENVR_SCI 202-0": "EARTH 212-0",
  "ENVR_SCI 203-0": "EARTH 213-0",
  "EARTH 201-0": "EARTH 214-0",
  "EARTH 202-0": "EARTH 215-0",
  "EARTH 203-0": "EARTH 210-0",
  // Psychology, September 2025 (department "(formerly ...)" list).
  "PSYCH 205-0": "PSYCH 301-0",
  "PSYCH 204-0": "PSYCH 213-0",
  "PSYCH 212-0": "PSYCH 221-0",
  "PSYCH 218-0": "PSYCH 244-0",
  "PSYCH 245-0": "PSYCH 345-0",
  "PSYCH 314-0": "PSYCH 350-0",
  "PSYCH 316-0": "PSYCH 330-0",
  "PSYCH 335-0": "PSYCH 373-0",
  "PSYCH 357-0": "PSYCH 390-0",
  "PSYCH 358-0": "PSYCH 391-0",
  "PSYCH 359-0": "PSYCH 392-0",
  "PSYCH 361-0": "PSYCH 328-0",
  "PSYCH 363-0": "PSYCH 378-0",
  "PSYCH 376-0": "PSYCH 308-0",
  "PSYCH 377-0": "PSYCH 367-0",
  "ASTRON 220-0": "ASTRON 220-1",
  "ASTRON 425-0": "ASTRON 325-0",
  // Computer science: 214 -> 208 and 111 -> 180 (Fall 2026, department
  // course pages), 325-1 -> 325-0 (2023-24), old EECS 317 -> 217.
  "COMP_SCI 214-0": "COMP_SCI 208-0",
  "COMP_SCI 111-0": "COMP_SCI 180-0",
  "COMP_SCI 325-1": "COMP_SCI 325-0",
  "EECS 317-0": "COMP_SCI 217-0",
  "IEMS 202-0": "IEMS 302-0",
  // Spanish, 2022-23 (archived catalog editions).
  "SPANISH 197-0": "SPANISH 200-0",
  "SPANISH 207-0": "SPANISH 200-0",
  "SPANISH 203-0": "SPANISH 201-0",
  "SPANISH 220-0": "SPANISH 204-0",
  // Evening French, Fall 2021 ("formerly FRENCH 101-B").
  "FRENCH 101-A": "FRENCH 111-A",
  "FRENCH 101-B": "FRENCH 111-B",
  "FRENCH 101-C": "FRENCH 111-C",
  "FRENCH 102-A": "FRENCH 121-A",
  "FRENCH 102-B": "FRENCH 121-B",
  "FRENCH 102-C": "FRENCH 121-C",
  "PORT 121-3": "PORT 115-2",
  "ARABIC 311-2": "ARABIC 211-3",
  "GBL_HLTH 301-0": "GBL_HLTH 201-0",
  "COMP_LIT 210-0": "ENGLISH 220-0",
  // Theatre intro sequence, 2024-25 (major requirement tables), and the
  // 2018-19 pattern-drafting renumber.
  "THEATRE 140-1": "THEATRE 160-1",
  "THEATRE 140-2": "THEATRE 160-2",
  "THEATRE 120-0": "THEATRE 160-3",
  "THEATRE 364-1": "THEATRE 328-1",
  "THEATRE 364-2": "THEATRE 328-2",
  "THEATRE 364-3": "THEATRE 328-3",
  "SESP 195-0": "SESP 195-1",
  "MUS_TECH 259-0": "MUS_TECH 300-0",
  "MUS_COMP 111-0": "MUS_COMP 211-0"
};

// Departments renamed with their numbers intact: African American
// Studies -> Black Studies (Fall 2023), Gender & Sexuality Studies
// GNDR_ST -> GSS (Fall 2026).
const SUBJECT_RENAMES: Readonly<Record<string, string>> = {
  AF_AM_ST: "BLK_ST",
  GNDR_ST: "GSS"
};

// Subject spellings that are not catalog codes.
const SUBJECT_ALIASES: Readonly<Record<string, string>> = {
  HINDI: "HIND_URD",
  URDU: "HIND_URD",
  BIO_SCI: "BIOL_SCI",
  MATSCI: "MAT_SCI",
  MSFT: "MS_FT",
  PHILOSOPHY: "PHIL",
  APPM: "ES_APPM"
};

// EECS split into three departments; a number resolves to whichever one
// still carries it.
const EECS_SUCCESSORS = ["COMP_SCI", "COMP_ENG", "ELEC_ENG"] as const;

const COUNT_WORDS: Readonly<Record<string, number>> = {
  ANY: 1,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4
};

// A course counts as live when it ran within this many term ids of the
// newest term in the data (10 per quarter, so two academic years).
const LIVE_TERM_WINDOW = 80;

export type CourseCatalog = {
  ids: ReadonlySet<string>;
  live: ReadonlySet<string>;
  subjects: ReadonlySet<string>;
  /** "SUBJ 123" -> every id sharing that number. */
  variants: ReadonlyMap<string, readonly string[]>;
};

export function buildCourseCatalog(courses: readonly PaperCourse[]): CourseCatalog {
  const ids = new Set<string>();
  const subjects = new Set<string>();
  const variants = new Map<string, string[]>();
  const lastTerm = new Map<string, number>();
  let newest = 0;
  for (const course of courses) {
    ids.add(course.id);
    subjects.add(course.subject);
    const base = `${course.subject} ${course.catalog.split("-")[0]}`;
    const list = variants.get(base);
    if (list) list.push(course.id);
    else variants.set(base, [course.id]);
    const last = Math.max(0, ...(course.terms ?? []).map(Number));
    lastTerm.set(course.id, last);
    if (last > newest) newest = last;
  }
  const live = new Set<string>();
  for (const [id, last] of lastTerm) {
    if (last > 0 && last >= newest - LIVE_TERM_WINDOW) live.add(id);
  }
  return { ids, live, subjects, variants };
}

/** Maps a retired course id to its current number; other ids pass through. */
export function aliasCourseId(id: string): string {
  const direct = COURSE_ALIASES[id];
  if (direct) return direct;
  const space = id.indexOf(" ");
  const renamed = SUBJECT_RENAMES[id.slice(0, space)];
  return renamed ? `${renamed}${id.slice(space)}` : id;
}

function idOf(node: CourseNode): string {
  return `${node.subject} ${node.number}-${node.section || "0"}`;
}

function withId(node: CourseNode, id: string): CourseNode {
  const [subject, rest] = id.split(" ");
  // A few law-school ids carry no suffix at all ("CRIM 621").
  const dash = rest.indexOf("-");
  if (dash < 0) return { ...node, subject, number: rest, section: "0" };
  return { ...node, subject, number: rest.slice(0, dash), section: rest.slice(dash + 1) };
}

// A reference whose exact id is gone but whose number survives under
// another suffix (STAT 202-CN -> 202-0, "DSGN 106" -> 106-1). Sequence
// parts ("490-1") are distinct courses and never swap for each other.
function pickVariant(node: CourseNode, catalog: CourseCatalog): string | null {
  const section = node.section || "0";
  if (/^\d+$/.test(section) && section !== "0") return null;
  const candidates = (catalog.variants.get(`${node.subject} ${node.number}`) ?? []).filter((id) =>
    catalog.live.has(id)
  );
  if (candidates.length === 0) return null;
  const base = `${node.subject} ${node.number}-`;
  for (const suffix of ["0", "1", "DL", "CN"]) {
    if (candidates.includes(base + suffix)) return base + suffix;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function resolveCourse(node: CourseNode, hostSubject: string, catalog: CourseCatalog): PrereqNode {
  let current: CourseNode = { ...node, subject: node.subject.toUpperCase() };
  // "MATH 290-1or MATH 291-1" — a glued conjunction lands in the section.
  current.section = (current.section || "0").toUpperCase().replace(/(?<=\d)(OR|AND)$/, "");

  const level = Number(current.number);
  if (current.section === "LEVEL" || (!catalog.subjects.has(current.subject) && current.subject in COUNT_WORDS)) {
    // "Two 200-level courses in German" / "200-level art history course".
    const count = COUNT_WORDS[current.subject];
    return {
      kind: "level-wildcard",
      levels: [level],
      subjects: [catalog.subjects.has(current.subject) ? current.subject : hostSubject],
      ...(count && count > 1 ? { count } : {})
    };
  }

  if (current.subject === "EECS") {
    const owners = EECS_SUCCESSORS.filter((s) => catalog.variants.has(`${s} ${current.number}`));
    if (owners.length === 1) current.subject = owners[0];
  }
  current.subject = SUBJECT_ALIASES[current.subject] ?? current.subject;

  // An alias only applies when its target is a real course, so a renamed
  // department's dropped numbers stay as written.
  const aliased = aliasCourseId(idOf(current));
  if (catalog.ids.has(aliased)) current = withId(current, aliased);

  if (!catalog.subjects.has(current.subject)) {
    // A stray word in front of a bare number ("group containing 240-0")
    // means the host department's own course.
    if (catalog.variants.has(`${hostSubject} ${current.number}`)) {
      current.subject = hostSubject;
    } else {
      return { kind: "raw", text: `${node.subject} ${node.number}`, reason: "unknown-subject" };
    }
  }

  if (!catalog.live.has(idOf(current))) {
    const variant = pickVariant(current, catalog);
    if (variant) current = withId(current, variant);
  }
  return current;
}

function isDead(node: PrereqNode, catalog: CourseCatalog): boolean {
  if (node.kind === "course") {
    const id = idOf(node);
    return catalog.ids.has(id) && !catalog.live.has(id);
  }
  if (node.kind === "all") return node.of.some((child) => isDead(child, catalog));
  return false;
}

// Aliasing can collapse two alternates onto one course ("CHEM 212-3 or
// 217-3" -> 217-3 twice).
function dedupe(nodes: PrereqNode[]): PrereqNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    // The same course twice is one requirement, whatever notes each copy carries.
    const key =
      node.kind === "course"
        ? `course:${node.subject} ${node.number}-${node.section}`
        : JSON.stringify(node);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalizeNode(node: PrereqNode, hostSubject: string, catalog: CourseCatalog): PrereqNode {
  switch (node.kind) {
    case "course":
      return resolveCourse(node, hostSubject, catalog);
    case "all":
      return { kind: "all", of: dedupe(node.of.map((c) => canonicalizeNode(c, hostSubject, catalog))) };
    case "any": {
      const of = dedupe(node.of.map((c) => canonicalizeNode(c, hostSubject, catalog)));
      // A retired alternate is noise once a live one sits beside it.
      const alive = of.filter((c) => !isDead(c, catalog));
      const kept = alive.length > 0 ? alive : of;
      return kept.length === 1 ? kept[0] : { kind: "any", of: kept };
    }
    case "when":
      return { ...node, then: canonicalizeNode(node.then, hostSubject, catalog) };
    default:
      return node;
  }
}

export function canonicalizePrereqs(
  map: ReadonlyMap<string, PrereqRecord>,
  catalog: CourseCatalog
): Map<string, PrereqRecord> {
  const out = new Map<string, PrereqRecord>();
  for (const [id, record] of map) {
    const parsed = record.parsed
      ? canonicalizeNode(record.parsed, id.split(" ")[0], catalog)
      : record.parsed;
    out.set(id, { ...record, parsed });
  }
  return out;
}
