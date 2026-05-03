import type { PaperCourse, PaperSection, PaperTermCourse, SubjectInfo } from "./paper-data";
import type { ResultRow, SearchFilters } from "./types";

export function applyFilters(
  termCourses: PaperTermCourse[],
  catalogIndex: Map<string, PaperCourse>,
  subjects: Record<string, SubjectInfo>,
  filters: SearchFilters
): ResultRow[] {
  const tokens = tokenizeQuery(filters.query);
  const tokenRegexes = tokens.map(tokenRegex);
  const wantedDistros = filters.distros;
  const wantedDisciplines = filters.disciplines;

  type Scored = { row: ResultRow; rank: number };
  const scored: Scored[] = [];

  for (const course of termCourses) {
    const planEntry = catalogIndex.get(`${course.subject} ${course.catalog}`);

    if (wantedDistros.size > 0 && !anyCharIn(planEntry?.distros, wantedDistros)) continue;
    if (wantedDisciplines.size > 0 && !anyCharIn(planEntry?.disciplines, wantedDisciplines)) continue;

    const sections = course.sections;
    if (sections.length === 0) continue;

    if (tokenRegexes.length > 0) {
      const subjectName = subjects[course.subject]?.display ?? "";
      const idHaystack = normalize(
        `${subjectName} ${course.subject} ${course.catalog}`
      );
      const titleHaystack = normalize(course.title);
      const descHaystack = planEntry?.description ? normalize(planEntry.description) : "";

      let matchedAllOnId = true;
      let matchedAllOnAny = true;
      for (const re of tokenRegexes) {
        const idHit = re.test(idHaystack);
        const titleHit = re.test(titleHaystack);
        const descHit = descHaystack.length > 0 && re.test(descHaystack);
        if (!idHit) matchedAllOnId = false;
        if (!idHit && !titleHit && !descHit) {
          matchedAllOnAny = false;
          break;
        }
      }
      if (!matchedAllOnAny) continue;

      // id-only matches outrank id+title or title-only matches.
      scored.push({ row: { course, sections }, rank: matchedAllOnId ? 0 : 1 });
    } else {
      scored.push({ row: { course, sections }, rank: 0 });
    }
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.row.course.subject !== b.row.course.subject) {
      return a.row.course.subject.localeCompare(b.row.course.subject);
    }
    return naturalCompare(a.row.course.catalog, b.row.course.catalog);
  });

  return scored.map((s) => s.row);
}

export function buildCatalogIndex(courses: PaperCourse[]): Map<string, PaperCourse> {
  const map = new Map<string, PaperCourse>();
  for (const course of courses) {
    map.set(course.id, course);
  }
  return map;
}

export function formatMeetingPattern(section: PaperSection, index: number): string {
  const days = section.meeting_days[index] ?? null;
  const start = section.start_time[index] ?? null;
  const end = section.end_time[index] ?? null;
  if (!days && !start && !end) return "TBA";

  const dayLabel = days ?? "—";
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

function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

function tokenRegex(token: string): RegExp {
  // paper.nu-style: `x` is a digit wildcard ("31x" matches "311"), and
  // `_` is treated as whitespace so "comp_sci" matches "comp sci" (the
  // haystack normalizes underscores to spaces). `\s+` not `\s*` so
  // "compsci" doesn't accidentally match "comp sci".
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wildcarded = escaped.replace(/x/g, "[\\dx]");
  const underscoresRelaxed = wildcarded.replace(/_/g, "\\s+");
  return new RegExp(underscoresRelaxed, "i");
}

function anyCharIn(value: string | undefined, set: Set<string>): boolean {
  if (!value) return false;
  for (const c of value) {
    if (set.has(c)) return true;
  }
  return false;
}

function formatTime(time: { h: number; m: number }): string {
  const minute = time.m.toString().padStart(2, "0");
  if (time.h === 0) return `12:${minute}am`;
  if (time.h < 12) return `${time.h}:${minute}am`;
  if (time.h === 12) return `12:${minute}pm`;
  return `${time.h - 12}:${minute}pm`;
}

function naturalCompare(a: string, b: string): number {
  const an = parseInt(a, 10);
  const bn = parseInt(b, 10);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
  return a.localeCompare(b);
}
