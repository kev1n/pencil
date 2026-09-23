import {
  getDataMapInfo,
  getPlanCourses,
  getTermCourses,
  type PaperCourse,
  type PaperSection
} from "../class-search/paper-data";
import { formatMeetingPattern, meetingPatternCount } from "../class-search/filter";
import { getCachedReportAggregate } from "../ctec-links/reports";
import { readPaperScheduleSnapshot } from "../paper-combos/data";

function oneLine(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function ctecLine(section: PaperSection): string | null {
  const instructor = section.instructors?.map((i) => oneLine(i.name)).find(Boolean);
  if (!instructor) return null;
  const aggregate = getCachedReportAggregate(
    { subject: section.subject, catalogNumber: section.catalog, instructor },
    section.title,
    5,
    "combo"
  );
  if (!aggregate) return null;
  const labels = [
    ["Instruction", aggregate.metrics.instruction],
    ["Course", aggregate.metrics.course],
    ["Learned", aggregate.metrics.learned]
  ] as const;
  const scores = labels
    .filter(([, metric]) => metric && Number.isFinite(metric.mean))
    .map(([label, metric]) => `${label} ${metric!.mean.toFixed(1)}/6`);
  return scores.length ? `CTEC (cached): ${scores.join("; ")}` : null;
}

export function formatScheduleMarkdown(
  termName: string,
  sections: PaperSection[],
  planCourses: PaperCourse[] = []
): string {
  const planById = new Map(planCourses.map((course) => [course.id, course]));
  const lines = [`# ${oneLine(termName) || "My schedule"}`, ""];
  for (const section of sections) {
    const code = `${section.subject} ${section.catalog}`;
    lines.push(`## ${code} — ${oneLine(section.title)}`);
    lines.push(`- Section: ${oneLine(section.section)} (${oneLine(section.component)})`);
    const instructors = section.instructors?.map((i) => oneLine(i.name)).filter(Boolean) ?? [];
    if (instructors.length) lines.push(`- Instructor${instructors.length > 1 ? "s" : ""}: ${instructors.join(", ")}`);
    for (let index = 0; index < meetingPatternCount(section); index++) {
      const meeting = formatMeetingPattern(section, index);
      const room = oneLine(section.room[index]);
      lines.push(`- Meets: ${meeting}${room ? ` · ${room}` : ""}`);
    }
    const start = oneLine(section.start_date);
    const end = oneLine(section.end_date);
    if (start || end) lines.push(`- Dates: ${start || "?"}–${end || "?"}`);
    const requirement = oneLine(section.enrl_req || planById.get(code)?.prereqs);
    if (requirement) lines.push(`- Requirements: ${requirement}`);
    const ctec = ctecLine(section);
    if (ctec) lines.push(`- ${ctec}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export async function buildScheduleMarkdown(): Promise<string> {
  const snapshot = await readPaperScheduleSnapshot();
  if (!snapshot || snapshot.sectionIds.length === 0) {
    throw new Error("No scheduled sections found for this term.");
  }
  const termCourses = await getTermCourses(snapshot.termId);
  const lookup = new Map(
    termCourses.flatMap((course) => course.sections.map((section) => [section.section_id, section] as const))
  );
  const sections = [...new Set(snapshot.sectionIds)].map((id) => lookup.get(id));
  const resolved = sections.filter((section): section is PaperSection => !!section);
  if (resolved.length === 0) {
    throw new Error("No scheduled classes found in Paper’s term data. Refresh Paper and try again.");
  }
  const [info, plan] = await Promise.all([
    getDataMapInfo().catch(() => null),
    getPlanCourses().catch(() => [])
  ]);
  const termName = info?.terms[snapshot.termId]?.name ?? "My schedule";
  const markdown = formatScheduleMarkdown(termName, resolved, plan);
  const omitted = sections.length - resolved.length;
  return omitted
    ? `${markdown}\n_${omitted} schedule item${omitted === 1 ? "" : "s"} could not be matched to Paper’s course catalog._\n`
    : markdown;
}
