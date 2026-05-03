import {
  applyResponseState,
  buildActionParams,
  buildSubjectResultsUrl,
  collectClassRowsFromText,
  collectCourseRows,
  dedupeEntries,
  extractBlueraUrl,
  extractPostUrl,
  normalizeSearch,
  resolveActionUrl,
  serializeForm
} from "../ctec-navigation/helpers";
import { readSubjectIndex, writeSubjectIndex } from "../ctec-navigation/storage";
import type { CtecIndexedEntry, CtecSubjectIndex } from "../ctec-navigation/types";
import {
  fetchPeopleSoftGetResult,
  fetchPeopleSoftResult
} from "../../peoplesoft/http";
import { runPeopleSoftTask } from "../../peoplesoft";
import { CTEC_AUTH_URL, REQUEST_OWNER } from "./constants";
import { courseDescMatchesCatalog, entryMatchesCourse, extractLastNameTokens, isAuthResponse, termToSortKey } from "./helpers";
import type { CtecLinkData, CtecLinkEntry, CtecLinkParams } from "./types";

const NOT_FOUND_ACTION_ID = "BC_NOT_FOUND";

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
  const { subject, catalogNumber, instructor, career } = params;

  // 1. Check cache (skip on force refresh).
  const cachedIndex = readSubjectIndex(subject);
  if (!forceRefresh && cachedIndex) {
    const cached = cachedIndex.entries.filter((e) =>
      entryMatchesCourse(e, subject, catalogNumber, instructor)
    );
    if (cached.length > 0) {
      return buildFoundResult(cached);
    }
  }

  // 2. Fetch the course's class entries from PeopleSoft.
  onProgress?.("Connecting to CTEC\u2026");
  let fetchResult = await fetchCourseEntries(subject, catalogNumber, career, instructor, onProgress);

  // Career fallback: 400–499 courses start as UGRD but may also live in TGS.
  const catalogNum = parseInt(catalogNumber, 10);
  if (fetchResult.type === "not-found" && career === "UGRD" && catalogNum >= 400 && catalogNum < 500) {
    onProgress?.("Trying graduate section\u2026");
    fetchResult = await fetchCourseEntries(subject, catalogNumber, "TGS", instructor, onProgress);
  }

  if (fetchResult.type === "auth") {
    return { state: "auth-required", loginUrl: fetchResult.loginUrl };
  }
  if (fetchResult.type === "error") {
    return { state: "error", message: fetchResult.message };
  }
  if (fetchResult.type === "not-found") {
    writeSentinel(subject, catalogNumber, instructor, readSubjectIndex(subject));
    return { state: "not-found" };
  }

  // 3. Merge new entries into existing subject index.
  const existingEntries = cachedIndex?.entries ?? [];
  // On force refresh, drop old entries for this course before merging — but
  // first copy any cached reportSummary onto the freshly-fetched entries so
  // we don't have to re-pull reports for terms we've already parsed.
  const newEntries = forceRefresh
    ? preserveReportSummaries(fetchResult.entries, existingEntries, subject, catalogNumber, instructor)
    : fetchResult.entries;
  const base = forceRefresh
    ? existingEntries.filter((e) => !entryMatchesCourse(e, subject, catalogNumber, instructor))
    : existingEntries;
  const merged = dedupeEntries([...base, ...newEntries]);
  writeSubjectIndex(subject, {
    subjectCode: subject,
    subjectLabel: cachedIndex?.subjectLabel ?? subject,
    builtAt: cachedIndex?.builtAt ?? Date.now(),
    sourceUrl: cachedIndex?.sourceUrl ?? window.location.href,
    entries: merged
  });

  // 4. Filter for this course+instructor.
  const matches = fetchResult.entries.filter((e) =>
    entryMatchesCourse(e, subject, catalogNumber, instructor)
  );
  if (matches.length === 0) {
    writeSentinel(subject, catalogNumber, instructor, readSubjectIndex(subject));
    return { state: "not-found" };
  }
  return buildFoundResult(matches);
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
  return buildFoundResult(matches);
}

