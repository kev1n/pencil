import { STORAGE_KEY } from "./constants";
import type { CtecIndexStore, CtecSubjectIndex } from "./types";

// Re-export under a name that conveys "the CTEC index storage key" — the popup's
// cache-clear factory imports this rather than redeclaring the literal.
export const CTEC_INDEX_STORAGE_KEY = STORAGE_KEY;

let memoryStore: CtecIndexStore = { version: 1, subjects: {} };

void chrome.storage.local
  .get(STORAGE_KEY)
  .then((result: Record<string, unknown>) => {
    const raw = result[STORAGE_KEY];
    if (raw && typeof raw === "object") {
      const candidate = raw as Partial<CtecIndexStore>;
      if (
        candidate.version === 1 &&
        candidate.subjects &&
        typeof candidate.subjects === "object"
      ) {
        memoryStore = candidate as CtecIndexStore;
      }
    }
  });

export function readSubjectIndex(subjectCode: string): CtecSubjectIndex | null {
  return memoryStore.subjects[subjectCode] ?? null;
}

export function writeSubjectIndex(subjectCode: string, index: CtecSubjectIndex): void {
  memoryStore.subjects[subjectCode] = index;
  void chrome.storage.local.set({ [STORAGE_KEY]: memoryStore });
}
