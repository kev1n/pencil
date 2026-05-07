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
  sections: ComboSection[];
};

export type Combination = {
  sectionIds: string[];
  sections: ComboSection[];
  score: number;
  ratedCount: number;
};

export type ComboPool = {
  termId: string;
  groups: CourseGroup[];
  byId: Map<string, ComboSection>;
};
