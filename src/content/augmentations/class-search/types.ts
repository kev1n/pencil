import type { PaperSection, PaperTermCourse } from "./paper-data";

export type SearchFilters = {
  termId: string;
  // Free-text query — paper.nu-style. Whitespace-separated tokens, each
  // matched (regex, `x` as digit wildcard) against the combined haystack of
  // subject display name, subject symbol, catalog number, and title.
  query: string;
  distros: Set<string>;
  disciplines: Set<string>;
};

export type ResultRow = {
  course: PaperTermCourse;
  sections: PaperSection[];
};

export const PAPER_DISTRO_LABELS: Record<string, string> = {
  "1": "Natural Sciences",
  "2": "Formal Studies",
  "3": "Social & Behavioral Sciences",
  "4": "Historical Studies",
  "5": "Ethics & Values",
  "6": "Literature & Fine Arts",
  "7": "Interdisciplinary"
};

export const PAPER_DISCIPLINE_LABELS: Record<string, string> = {
  A: "Empirical & Deductive Reasoning",
  B: "Formal & Computational Reasoning",
  C: "Quantitative Reasoning",
  D: "Historical Studies",
  E: "Ethical & Evaluative Thinking",
  F: "Literary & Artistic Analysis",
  G: "Social & Behavioral Inquiry"
};
