import { normalizeSearch } from "../../ctec-index/helpers";
import { readSubjectIndex, writeSubjectIndex } from "../../ctec-index/storage";
import type {
  CtecIndexedEntry,
  CtecReportChart,
  CtecReportCommentGroup,
  CtecReportHoursMetric,
  CtecReportScalarMetric,
  CtecReportSummary
} from "../../ctec-index/types";
import { fetchTextResultViaBackground } from "../../remote-fetch";
import { getCurrentPeopleSoftTaskSignal } from "../../peoplesoft/traffic";
import { extractChartFromImage } from "../paper-ctec/chart-extract";
import { fetchCtecLinksBackground, readCoursePendingRowCount } from "./fetcher";
import { CTEC_AUTH_URL, NOT_FOUND_ACTION_ID } from "./constants";
import { entryMatchesCourse, isAuthResponse, termToSortKey } from "./helpers";
import type { CtecLinkParams } from "./types";

export type CtecAggregateMetric = {
  mean: number;
  totalResponses: number;
  evaluationCount: number;
};

export type CtecReportAggregate = {
  evaluationCount: number;
  parsedCount: number;
  aggregateEvaluationCount: number;
  aggregateParsedCount: number;
  maxEntriesUsed: number | null;
  windowTerms: string[];
  latestTerm: string | null;
  latestUrl: string | null;
  allFetched: boolean;
  partial: boolean;
  metrics: {
    instruction?: CtecAggregateMetric;
    course?: CtecAggregateMetric;
    learned?: CtecAggregateMetric;
    challenging?: CtecAggregateMetric;
    stimulating?: CtecAggregateMetric;
    hours?: CtecAggregateMetric;
  };
};

export type CtecCourseAnalyticsEntry = {
  term: string;
  description: string;
  instructor: string;
  url: string | null;
  status: "ready" | "pending" | "unavailable";
  metrics: CtecReportSummary["metrics"];
  charts: CtecReportChart[];
  commentGroups: CtecReportCommentGroup[];
};

export type CtecCourseAnalytics = {
  recentAggregate: CtecReportAggregate;
  entries: CtecCourseAnalyticsEntry[];
  allFetched: boolean;
  // Persisted count of class rows the most recent PeopleSoft discovery saw
  // that we haven't fetched yet. Survives reloads so the modal can keep
  // "Load N more (M left)" accurate without doing another discovery probe
  // just to find out.
  pendingDiscoveryCount: number;
};

export type CtecReportAggregateResult =
  | { state: "found"; aggregate: CtecReportAggregate }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export type CtecCourseAnalyticsResult =
  | { state: "found"; analytics: CtecCourseAnalytics }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

type FetchCtecReportAggregateOptions = {
  fetchLimit?: number;
  aggregateLimit?: number;
};

type EnsureReportEntriesResult =
  | { state: "found"; entries: CtecIndexedEntry[] }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export async function fetchCtecReportAggregate(
  params: CtecLinkParams,
  titleHint?: string,
  onProgress?: (message: string) => void,
  options: FetchCtecReportAggregateOptions = {}
): Promise<CtecReportAggregateResult> {
  const result = await ensureReportEntries(params, titleHint, onProgress, {
    fetchLimit: options.fetchLimit
  });
  if (result.state !== "found") return result;

  return {
    state: "found",
    aggregate: buildReportAggregate(result.entries, {
      aggregateLimit: options.aggregateLimit
    })
  };
}

export async function fetchCtecCourseAnalytics(
  params: CtecLinkParams,
  titleHint?: string,
  recentAggregateLimit?: number,
  onProgress?: (message: string) => void,
  fetchLimit?: number,
  forceRefreshLinks?: boolean
): Promise<CtecCourseAnalyticsResult> {
  const result = await ensureReportEntries(params, titleHint, onProgress, {
    fetchLimit,
    forceRefreshLinks
  });
  if (result.state !== "found") return result;

  return {
    state: "found",
    analytics: buildCourseAnalytics(
      result.entries,
      recentAggregateLimit,
      readPendingRowCountFor(params)
    )
  };
}

export function getCtecCourseAnalyticsSnapshot(
  params: CtecLinkParams,
  titleHint?: string,
  recentAggregateLimit?: number
): CtecCourseAnalytics | null {
  const entries = getIndexedEntriesForCourse(params, titleHint);
  if (entries.length === 0) return null;
  return buildCourseAnalytics(
    entries,
    recentAggregateLimit,
    readPendingRowCountFor(params)
  );
}

