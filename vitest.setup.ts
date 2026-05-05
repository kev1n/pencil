// Vitest setup — runs once per worker before tests.
//
// Node 25+ ships its own localStorage implementation that hijacks the global
// even when jsdom would otherwise provide one. When invoked without a
// --localstorage-file path that backing store has no methods, which breaks
// any spec that touches `localStorage.setItem` / `.getItem` / `.clear`.
// Replace with an in-memory shim so tests are deterministic regardless of
// node version.

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: storage
});
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: storage
  });
}

// scripts/build.mjs textually substitutes `__BC_BUCKET_SCHEDULE_URL__` from
// the `.env` at bundle time. esbuild's --define isn't running in vitest, so
// any spec that transitively imports `access-gate/server-client.ts` blows up
// with `ReferenceError: __BC_BUCKET_SCHEDULE_URL__ is not defined`. Stub it
// once globally so individual specs don't have to seed their own URL before
// dynamic imports.
(globalThis as Record<string, unknown>).__BC_BUCKET_SCHEDULE_URL__ =
  "https://bc-test.example.com/bucket-schedule.json";

// Several modules under src/content/* read `chrome.storage.local.get(...)` at
// module-eval time (see e.g. ctec-links/reports.ts → ctec-index/storage.ts,
// settings.ts, cart-cache/storage.ts). When a spec transitively imports any
// of those, `ReferenceError: chrome is not defined` blows up before tests
// can install their own stub. Provide a minimal in-memory shim globally so
// the import chain stays loadable; specs that exercise storage callbacks
// can override individual methods via vi.spyOn.
type ChromeStorageArea = {
  get(keys?: unknown, cb?: (items: Record<string, unknown>) => void): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>, cb?: () => void): Promise<void>;
  remove(keys: string | string[], cb?: () => void): Promise<void>;
  clear(cb?: () => void): Promise<void>;
};
type ChromeListener = (...args: unknown[]) => void;
function makeStorageArea(): ChromeStorageArea {
  const data = new Map<string, unknown>();
  const all = (): Record<string, unknown> => Object.fromEntries(data);
  return {
    async get(keys, cb) {
      let result: Record<string, unknown>;
      if (keys === undefined || keys === null) result = all();
      else if (typeof keys === "string") result = data.has(keys) ? { [keys]: data.get(keys) } : {};
      else if (Array.isArray(keys)) {
        result = {};
        for (const k of keys as string[]) if (data.has(k)) result[k] = data.get(k);
      } else if (typeof keys === "object") {
        result = { ...(keys as Record<string, unknown>) };
        for (const k of Object.keys(keys)) if (data.has(k)) result[k] = data.get(k);
      } else result = {};
      cb?.(result);
      return result;
    },
    async set(items, cb) {
      for (const [k, v] of Object.entries(items)) data.set(k, v);
      cb?.();
    },
    async remove(keys, cb) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) data.delete(k);
      cb?.();
    },
    async clear(cb) {
      data.clear();
      cb?.();
    }
  };
}
const onChangedListeners = new Set<ChromeListener>();
const onMessageListeners = new Set<ChromeListener>();
(globalThis as Record<string, unknown>).chrome = {
  storage: {
    local: makeStorageArea(),
    sync: makeStorageArea(),
    onChanged: {
      addListener: (fn: ChromeListener) => onChangedListeners.add(fn),
      removeListener: (fn: ChromeListener) => onChangedListeners.delete(fn),
      hasListener: (fn: ChromeListener) => onChangedListeners.has(fn)
    }
  },
  runtime: {
    id: "test-extension-id",
    sendMessage: () => Promise.resolve({}),
    onMessage: {
      addListener: (fn: ChromeListener) => onMessageListeners.add(fn),
      removeListener: (fn: ChromeListener) => onMessageListeners.delete(fn),
      hasListener: (fn: ChromeListener) => onMessageListeners.has(fn)
    },
    getURL: (path: string) => `chrome-extension://test/${path}`,
    lastError: undefined
  }
};
