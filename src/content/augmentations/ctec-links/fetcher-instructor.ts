// Instructor-lens CTEC fetcher. Mirror of fetcher.ts's structure but routes
// through CAESAR's NW_CTEC_SRCH_CHOIC=T (Teacher search) surface instead of
// the catalog-keyed =C search. The T surface returns a directory of every
// instructor who has taught the subject + career; click a row, get that
// instructor's CTEC list for the subject (across all courses they taught
// in it). That's the data the "instructor" analytics lens consumes.
//
// Cache substrate is the same per-subject CtecSubjectIndex — entries land
// in `index.entries` alongside combo-mode entries, dedupe'd by blueraUrl.
// The strategy dispatcher in reports.ts filters on read, so the modal
// flipping lenses just changes which entries get aggregated; nothing
// re-fetches if the cache already has them.

import { CAESAR_ORIGIN } from "../../../shared/nu-hosts";
import {
  collectClassRowsFromText,
  dedupeEntries,
  extractBlueraUrl,
  normalizeSearch
} from "../../ctec-index/helpers";
import {
  applyResponseState,
  buildActionParams,
  serializeForm
} from "../../peoplesoft/params";
import {
  extractActionIds,
  extractFieldValue,
  extractPostUrl
} from "../../peoplesoft/parsers";
import { resolveActionUrl } from "../../peoplesoft/shared";
import {
  getCtecAccessStatus,
  isCtecAccessDenied,
  isCtecUnauthorizedHtml,
  markCtecAccessDenied
} from "../../ctec-index/access";
import { probeCtecAccess } from "../../ctec-index/access-probe";
import {
  createEmptySubjectIndex,
  readSubjectIndex,
  writeSubjectIndex
} from "../../ctec-index/storage";
import type {
  CtecIndexedEntry,
  CtecRowSeed
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
import { resolveCareerCandidates, SCHOOL_LABELS } from "../../nu-careers";
import { REQUEST_OWNER } from "./constants";
import {
  CtecAccessDeniedError,
  dedupeRowsByLogicalKey,
  isCtecAccessDeniedError
} from "./fetcher";
import { instructorMatches, isAuthResponse, termToSortKey } from "./helpers";
import { CTEC_BATCH_SIZE, CTEC_FETCH_TIMEOUT_MS } from "./rate-limit";
import type { CtecLinkData, CtecLinkEntry, CtecLinkParams } from "./types";

export async function fetchCtecLinksByInstructor(
  params: CtecLinkParams,
  forceRefresh = false,
  onProgress?: (msg: string) => void
): Promise<CtecLinkData> {
  return runPeopleSoftTask(
    "background",
    () => fetchCtecLinksByInstructorInternal(params, forceRefresh, onProgress),
    { owner: REQUEST_OWNER, label: `Load CTEC for ${params.instructor}` }
  );
}

async function fetchCtecLinksByInstructorInternal(
  params: CtecLinkParams,
  forceRefresh: boolean,
  onProgress?: (msg: string) => void
): Promise<CtecLinkData> {
  if (isCtecAccessDenied()) return { state: "no-access" };
  if (getCtecAccessStatus() === "unknown") {
    await probeCtecAccess();
    if (isCtecAccessDenied()) return { state: "no-access" };
  }

  try {
    return await withSilentAuthRecovery(
      () => fetchCtecLinksByInstructorCore(params, forceRefresh, onProgress),
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

async function fetchCtecLinksByInstructorCore(
  params: CtecLinkParams,
  forceRefresh: boolean,
  onProgress?: (msg: string) => void
): Promise<CtecLinkData> {
  const { subject, instructor, catalogNumber } = params;
  const accessConfirmed = getCtecAccessStatus() === "confirmed";

  const cachedIndex = readSubjectIndex(subject);
  const cachedInstructorEntries = cachedIndex
    ? cachedIndex.entries.filter(
        (e) => !!e.blueraUrl && instructorMatches(e.instructor, instructor)
      )
    : [];

  // Per-instructor exploration marker. Combo / course fetches will leave
  // *some* of this instructor's entries in the index (anything overlapping
  // their (catalog, instructor) or (catalog, all-instructors) scans), but
  // those scans don't visit instructor-search territory — so flipping to
  // Prof mode after only-combo activity would short-circuit on partial
  // data and miss every course this professor has taught outside the one
  // the user opened. The marker gets written after a successful T-endpoint
  // discovery so we only re-probe when forcibly refreshed.
  const instructorStateKey = buildInstructorStateKey(instructor);
  const exploredBefore = !!cachedIndex?.courseState?.[instructorStateKey];

  if (
    accessConfirmed &&
    !forceRefresh &&
    exploredBefore &&
    cachedInstructorEntries.length > 0
  ) {
    return buildFoundResult(cachedInstructorEntries);
  }

  // Skip rows already in cache (matched by natural key) so a re-fetch
  // doesn't re-hit Bluera for entries we already have summaries for.
  // The same skip-set drives the batch slicing inside fetchInstructorRows
  // — keeps each call to CTEC_BATCH_SIZE new fetches, identical to the
  // combo / course path (see fetcher.ts's CTEC_BATCH_SIZE handling).
  const skipKeys = new Set(
    cachedInstructorEntries.map((e) =>
      buildRowKey(e.term, e.description, e.instructor)
    )
  );

  // Build career candidate list. resolveCareerCandidates orders careers by
  // catalog-number lean — we still pass catalogNumber even though we're not
  // filtering by it here, since it's the best hint we have for which
  // school's instructor directory to probe first.
  const candidates = resolveCareerCandidates(subject, catalogNumber);

  let fetchResult: InstructorFetchResult | null = null;
  let lastError: string | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    const label = SCHOOL_LABELS[candidate] ?? candidate;
    onProgress?.(
      i === 0 ? `Searching ${label} for ${instructor}…` : `Trying ${label}…`
    );

    try {
      const result = await fetchInstructorRows(
        subject,
        candidate,
        instructor,
        skipKeys,
        CTEC_BATCH_SIZE,
        onProgress
      );
      if (result) {
        fetchResult = result;
        break;
      }
    } catch (e) {
      if (isCaesarAuthRequiredError(e) || isCtecAccessDeniedError(e)) throw e;
      lastError = e instanceof Error ? e.message : "Failed to load CTEC page.";
    }
  }

  if (!fetchResult) {
    if (cachedInstructorEntries.length > 0) {
      return buildFoundResult(cachedInstructorEntries);
    }
    if (lastError) return { state: "error", message: lastError };
    return { state: "not-found" };
  }

  // Persist this batch's resolved rows + stamp the exploration marker so
  // a flip back to Prof mode short-circuits cleanly. pendingRowCount
  // carries the count of un-fetched rows the directory contained so the
  // modal's "Load N more" button stays accurate across reloads.
  const merged = dedupeEntries([
    ...(cachedIndex?.entries ?? []),
    ...fetchResult.rows
  ]);
  writeSubjectIndex(subject, {
    ...(cachedIndex ?? createEmptySubjectIndex(subject)),
    entries: merged,
    courseState: {
      ...(cachedIndex?.courseState ?? {}),
      [instructorStateKey]: {
        pendingRowCount: fetchResult.pendingRowCount,
        updatedAt: Date.now()
      }
    }
  });

  const allMatches = merged.filter(
    (e) => !!e.blueraUrl && instructorMatches(e.instructor, instructor)
  );
  return buildFoundResult(allMatches, fetchResult.pendingRowCount > 0);
}

type InstructorFetchResult = {
  // Newly-fetched index entries (with blueraUrl resolved) for this batch.
  // Mirrors fetcher.ts's FetchCourseResult.entries.
  rows: CtecIndexedEntry[];
  // Rows the directory contained that we haven't fetched yet — drives
  // the modal "(N left)" affordance.
  pendingRowCount: number;
};

// Hits the instructor directory page for (subject, career) — the same
// NWCT.NW_CT_PUB_RSLT_FL.GBL endpoint the catalog search uses, but with
// SRCH_CHOIC=T (Teacher) instead of =C (Course). The response includes a
// side-panel grid of instructor rows (`NW_CT_PV_DRV$0_row_N`), each with
// a MYLABEL$N name + MYLINK$N action ID. We find the matching name,
// submit its action to get the instructor's CTEC list, then resolve each
// class row to a Bluera report URL.
async function fetchInstructorRows(
  subject: string,
  career: string,
  instructor: string,
  skipKeys: Set<string>,
  batchSize: number,
  onProgress?: (msg: string) => void
): Promise<InstructorFetchResult | null> {
  const directoryUrl = buildInstructorResultsUrl(subject, career);
  const response = await fetchPeopleSoftGetResult(directoryUrl, {
    timeoutMs: CTEC_FETCH_TIMEOUT_MS
  });
  if (isUnauthorizedStatus(response.status)) {
    throw new CaesarAuthRequiredError(directoryUrl);
  }
  const html = response.text;
  if (isCtecUnauthorizedHtml(html)) {
    markCtecAccessDenied("fetcher-instructor: directory GET");
    throw new CtecAccessDeniedError();
  }
  if (isAuthResponse(html)) throw new CaesarAuthRequiredError(directoryUrl);

  const doc = new DOMParser().parseFromString(html, "text/html");
  const form = doc.forms.namedItem("win0");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Could not parse CTEC directory form.");
  }

  const actionUrl = resolveActionUrl(form.action);
  const baseParams = serializeForm(form);

  const instructorActionId = findInstructorActionId(html, instructor);
  if (!instructorActionId) return null;

  onProgress?.(`Loading ${instructor}'s evaluations…`);
  const listResponse = await fetchPeopleSoftResult(
    actionUrl,
    buildActionParams(baseParams, instructorActionId),
    { timeoutMs: CTEC_FETCH_TIMEOUT_MS }
  );
  if (isUnauthorizedStatus(listResponse.status)) {
    throw new CaesarAuthRequiredError(actionUrl);
  }
  const listHtml = listResponse.text;
  if (isCtecUnauthorizedHtml(listHtml)) {
    markCtecAccessDenied("fetcher-instructor: list POST");
    throw new CtecAccessDeniedError();
  }
  if (isAuthResponse(listHtml)) throw new CaesarAuthRequiredError(actionUrl);

  const classRows = collectClassRowsFromText(listHtml);
  // Defense in depth: the action submission should already scope to one
  // instructor, but CAESAR occasionally serves cross-listed rows whose
  // instructor field lists co-instructors in a different order. Filter
  // on the way out so the cache stays clean for instructor-lens reads.
  const matching = classRows.filter((r) =>
    instructorMatches(r.instructor, instructor)
  );
  if (matching.length === 0) return null;

  // PeopleSoft serves rows oldest-first; sort newest-first so the first
  // batchSize-sized slice picks up recent CTECs — same convention used by
  // fetcher.ts's fetchCourseEntries. Dedupe by (term, prof, catalog) so
  // cross-listed sections that share a Bluera report don't each burn a
  // round-trip — same key the dry-run preview uses, so what loads
  // matches what the user previewed.
  const sortedRows = dedupeRowsByLogicalKey(
    matching.sort((a, b) => termToSortKey(b.term) - termToSortKey(a.term))
  );

  // Side-effect: persist the discovery row list so a page refresh
  // doesn't force the T-endpoint scrape to run again. Same shape the
  // dry-run dialog's instructor pathway reads.
  writePersistedInstructorDiscovery(subject, instructor, sortedRows);

  // Skip rows we've already resolved on a prior pass, then cap to
  // batchSize. pendingRowCount = the directory's remainder, which the
  // modal surfaces as "(N left)" and "Load more" iterations chew through.
  const todoAll = sortedRows.filter(
    (r) => !skipKeys.has(buildRowKey(r.term, r.description, r.instructor))
  );
  const todo = todoAll.slice(0, batchSize);
  const pendingRowCount = Math.max(0, todoAll.length - todo.length);

  if (todo.length === 0) {
    return { rows: [], pendingRowCount };
  }

  // Resolve each batched class row to a Bluera URL — same pattern as
  // fetcher.ts's per-class POST, but on the response state of the
  // instructor-list page.
  const classParams = applyResponseState(baseParams, listHtml);
  const classActionUrl = extractPostUrl(listHtml) ?? actionUrl;

  const resolved: CtecIndexedEntry[] = [];
  for (let i = 0; i < todo.length; i++) {
    const row = todo[i]!;
    onProgress?.(`Loading evaluation ${i + 1}/${todo.length}…`);

    let classText: string;
    try {
      const classResponse = await fetchPeopleSoftResult(
        classActionUrl,
        buildActionParams(classParams, row.actionId),
        { timeoutMs: CTEC_FETCH_TIMEOUT_MS }
      );
      if (isUnauthorizedStatus(classResponse.status)) {
        throw new CaesarAuthRequiredError(classActionUrl);
      }
      classText = classResponse.text;
    } catch (e) {
      if (isCaesarAuthRequiredError(e)) throw e;
      // Persist a "Fetch failed" marker so the entry isn't silently
      // dropped — combo mode does the same so the modal's load-more
      // button can retry just the failed ones rather than the whole batch.
      resolved.push({
        actionId: row.actionId,
        term: row.term,
        description: row.description,
        instructor: row.instructor,
        blueraUrl: null,
        error: "Fetch failed",
        searchText: normalizeSearch(
          [row.term, row.description, row.instructor].join(" ")
        )
      });
      continue;
    }

    if (isCtecUnauthorizedHtml(classText)) {
      markCtecAccessDenied("fetcher-instructor: class POST");
      throw new CtecAccessDeniedError();
    }
    if (isAuthResponse(classText)) throw new CaesarAuthRequiredError(classActionUrl);

    const blueraUrl = extractBlueraUrl(classText);
    resolved.push(seedToEntry(row, blueraUrl, null));
  }

  return { rows: resolved, pendingRowCount };
}

function buildInstructorResultsUrl(
  subjectCode: string,
  careerCode: string
): string {
  const url = new URL(
    "/psc/csnu/EMPLOYEE/SA/c/NWCT.NW_CT_PUB_RSLT_FL.GBL",
    CAESAR_ORIGIN
  );
  // Page=NW_CTEC_RSLT2_FL matches the page id CAESAR's own Teacher-search
  // UI navigates to (per the URL observed when browsing the instructor
  // directory). CHOIC=T flags this as Teacher mode; CHOIC=C is Course mode.
  url.searchParams.set("Page", "NW_CTEC_RSLT2_FL");
  url.searchParams.set("NW_CTEC_SRCH_CHOIC", "T");
  url.searchParams.set("ACAD_CAREER", careerCode);
  url.searchParams.set("SUBJECT", subjectCode);
  url.searchParams.set("NoCrumbs", "yes");
  url.searchParams.set("PortalKeyStruct", "yes");
  return url.toString();
}

// Scans the instructor directory HTML for a row whose MYLABEL$N name
// matches the requested instructor (last-name token overlap, same as
// instructorMatches). Returns the corresponding MYLINK$N action id.
function findInstructorActionId(
  html: string,
  instructor: string
): string | null {
  const actionIds = extractActionIds(html, "MYLINK");
  for (const actionId of actionIds) {
    const index = actionId.match(/\$(\d+)$/)?.[1];
    if (!index) continue;
    const name = extractFieldValue(html, `MYLABEL$${index}`);
    if (!name) continue;
    if (instructorMatches(name, instructor)) return actionId;
  }
  return null;
}

function seedToEntry(
  row: CtecRowSeed,
  blueraUrl: string | null,
  error: string | null
): CtecIndexedEntry {
  return {
    actionId: row.actionId,
    term: row.term,
    description: row.description,
    instructor: row.instructor,
    blueraUrl,
    error: error ?? (blueraUrl ? null : "No Bluera URL found"),
    searchText: normalizeSearch(
      [row.term, row.description, row.instructor].join(" ")
    )
  };
}

function buildRowKey(term: string, description: string, instructor: string): string {
  return [
    normalizeSearch(term),
    normalizeSearch(description),
    normalizeSearch(instructor)
  ].join("|");
}

// Stored in CtecSubjectIndex.courseState alongside per-course discovery
// states. The `_instructor:` prefix keeps it out of the namespace
// fetcher.ts uses for `${catalogNumber}|${instructor}` keys — those start
// with digits, so a key starting with `_instructor:` can't collide.
// Exported so reports.ts can read pendingRowCount + the exploration
// marker without redefining the key format and risking drift.
export function buildInstructorStateKey(instructor: string): string {
  return `_instructor:${normalizeSearch(instructor)}`;
}

export type InstructorDiscoveryResult =
  | { state: "found"; rows: CtecRowSeed[] }
  | { state: "no-access" }
  | { state: "not-found" }
  | { state: "auth-required"; loginUrl: string }
  | { state: "error"; message: string };

// In-memory cache keyed on (subject, normalized-instructor). Same
// shape and lifetime semantics as the course-side cache in fetcher.ts.
const instructorDiscoveryCache = new Map<string, InstructorDiscoveryResult>();

function instructorDiscoveryCacheKey(subject: string, instructor: string): string {
  return `${subject}|${normalizeSearch(instructor)}`;
}

// Persists instructor-discovery row sets onto the subject index so
// reloading the tab doesn't force the T-endpoint scrape to run again.
// Empty arrays represent a confirmed "discovery ran, nothing for this
// instructor in the subject" — distinct from a missing key, which
// means we haven't discovered yet.
function readPersistedInstructorDiscovery(
  subject: string,
  instructor: string
): CtecRowSeed[] | null {
  const index = readSubjectIndex(subject);
  if (!index?.instructorDiscovery) return null;
  const rows = index.instructorDiscovery[normalizeSearch(instructor)];
  return Array.isArray(rows) ? rows : null;
}

function writePersistedInstructorDiscovery(
  subject: string,
  instructor: string,
  rows: CtecRowSeed[]
): void {
  const existing = readSubjectIndex(subject);
  const base = existing ?? createEmptySubjectIndex(subject);
  const next: Record<string, CtecRowSeed[]> = {
    ...(base.instructorDiscovery ?? {}),
    [normalizeSearch(instructor)]: rows
  };
  writeSubjectIndex(subject, { ...base, instructorDiscovery: next });
}

// Lightweight discovery: enumerates every section this instructor has
// taught in `subject` via the NW_CTEC_SRCH_CHOIC=T directory. Returns
// raw row seeds (term + description + instructor + actionId) without
// resolving Bluera URLs. Used by the dry-run dialog's choose stage to
// show how many sections exist and to seed the pick stage.
export async function discoverInstructorRows(
  params: CtecLinkParams
): Promise<InstructorDiscoveryResult> {
  const key = instructorDiscoveryCacheKey(params.subject, params.instructor);
  const cached = instructorDiscoveryCache.get(key);
  if (cached) return cached;

  const persisted = readPersistedInstructorDiscovery(
    params.subject,
    params.instructor
  );
  if (persisted !== null) {
    const result: InstructorDiscoveryResult =
      persisted.length === 0
        ? { state: "not-found" }
        : { state: "found", rows: persisted };
    instructorDiscoveryCache.set(key, result);
    return result;
  }

  const result = await runPeopleSoftTask(
    "background",
    () => discoverInstructorRowsInternal(params),
    {
      owner: REQUEST_OWNER,
      label: `Discover sections by ${params.instructor}`
    }
  );
  if (result.state === "found") {
    instructorDiscoveryCache.set(key, result);
    writePersistedInstructorDiscovery(
      params.subject,
      params.instructor,
      result.rows
    );
  } else if (result.state === "not-found") {
    instructorDiscoveryCache.set(key, result);
    writePersistedInstructorDiscovery(params.subject, params.instructor, []);
  }
  return result;
}

async function discoverInstructorRowsInternal(
  params: CtecLinkParams
): Promise<InstructorDiscoveryResult> {
  if (isCtecAccessDenied()) return { state: "no-access" };
  if (getCtecAccessStatus() === "unknown") {
    await probeCtecAccess();
    if (isCtecAccessDenied()) return { state: "no-access" };
  }

  try {
    return await withSilentAuthRecovery(
      () => discoverInstructorRowsCore(params),
      isCaesarAuthRequiredError
    );
  } catch (error) {
    if (isCtecAccessDeniedError(error)) return { state: "no-access" };
    if (isCaesarAuthRequiredError(error)) {
      return { state: "auth-required", loginUrl: error.loginUrl };
    }
    return {
      state: "error",
      message: error instanceof Error ? error.message : "Discovery failed."
    };
  }
}

async function discoverInstructorRowsCore(
  params: CtecLinkParams
): Promise<InstructorDiscoveryResult> {
  const { subject, instructor, catalogNumber } = params;
  const candidates = resolveCareerCandidates(subject, catalogNumber);

  let lastError: string | null = null;
  for (const candidate of candidates) {
    try {
      const rows = await discoverInstructorRowsForCareer(
        subject,
        candidate,
        instructor
      );
      if (rows.length > 0) return { state: "found", rows };
    } catch (e) {
      if (isCaesarAuthRequiredError(e) || isCtecAccessDeniedError(e)) throw e;
      lastError = e instanceof Error ? e.message : "Failed to load CTEC page.";
    }
  }
  if (lastError) return { state: "error", message: lastError };
  return { state: "not-found" };
}

// Discovery-only variant of fetchInstructorRows — same directory GET +
// instructor action POST + class-row collection, but stops before any
// Bluera fetches.
async function discoverInstructorRowsForCareer(
  subject: string,
  career: string,
  instructor: string
): Promise<CtecRowSeed[]> {
  const directoryUrl = buildInstructorResultsUrl(subject, career);
  const response = await fetchPeopleSoftGetResult(directoryUrl, {
    timeoutMs: CTEC_FETCH_TIMEOUT_MS
  });
  if (isUnauthorizedStatus(response.status)) {
    throw new CaesarAuthRequiredError(directoryUrl);
  }
  const html = response.text;
  if (isCtecUnauthorizedHtml(html)) {
    markCtecAccessDenied("discover-instructor: directory GET");
    throw new CtecAccessDeniedError();
  }
  if (isAuthResponse(html)) throw new CaesarAuthRequiredError(directoryUrl);

  const doc = new DOMParser().parseFromString(html, "text/html");
  const form = doc.forms.namedItem("win0");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Could not parse CTEC directory form.");
  }

  const actionUrl = resolveActionUrl(form.action);
  const baseParams = serializeForm(form);

  const instructorActionId = findInstructorActionId(html, instructor);
  if (!instructorActionId) return [];

  const listResponse = await fetchPeopleSoftResult(
    actionUrl,
    buildActionParams(baseParams, instructorActionId),
    { timeoutMs: CTEC_FETCH_TIMEOUT_MS }
  );
  if (isUnauthorizedStatus(listResponse.status)) {
    throw new CaesarAuthRequiredError(actionUrl);
  }
  const listHtml = listResponse.text;
  if (isCtecUnauthorizedHtml(listHtml)) {
    markCtecAccessDenied("discover-instructor: list POST");
    throw new CtecAccessDeniedError();
  }
  if (isAuthResponse(listHtml)) throw new CaesarAuthRequiredError(actionUrl);

  const classRows = collectClassRowsFromText(listHtml);
  return classRows
    .filter((r) => instructorMatches(r.instructor, instructor))
    .sort((a, b) => termToSortKey(b.term) - termToSortKey(a.term));
}

function buildFoundResult(
  entries: CtecIndexedEntry[],
  hasMore = false
): CtecLinkData {
  const withUrls = entries
    .filter((e): e is CtecIndexedEntry & { blueraUrl: string } => !!e.blueraUrl)
    .map<CtecLinkEntry>((e) => ({
      term: e.term,
      url: e.blueraUrl,
      instructor: e.instructor,
      description: e.description
    }))
    .sort((a, b) => termToSortKey(b.term) - termToSortKey(a.term));

  if (withUrls.length === 0) return { state: "not-found" };

  return {
    state: "found",
    entries: withUrls,
    totalCount: entries.length,
    incomplete: entries.some((e) => e.error === "Fetch failed"),
    hasMore
  };
}

function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}
