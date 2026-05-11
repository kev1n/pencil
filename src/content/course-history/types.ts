// Cached snapshot of the user's CAESAR Course History grid (Academic
// Records → Course History). Populated opportunistically by a background
// fetch of the SSR_CRSE_HIST_FL AJAX endpoint whenever the user lands on
// CAESAR and the cache is older than the staleness window. Read by the
// popup's "My courses" panel.
//
// One flat list — the page itself returns 1 row per course-attempt and
// already mixes terms, so we keep the same shape and group at render time.

export type CourseHistoryStatus =
  | "In Cart"
  | "In Progress"
  | "Taken"
  | "Transferred"
  | string;

export type CourseHistoryEntry = {
  catalog: string;             // "COMP_SCI 329-0" (whole label as CAESAR shows it)
  subject: string;             // "COMP_SCI"
  number: string;              // "329-0"
  description: string;         // "HCI Studio"
  termLabel: string;           // "2026 Fall"
  termStartDate: string | null;// "2026-09-23" — from the HTML comment, used for sort
  grade: string | null;        // "A", "A-", "T", null when ungraded/in-cart
  units: number | null;        // 1.00, 0.34, null
  status: CourseHistoryStatus; // "Taken", "In Progress", "In Cart", "Transferred", ...
};

export type CourseHistoryCache = {
  version: 1;
  entries: CourseHistoryEntry[];
  refreshedAt: number;         // ms since epoch, 0 = never
};

export const COURSE_HISTORY_STORAGE_KEY = "better-caesar:course-history:v1";

export function emptyCache(): CourseHistoryCache {
  return { version: 1, entries: [], refreshedAt: 0 };
}
