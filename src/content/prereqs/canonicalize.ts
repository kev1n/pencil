// Post-parse cleanup of course references. Registrar prose (paper.nu's
// `p`, CAESAR's enrollment requirements, the catalog) keeps citing
// retired course numbers, old department codes and bare numbers, and the
// parser reads phrases like "two 200-level courses" as a course called
// "TWO 200-LEVEL". This pass rewrites every course node against the live
// catalog so the tree only shows courses a student can actually take.
//
// Pure — no DOM, no chrome.*.

import type { PaperCourse } from "../augmentations/class-search/paper-data";
import { aliasCourseId } from "../course-aliases";
import type { PrereqNode, PrereqRecord } from "./types";

export { aliasCourseId };

type CourseNode = Extract<PrereqNode, { kind: "course" }>;

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
