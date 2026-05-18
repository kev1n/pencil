import type { CtecLinkParams } from "../ctec-links/types";

type CourseIdentity = Pick<CtecLinkParams, "subject" | "catalogNumber" | "instructor">;

export function buildCourseKey(params: CourseIdentity, titleHint: string): string {
  const title = titleHint.toLowerCase().replace(/\s+/g, " ").trim();
  return `${params.subject}:${params.catalogNumber}:${params.instructor.toLowerCase().trim()}:${title}`;
}

// Compact-but-discriminating identity for an instructor list. Each name
// becomes "<firstInitial> <last>" when a leading first name is available
// and falls back to "<last>" otherwise. Preserving the first initial lets
// `instructorMatches` distinguish two professors who share a last name
// (e.g. Alexander Smith vs Zachary Smith) while staying stable across
// CAESAR's name format quirks ("A. Smith", "Alexander Smith", etc.).
export function buildInstructorLastNameLabel(names: string[]): string {
  return names
    .map((name) => {
      const cleaned = name
        .split(/\s+/)
        .map((p) => (p.endsWith(".") ? p.slice(0, -1) : p))
        .filter(Boolean);
      if (cleaned.length === 0) return "";

      let lastIdx = cleaned.length - 1;
      const tail = (cleaned[lastIdx] ?? "").toLowerCase();
      if ((tail === "jr" || tail === "sr") && lastIdx > 0) {
        lastIdx -= 1;
      }
      const last = cleaned[lastIdx] ?? "";
      if (!last) return "";

      if (lastIdx > 0) {
        const firstInitial = cleaned[0]?.[0] ?? "";
        return firstInitial ? `${firstInitial} ${last}` : last;
      }
      return last;
    })
    .filter(Boolean)
    .join(", ");
}