function readPendingRowCountFor(params: CtecLinkParams): number {
  return readCoursePendingRowCount(
    readSubjectIndex(params.subject),
    params.catalogNumber,
    params.instructor
  );
}

// Cache-only aggregate: returns a CtecReportAggregate from the subject index
// if any of the top recentTerms entries already have a parsed reportSummary.
// Returns null when nothing useful is cached, so callers can show a "Load CTEC"
// placeholder instead of triggering network traffic.
export function getCachedReportAggregate(
  params: CtecLinkParams,
  titleHint: string | undefined,
  recentTerms: number
): CtecReportAggregate | null {
  const entries = sortEntries(getIndexedEntriesForCourse(params, titleHint));
  if (entries.length === 0) return null;

  const window = entries.slice(0, recentTerms);
  const hasAnyParsed = window.some((entry) => entry.reportSummary !== undefined);
  if (!hasAnyParsed) return null;

  return buildReportAggregate(entries, { aggregateLimit: recentTerms });
}

// Existence-only variant of getCachedReportAggregate. Skips the
// buildReportAggregate cost for callers (e.g. side-card sync) that only
// need to know whether *any* parsed report is cached for this course.
export function hasCachedReportAggregate(
  params: CtecLinkParams,
  titleHint: string | undefined,
  recentTerms: number
): boolean {
  const entries = sortEntries(getIndexedEntriesForCourse(params, titleHint));
  if (entries.length === 0) return false;
  const window = entries.slice(0, recentTerms);
  return window.some((entry) => entry.reportSummary !== undefined);
}

export function parseCtecReportHtml(
  html: string,
  url: string
): CtecReportSummary | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(doc.querySelectorAll<HTMLElement>(".report-block"));
  if (blocks.length === 0) return null;

  const metrics: CtecReportSummary["metrics"] = {};
  const charts: CtecReportChart[] = [];
  const commentGroups: CtecReportCommentGroup[] = [];

  for (const block of blocks) {
    const question = cleanText(
      block.querySelector<HTMLElement>(".ReportBlockTitle")?.textContent
    );
    if (!question) continue;

    charts.push(...parseCharts(block, question, url));

    const commentGroup = parseCommentGroup(block, question);
    if (commentGroup) commentGroups.push(commentGroup);

    const kind = classifyQuestion(question);
    if (!kind) continue;

    if (kind === "hours") {
      const hoursMetric = parseHoursMetric(block);
      if (hoursMetric) metrics.hours = hoursMetric;
      continue;
    }

    const scalarMetric = parseScalarMetric(block);
    if (!scalarMetric) continue;

    if (kind === "instruction") metrics.instruction = scalarMetric;
    if (kind === "course") metrics.course = scalarMetric;
    if (kind === "learned") metrics.learned = scalarMetric;
    if (kind === "challenging") metrics.challenging = scalarMetric;
    if (kind === "stimulating") metrics.stimulating = scalarMetric;
  }

  if (!hasAnyMetrics(metrics) && charts.length === 0 && commentGroups.length === 0) {
    return null;
  }

  return {
    url,
    parsedAt: Date.now(),
    metrics,
    charts,
    commentGroups
  };
}

function getIndexedEntriesForCourse(
  params: CtecLinkParams,
  titleHint?: string
): CtecIndexedEntry[] {
  const index = readSubjectIndex(params.subject);
  if (!index) return [];

  const baseEntries = index.entries.filter((entry) =>
    entry.actionId !== NOT_FOUND_ACTION_ID &&
    entry.blueraUrl &&
    entryMatchesCourse(entry, params.subject, params.catalogNumber, params.instructor)
  );

  return selectEntriesForTitle(baseEntries, titleHint);
}

