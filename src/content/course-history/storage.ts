import { logQuiet } from "../../shared/log";
import {
  COURSE_HISTORY_STORAGE_KEY,
  emptyCache,
  type CourseHistoryCache,
  type CourseHistoryEntry
} from "./types";

let memoryCache: CourseHistoryCache = emptyCache();
let initPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function initCourseHistoryCache(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = chrome.storage.local
    .get(COURSE_HISTORY_STORAGE_KEY)
    .then((result: Record<string, unknown>) => {
      const stored = result[COURSE_HISTORY_STORAGE_KEY];
      if (stored && typeof stored === "object") {
        const candidate = stored as Partial<CourseHistoryCache>;
        if (
          candidate.version === 1 &&
          Array.isArray(candidate.entries) &&
          typeof candidate.refreshedAt === "number"
        ) {
          memoryCache = candidate as CourseHistoryCache;
        }
      }
    })
    .catch(() => undefined);

  // Mirror updates from any other context (popup, sibling tab) so reads
  // from this context immediately see fresh data.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const change = changes[COURSE_HISTORY_STORAGE_KEY];
    if (!change) return;
    const next = change.newValue as Partial<CourseHistoryCache> | undefined;
    if (
      next &&
      next.version === 1 &&
      Array.isArray(next.entries) &&
      typeof next.refreshedAt === "number"
    ) {
      memoryCache = next as CourseHistoryCache;
    } else {
      memoryCache = emptyCache();
    }
    fireListeners();
  });

  return initPromise;
}

function fireListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      logQuiet("course-history.fireListeners", err);
    }
  }
}

function persist(): void {
  void chrome.storage.local.set({ [COURSE_HISTORY_STORAGE_KEY]: memoryCache });
  fireListeners();
}

export function readCourseHistory(): CourseHistoryCache {
  return memoryCache;
}

export function writeCourseHistory(
  entries: CourseHistoryEntry[],
  now: number = Date.now()
): void {
  memoryCache = { version: 1, entries, refreshedAt: now };
  persist();
}

export function clearCourseHistory(): void {
  memoryCache = emptyCache();
  persist();
}
