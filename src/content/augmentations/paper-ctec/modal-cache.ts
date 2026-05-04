// Persistent cache for derived ModalDisplayData. The expensive bigram /
// trigram extraction (`collectComments` → `extractFrequentTopics`) and
// per-comment sentiment scoring run inside `buildModalDisplayData`, which
// the modal's sync() loop calls on every interaction. The in-memory map
// keeps repeat clicks within a session fast; persisting to
// chrome.storage.local lets the first modal open after a fresh page load
// skip the work too, as long as the underlying CTEC entries are unchanged.

import { logQuiet } from "../../../shared/log";
import type { ModalDisplayData } from "./modal-data";

export const PAPER_CTEC_MODAL_CACHE_KEY = "bc_paper_ctec_modal_cache";

const STORAGE_VERSION = 1;
const MAX_ENTRIES = 16;
const PERSIST_DEBOUNCE_MS = 800;

type CacheEntry = {
  signature: string;
  result: ModalDisplayData | null;
  accessedAt: number;
};

type CacheRecord = {
  version: number;
  entries: Record<string, CacheEntry>;
};

const memoryCache = new Map<string, CacheEntry>();
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function initModalCache(): void {
  if (hydrated) return;
  hydrated = true;
  void chrome.storage.local
    .get(PAPER_CTEC_MODAL_CACHE_KEY)
    .then((store: Record<string, unknown>) => {
      const raw = store[PAPER_CTEC_MODAL_CACHE_KEY] as CacheRecord | undefined;
      if (!raw || raw.version !== STORAGE_VERSION || !raw.entries) return;
      for (const [key, entry] of Object.entries(raw.entries)) {
        if (entry && typeof entry.signature === "string") memoryCache.set(key, entry);
      }
    })
    .catch(() => undefined);

  // Cross-tab broadcast: another paper.nu tab (or the popup's clear button)
  // may rewrite the persisted record. Adopt the new value into our in-memory
  // mirror so we don't keep serving evicted entries.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const change = changes[PAPER_CTEC_MODAL_CACHE_KEY];
    if (!change) return;
    memoryCache.clear();
    const next = change.newValue as CacheRecord | undefined;
    if (next && next.version === STORAGE_VERSION && next.entries) {
      for (const [key, entry] of Object.entries(next.entries)) {
        if (entry && typeof entry.signature === "string") memoryCache.set(key, entry);
      }
    }
  });
}

// Returns `undefined` for a miss (caller must compute), or the stored
// ModalDisplayData (which itself can be `null` when the snapshot had no
// usable entries — that null is a valid cached value). Bumps recency on hit.
export function readModalCache(
  key: string,
  signature: string
): { result: ModalDisplayData | null } | undefined {
  const entry = memoryCache.get(key);
  if (!entry || entry.signature !== signature) return undefined;
  entry.accessedAt = Date.now();
  schedulePersist();
  return { result: entry.result };
}

export function writeModalCache(
  key: string,
  signature: string,
  result: ModalDisplayData | null
): void {
  memoryCache.set(key, { signature, result, accessedAt: Date.now() });
  evictIfNeeded();
  schedulePersist();
}

function evictIfNeeded(): void {
  if (memoryCache.size <= MAX_ENTRIES) return;
  const sorted = Array.from(memoryCache.entries()).sort(
    (a, b) => a[1].accessedAt - b[1].accessedAt
  );
  while (memoryCache.size > MAX_ENTRIES && sorted.length > 0) {
    const [oldest] = sorted.shift()!;
    memoryCache.delete(oldest);
  }
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

async function persistNow(): Promise<void> {
  const entries: Record<string, CacheEntry> = {};
  for (const [key, value] of memoryCache) entries[key] = value;
  const record: CacheRecord = { version: STORAGE_VERSION, entries };
  try {
    await chrome.storage.local.set({ [PAPER_CTEC_MODAL_CACHE_KEY]: record });
  } catch (err) {
    // Quota / serialization failures must never break the modal — drop on
    // floor and let in-memory keep serving.
    logQuiet("paper-ctec.modal-cache.persist", err);
  }
}