async function ensureReportEntries(
  params: CtecLinkParams,
  titleHint?: string,
  onProgress?: (message: string) => void,
  options: { fetchLimit?: number; forceRefreshLinks?: boolean } = {}
): Promise<EnsureReportEntriesResult> {
  const links = await fetchCtecLinksBackground(params, options.forceRefreshLinks ?? false, onProgress);
  if (links.state !== "found") return links;

  let entries = sortEntries(getIndexedEntriesForCourse(params, titleHint));
  if (entries.length === 0) {
    return { state: "not-found" };
  }

  const relevantEntries =
    options.fetchLimit && options.fetchLimit > 0
      ? entries.slice(0, options.fetchLimit)
      : entries;
  const missing = relevantEntries.filter(
    (entry) => entry.blueraUrl && entry.reportSummary === undefined
  );

  for (let index = 0; index < missing.length; index++) {
    const entry = missing[index]!;
    const url = entry.blueraUrl;
    if (!url) continue;

    onProgress?.(`Reading evaluation ${index + 1}/${missing.length}…`);

    const response = await fetchTextResultViaBackground(url, {
      method: "GET",
      signal: getCurrentPeopleSoftTaskSignal() ?? undefined
    });
    if (isAuthResponse(response.text)) {
      return { state: "auth-required", loginUrl: url };
    }
    if (response.status === 401 || response.status === 403) {
      return { state: "auth-required", loginUrl: CTEC_AUTH_URL };
    }
    if (response.status < 200 || response.status >= 300) {
      return { state: "error", message: `Request failed (${response.status}).` };
    }

    const summary = parseCtecReportHtml(response.text, url);
    if (summary) {
      await extractChartCountsForSummary(
        summary,
        getCurrentPeopleSoftTaskSignal() ?? undefined
      );
    }
    cacheReportSummary(params.subject, url, summary);
  }

  entries = sortEntries(getIndexedEntriesForCourse(params, titleHint));
  return {
    state: "found",
    entries
  };
}

function selectEntriesForTitle(
  entries: CtecIndexedEntry[],
  titleHint?: string
): CtecIndexedEntry[] {
  const normalizedHint = normalizeSearch(titleHint ?? "");
  if (!normalizedHint) return entries;

  const distinctTitles = new Set(entries.map((entry) => extractShortTitle(entry.description)));
  if (distinctTitles.size <= 1) return entries;

  const tokens = normalizedHint.split(" ").filter((token) => token.length >= 4);
  if (tokens.length === 0) return entries;

  const filtered = entries.filter((entry) => {
    const haystack = normalizeSearch(`${entry.description} ${extractShortTitle(entry.description)}`);
    const overlap = tokens.filter((token) => haystack.includes(token)).length;
    return overlap >= Math.min(2, tokens.length);
  });

  return filtered.length > 0 ? filtered : entries;
}

// Keyed by blueraUrl (the report's stable identity), NOT actionId —
// PeopleSoft `MYLINK1$N` indices are response-local and routinely
// collide across course fetches, which would splatter one course's
// summary across another's entries.
function cacheReportSummary(
  subjectCode: string,
  blueraUrl: string,
  reportSummary: CtecReportSummary | null
): void {
  const index = readSubjectIndex(subjectCode);
  if (!index) return;

  let changed = false;
  const nextEntries = index.entries.map((entry) => {
    if (entry.blueraUrl !== blueraUrl) return entry;
    changed = true;
    return { ...entry, reportSummary };
  });

  if (!changed) return;
  writeSubjectIndex(subjectCode, {
    ...index,
    entries: nextEntries
  });
}

function buildReportAggregate(
  entries: CtecIndexedEntry[],
  options: { aggregateLimit?: number } = {}
): CtecReportAggregate {
  const sorted = sortEntries(entries);
  const aggregateEntries =
    options.aggregateLimit && options.aggregateLimit > 0
      ? sorted.slice(0, options.aggregateLimit)
      : sorted;
  const summaries = aggregateEntries
    .map((entry) => entry.reportSummary)
    .filter((summary): summary is CtecReportSummary => !!summary && hasAnyMetrics(summary.metrics));
  const parsedCount = sorted.filter(
    (entry) => !!entry.reportSummary && hasAnyMetrics(entry.reportSummary.metrics)
  ).length;

  return {
    evaluationCount: sorted.length,
    parsedCount,
    aggregateEvaluationCount: aggregateEntries.length,
    aggregateParsedCount: summaries.length,
    maxEntriesUsed: options.aggregateLimit ?? null,
    windowTerms: aggregateEntries.map((entry) => entry.term),
    latestTerm: sorted[0]?.term ?? null,
    latestUrl: sorted[0]?.blueraUrl ?? null,
    allFetched: sorted.every((entry) => entry.reportSummary !== undefined),
    partial: summaries.length < aggregateEntries.length,
    metrics: {
      instruction: aggregateMetric(summaries, (summary) => summary.metrics.instruction),
      course: aggregateMetric(summaries, (summary) => summary.metrics.course),
      learned: aggregateMetric(summaries, (summary) => summary.metrics.learned),
      challenging: aggregateMetric(summaries, (summary) => summary.metrics.challenging),
      stimulating: aggregateMetric(summaries, (summary) => summary.metrics.stimulating),
      hours: aggregateMetric(summaries, (summary) => summary.metrics.hours)
    }
  };
}

