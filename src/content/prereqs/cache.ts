// Parsed-prereqs cache. Backs the augmentation's per-course eligibility
// rendering: parses every PaperCourse.prereqs once per planRev, persists
// the result to chrome.storage.local, and serves subsequent calls from a
// module-level memo. Re-parses on planRev change OR when the persisted
// payload is older than PARSED_PREREQS_TTL_MS.

import type { PaperCourse } from "../augmentations/class-search/paper-data";
import { logQuiet } from "../../shared/log";
import { parsePrereq } from "./parser/index";
import {
  PARSED_PREREQS_TTL_MS,
  PREREQS_PARSED_STORAGE_KEY,
  type ParsedPrereqsCachePayload,
  type PrereqRecord
} from "./types";

export type ParsedPrereqMap = ReadonlyMap<string, PrereqRecord>;

type MemoEntry = { planRev: string; map: ParsedPrereqMap };

let memoCache: MemoEntry | null = null;
let inFlight: { planRev: string; promise: Promise<ParsedPrereqMap> } | null = null;

// Parsing ~1900 courses synchronously can hold the main thread for several
// hundred ms. Yielding every YIELD_EVERY entries lets paint + input pump.
const YIELD_EVERY = 100;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function isValidPayload(value: unknown): value is ParsedPrereqsCachePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ParsedPrereqsCachePayload>;
  return (
    v.version === 1 &&
    typeof v.planRev === "string" &&
    typeof v.parsedAt === "number" &&
    !!v.byCourseId &&
    typeof v.byCourseId === "object"
  );
}

async function readPersisted(): Promise<ParsedPrereqsCachePayload | null> {
  try {
    const result = await chrome.storage.local.get(PREREQS_PARSED_STORAGE_KEY);
    const raw = (result as Record<string, unknown>)[PREREQS_PARSED_STORAGE_KEY];
    return isValidPayload(raw) ? raw : null;
  } catch (err) {
    logQuiet("prereqs-cache.read", err);
    return null;
  }
}

async function persist(payload: ParsedPrereqsCachePayload): Promise<void> {
  try {
    await chrome.storage.local.set({ [PREREQS_PARSED_STORAGE_KEY]: payload });
  } catch (err) {
    logQuiet("prereqs-cache.persist", err);
  }
}

function payloadToMap(payload: ParsedPrereqsCachePayload): ParsedPrereqMap {
  const map = new Map<string, PrereqRecord>();
  for (const [id, record] of Object.entries(payload.byCourseId)) {
    map.set(id, record);
  }
  return map;
}

async function parseAll(courses: readonly PaperCourse[]): Promise<Record<string, PrereqRecord>> {
  const byCourseId: Record<string, PrereqRecord> = {};
  let parsedSinceYield = 0;
  for (const course of courses) {
    // paper.nu's plan.json either drops the `p` field or ships an empty
    // string for courses with no prereqs. Both mean "no prereqs" per the
    // registrar's data — emit a synthetic `none` record so the UI shows a
    // confident ✓ instead of a "no data" pill.
    const raw = course.prereqs ?? "";
    if (raw.trim() === "") {
      byCourseId[course.id] = {
        id: course.id,
        raw: "",
        parsed: { kind: "none" },
        warnings: []
      };
      continue;
    }
    const { parsed, warnings } = parsePrereq(raw, course.subject ?? null);
    byCourseId[course.id] = {
      id: course.id,
      raw,
      parsed,
      warnings
    };
    parsedSinceYield += 1;
    if (parsedSinceYield >= YIELD_EVERY) {
      parsedSinceYield = 0;
      await yieldToEventLoop();
    }
  }
  return byCourseId;
}

export async function getParsedPrereqs(
  planRev: string,
  courses: readonly PaperCourse[]
): Promise<ParsedPrereqMap> {
  // In-flight dedupe: a second call for the same planRev rides the same
  // promise so we never parse twice concurrently.
  if (inFlight && inFlight.planRev === planRev) {
    return inFlight.promise;
  }

  if (memoCache && memoCache.planRev === planRev) {
    return memoCache.map;
  }

  const promise = (async (): Promise<ParsedPrereqMap> => {
    const persisted = await readPersisted();
    if (
      persisted &&
      persisted.planRev === planRev &&
      Date.now() - persisted.parsedAt < PARSED_PREREQS_TTL_MS
    ) {
      const map = payloadToMap(persisted);
      memoCache = { planRev, map };
      return map;
    }

    const byCourseId = await parseAll(courses);
    const payload: ParsedPrereqsCachePayload = {
      version: 1,
      planRev,
      parsedAt: Date.now(),
      byCourseId
    };
    await persist(payload);
    const map = payloadToMap(payload);
    memoCache = { planRev, map };
    return map;
  })();

  inFlight = { planRev, promise };
  try {
    return await promise;
  } finally {
    if (inFlight && inFlight.promise === promise) {
      inFlight = null;
    }
  }
}

export async function clearParsedPrereqs(): Promise<void> {
  memoCache = null;
  inFlight = null;
  try {
    await chrome.storage.local.remove(PREREQS_PARSED_STORAGE_KEY);
  } catch (err) {
    logQuiet("prereqs-cache.clear", err);
  }
}
