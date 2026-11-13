// Stands in for the browser-extension APIs so the extension's modules in
// ../src run unchanged inside the app. Import this before any of them.
//
//   chrome.storage.local  -> IndexedDB on the phone
//   chrome.runtime        -> requests go to the native Northwestern session
import { NUSession, type NativeResponse } from "./native";
import { noteResponse } from "./session-state";

// ── storage ────────────────────────────────────────────────────────────────

const DB_NAME = "pencil";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return dbPromise;
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

type Change = { oldValue?: unknown; newValue?: unknown };
type ChangeListener = (changes: Record<string, Change>, area: string) => void;
const changeListeners = new Set<ChangeListener>();
function fire(changes: Record<string, Change>): void {
  for (const listener of [...changeListeners]) listener(changes, "local");
}

async function readKey(key: string): Promise<unknown> {
  return tx("readonly", (store) => store.get(key));
}

const local = {
  async get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    if (keys == null) {
      const database = await db();
      await new Promise<void>((resolve, reject) => {
        const cursor = database.transaction(STORE, "readonly").objectStore(STORE).openCursor();
        cursor.onsuccess = () => {
          const at = cursor.result;
          if (!at) return resolve();
          out[String(at.key)] = at.value;
          at.continue();
        };
        cursor.onerror = () => reject(cursor.error);
      });
      return out;
    }
    const defaults = typeof keys === "object" && !Array.isArray(keys) ? keys : null;
    const names = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    for (const name of names) {
      const value = await readKey(name);
      if (value !== undefined) out[name] = value;
      else if (defaults) out[name] = defaults[name];
    }
    return out;
  },
  async set(items: Record<string, unknown>): Promise<void> {
    await tx("readwrite", (store) => {
      for (const [key, value] of Object.entries(items)) store.put(value, key);
    });
    fire(Object.fromEntries(Object.entries(items).map(([key, value]) => [key, { newValue: value }])));
  },
  async remove(keys: string | string[]): Promise<void> {
    const names = Array.isArray(keys) ? keys : [keys];
    await tx("readwrite", (store) => {
      for (const key of names) store.delete(key);
    });
    fire(Object.fromEntries(names.map((key) => [key, {}])));
  },
  async clear(): Promise<void> {
    await tx("readwrite", (store) => store.clear());
  }
};

// ── requests ───────────────────────────────────────────────────────────────

async function sendMessage(message: { type: string; [key: string]: unknown }): Promise<unknown> {
  if (message.type === "fetch-text" || message.type === "fetch-binary") {
    const url = String(message.url);
    let result: NativeResponse;
    try {
      result = await NUSession.request({
        url,
        method: (message.method as string | undefined) ?? "GET",
        headers: message.headers as Record<string, string> | undefined,
        body: message.body as string | undefined,
        timeoutMs: message.timeoutMs as number | undefined,
        binary: message.type === "fetch-binary"
      });
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : String(error), connectionFailed: true };
    }
    noteResponse(url, result);
    return result;
  }
  // abort-fetch, credit-used and the extension's own sign-in tabs have no
  // counterpart here; the app shows its sign-in screen itself.
  if (message.type === "abort-fetch" || message.type === "credit-used") return undefined;
  return { ok: false, error: `Not available in the app: ${message.type}` };
}

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local,
    onChanged: {
      addListener: (listener: ChangeListener) => void changeListeners.add(listener),
      removeListener: (listener: ChangeListener) => void changeListeners.delete(listener)
    }
  },
  runtime: {
    id: "pencil-app",
    sendMessage,
    getURL: (path: string) => path,
    getManifest: () => ({ version: __APP_VERSION__ }),
    onMessage: { addListener: () => undefined, removeListener: () => undefined }
  }
};

declare const __APP_VERSION__: string;