function buildCourseAnalytics(
  entries: CtecIndexedEntry[],
  recentAggregateLimit?: number,
  pendingDiscoveryCount = 0
): CtecCourseAnalytics {
  const sorted = sortEntries(entries);
  const aggregateLimit =
    recentAggregateLimit && recentAggregateLimit > 0 ? recentAggregateLimit : undefined;

  return {
    recentAggregate: buildReportAggregate(sorted, {
      aggregateLimit
    }),
    pendingDiscoveryCount,
    entries: sorted.map((entry) => ({
      term: entry.term,
      description: entry.description,
      instructor: entry.instructor,
      url: entry.blueraUrl,
      status:
        entry.reportSummary === undefined
          ? "pending"
          : entry.reportSummary
            ? "ready"
            : "unavailable",
      metrics: entry.reportSummary?.metrics ?? {},
      charts: entry.reportSummary?.charts ?? [],
      commentGroups: entry.reportSummary?.commentGroups ?? []
    })),
    allFetched: sorted.every((entry) => entry.reportSummary !== undefined)
  };
}

// Response-count-weighted mean over an arbitrary collection. Used by both
// the schedule-card chip aggregation here and the analytics-modal KPI
// strip (modal/overview.ts:recentMean) so the two surfaces are guaranteed
// to land on the exact same number for the same window of terms. Single
// source of truth for the aggregation formula.
export type WeightedSample = { mean: number; responseCount: number };

export function weightedMean<T>(
  samples: Iterable<T>,
  pick: (sample: T) => WeightedSample | undefined
): { mean: number; totalResponses: number; evaluationCount: number } {
  let weightedTotal = 0;
  let totalResponses = 0;
  let evaluationCount = 0;
  for (const sample of samples) {
    const metric = pick(sample);
    if (!metric) continue;
    weightedTotal += metric.mean * metric.responseCount;
    totalResponses += metric.responseCount;
    evaluationCount += 1;
  }
  return {
    mean: totalResponses > 0 ? weightedTotal / totalResponses : 0,
    totalResponses,
    evaluationCount
  };
}

function aggregateMetric(
  summaries: CtecReportSummary[],
  pick: (
    summary: CtecReportSummary
  ) => CtecReportScalarMetric | CtecReportHoursMetric | undefined
): CtecAggregateMetric | undefined {
  const result = weightedMean(summaries, (summary) => pick(summary));
  if (result.totalResponses <= 0 || result.evaluationCount <= 0) return undefined;
  return {
    mean: result.mean,
    totalResponses: result.totalResponses,
    evaluationCount: result.evaluationCount
  };
}

function parseScalarMetric(block: HTMLElement): CtecReportScalarMetric | undefined {
  let mean: number | null = null;
  let responseCount: number | null = null;

  for (const row of Array.from(block.querySelectorAll<HTMLTableRowElement>("table.block-table tbody tr"))) {
    const label = cleanText(row.querySelector("th")?.textContent);
    const value = cleanText(row.querySelector("td")?.textContent);
    if (!label || !value) continue;

    if (normalizeSearch(label) === "response count") {
      responseCount = parseNumber(value);
      continue;
    }

    if (normalizeSearch(label) === "mean") {
      mean = parseNumber(value);
    }
  }

  if (mean === null || responseCount === null) return undefined;
  return { mean, responseCount };
}

function parseHoursMetric(block: HTMLElement): CtecReportHoursMetric | undefined {
  let weightedTotal = 0;
  let responseCount = 0;
  const buckets: { label: string; count: number }[] = [];

  for (const row of Array.from(block.querySelectorAll<HTMLTableRowElement>("table.block-table tbody tr"))) {
    const option = cleanText(row.querySelector("th")?.textContent);
    const value = cleanText(row.querySelector("td")?.textContent);
    if (!option || !value) continue;
    if (normalizeSearch(option).includes("respondent")) continue;

    const count = parseNumber(value);
    const representativeHours = estimateHoursForOption(option);
    if (count === null || representativeHours === null) continue;

    weightedTotal += representativeHours * count;
    responseCount += count;
    buckets.push({ label: option, count });
  }

  if (responseCount <= 0) return undefined;
  return {
    mean: weightedTotal / responseCount,
    responseCount,
    buckets
  };
}

