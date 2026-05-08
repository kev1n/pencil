import {
  buildSubjectResultsUrl,
  collectClassRowsFromText,
  collectCourseRows,
  dedupeEntries,
  extractBlueraUrl,
  normalizeSearch
} from "../../ctec-index/helpers";
import {
  applyResponseState,
  buildActionParams,
  serializeForm
} from "../../peoplesoft/params";
import { extractPostUrl } from "../../peoplesoft/parsers";
import { resolveActionUrl } from "../../peoplesoft/shared";
import {
  extractPeopleSoftPageId,
  getCtecAccessStatus,
  isCtecAccessDenied,
  isCtecUnauthorizedHtml,
  markCtecAccessDenied
} from "../../ctec-index/access";
import { probeCtecAccess } from "../../ctec-index/access-probe";
import { logDebug } from "../../../shared/log";
import { readSubjectIndex, writeSubjectIndex } from "../../ctec-index/storage";
import type {
  CtecCourseDiscoveryState,
  CtecIndexedEntry,
  CtecRowSeed,
  CtecSubjectIndex
} from "../../ctec-index/types";
import {
  fetchPeopleSoftGetResult,
  fetchPeopleSoftResult
} from "../../peoplesoft/http";
import { runPeopleSoftTask } from "../../peoplesoft";
import {
  CaesarAuthRequiredError,
  isCaesarAuthRequiredError
} from "../class-search/caesar-search/types";
import { withSilentAuthRecovery } from "../../auth/silent-recovery";
import { NOT_FOUND_ACTION_ID, REQUEST_OWNER } from "./constants";
import {
  descriptionMatchesCatalog,
  entryMatchesCourse,
  instructorMatches,
  isAuthResponse,
  termToSortKey
} from "./helpers";
import { CTEC_BATCH_SIZE, CTEC_FETCH_TIMEOUT_MS } from "./rate-limit";
import { resolveCareerCandidates, SCHOOL_LABELS } from "./subject-careers";
import type { CtecLinkData, CtecLinkEntry, CtecLinkParams } from "./types";

export async function fetchCtecLinks(
  params: CtecLinkParams,
  onProgress?: (msg: string) => void
): Promise<CtecLinkData> {
  return runPeopleSoftTask(
    "user",
    () => fetchCtecLinksInternal(params, false, onProgress),
    { owner: REQUEST_OWNER, label: buildCtecTaskLabel(params) }
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
    { owner: REQUEST_OWNER, label: buildCtecTaskLabel(params) }
  );
}

function buildCtecTaskLabel(params: CtecLinkParams): string {
  return `Load CTEC for ${params.subject} ${params.catalogNumber}`;
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
  // Sticky no-access short-circuit. Once a CTEC fetch in this session (or
  // a prior one — the flag persists in chrome.storage.local) lands on the
  // NW_CTEC_MSG_FL "you are not authorized" panel, every later call
  // returns no-access without touching the network. Cleared from the
  // popup's "Clear CTEC cache" button.
  logDebug("ctec-fetch", "fetchCtecLinksInternal start", {
    params,
    forceRefresh,
    accessStatus: getCtecAccessStatus()
  });
  if (isCtecAccessDenied()) return { state: "no-access" };

  // Upfront probe: hit the NU Manage Classes navigation page CAESAR's
  // own UI walks through. Its rendered body contains the literal "You
  // are not authorized to access CTECs" copy for any deauthorized
  // NetID — a far more reliable signal than inferring from the actual
  // subject-results URL response. Sticky-cached, so subsequent Load
  // CTEC clicks don't re-probe.
  if (getCtecAccessStatus() === "unknown") {
    await probeCtecAccess();
    if (isCtecAccessDenied()) return { state: "no-access" };
  }

  // Wrap the core in the shared silent-recovery cascade. Inner code throws
  // `CaesarAuthRequiredError` whenever PeopleSoft hands us an SSO page; the
  // wrapper retries through Layer 1 (background fetch to landing page) then
  // Layer 2 (inactive 10s tab) before giving up. If both silent layers
  // fail, surface `auth-required` carrying the URL we were just trying —
  // the cart-page widget renders that as an inline log-in link, and the
  // chip-side callers (paper-ctec / class-search) re-throw it through
  // their withAuthRecovery wrapper so a real popup tab opens to the right
  // SSO endpoint.
  try {
    return await withSilentAuthRecovery(
      () => fetchCtecLinksCore(params, forceRefresh, onProgress),
      isCaesarAuthRequiredError
    );
  } catch (error) {
    if (isCtecAccessDeniedError(error)) {
      return { state: "no-access" };
    }
    if (isCaesarAuthRequiredError(error)) {
      return { state: "auth-required", loginUrl: error.loginUrl };
    }
    throw error;
  }
}

