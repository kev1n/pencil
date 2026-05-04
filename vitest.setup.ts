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
