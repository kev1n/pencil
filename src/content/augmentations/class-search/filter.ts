import { matchesAnyDiscipline } from "./discipline-match";
import type { PaperCourse, PaperSection, PaperTermCourse, SubjectInfo } from "./paper-data";
import type { ResultRow, SearchFilters } from "./types";

// Replicated verbatim from paper.nu's src/data/shortcuts.json so a query like
// "cs 349" expands to "comp_sci 349" before matching.
const SHORTCUTS: Record<string, string[]> = {
  cs: ["COMP_SCI"],
  ea: ["GEN_ENG 205", "GEN_ENG 206"],
  dtc: ["DSGN 106", "ENGLISH 106"],
  bio: ["BIOL_SCI"],
  ee: ["ELEC_ENG"],
  bme: ["BMD_ENG"],
  meche: ["MECH_ENG"],
  me: ["MECH_ENG"],
  ce: ["COMP_ENG"],
  cive: ["CIV_ENV"],
  ie: ["IEMS"],
  alc: ["ASIAN_LC"]
};

// Schools generally open to undergrads. Pushes Kellogg / TGS / continuing-
// studies / Qatar courses below undergrad-track matches when the user's
// CAESAR career is UGRD.
const UNDERGRAD_SCHOOLS = new Set(["WCAS", "MEAS", "SESP", "JOUR", "MUSIC", "SPCH"]);

// Bucket: 0 = strong id match (query hits subject symbol or catalog), 1 =
// title match, 2 = fuzzy id match (query only hits the subject's display name,
// e.g. "machine learning" matching AIML's display "Artificial Intelligence
// and Machine Learning"). paper.nu lumps strong + fuzzy into a single id
// bucket above name matches, which is why AIML 451 ranks above COMP_SCI 349
// for "machine learning" on paper.nu itself.
type Scored = {
  row: ResultRow;
  bucket: 0 | 1 | 2;
  tier: 0 | 1;
};

export function applyFilters(
  termCourses: PaperTermCourse[],
  catalogIndex: Map<string, PaperCourse>,
  subjects: Record<string, SubjectInfo>,
  filters: SearchFilters,
  career: string
): ResultRow[] {
  const terms = prepareQuery(filters.query);
  const hasQuery = terms.length > 0 && terms.some((t) => t.trim().length > 0);
  const fdCodes = filters.disciplines;

  if (!hasQuery && fdCodes.size === 0) return [];

  // Discipline-only path: no query, but the user toggled at least one FD
  // chip. Surface every course that matches the chip set, sorted by
  // subject then catalog ascending — there's no relevance signal to
  // bucket against.
  if (!hasQuery) {
    const filtered: ResultRow[] = [];
    for (const course of termCourses) {
      if (course.sections.length === 0) continue;
      if (!matchesAnyDiscipline(course, catalogIndex, fdCodes)) continue;
      filtered.push({ course, sections: course.sections });
    }
    filtered.sort((a, b) => {
      const subjectDelta = a.course.subject.localeCompare(b.course.subject);
      if (subjectDelta !== 0) return subjectDelta;
      return compareCatalog(a.course.catalog, b.course.catalog);
    });
    return filtered;
  }

  const scored: Scored[] = [];
  const placed = new Set<PaperTermCourse>();

  for (const course of termCourses) {
    if (course.sections.length === 0) continue;
    if (fdCodes.size > 0 && !matchesAnyDiscipline(course, catalogIndex, fdCodes)) {
      continue;
    }

    const subjectName = subjects[course.subject]?.display ?? "";
    const strongId = `${course.subject} ${course.catalog}`;
    const fullId = `${subjectName} ${course.subject} ${course.catalog}`;
    const name = course.title;
    const tier = careerTier(course, career);

    for (const term of terms) {
      if (placed.has(course)) break;
      if (search(strongId, term)) {
        scored.push({ row: { course, sections: course.sections }, bucket: 0, tier });
        placed.add(course);
      } else if (search(name, term)) {
        scored.push({ row: { course, sections: course.sections }, bucket: 1, tier });
        placed.add(course);
      } else if (subjectName && search(fullId, term)) {
        scored.push({ row: { course, sections: course.sections }, bucket: 2, tier });
        placed.add(course);
      }
    }
  }

  scored.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    if (a.tier !== b.tier) return a.tier - b.tier;
    // Id matches: searching "comp_sci 3" should list COMP_SCI 301, 305, …,
    // 349, … in catalog order, not title-length order.
    if (a.bucket === 0 || a.bucket === 2) {
      const subjectDelta = a.row.course.subject.localeCompare(b.row.course.subject);
      if (subjectDelta !== 0) return subjectDelta;
      return compareCatalog(a.row.course.catalog, b.row.course.catalog);
    }
    // Title matches: shorter title with all words matched is a more focused
    // hit. Puts "Machine Learning" ahead of "Biomedical Applications in
    // Machine Learning" within the same bucket+tier.
    const lenDelta = a.row.course.title.length - b.row.course.title.length;
    if (lenDelta !== 0) return lenDelta;
    const aid = `${a.row.course.subject} ${a.row.course.catalog}`;
    const bid = `${b.row.course.subject} ${b.row.course.catalog}`;
    return aid.localeCompare(bid);
  });

  return scored.map((s) => s.row);
}

