import type { PaperSection } from "../class-search/paper-data";

export type Time = { h: number; m: number };

// A meeting block = single (day, start, end) tuple. paper.nu's section
// records use parallel arrays indexed by meeting-pattern; we flatten those
// into one block per (pattern, day) for overlap and rendering math.
export type MeetingBlock = {
  day: number;
  start: Time;
  end: Time;
  patternIndex: number;
};

export type ComboSection = {
  sectionId: string;
  courseId: string;
  subject: string;
  catalog: string;
  number: string;
  title: string;
  topic?: string;
  section: string;
  component: string;
  instructorNames: string[];
  blocks: MeetingBlock[];
  raw: PaperSection;
};

export type CourseGroup = {
  courseId: string;
  label: string;
  // Course-level credit/unit value (Northwestern uses "units"; user-facing
  // copy says "credits"). Defaults to 1 when paper.nu's plan data doesn't
  // have a usable units field — most courses are 1.0 anyway, so the
  // fallback is conservative and keeps the budget meaningful.
  units: number;
  // Every component (LEC, DIS, LAB…) the user scheduled for this course.
  // A combination takes one section of each, so a course whose only
  // discussions were filtered out drops out instead of losing them.
  components?: string[];
  sections: ComboSection[];
};

export type Combination = {
  sectionIds: string[];
  sections: ComboSection[];
  score: number;
  ratedCount: number;
  totalUnits: number;
};

export type ComboPool = {
  termId: string;
  groups: CourseGroup[];
  byId: Map<string, ComboSection>;
};
