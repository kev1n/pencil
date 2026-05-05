import {
  buildSubjectResultsUrl,
  collectClassRowsFromText,
  collectCourseRows,
  dedupeEntries,
  extractBlueraUrl,
  normalizeSearch
} from "../ctec-navigation/helpers";
import {
  applyResponseState,
  buildActionParams,
  serializeForm
} from "../../peoplesoft/params";
import { extractPostUrl } from "../../peoplesoft/parsers";
import { resolveActionUrl } from "../../peoplesoft/shared";
import { readSubjectIndex, writeSubjectIndex } from "../ctec-navigation/storage";
import type {
  CtecCourseDiscoveryState,
  CtecIndexedEntry,
  CtecRowSeed,
  CtecSubjectIndex
} from "../ctec-navigation/types";
import {
  fetchPeopleSoftGetResult,
  fetchPeopleSoftResult
} from "../../peoplesoft/http";
import { runPeopleSoftTask } from "../../peoplesoft";
import { CTEC_AUTH_URL, NOT_FOUND_ACTION_ID, REQUEST_OWNER } from "./constants";
import {
  descriptionMatchesCatalog,
  entryMatchesCourse,
  instructorMatches,
  isAuthResponse,
  termToSortKey
} from "./helpers";
import { CTEC_BATCH_SIZE } from "./rate-limit";
import { resolveCareerCandidates, SCHOOL_LABELS } from "./subject-careers";
import type { CtecLinkData, CtecLinkEntry, CtecLinkParams } from "./types";

export async function fetchCtecLinks(
  params: CtecLinkParams,
  onProgress?: (msg: string) => void
): Promise<CtecLinkData> {
  return runPeopleSoftTask(
    "user",
    () => fetchCtecLinksInternal(params, false, onProgress),
    { owner: REQUEST_OWNER }
  );
}

export async function fetchCtecLinksBackground(
  params: CtecLinkParams,
  forceRefresh = false,
  onProgress?: (msg: string) => void
): Promise<CtecLinkData> {
  return runPeopleSoftTask(
    "background",
    () => fetchCtecLinksInternal(params, forceRefresh, onProgress),
    { owner: REQUEST_OWNER }
  );
}

// Removes all cached entries (including sentinels) matching this course +
// instructor so the next fetch hits the network. Used by the analytics-tab
// refresh button: when newly-published CTECs appear after the subject was
// cached, this clears the stale per-course slice without dropping the rest
// of the subject index.
export function clearCtecCacheForCourse(
  subject: string,
  catalogNumber: string,
  instructor: string
): void {
  const index = readSubjectIndex(subject);
  if (!index) return;
  const remaining = index.entries.filter(
    (e) => !entryMatchesCourse(e, subject, catalogNumber, instructor)
  );
  writeSubjectIndex(subject, { ...index, entries: remaining });
}

