import { describe, expect, it } from "vitest";

// `recent-terms.ts` imports the popup's settings module for the storage key
// and bounds. Settings does a `chrome.storage.local.get` at module load —
// stub `chrome` first so the import doesn't crash under jsdom.
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve()
    },
    onChanged: { addListener: () => undefined }
  }
};

const { clampRecent } = await import("../recent-terms");
const {
  DEFAULT_RECENT_AGGREGATION_TERMS,
  MAX_RECENT_AGGREGATION_TERMS,
  MIN_RECENT_AGGREGATION_TERMS
} = await import("../../../content/settings");

describe("clampRecent()", () => {
  it("returns the default when given NaN", () => {
    expect(clampRecent(Number.NaN)).toBe(DEFAULT_RECENT_AGGREGATION_TERMS);
  });

  it("returns the default when given Infinity", () => {
    expect(clampRecent(Number.POSITIVE_INFINITY)).toBe(DEFAULT_RECENT_AGGREGATION_TERMS);
  });

  it("clamps below the minimum up to MIN", () => {
    expect(clampRecent(-10)).toBe(MIN_RECENT_AGGREGATION_TERMS);
    expect(clampRecent(0)).toBe(MIN_RECENT_AGGREGATION_TERMS);
  });

  it("clamps above the maximum down to MAX", () => {
    expect(clampRecent(MAX_RECENT_AGGREGATION_TERMS + 100)).toBe(MAX_RECENT_AGGREGATION_TERMS);
  });

  it("floors fractional values inside the valid range", () => {
    expect(clampRecent(3.9)).toBe(3);
    expect(clampRecent(7.1)).toBe(7);
  });

  it("passes through integer values inside the valid range", () => {
    expect(clampRecent(MIN_RECENT_AGGREGATION_TERMS)).toBe(MIN_RECENT_AGGREGATION_TERMS);
    expect(clampRecent(MAX_RECENT_AGGREGATION_TERMS)).toBe(MAX_RECENT_AGGREGATION_TERMS);
    expect(clampRecent(5)).toBe(5);
  });
});