// Pre-extract integer bar counts from each Bluera chart PNG so the modal
// can render the histogram synchronously later. Mutates summary.charts in
// place; failures are silently dropped (the renderer still has on-demand
// fallback for charts without counts). Charts run in parallel per report —
// all reports remain sequential to keep traffic ordered.
async function extractChartCountsForSummary(
  summary: CtecReportSummary,
  signal?: AbortSignal
): Promise<void> {
  await Promise.all(
    summary.charts.map(async (chart) => {
      if (chart.counts) return;
      const kind = classifyQuestion(chart.question);
      if (!kind) return;
      const metric = summary.metrics[kind];
      if (!metric || metric.responseCount <= 0) return;
      const result = await extractChartFromImage(
        chart.imageUrl,
        metric.responseCount,
        signal
      );
      if (result.ok) chart.counts = result.data.counts;
    })
  );
}

function parseCharts(
  block: HTMLElement,
  question: string,
  url: string
): CtecReportChart[] {
  return Array.from(block.querySelectorAll<HTMLImageElement>(".FrequencyBlock_chart img"))
    .map((image) => {
      const src = image.getAttribute("src")?.trim();
      if (!src) return null;

      try {
        return {
          question,
          imageUrl: new URL(src, url).toString(),
          alt: cleanText(image.getAttribute("alt")) || null
        };
      } catch {
        return null;
      }
    })
    .filter((chart): chart is CtecReportChart => !!chart);
}

function parseCommentGroup(
  block: HTMLElement,
  prompt: string
): CtecReportCommentGroup | null {
  const comments = Array.from(block.querySelectorAll<HTMLElement>(".CommentBlockRow td"))
    .map((cell) => extractRichText(cell))
    .filter(Boolean);

  if (comments.length === 0) return null;
  return { prompt, comments };
}

export function classifyQuestion(
  question: string
): "instruction" | "course" | "learned" | "challenging" | "stimulating" | "hours" | null {
  const normalized = normalizeSearch(question);

  if (normalized.includes("overall rating of the instruction")) return "instruction";
  if (normalized.includes("overall rating of the course")) return "course";
  if (normalized.includes("estimate how much you learned")) return "learned";
  if (normalized.includes("challenging you intellectually")) return "challenging";
  if (normalized.includes("stimulating your interest in the subject")) return "stimulating";
  if (normalized.includes("average number of hours per week")) return "hours";
  return null;
}

function estimateHoursForOption(option: string): number | null {
  const normalized = cleanText(option).replace(/[–—]/g, "-");
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1] ?? "");
    const end = parseFloat(rangeMatch[2] ?? "");
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return (start + end) / 2;
    }
  }

  const fewerMatch = normalized.match(/(\d+(?:\.\d+)?)\s+or\s+fewer/i);
  if (fewerMatch) {
    const end = parseFloat(fewerMatch[1] ?? "");
    if (Number.isFinite(end)) return end / 2;
  }

  const moreMatch = normalized.match(/(\d+(?:\.\d+)?)\s+or\s+more/i);
  if (moreMatch) {
    const start = parseFloat(moreMatch[1] ?? "");
    if (Number.isFinite(start)) return start;
  }

  return null;
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? null;
  if (!normalized) return null;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function extractRichText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  for (const br of Array.from(clone.querySelectorAll("br"))) {
    br.replaceWith("\n");
  }

  return (clone.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractShortTitle(description: string): string {
  const stripped = description.replace(/^\S+\s+[\d][\d-]*\s*/, "").trim();
  const colonIndex = stripped.lastIndexOf(":");
  return colonIndex >= 0 ? stripped.slice(colonIndex + 1).trim() : stripped;
}

function sortEntries(entries: CtecIndexedEntry[]): CtecIndexedEntry[] {
  return [...entries].sort(
    (left, right) => termToSortKey(right.term) - termToSortKey(left.term)
  );
}

function hasAnyMetrics(metrics: CtecReportSummary["metrics"]): boolean {
  return Object.values(metrics).some((value) => !!value);
}
