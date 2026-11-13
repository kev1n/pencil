import {
  PS_CREDIT_CAP,
  PS_CREDIT_WINDOW_MS,
  psCreditPool
} from "../../../shared/credit-pool";
import type { SeatsNotesResult } from "./types";

const CACHE_STORAGE_KEY = "bc-seats-notes-cache-v1";

// Re-exported for backward-compat with callers that referenced these
// constants directly. The pool instance itself lives in shared/credit-pool.
export const RATE_LIMIT_MAX = PS_CREDIT_CAP;
export const RATE_LIMIT_WINDOW_MS = PS_CREDIT_WINDOW_MS;

export type SeatsNotesCacheEntry = {
  result: SeatsNotesResult;
  fetchedAt: number;
};

type CacheStore = {
  version: 1;
  entries: Record<string, SeatsNotesCacheEntry>;
  // CAESAR class numbers already found, by term and Paper.nu section, so
  // a class's page can be asked for without a catalog search first.
  numbers?: Record<string, string>;
};

let memoryCache: CacheStore = { version: 1, entries: {} };
let initPromise: Promise<void> | null = null;

export function initStorage(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = chrome.storage.local
    .get(CACHE_STORAGE_KEY)
    .then((result: Record<string, unknown>) => {
      const cache = result[CACHE_STORAGE_KEY];
      if (cache && typeof cache === "object") {
        const candidate = cache as Partial<CacheStore>;
        if (candidate.version === 1 && candidate.entries && typeof candidate.entries === "object") {
          memoryCache = candidate as CacheStore;
        }
      }
    });

  return initPromise;
}

export function readCachedEntry(classNumber: string): SeatsNotesCacheEntry | null {
  return memoryCache.entries[classNumber] ?? null;
}

export function writeCachedEntry(classNumber: string, entry: SeatsNotesCacheEntry): void {
  memoryCache.entries[classNumber] = entry;
  void chrome.storage.local.set({ [CACHE_STORAGE_KEY]: memoryCache });
}

export function knownClassNumber(termId: string, sectionId: string): string | null {
  return memoryCache.numbers?.[`${termId}|${sectionId}`] ?? null;
}

export function rememberClassNumber(termId: string, sectionId: string, classNumber: string): void {
  const key = `${termId}|${sectionId}`;
  if (memoryCache.numbers?.[key] === classNumber) return;
  memoryCache.numbers = { ...memoryCache.numbers, [key]: classNumber };
  void chrome.storage.local.set({ [CACHE_STORAGE_KEY]: memoryCache });
}

// GC "ok with all-null" entries (a poisoned shape that earlier code paths
// could write); they'd otherwise persist as permanent "Seat counts
// unavailable" rows.
export function pruneEmptySeatsCache(): void {
  let removed = 0;
  for (const key of Object.keys(memoryCache.entries)) {
    const entry = memoryCache.entries[key];
    if (!entry) continue;
    const r = entry.result;
    if (
      r.ok &&
      r.classCapacity === null &&
      r.enrollmentTotal === null &&
      r.availableSeats === null &&
      r.waitListCapacity === null &&
      r.waitListTotal === null &&
      r.classAttributes === null &&
      r.enrollmentRequirements === null &&
      r.classNotes === null
    ) {
      delete memoryCache.entries[key];
      removed += 1;
    }
  }
  if (removed > 0) {
    void chrome.storage.local.set({ [CACHE_STORAGE_KEY]: memoryCache });
  }
}

// Backward-compat wrappers around the shared credit pool. Existing callers
// (seats-notes/augmentation, class-search/augmentation) keep their old
// import paths — paper-ctec consumes the shared module directly.
export function tryConsumePeopleSoftCredit(
  now: number,
  owner?: string
): { ok: true } | { ok: false; waitMs: number } {
  const result = psCreditPool.tryConsume(owner, now);
  if (result.allowed) return { ok: true };
  return { ok: false, waitMs: result.waitMs };
}

export function buildPeopleSoftCreditToast(waitMs: number): string {
  return psCreditPool.formatLimitReached(waitMs);
}

export function formatPsCreditsWarning(now: number = Date.now()): string | null {
  return psCreditPool.format(now);
}