function compareCatalog(a: string, b: string): number {
  const aPrefix = a.split("-")[0];
  const bPrefix = b.split("-")[0];
  const aHasLetters = /[A-Za-z]/.test(aPrefix);
  const bHasLetters = /[A-Za-z]/.test(bPrefix);
  // Numeric prefixes (e.g. "349") ahead of letter-bearing ones (e.g. "901FI")
  // so undergrad-style numbers list before exec-ed / continuing modules.
  if (!aHasLetters && bHasLetters) return -1;
  if (aHasLetters && !bHasLetters) return 1;
  if (!aHasLetters && !bHasLetters) {
    const aNum = parseInt(aPrefix, 10);
    const bNum = parseInt(bPrefix, 10);
    if (aNum !== bNum) return aNum - bNum;
  }
  return a.localeCompare(b);
}

function careerTier(course: PaperTermCourse, career: string): 0 | 1 {
  // Only re-rank for undergraduates. Other careers (TGS, KSM, LAW, etc.) get
  // paper.nu's default ordering — re-tiering for them needs more thought.
  if (career !== "UGRD") return 0;
  const school = course.school ?? "";
  if (!UNDERGRAD_SCHOOLS.has(school)) return 1;
  const prefix = course.catalog.split("-")[0];
  // Letters in the prefix (e.g. "901FI") flag exec-ed / continuing modules
  // that an undergrad can't enroll in.
  if (/[A-Za-z]/.test(prefix)) return 1;
  const num = parseInt(prefix, 10);
  if (Number.isNaN(num)) return 1;
  if (num >= 500) return 1;
  return 0;
}

export function buildCatalogIndex(courses: PaperCourse[]): Map<string, PaperCourse> {
  const map = new Map<string, PaperCourse>();
  for (const course of courses) {
    map.set(course.id, course);
  }
  return map;
}

// paper.nu encoding (verified at paper.nu/src/utility/Constants.ts):
// each character in meeting_days[i] is a zero-indexed day:
//   0 = Mo, 1 = Tu, 2 = We, 3 = Th, 4 = Fr
// E.g. "024" → "MoWeFr", "13" → "TuTh", "3" → "Th".
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function formatMeetingDays(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const idx = Number(ch);
    if (Number.isInteger(idx) && idx >= 0 && idx < DAY_LABELS.length) {
      out += DAY_LABELS[idx];
    } else {
      // Non-digit (e.g. legacy "MoWeFr" payloads or unexpected glyphs):
      // pass through verbatim so we don't regress old data.
      out += ch;
    }
  }
  return out;
}

export function formatMeetingPattern(section: PaperSection, index: number): string {
  const days = section.meeting_days[index] ?? null;
  const start = section.start_time[index] ?? null;
  const end = section.end_time[index] ?? null;
  if (!days && !start && !end) return "TBA";

  const dayLabel = days ? formatMeetingDays(days) : "—";
  if (!start || !end) return dayLabel;
  return `${dayLabel} ${formatTime(start)}–${formatTime(end)}`;
}

export function meetingPatternCount(section: PaperSection): number {
  return Math.max(
    section.meeting_days.length,
    section.start_time.length,
    section.end_time.length,
    section.room.length,
    1
  );
}

export function formatRoom(section: PaperSection, index: number): string | null {
  return section.room[index] ?? null;
}

export function formatInstructors(section: PaperSection): string {
  const names = (section.instructors ?? [])
    .map((i) => i.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return "Staff";
  return names.join(", ");
}

function cleanQuery(query: string): string {
  return query.toLowerCase().replace(/_/g, " ");
}

function prepareQuery(query: string): string[] {
  const cleaned = cleanQuery(query).trim();
  if (!cleaned) return [];

  const firstWord = cleaned.split(/\s+/)[0];
  const shortcut = SHORTCUTS[firstWord];
  if (!shortcut) return [cleaned];

  const remainder = cleaned.substring(firstWord.length).trim();
  return shortcut.map((s) => {
    const expanded = cleanQuery(s);
    return remainder ? `${expanded} ${remainder}` : expanded;
  });
}

function getSearchRegex(token: string): RegExp {
  // paper.nu's escape: any regex metachar prefixed with `\`, then `x` becomes
  // a digit-or-x wildcard so "31x" matches "311", "315", etc.
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wildcarded = escaped.replace(/x/g, "[\\dx]");
  return new RegExp(wildcarded, "i");
}

function search(haystack: string, term: string): boolean {
  const normalized = haystack.toLowerCase().replace(/_/g, " ");
  const words = term.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return false;
  return words.every((w) => getSearchRegex(w).test(normalized));
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Renders an ISO `YYYY-MM-DD` range as "Sep 23 – Dec 5, 2026". When the
// range spans a year boundary we annotate both sides ("Dec 28, 2025 –
// Jan 10, 2026"). Falls back to the raw " – "-joined input on parse
// failure so unexpected payloads don't break the UI.
export function formatDateRange(start: string, end: string): string {
  const startParts = parseIsoDate(start);
  const endParts = parseIsoDate(end);
  if (!startParts || !endParts) return `${start} – ${end}`;
  const sameYear = startParts.year === endParts.year;
  const startLabel = `${MONTH_LABELS[startParts.month]} ${startParts.day}`;
  const endLabel = `${MONTH_LABELS[endParts.month]} ${endParts.day}`;
  if (sameYear) {
    return `${startLabel} – ${endLabel}, ${endParts.year}`;
  }
  return `${startLabel}, ${startParts.year} – ${endLabel}, ${endParts.year}`;
}

function parseIsoDate(input: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIdx < 0 || monthIdx > 11) return null;
  return { year, month: monthIdx, day };
}

function formatTime(time: { h: number; m: number }): string {
  const minute = time.m.toString().padStart(2, "0");
  if (time.h === 0) return `12:${minute}am`;
  if (time.h < 12) return `${time.h}:${minute}am`;
  if (time.h === 12) return `12:${minute}pm`;
  return `${time.h - 12}:${minute}pm`;
}
