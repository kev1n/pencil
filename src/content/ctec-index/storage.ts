import { STORAGE_KEY } from "./constants";
import type { CtecIndexStore, CtecSubjectIndex } from "./types";

// Re-export under a name that conveys "the CTEC index storage key" — the popup's
// cache-clear factory imports this rather than redeclaring the literal.
export const CTEC_INDEX_STORAGE_KEY = STORAGE_KEY;

const EMPTY_STORE: CtecIndexStore = { version: 1, subjects: {} };
let memoryStore: CtecIndexStore = { version: 1, subjects: {} };

void chrome.storage.local
  .get(STORAGE_KEY)
  .then((result: Record<string, unknown>) => {
    memoryStore = parseStore(result[STORAGE_KEY]);
  });

// Cross-context mirror: when the popup's "Clear CTEC cache" button calls
// chrome.storage.local.remove, this listener resets the live content
// script's in-memory copy too. Without it, any open CAESAR / paper.nu
// tab would keep serving stale CTEC data from `memoryStore` until the
// page reloaded — defeating the whole point of the clear-cache button.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!(STORAGE_KEY in changes)) return;
  memoryStore = parseStore(changes[STORAGE_KEY]?.newValue);
});

function parseStore(raw: unknown): CtecIndexStore {
  if (!raw || typeof raw !== "object") return { version: 1, subjects: {} };
  const candidate = raw as Partial<CtecIndexStore>;
  if (
    candidate.version === 1 &&
    candidate.subjects &&
    typeof candidate.subjects === "object"
  ) {
    return candidate as CtecIndexStore;
  }
  return { ...EMPTY_STORE };
}

export function readSubjectIndex(subjectCode: string): CtecSubjectIndex | null {
  return memoryStore.subjects[subjectCode] ?? null;
}

export function writeSubjectIndex(subjectCode: string, index: CtecSubjectIndex): void {
  memoryStore.subjects[subjectCode] = index;
  void chrome.storage.local.set({ [STORAGE_KEY]: memoryStore });
}

// Centralizes the shape so new optional fields don't drift across the
// dozen-ish writeSubjectIndex callsites that previously inlined this
// literal. Used both as the fallback for "no prior index" and as the
// base for a spread that overrides specific fields.
export function createEmptySubjectIndex(subjectCode: string): CtecSubjectIndex {
  return {
    subjectCode,
    subjectLabel: subjectCode,
    builtAt: Date.now(),
    sourceUrl: typeof window !== "undefined" ? window.location.href : "",
    entries: []
  };
}
