import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaperCourse } from "../augmentations/class-search/paper-data";
import {
  PARSED_PREREQS_TTL_MS,
  PREREQS_PARSED_STORAGE_KEY,
  type ParsedPrereqsCachePayload
} from "./types";

// Mock the parser so tests count invocations and stay independent of the
// real grammar (which a sibling agent is implementing in parallel).
vi.mock("./parser/index", () => ({
  parsePrereq: vi.fn((text: string, parentSubject: string | null) => ({
    parsed: { kind: "raw" as const, text, reason: parentSubject ?? "no-parent" },
    warnings: []
  }))
}));

import { parsePrereq } from "./parser/index";
import { clearParsedPrereqs, getParsedPrereqs } from "./cache";

const mockParsePrereq = vi.mocked(parsePrereq);

function makeCourse(id: string, prereqs?: string): PaperCourse {
  const [subject, catalog] = id.split(" ");
  return {
    id,
    subject: subject ?? "",
    catalog: catalog ?? "",
    name: `Course ${id}`,
    units: "1",
    prereqs
  };
}

describe("getParsedPrereqs", () => {
  beforeEach(async () => {
    // Reset memo + storage between tests so each starts cold.
    await clearParsedPrereqs();
    mockParsePrereq.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cold cache: parses every course with prereqs and persists the result", async () => {
    const courses = [
      makeCourse("COMP_SCI 111-0", "none"),
      makeCourse("COMP_SCI 211-0", "COMP_SCI 111-0"),
      makeCourse("COMP_SCI 213-0", "COMP_SCI 211-0")
    ];
    const map = await getParsedPrereqs("rev-1", courses);

    expect(mockParsePrereq).toHaveBeenCalledTimes(3);
    expect(map.size).toBe(3);

    const record = map.get("COMP_SCI 211-0");
    expect(record).toBeDefined();
    expect(record?.id).toBe("COMP_SCI 211-0");
    expect(record?.raw).toBe("COMP_SCI 111-0");
    expect(record?.warnings).toEqual([]);

    const stored = await chrome.storage.local.get(PREREQS_PARSED_STORAGE_KEY);
    const payload = stored[PREREQS_PARSED_STORAGE_KEY] as ParsedPrereqsCachePayload;
    expect(payload.version).toBe(1);
    expect(payload.planRev).toBe("rev-1");
    expect(typeof payload.parsedAt).toBe("number");
    expect(Object.keys(payload.byCourseId)).toHaveLength(3);
  });

  it("courses without a prereqs field get a synthetic 'none' record (don't call the parser)", async () => {
    const courses = [
      makeCourse("MATH 220-1"), // no prereqs → synthetic none
      makeCourse("MATH 220-2", "MATH 220-1"), // real prereq
      makeCourse("MATH 230-1") // no prereqs → synthetic none
    ];
    const map = await getParsedPrereqs("rev-skip", courses);

    // Parser should fire only for the one course with a non-empty prereq.
    expect(mockParsePrereq).toHaveBeenCalledTimes(1);
    expect(map.size).toBe(3);
    expect(map.get("MATH 220-1")?.parsed).toEqual({ kind: "none" });
    expect(map.get("MATH 220-1")?.raw).toBe("");
    expect(map.has("MATH 220-2")).toBe(true);
    expect(map.get("MATH 230-1")?.parsed).toEqual({ kind: "none" });
  });

  it("courses with an empty-string prereq get the same synthetic 'none' record", async () => {
    const courses = [makeCourse("BIOL 101-0", "   ")];
    const map = await getParsedPrereqs("rev-empty-string", courses);
    expect(mockParsePrereq).not.toHaveBeenCalled();
    expect(map.size).toBe(1);
    expect(map.get("BIOL 101-0")?.parsed).toEqual({ kind: "none" });
    expect(map.get("BIOL 101-0")?.raw).toBe("");
  });

  it("memo hit on same planRev: second call does not re-parse and does not re-read storage", async () => {
    const courses = [makeCourse("COMP_SCI 111-0", "none")];
    await getParsedPrereqs("rev-2", courses);
    expect(mockParsePrereq).toHaveBeenCalledTimes(1);

    const getSpy = vi.spyOn(chrome.storage.local, "get");
    const second = await getParsedPrereqs("rev-2", courses);
    expect(mockParsePrereq).toHaveBeenCalledTimes(1);
    expect(getSpy).not.toHaveBeenCalled();
    expect(second.size).toBe(1);
    getSpy.mockRestore();
  });

  it("storage hit (fresh, same planRev) on a cold module state: no parse calls", async () => {
    // Seed storage directly, then clear memo so the next call has to read.
    const seeded: ParsedPrereqsCachePayload = {
      version: 1,
      planRev: "rev-seed",
      parsedAt: Date.now(),
      byCourseId: {
        "COMP_SCI 111-0": {
          id: "COMP_SCI 111-0",
          raw: "none",
          parsed: { kind: "none" },
          warnings: []
        }
      }
    };
    await chrome.storage.local.set({ [PREREQS_PARSED_STORAGE_KEY]: seeded });
    // Wipe memo only — clearParsedPrereqs would also wipe storage, so reach
    // into the module's exported clearer + immediately re-seed instead. The
    // simpler path: clear, then re-set.
    await clearParsedPrereqs();
    await chrome.storage.local.set({ [PREREQS_PARSED_STORAGE_KEY]: seeded });
    mockParsePrereq.mockClear();

    const map = await getParsedPrereqs("rev-seed", [makeCourse("COMP_SCI 111-0", "none")]);
    expect(mockParsePrereq).not.toHaveBeenCalled();
    expect(map.size).toBe(1);
    expect(map.get("COMP_SCI 111-0")?.parsed).toEqual({ kind: "none" });
  });

  it("stale storage (parsedAt older than TTL): re-parses and overwrites", async () => {
    const stale: ParsedPrereqsCachePayload = {
      version: 1,
      planRev: "rev-stale",
      parsedAt: Date.now() - PARSED_PREREQS_TTL_MS - 1_000,
      byCourseId: {
        "OLD 100-0": {
          id: "OLD 100-0",
          raw: "old",
          parsed: { kind: "raw", text: "old" },
          warnings: []
        }
      }
    };
    await chrome.storage.local.set({ [PREREQS_PARSED_STORAGE_KEY]: stale });
    await clearParsedPrereqs();
    await chrome.storage.local.set({ [PREREQS_PARSED_STORAGE_KEY]: stale });
    mockParsePrereq.mockClear();

    const courses = [makeCourse("COMP_SCI 111-0", "none")];
    const map = await getParsedPrereqs("rev-stale", courses);
    expect(mockParsePrereq).toHaveBeenCalledTimes(1);
    expect(map.has("COMP_SCI 111-0")).toBe(true);
    expect(map.has("OLD 100-0")).toBe(false);

    const stored = await chrome.storage.local.get(PREREQS_PARSED_STORAGE_KEY);
    const payload = stored[PREREQS_PARSED_STORAGE_KEY] as ParsedPrereqsCachePayload;
    expect(Object.keys(payload.byCourseId)).toEqual(["COMP_SCI 111-0"]);
    expect(payload.parsedAt).toBeGreaterThan(stale.parsedAt);
  });

  it("planRev change: re-parses and overwrites storage even if previous payload is fresh", async () => {
    const courses1 = [makeCourse("COMP_SCI 111-0", "none")];
    await getParsedPrereqs("rev-A", courses1);
    expect(mockParsePrereq).toHaveBeenCalledTimes(1);

    const courses2 = [
      makeCourse("COMP_SCI 211-0", "COMP_SCI 111-0"),
      makeCourse("COMP_SCI 213-0", "COMP_SCI 211-0")
    ];
    const map = await getParsedPrereqs("rev-B", courses2);
    expect(mockParsePrereq).toHaveBeenCalledTimes(3);
    expect(map.size).toBe(2);
    expect(map.has("COMP_SCI 111-0")).toBe(false);

    const stored = await chrome.storage.local.get(PREREQS_PARSED_STORAGE_KEY);
    const payload = stored[PREREQS_PARSED_STORAGE_KEY] as ParsedPrereqsCachePayload;
    expect(payload.planRev).toBe("rev-B");
    expect(Object.keys(payload.byCourseId).sort()).toEqual([
      "COMP_SCI 211-0",
      "COMP_SCI 213-0"
    ]);
  });

  it("in-flight dedupe: two simultaneous calls for the same planRev only parse once", async () => {
    // The first call's storage read is async — kick off both calls before
    // either resolves so the second one finds an inFlight entry waiting.
    const courses = [
      makeCourse("COMP_SCI 111-0", "none"),
      makeCourse("COMP_SCI 211-0", "COMP_SCI 111-0")
    ];

    const a = getParsedPrereqs("rev-dedupe", courses);
    const b = getParsedPrereqs("rev-dedupe", courses);
    const [resA, resB] = await Promise.all([a, b]);

    // parsePrereq fires once per course (2 courses) — the dedupe ensures the
    // SECOND getParsedPrereqs call rides the same promise rather than running
    // its own parse loop, so total parse count stays at 2 (not 4).
    expect(mockParsePrereq).toHaveBeenCalledTimes(2);
    expect(resA).toBe(resB);
  });

  it("clearParsedPrereqs wipes both memo and storage", async () => {
    await getParsedPrereqs("rev-clear", [makeCourse("COMP_SCI 111-0", "none")]);
    expect(mockParsePrereq).toHaveBeenCalledTimes(1);

    await clearParsedPrereqs();

    const stored = await chrome.storage.local.get(PREREQS_PARSED_STORAGE_KEY);
    expect(stored[PREREQS_PARSED_STORAGE_KEY]).toBeUndefined();

    // After clear, a same-planRev call must re-parse (memo gone).
    await getParsedPrereqs("rev-clear", [makeCourse("COMP_SCI 111-0", "none")]);
    expect(mockParsePrereq).toHaveBeenCalledTimes(2);
  });
});
