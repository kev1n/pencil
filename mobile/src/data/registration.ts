// Registration dates for a term: the general windows and the student's own
// appointment times, read from CAESAR by the extension's loader and kept
// on the device.
import { loadEnrollmentDates, type EnrollmentDates } from "@ext/content/enrollment-dates/appointment-dates";
import { formatAppointmentTime, googleCalendarUrl } from "@ext/content/enrollment-dates/appointments";
import { needsSession } from "./caesar";
import { createStore, useStore } from "./store";

export { formatAppointmentTime, googleCalendarUrl };
export type { EnrollmentDates };

// `dates` is null when CAESAR has nothing posted for the term yet.
export type SavedRegistration = { dates: EnrollmentDates | null; at: number };

const KEY = "pencil-app:registration:v1";
const store = createStore<Record<string, SavedRegistration>>({});
const loading = new Set<string>();

export async function initRegistration(): Promise<void> {
  const saved = (await chrome.storage.local.get(KEY))[KEY] as Record<string, SavedRegistration> | undefined;
  if (saved) store.set(saved);
}

export function useRegistration(termName: string): SavedRegistration | null {
  return useStore(store)[termName] ?? null;
}

// `quiet` is a load nobody tapped for: it never opens a sign-in page.
export async function loadRegistration(termName: string, quiet = false): Promise<void> {
  if (!termName || loading.has(termName)) return;
  loading.add(termName);
  try {
    const run = () => loadEnrollmentDates(document, termName);
    const dates = await (quiet ? run() : needsSession(run));
    store.update((current) => ({ ...current, [termName]: { dates, at: Date.now() } }));
    void chrome.storage.local.set({ [KEY]: store.get() });
  } catch (error) {
    if (!quiet) throw error;
  } finally {
    loading.delete(termName);
  }
}
