import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadLastTab, saveLastTab } from "./storage";

const LAST_TAB_KEY = "better-caesar:paper-export-helper:last-tab:v1";

async function clearTestStorage(): Promise<void> {
  await chrome.storage.local.clear();
}

beforeEach(clearTestStorage);
afterEach(clearTestStorage);

describe("loadLastTab", () => {
  it("returns the default when storage is empty", async () => {
    expect(await loadLastTab()).toBe("google");
  });

  it("round-trips a saved tab", async () => {
    await chrome.storage.local.set({ [LAST_TAB_KEY]: "outlook" });
    expect(await loadLastTab()).toBe("outlook");
  });

  it("falls back to the default for an unrecognized value", async () => {
    await chrome.storage.local.set({ [LAST_TAB_KEY]: "fastmail" });
    expect(await loadLastTab()).toBe("google");
  });

  it("falls back to the default for a non-string value", async () => {
    await chrome.storage.local.set({ [LAST_TAB_KEY]: 42 });
    expect(await loadLastTab()).toBe("google");
  });

  it("accepts every valid calendar app id", async () => {
    for (const app of ["google", "apple", "outlook"] as const) {
      await chrome.storage.local.set({ [LAST_TAB_KEY]: app });
      expect(await loadLastTab()).toBe(app);
    }
  });
});

describe("saveLastTab", () => {
  it("writes the value to chrome.storage.local under the v1 key", async () => {
    saveLastTab("apple");
    // saveLastTab is fire-and-forget — wait one microtask for the write.
    await Promise.resolve();
    const result = await chrome.storage.local.get(LAST_TAB_KEY);
    expect(result[LAST_TAB_KEY]).toBe("apple");
  });

  it("is observable by a subsequent loadLastTab", async () => {
    saveLastTab("outlook");
    await Promise.resolve();
    expect(await loadLastTab()).toBe("outlook");
  });

  it("overwrites a previously saved value", async () => {
    saveLastTab("apple");
    await Promise.resolve();
    saveLastTab("outlook");
    await Promise.resolve();
    expect(await loadLastTab()).toBe("outlook");
  });
});