async function fetchCtecLinksInternal(
  params: CtecLinkParams,
  forceRefresh: boolean,
  onProgress?: (msg: string) => void
): Promise<CtecLinkData> {
  const { subject, catalogNumber, instructor } = params;

  // Sentinel-only short-circuit: previously confirmed not-found in the CTEC
  // catalog. forceRefresh bypasses to allow re-checking.
  const cachedIndex = readSubjectIndex(subject);
  const cachedCourseEntries = cachedIndex
    ? cachedIndex.entries.filter((e) =>
        entryMatchesCourse(e, subject, catalogNumber, instructor)
      )
    : [];
  const realCached = cachedCourseEntries.filter(
    (e) => e.actionId !== NOT_FOUND_ACTION_ID
  );
  if (
    !forceRefresh &&
    cachedCourseEntries.length > 0 &&
    realCached.length === 0
  ) {
    return { state: "not-found" };
  }

  // Discovery already completed in a prior run and there's nothing left to
  // probe — return the cached entries directly. Avoids re-running the
  // subject-results GET and course-action POST on every retry (e.g. after
  // a bluera-side auth-required interrupts the report-fetch loop).
  const cachedPending = readCoursePendingRowCount(
    cachedIndex,
    catalogNumber,
    instructor
  );
  const hasFetchFailed = realCached.some((e) => e.error === "Fetch failed");
  const courseStateRecorded = !!cachedIndex?.courseState?.[
    buildCourseStateKey(catalogNumber, instructor)
  ];
  if (
    !forceRefresh &&
    courseStateRecorded &&
    cachedPending === 0 &&
    !hasFetchFailed &&
    realCached.length > 0
  ) {
    return buildFoundResult(realCached, false);
  }

  // Skip rows already fetched (excluding transient "Fetch failed" so they
  // get retried). Each call fetches the next CTEC_BATCH_SIZE uncached rows;
  // callers re-invoke to load more.
  const skipKeys = new Set<string>(
    realCached
      .filter((e) => e.error !== "Fetch failed")
      .map((e) => buildRowKey(e.term, e.description, e.instructor))
  );

  // Try the careers that actually catalogue this subject (ordered by catalog-
  // number lean) and stop on the first hit.
  const candidates = resolveCareerCandidates(subject, catalogNumber);

  let fetchResult: FetchCourseResult = { type: "not-found" };
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    const label = SCHOOL_LABELS[candidate] ?? candidate;
    onProgress?.(i === 0 ? `Searching ${label}…` : `Trying ${label}…`);
    fetchResult = await fetchCourseEntries(
      subject,
      catalogNumber,
      candidate,
      instructor,
      skipKeys,
      CTEC_BATCH_SIZE,
      onProgress
    );
    if (fetchResult.type !== "not-found") break;
  }

  if (fetchResult.type === "auth") {
    return { state: "auth-required", loginUrl: fetchResult.loginUrl };
  }
  if (fetchResult.type === "error") {
    return { state: "error", message: fetchResult.message };
  }
  if (fetchResult.type === "not-found") {
    if (realCached.length === 0) {
      writeSentinel(subject, catalogNumber, instructor, readSubjectIndex(subject));
      return { state: "not-found" };
    }
    // Discovery failed in every career we tried, but earlier runs cached real
    // entries — surface those rather than overwriting them with not-found.
    return buildFoundResult(realCached, false);
  }

  // Merge new entries into the subject index and persist this course's
  // discovery state so callers (paper-ctec modal, ctec-links chip) can
  // decide whether to surface "Load more" without redoing the discovery
  // probe just to find out.
  const existingEntries = cachedIndex?.entries ?? [];
  const merged = dedupeEntries([...existingEntries, ...fetchResult.entries]);
  const courseStateKey = buildCourseStateKey(catalogNumber, instructor);
  const nextCourseState: Record<string, CtecCourseDiscoveryState> = {
    ...(cachedIndex?.courseState ?? {}),
    [courseStateKey]: {
      pendingRowCount: fetchResult.pendingRowCount,
      updatedAt: Date.now()
    }
  };
  writeSubjectIndex(subject, {
    subjectCode: subject,
    subjectLabel: cachedIndex?.subjectLabel ?? subject,
    builtAt: cachedIndex?.builtAt ?? Date.now(),
    sourceUrl: cachedIndex?.sourceUrl ?? window.location.href,
    entries: merged,
    courseState: nextCourseState
  });

  const allMatches = merged.filter((e) =>
    entryMatchesCourse(e, subject, catalogNumber, instructor)
  );
  const allReal = allMatches.filter((e) => e.actionId !== NOT_FOUND_ACTION_ID);
  if (allReal.length === 0) {
    writeSentinel(subject, catalogNumber, instructor, readSubjectIndex(subject));
    return { state: "not-found" };
  }
  return buildFoundResult(allMatches, fetchResult.pendingRowCount > 0);
}