function buildFoundResult(entries: CtecIndexedEntry[]): CtecLinkData {
  // Exclude sentinel entries from display and count.
  const real = entries.filter((e) => e.actionId !== NOT_FOUND_ACTION_ID);
  const sorted = [...real].sort((a, b) => termToSortKey(b.term) - termToSortKey(a.term));

  const withUrls: CtecLinkEntry[] = sorted
    .filter((e): e is CtecIndexedEntry & { blueraUrl: string } => e.blueraUrl !== null)
    .map((e) => ({ term: e.term, url: e.blueraUrl, instructor: e.instructor, description: e.description }));

  if (withUrls.length === 0) return { state: "not-found" };

  // Mark incomplete if any entries failed to fetch (cancelled mid-run).
  const incomplete = real.some((e) => e.error === "Fetch failed");

  return { state: "found", entries: withUrls, totalCount: real.length, incomplete };
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
  | { type: "entries"; entries: CtecIndexedEntry[] }
  | { type: "auth"; loginUrl: string }
  | { type: "not-found" }
  | { type: "error"; message: string };

async function fetchCourseEntries(
  subject: string,
  catalogNumber: string,
  career: string,
  instructor: string,
  onProgress?: (msg: string) => void
): Promise<FetchCourseResult> {
  const resultsUrl = buildSubjectResultsUrl(subject, career);
  let html: string;
  let resultsLoginUrl = CTEC_AUTH_URL;
  try {
    const response = await fetchPeopleSoftGetResult(resultsUrl, { owner: REQUEST_OWNER });
    resultsLoginUrl = response.finalUrl || CTEC_AUTH_URL;
    if (isUnauthorizedStatus(response.status)) {
      return { type: "auth", loginUrl: CTEC_AUTH_URL };
    }
    html = response.text;
  } catch (e) {
    return { type: "error", message: e instanceof Error ? e.message : "Failed to load CTEC page." };
  }

  if (isAuthResponse(html)) return { type: "auth", loginUrl: resultsLoginUrl };

  const doc = new DOMParser().parseFromString(html, "text/html");
  const form = doc.forms.namedItem("win0");
  if (!(form instanceof HTMLFormElement)) {
    return { type: "error", message: "Could not parse CTEC form." };
  }

  const actionUrl = resolveActionUrl(form.action);
  const baseParams = serializeForm(form);

  onProgress?.("Finding course\u2026");
  const courseRows = collectCourseRows(doc);
  const targetCourse = courseRows.find((c) =>
    courseDescMatchesCatalog(c.description, catalogNumber)
  );
  if (!targetCourse) return { type: "not-found" };

  let courseResponse: string;
  let courseLoginUrl = CTEC_AUTH_URL;
  try {
    const response = await fetchPeopleSoftResult(
      actionUrl,
      buildActionParams(baseParams, targetCourse.actionId),
      { owner: REQUEST_OWNER }
    );
    courseLoginUrl = response.finalUrl || CTEC_AUTH_URL;
    if (isUnauthorizedStatus(response.status)) {
      return { type: "auth", loginUrl: CTEC_AUTH_URL };
    }
    courseResponse = response.text;
  } catch (e) {
    return { type: "error", message: e instanceof Error ? e.message : "Failed to load course." };
  }

  if (isAuthResponse(courseResponse)) return { type: "auth", loginUrl: courseLoginUrl };

  const allClassRows = collectClassRowsFromText(courseResponse);
  if (allClassRows.length === 0) return { type: "not-found" };

  const instrLastNames = extractLastNameTokens(instructor);
  const classRows =
    instrLastNames.length > 0
      ? allClassRows.filter((r) => {
          const rParts = r.instructor.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ");
          const rLast = rParts[rParts.length - 1] ?? "";
          return instrLastNames.some((ln) => rLast === ln);
        })
      : allClassRows;

  const classParams = applyResponseState(baseParams, courseResponse);
  const classActionUrl = extractPostUrl(courseResponse) ?? actionUrl;

  const total = classRows.length;
  const resultEntries: CtecIndexedEntry[] = [];
  for (let i = 0; i < classRows.length; i++) {
    const row = classRows[i]!;
    onProgress?.(`Loading evaluation ${i + 1}/${total}\u2026`);

    let classResponse: string;
    let classLoginUrl = CTEC_AUTH_URL;
    try {
      const response = await fetchPeopleSoftResult(
        classActionUrl,
        buildActionParams(classParams, row.actionId),
        { owner: REQUEST_OWNER }
      );
      classLoginUrl = response.finalUrl || CTEC_AUTH_URL;
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

    if (isAuthResponse(classResponse)) return { type: "auth", loginUrl: classLoginUrl };

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

  return { type: "entries", entries: resultEntries };
}

function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

// Carries cached reportSummary forward across a force-refresh so a "check for
// new CTECs" pass only needs to fetch reports for entries we haven't seen yet.
// Match by actionId — that's the stable identifier from PeopleSoft for a
// specific term/section combo.
function preserveReportSummaries(
  newEntries: CtecIndexedEntry[],
  existingEntries: CtecIndexedEntry[],
  subject: string,
  catalogNumber: string,
  instructor: string
): CtecIndexedEntry[] {
  const oldByActionId = new Map<string, CtecIndexedEntry>();
  for (const e of existingEntries) {
    if (entryMatchesCourse(e, subject, catalogNumber, instructor)) {
      oldByActionId.set(e.actionId, e);
    }
  }
  return newEntries.map((entry) => {
    const old = oldByActionId.get(entry.actionId);
    if (old?.reportSummary !== undefined) {
      return { ...entry, reportSummary: old.reportSummary };
    }
    return entry;
  });
}
