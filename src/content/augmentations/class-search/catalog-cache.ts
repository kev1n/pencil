// Persistent CAESAR catalog cache. Maps `(termId, subject, bareCatalog)` to
// the parsed search-results page. Lets us drop the user-facing "Load CAESAR
// data" button: when a section's Details or Add-to-cart fires, we read this
// cache first, fetch only on miss, and write back so future actions are
// free until the TTL expires.
//
// Mirrors the seats-notes / cart-cache patterns: chrome.storage.local backing,
// in-memory mirror for sync reads on render, prune-on-init.

import type { CaesarSearchResult } from "./caesar-search";

const STORAGE_KEY = "better-caesar:class-search-catalog-cache:v1";
// CAESAR class-status (Open/Closed/Wait List) shifts at the granularity of
// hours during registration, so a 15-minute TTL stays useful while keeping
// us from hammering PeopleSoft when the user opens a long results list.
const TTL_MS = 15 * 60 * 1000;

type CatalogCacheEntry = {
  result: CaesarSearchResult;
  fetchedAt: number;
};

type CatalogCache = {
  version: 1;
  entries: Record<string, CatalogCacheEntry>;
};

let memory: CatalogCache | null = null;
let initPromise: Promise<void> | null = null;

function key(termId: string, subject: string, bareCatalog: string): string {
  return `${termId}|${subject}|${bareCatalog}`;
}

export function initCatalogCache(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const result = (await chrome.storage.local.get(STORAGE_KEY)) as Record<string, unknown>;
      const raw = result[STORAGE_KEY] as CatalogCache | undefined;
      memory = raw && raw.version === 1 ? raw : { version: 1, entries: {} };
      pruneStale();
    } catch {
      memory = { version: 1, entries: {} };
    }
  })();
  return initPromise;
}

export function readCatalogCache(
  termId: string,
  subject: string,
  bareCatalog: string
): CatalogCacheEntry | null {
  if (!memory) return null;
  const entry = memory.entries[key(termId, subject, bareCatalog)];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) return null;
  return entry;
}

export function writeCatalogCache(
  termId: string,
  subject: string,
  bareCatalog: string,
  result: CaesarSearchResult
): void {
  if (!memory) memory = { version: 1, entries: {} };
  memory.entries[key(termId, subject, bareCatalog)] = {
    result,
    fetchedAt: Date.now()
  };
  void persist();
}

export async function clearCatalogCache(): Promise<void> {
  memory = { version: 1, entries: {} };
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function pruneStale(): void {
  if (!memory) return;
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(memory.entries)) {
    if (now - memory.entries[k]!.fetchedAt > TTL_MS) {
      delete memory.entries[k];
      changed = true;
    }
  }
  if (changed) void persist();
}

async function persist(): Promise<void> {
  if (!memory) return;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: memory });
  } catch {
    // ignore — best-effort
  }
}
