import type { SeatsNotesResult } from "./types";

const CACHE_STORAGE_KEY = "bc-seats-notes-cache-v1";
const RATE_LIMIT_STORAGE_KEY = "bc-seats-notes-rate-limit-v1";

export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;

export type SeatsNotesCacheEntry = {
  result: SeatsNotesResult;
  fetchedAt: number;
};

type CacheStore = {
  version: 1;
  entries: Record<string, SeatsNotesCacheEntry>;
};

type RateLimitStore = {
  version: 1;
  timestamps: number[];
};

let memoryCache: CacheStore = { version: 1, entries: {} };
let memoryRateLimit: RateLimitStore = { version: 1, timestamps: [] };
let initPromise: Promise<void> | null = null;

export function initStorage(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = chrome.storage.local
    .get([CACHE_STORAGE_KEY, RATE_LIMIT_STORAGE_KEY])
    .then((result: Record<string, unknown>) => {
      const cache = result[CACHE_STORAGE_KEY];
      if (cache && typeof cache === "object") {
        const candidate = cache as Partial<CacheStore>;
        if (candidate.version === 1 && candidate.entries && typeof candidate.entries === "object") {
          memoryCache = candidate as CacheStore;
        }
      }

      const rate = result[RATE_LIMIT_STORAGE_KEY];
      if (rate && typeof rate === "object") {
        const candidate = rate as Partial<RateLimitStore>;
        if (candidate.version === 1 && Array.isArray(candidate.timestamps)) {
          memoryRateLimit = {
            version: 1,
            timestamps: candidate.timestamps.filter((t): t is number => typeof t === "number")
          };
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

export function getRateLimitState(now: number): {
  recentCount: number;
  oldestRecentAt: number | null;
  nextAvailableAt: number | null;
} {
  pruneRateLimit(now);
  const timestamps = memoryRateLimit.timestamps;
  const recentCount = timestamps.length;
  const oldestRecentAt = recentCount > 0 ? timestamps[0]! : null;
  const nextAvailableAt =
    recentCount >= RATE_LIMIT_MAX && oldestRecentAt !== null
      ? oldestRecentAt + RATE_LIMIT_WINDOW_MS
      : null;
  return { recentCount, oldestRecentAt, nextAvailableAt };
}

export function recordFetch(now: number): void {
  pruneRateLimit(now);
  memoryRateLimit.timestamps.push(now);
  void chrome.storage.local.set({ [RATE_LIMIT_STORAGE_KEY]: memoryRateLimit });
}

// Single-shot credit consumption for CAESAR PeopleSoft work. Mirrors
// tryConsumeCtecCredit in ctec-links/rate-limit.ts so class-search,
// paper-ctec's chip cart-add, and any other PS caller can gate themselves
// without re-implementing the check/record/toast boilerplate.
//
// `owner` is forwarded to the background worker for the credit-usage log
// (chrome://extensions service-worker devtools), making it easy to see
// which feature burned a credit when debugging.
export function tryConsumePeopleSoftCredit(
  now: number,
  owner?: string
): { ok: true } | { ok: false; waitMs: number } {
  const state = getRateLimitState(now);
  if (state.recentCount >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      waitMs: state.nextAvailableAt ? state.nextAvailableAt - now : 0
    };
  }
  recordFetch(now);
  void chrome.runtime
    .sendMessage({
      type: "credit-used",
      pool: "ps",
      remaining: Math.max(0, RATE_LIMIT_MAX - state.recentCount - 1),
      cap: RATE_LIMIT_MAX,
      owner
    })
    .catch(() => undefined);
  return { ok: true };
}

export function buildPeopleSoftCreditToast(waitMs: number): string {
  const waitMin = Math.max(1, Math.ceil(waitMs / 60_000));
  return `Limit reached: ${RATE_LIMIT_MAX} CAESAR loads per 30 min. Try again in ${waitMin} min.`;
}

// Trailing fragment for success toasts — only returns text once the user
// has burned through ~70% of the cap, so normal use stays silent and the
// toast only appears as the user is approaching the limit. The message
// includes the time until the oldest credit ages out (when "next opens"
// in the rolling window).
const PS_WARNING_THRESHOLD_RATIO = 0.3;

export function formatPsCreditsWarning(now: number = Date.now()): string | null {
  const state = getRateLimitState(now);
  const remaining = Math.max(0, RATE_LIMIT_MAX - state.recentCount);
  if (remaining > Math.floor(RATE_LIMIT_MAX * PS_WARNING_THRESHOLD_RATIO)) return null;
  if (!state.oldestRecentAt) return null;
  const refreshMs = Math.max(0, state.oldestRecentAt + RATE_LIMIT_WINDOW_MS - now);
  const refreshMin = Math.max(1, Math.ceil(refreshMs / 60_000));
  return `${remaining} of ${RATE_LIMIT_MAX} left, limit resets in ${refreshMin} min`;
}

function pruneRateLimit(now: number): void {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const kept = memoryRateLimit.timestamps.filter((t) => t > cutoff);
  if (kept.length !== memoryRateLimit.timestamps.length) {
    memoryRateLimit.timestamps = kept;
  }
}