// Synchronous cache-only lookup. Returns data if the subject index exists and
// has matching entries for this course; null if a fetch is required.
export function getCtecLinksFromCache(params: CtecLinkParams): CtecLinkData | null {
  const { subject, catalogNumber, instructor } = params;
  const cachedIndex = readSubjectIndex(subject);
  if (!cachedIndex) return null;
  const matches = cachedIndex.entries.filter((e) =>
    entryMatchesCourse(e, subject, catalogNumber, instructor)
  );
  if (matches.length === 0) return null;
  const hasMore =
    readCoursePendingRowCount(cachedIndex, catalogNumber, instructor) > 0;
  return buildFoundResult(matches, hasMore);
}

// Reads the persisted count of unfetched class rows for this course. Returns
// 0 when no fetch has happened yet — callers should treat that as "unknown,
// fall back to in-memory snapshot heuristics" rather than "definitely none."
export function readCoursePendingRowCount(
  index: CtecSubjectIndex | null,
  catalogNumber: string,
  instructor: string
): number {
  if (!index?.courseState) return 0;
  const state = index.courseState[buildCourseStateKey(catalogNumber, instructor)];
  return Math.max(0, state?.pendingRowCount ?? 0);
}

function buildCourseStateKey(catalogNumber: string, instructor: string): string {
  return `${catalogNumber}|${normalizeSearch(instructor)}`;
}

function buildFoundResult(entries: CtecIndexedEntry[], hasMore: boolean): CtecLinkData {
  // Exclude sentinel entries from display and count.
  const real = entries.filter((e) => e.actionId !== NOT_FOUND_ACTION_ID);
  const sorted = [...real].sort((a, b) => termToSortKey(b.term) - termToSortKey(a.term));

  const withUrls: CtecLinkEntry[] = sorted
    .filter((e): e is CtecIndexedEntry & { blueraUrl: string } => e.blueraUrl !== null)
    .map((e) => ({ term: e.term, url: e.blueraUrl, instructor: e.instructor, description: e.description }));

  if (withUrls.length === 0) return { state: "not-found" };

  // Mark incomplete if any entries failed to fetch (cancelled mid-run).
  const incomplete = real.some((e) => e.error === "Fetch failed");

  return {
    state: "found",
    entries: withUrls,
    totalCount: real.length,
    incomplete,
    hasMore
  };
}

function buildRowKey(term: string, description: string, instructor: string): string {
  return [
    normalizeSearch(term),
    normalizeSearch(description),
    normalizeSearch(instructor)
  ].join("|");
}

function writeSentinel(
  subject: string,
  catalogNumber: string,
  instructor: string,
  existingIndex: CtecSubjectIndex | null
): void {
  const sentinel: CtecIndexedEntry = {
    actionId: NOT_FOUND_ACTION_ID,
    term: "",
    description: `${subject} ${catalogNumber}`,
    instructor,
    blueraUrl: null,
    error: "not-found",
    searchText: normalizeSearch(`${catalogNumber} ${instructor}`)
  };
  const existing = existingIndex?.entries ?? [];
  const merged = dedupeEntries([...existing, sentinel]);
  writeSubjectIndex(subject, {
    subjectCode: subject,
    subjectLabel: existingIndex?.subjectLabel ?? subject,
    builtAt: existingIndex?.builtAt ?? Date.now(),
    sourceUrl: existingIndex?.sourceUrl ?? window.location.href,
    entries: merged
  });
}

type FetchCourseResult =
  | { type: "entries"; entries: CtecIndexedEntry[]; pendingRowCount: number }
  | { type: "auth"; loginUrl: string }
  | { type: "not-found" }
  | { type: "error"; message: string };