async function fetchCtecLinksCore(
  params: CtecLinkParams,
  forceRefresh: boolean,
  onProgress?: (msg: string) => void
): Promise<CtecLinkData> {
  const { subject, catalogNumber, instructor } = params;

  // Cache-only short-circuits are only safe once we've actually verified
  // CTEC access for this NetID. The upfront `probeCtecAccess()` call in
  // `fetchCtecLinksInternal` flips status to denied or confirmed when it
  // sees a positive marker (unauthorized panel vs. authorized
  // disclaimer); ambiguous responses leave it "unknown" by design — we
  // err on the side of caution rather than confirming on absence of
  // denial. Preexisting users who already have a populated subject index
  // would otherwise short-circuit forever and never confirm — the
  // popup's CTEC-access pill would be stuck on "not checked yet" while
  // CTEC widgets happily render cached data.
  const accessConfirmed = getCtecAccessStatus() === "confirmed";

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
    accessConfirmed &&
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
    accessConfirmed &&
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

  // Auth-required cases are surfaced as `CaesarAuthRequiredError` thrown
  // from `fetchCourseEntries`, caught by the outer `withSilentAuthRecovery`
  // wrapper. They never reach this switch.
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
// has matching entries for this course; null if a fetch is required. Gates
// on the access flag — denied → no-access, anything but confirmed → null
// so the caller has to drive a real network probe before any cached data
// is shown.
export function getCtecLinksFromCache(params: CtecLinkParams): CtecLinkData | null {
  if (isCtecAccessDenied()) return { state: "no-access" };
  if (getCtecAccessStatus() !== "confirmed") return null;
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
  | { type: "not-found" }
  | { type: "error"; message: string };

// Throws `CaesarAuthRequiredError` whenever PeopleSoft signals auth-required
// (4xx status or SSO-shaped HTML). The outer `fetchCtecLinksInternal`
// wraps this in `withSilentAuthRecovery`, which retries through Layer 1 +
// Layer 2 and only escalates to a visible modal as a last resort.
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
    const response = await fetchPeopleSoftGetResult(resultsUrl, {
      timeoutMs: CTEC_FETCH_TIMEOUT_MS
    });
    if (isUnauthorizedStatus(response.status)) {
      throw new CaesarAuthRequiredError(resultsUrl);
    }
    html = response.text;
  } catch (e) {
    if (isCaesarAuthRequiredError(e)) throw e;
    return { type: "error", message: e instanceof Error ? e.message : "Failed to load CTEC page." };
  }

  logCtecResponse("subject-results GET", resultsUrl, html);

  if (detectAndMarkUnauthorized(html, "subject-results GET")) {
    throw new CtecAccessDeniedError();
  }
  if (isAuthResponse(html)) throw new CaesarAuthRequiredError(resultsUrl);

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
      buildActionParams(baseParams, targetCourse.actionId),
      { timeoutMs: CTEC_FETCH_TIMEOUT_MS }
    );
    if (isUnauthorizedStatus(response.status)) {
      throw new CaesarAuthRequiredError(actionUrl);
    }
    courseResponse = response.text;
  } catch (e) {
    if (isCaesarAuthRequiredError(e)) throw e;
    return { type: "error", message: e instanceof Error ? e.message : "Failed to load course." };
  }

  logCtecResponse("course POST", actionUrl, courseResponse);

  if (detectAndMarkUnauthorized(courseResponse, "course POST")) {
    throw new CtecAccessDeniedError();
  }
  if (isAuthResponse(courseResponse)) throw new CaesarAuthRequiredError(actionUrl);

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
        buildActionParams(classParams, row.actionId),
        { timeoutMs: CTEC_FETCH_TIMEOUT_MS }
      );
      if (isUnauthorizedStatus(response.status)) {
        throw new CaesarAuthRequiredError(classActionUrl);
      }
      classResponse = response.text;
    } catch (e) {
      if (isCaesarAuthRequiredError(e)) throw e;
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

    if (detectAndMarkUnauthorized(classResponse, "class POST")) {
      throw new CtecAccessDeniedError();
    }
    if (isAuthResponse(classResponse)) throw new CaesarAuthRequiredError(classActionUrl);

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

// Marker error for "your NetID lost CTEC access." Distinct from
// `CaesarAuthRequiredError` (which means "session expired, sign in again")
// — silent SSO can't recover from this one, since the user is already
// authenticated; CTEC just refuses to serve them. Caught at the top of
// `fetchCtecLinksInternal` and converted to `{ state: "no-access" }`.
export class CtecAccessDeniedError extends Error {
  constructor() {
    super("Northwestern has not authorized this NetID to view CTECs.");
    this.name = "CtecAccessDeniedError";
  }
}

export function isCtecAccessDeniedError(error: unknown): error is CtecAccessDeniedError {
  return error instanceof CtecAccessDeniedError;
}

// Detects the unauthorized-message panel CAESAR returns and persists the
// sticky flag on the way out, so callers up the stack can short-circuit
// without re-checking the body. The `source` string is purely for the
// debug log so we can tell which fetch step (subject GET / course POST /
// class POST) tripped the marker.
function detectAndMarkUnauthorized(html: string, source: string): boolean {
  if (!isCtecUnauthorizedHtml(html)) return false;
  markCtecAccessDenied(`fetcher.ts: ${source}`);
  return true;
}

// Single-line response trace at every CTEC step. Gated by `bc-debug`
// (logDebug is a no-op without it). Helps diagnose "why did access flip
// the wrong way" without dumping multi-KB bodies into the console.
function logCtecResponse(label: string, url: string, html: string): void {
  logDebug("ctec-fetch", label, {
    url,
    bodyLength: html.length,
    pageId: extractPeopleSoftPageId(html),
    isUnauthorized: isCtecUnauthorizedHtml(html)
  });
}
