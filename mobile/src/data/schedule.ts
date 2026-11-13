// The student's planned schedule, kept on the phone. Each entry carries a
// copy of the section so the schedule draws without the catalog loaded.
import type { PaperSection } from "./catalog";
import { createStore, useStore } from "./store";

export type PlannedSection = {
  termId: string;
  subject: string;
  catalog: string;
  title: string;
  section: PaperSection;
  addedAt: number;
};

// `removed` remembers when a class was taken off the plan, so sync can tell a
// removal here from a class another device has that this one never had.
type Saved = { version: 1; sections: Record<string, PlannedSection>; removed?: Record<string, number> };

const KEY = "pencil-app:schedule:v1";
const store = createStore<Record<string, PlannedSection>>({});
let removed: Record<string, number> = {};

export async function initSchedule(): Promise<void> {
  const saved = (await chrome.storage.local.get(KEY))[KEY] as Saved | undefined;
  if (saved?.version === 1) {
    removed = saved.removed ?? {};
    store.set(saved.sections);
  }
}

function persist(): void {
  void chrome.storage.local.set({ [KEY]: { version: 1, sections: store.get(), removed } satisfies Saved });
}

function keyOf(termId: string, sectionId: string): string {
  return `${termId}|${sectionId}`;
}

export function isPlanned(termId: string, sectionId: string): boolean {
  return keyOf(termId, sectionId) in store.get();
}

// `at` is given when the change comes from another device (sync).
export function addToSchedule(entry: Omit<PlannedSection, "addedAt">, at = Date.now()): void {
  const key = keyOf(entry.termId, entry.section.section_id);
  delete removed[key];
  store.update((current) => ({ ...current, [key]: { ...entry, addedAt: at } }));
  persist();
}

export function removeFromSchedule(termId: string, sectionId: string, at = Date.now()): void {
  const key = keyOf(termId, sectionId);
  removed[key] = at;
  store.update((current) => {
    const next = { ...current };
    delete next[key];
    return next;
  });
  persist();
}

// What sync reads: every planned class and every remembered removal.
export function scheduleChanges(): { planned: Record<string, PlannedSection>; removed: Record<string, number> } {
  return { planned: store.get(), removed };
}

export function onScheduleChange(listener: () => void): () => void {
  return store.subscribe(listener);
}

export function usePlanned(termId: string | null): PlannedSection[] {
  const all = useStore(store);
  if (!termId) return [];
  return Object.values(all)
    .filter((entry) => entry.termId === termId)
    .sort((a, b) => a.addedAt - b.addedAt);
}

export function usePlannedKeys(): Record<string, PlannedSection> {
  return useStore(store);
}

// One meeting of a section on one weekday, in minutes from midnight.
export type Meeting = { day: number; start: number; end: number; room: string | null };

export function meetingsOf(section: PaperSection): Meeting[] {
  const out: Meeting[] = [];
  section.meeting_days.forEach((days, index) => {
    const start = section.start_time[index];
    const end = section.end_time[index];
    if (!days || !start || !end) return;
    for (const ch of days) {
      const day = Number(ch);
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      out.push({
        day,
        start: start.h * 60 + start.m,
        end: end.h * 60 + end.m,
        room: section.room[index] ?? null
      });
    }
  });
  return out;
}

export function conflictsWith(section: PaperSection, others: PlannedSection[]): PlannedSection | null {
  const mine = meetingsOf(section);
  for (const other of others) {
    if (other.section.section_id === section.section_id) continue;
    for (const theirs of meetingsOf(other.section)) {
      if (mine.some((m) => m.day === theirs.day && m.start < theirs.end && theirs.start < m.end)) return other;
    }
  }
  return null;
}