async function fetchCourseEntries(
  subject: string,
  catalogNumber: string,
  career: string,
  instructor: string,
  skipKeys: Set<string>,
  batchSize: number,
  onProgress?: (msg: string) => void
): Promise<FetchCourseResult> {
  const resultsUrl = buildSubjectResultsUrl(subject, career);
  let html: string;
  try {
    const response = await fetchPeopleSoftGetResult(resultsUrl);
    if (isUnauthorizedStatus(response.status)) {
      return { type: "auth", loginUrl: CTEC_AUTH_URL };
    }
    html = response.text;
  } catch (e) {
    return { type: "error", message: e instanceof Error ? e.message : "Failed to load CTEC page." };
  }

  if (isAuthResponse(html)) return { type: "auth", loginUrl: CTEC_AUTH_URL };

  const doc = new DOMParser().parseFromString(html, "text/html");
  const form = doc.forms.namedItem("win0");
  if (!(form instanceof HTMLFormElement)) {
    return { type: "error", message: "Could not parse CTEC form." };
  }

  const actionUrl = resolveActionUrl(form.action);
  const baseParams = serializeForm(form);

  onProgress?.("Finding course…");
  const courseRows = collectCourseRows(doc);
  const targetCourse = courseRows.find((c) =>
    descriptionMatchesCatalog(c.description, catalogNumber)
  );
  if (!targetCourse) return { type: "not-found" };

  let courseResponse: string;
  try {
    const response = await fetchPeopleSoftResult(
      actionUrl,
      buildActionParams(baseParams, targetCourse.actionId)
    );
    if (isUnauthorizedStatus(response.status)) {
      return { type: "auth", loginUrl: CTEC_AUTH_URL };
    }
    courseResponse = response.text;
  } catch (e) {
    return { type: "error", message: e instanceof Error ? e.message : "Failed to load course." };
  }

  if (isAuthResponse(courseResponse)) return { type: "auth", loginUrl: CTEC_AUTH_URL };

  const allClassRows = collectClassRowsFromText(courseResponse);
  if (allClassRows.length === 0) return { type: "not-found" };

  // Same matchers entryMatchesCourse uses on read — keeps cross-listed
  // sections and rows from a mis-targeted course out of the index.
  // PeopleSoft serves rows oldest-first; sort newest-first so the first
  // batchSize-sized slice picks up recent CTECs.
  const sortedRows = allClassRows
    .filter(
      (r) =>
        descriptionMatchesCatalog(r.description, catalogNumber) &&
        instructorMatches(r.instructor, instructor)
    )
    .sort((a, b) => termToSortKey(b.term) - termToSortKey(a.term));

  // Skip already-fetched rows; each call processes at most batchSize new ones.
  const todoAll: CtecRowSeed[] = sortedRows.filter(
    (r) => !skipKeys.has(buildRowKey(r.term, r.description, r.instructor))
  );
  const todo = todoAll.slice(0, batchSize);
  const pendingRowCount = Math.max(0, todoAll.length - todo.length);

  if (todo.length === 0) {
    return { type: "entries", entries: [], pendingRowCount: 0 };
  }

  const classParams = applyResponseState(baseParams, courseResponse);
  const classActionUrl = extractPostUrl(courseResponse) ?? actionUrl;

  const total = todo.length;
  const resultEntries: CtecIndexedEntry[] = [];
  for (let i = 0; i < todo.length; i++) {
    const row = todo[i]!;
    onProgress?.(`Loading evaluation ${i + 1}/${total}…`);

    let classResponse: string;
    try {
      const response = await fetchPeopleSoftResult(
        classActionUrl,
        buildActionParams(classParams, row.actionId)
      );
      if (isUnauthorizedStatus(response.status)) {
        return { type: "auth", loginUrl: CTEC_AUTH_URL };
      }
      classResponse = response.text;
    } catch {
      resultEntries.push({
        actionId: row.actionId,
        term: row.term,
        description: row.description,
        instructor: row.instructor,
        blueraUrl: null,
        error: "Fetch failed",
        searchText: normalizeSearch([row.term, row.description, row.instructor].join(" "))
      });
      continue;
    }

    if (isAuthResponse(classResponse)) return { type: "auth", loginUrl: CTEC_AUTH_URL };

    const blueraUrl = extractBlueraUrl(classResponse);
    resultEntries.push({
      actionId: row.actionId,
      term: row.term,
      description: row.description,
      instructor: row.instructor,
      blueraUrl,
      error: blueraUrl ? null : "No Bluera URL found",
      searchText: normalizeSearch([row.term, row.description, row.instructor].join(" "))
    });
  }

  return { type: "entries", entries: resultEntries, pendingRowCount };
}

function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}
