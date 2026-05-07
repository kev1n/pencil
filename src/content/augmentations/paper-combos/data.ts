import { logQuiet } from "../../../shared/log";
import { getTermCourses, type PaperSection } from "../class-search/paper-data";
import { PAPER_COMBOS_CONFIG } from "./config";
import type { ComboPool, ComboSection, CourseGroup, MeetingBlock } from "./types";

type RawSerializedSchedule = {
  termId?: unknown;
  schedule?: unknown;
  bookmarks?: unknown;
};

// Open paper.nu's IndexedDB and read the `data_schedule` entry localforage
// writes to. Same-origin: content scripts share the page's IDB without any
// extra plumbing. Returns null if the DB / store / entry doesn't exist
// yet (e.g. user hasn't loaded paper.nu's UI in this browser session).
async function readPaperSchedule(): Promise<RawSerializedSchedule | null> {
  const { paperDbName, paperStoreName, scheduleKey } = PAPER_COMBOS_CONFIG.storage;
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(paperDbName);
    } catch (err) {
      logQuiet("paper-combos.idb.open", err);
      resolve(null);
      return;
    }
    request.onerror = () => {
      logQuiet("paper-combos.idb.open.err", request.error);
      resolve(null);
    };
    request.onsuccess = () => {
      const db = request.result;
      try {
        if (!db.objectStoreNames.contains(paperStoreName)) {
          db.close();
          resolve(null);
          return;
        }
        const tx = db.transaction(paperStoreName, "readonly");
        const store = tx.objectStore(paperStoreName);
        const get = store.get(scheduleKey);
        get.onsuccess = () => {
          const value = get.result;
          db.close();
          if (value && typeof value === "object") {
            resolve(value as RawSerializedSchedule);
          } else {
            resolve(null);
          }
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch (err) {
        logQuiet("paper-combos.idb.read", err);
        try {
          db.close();
        } catch {
          // ignore
        }
        resolve(null);
      }
    };
  });
}

function flattenBlocks(section: PaperSection): MeetingBlock[] {
  const blocks: MeetingBlock[] = [];
  const patterns = section.meeting_days?.length ?? 0;
  for (let p = 0; p < patterns; p++) {
    const days = section.meeting_days[p];
    const start = section.start_time[p];
    const end = section.end_time[p];
    if (!days || !start || !end) continue;
    for (const ch of days) {
      const day = Number.parseInt(ch, 10);
      if (!Number.isFinite(day)) continue;
      blocks.push({
        day,
        start: { h: start.h, m: start.m },
        end: { h: end.h, m: end.m },
        patternIndex: p
      });
    }
  }
  return blocks;
}

function instructorNames(section: PaperSection): string[] {
  return (section.instructors ?? [])
    .map((i) => i.name?.trim() ?? "")
    .filter(Boolean);
}

function toComboSection(section: PaperSection): ComboSection | null {
  const blocks = flattenBlocks(section);
  if (blocks.length === 0) return null;
  return {
    sectionId: section.section_id,
    courseId: section.course_id,
    subject: section.subject,
    catalog: section.catalog,
    number: section.number ?? section.catalog,
    title: section.title,
    topic: section.topic,
    section: section.section,
    component: section.component,
    instructorNames: instructorNames(section),
    blocks,
    raw: section
  };
}

function buildSectionLookup(termCourses: Awaited<ReturnType<typeof getTermCourses>>): Map<string, PaperSection> {
  const map = new Map<string, PaperSection>();
  for (const course of termCourses) {
    for (const section of course.sections) {
      map.set(section.section_id, section);
    }
  }
  return map;
}

function readScheduleSectionIds(raw: RawSerializedSchedule): string[] {
  const arr = raw.schedule;
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const entry of arr) {
    if (typeof entry === "string") out.push(entry);
  }
  return out;
}

function groupByCourse(sections: ComboSection[]): CourseGroup[] {
  const byCourse = new Map<string, CourseGroup>();
  for (const section of sections) {
    let group = byCourse.get(section.courseId);
    if (!group) {
      group = {
        courseId: section.courseId,
        label: `${section.subject} ${section.number}`,
        sections: []
      };
      byCourse.set(section.courseId, group);
    }
    group.sections.push(section);
  }
  return Array.from(byCourse.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

export type LoadComboPoolResult =
  | { state: "ok"; pool: ComboPool }
  | { state: "no-schedule" }
  | { state: "no-term" }
  | { state: "term-data-missing" };

export async function loadComboPool(): Promise<LoadComboPoolResult> {
  const raw = await readPaperSchedule();
  if (!raw) return { state: "no-schedule" };

  const termId = typeof raw.termId === "string" ? raw.termId : "";
  if (!termId) return { state: "no-term" };

  const sectionIds = readScheduleSectionIds(raw);
  if (sectionIds.length === 0) return { state: "no-schedule" };

  let termCourses;
  try {
    termCourses = await getTermCourses(termId);
  } catch (err) {
    logQuiet("paper-combos.getTermCourses", err);
    return { state: "term-data-missing" };
  }

  const lookup = buildSectionLookup(termCourses);
  const sections: ComboSection[] = [];
  const byId = new Map<string, ComboSection>();
  for (const sectionId of sectionIds) {
    const raw = lookup.get(sectionId);
    if (!raw) continue;
    const combo = toComboSection(raw);
    if (!combo) continue;
    if (byId.has(combo.sectionId)) continue;
    sections.push(combo);
    byId.set(combo.sectionId, combo);
  }

  if (sections.length === 0) return { state: "no-schedule" };

  return {
    state: "ok",
    pool: {
      termId,
      groups: groupByCourse(sections),
      byId
    }
  };
}
