import {
  classifyQuestion,
  type CtecCourseAnalytics,
  type CtecCourseAnalyticsEntry
} from "../ctec-links/reports";
import type { CtecReportChart } from "../../ctec-index/types";
import type { CtecLinkParams } from "../ctec-links/types";
import { collectComments } from "./modal-comments";
import { readModalCache, writeModalCache } from "./modal-cache";
import { aggregateTopics } from "./modal-topics";

export type ModalMetricKind =
  | "instruction"
  | "course"
  | "learned"
  | "challenging"
  | "stimulating"
  | "hours";

export const MODAL_RATING_METRICS: ReadonlyArray<
  Exclude<ModalMetricKind, "hours">
> = ["instruction", "course", "learned", "challenging", "stimulating"];

export const MODAL_METRIC_LABELS: Record<ModalMetricKind, string> = {
  instruction: "Instruction",
  course: "Course",
  learned: "Learned",
  challenging: "Challenge",
  stimulating: "Interest",
  hours: "Hours"
};

// The three rating metrics that compose the Global KPI: instruction
// quality, course rating, and amount learned. Excludes "challenging" and
// "stimulating" (descriptive, not quality signals) and "hours" (different
// scale). Shared by the KPI card and the heatmap so both compute the
// Global score the same way.
export const GLOBAL_KPI_METRICS = ["instruction", "course", "learned"] as const;

// Avg of the GLOBAL_KPI_METRICS means across the supplied terms. Each
// metric's contribution is its own mean across those terms (not a per-term
// mean of all metrics) so a course missing one of the three on some term
// doesn't double-penalize. Returns 0 if no relevant data exists.
export function computeGlobalMean(terms: ModalTerm[]): number {
  const perMetricValues: number[] = [];
  for (const kind of GLOBAL_KPI_METRICS) {
    const values = terms
      .map((term) => term.metrics[kind])
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) continue;
    perMetricValues.push(values.reduce((sum, v) => sum + v, 0) / values.length);
  }
  if (perMetricValues.length === 0) return 0;
  return perMetricValues.reduce((sum, v) => sum + v, 0) / perMetricValues.length;
}

export const MODAL_METRIC_SCALES: Record<ModalMetricKind, number> = {
  instruction: 6,
  course: 6,
  learned: 6,
  challenging: 6,
  stimulating: 6,
  hours: 20
};

export type ModalMetricSummary = {
  mean: number;
  trend: number[]; // oldest → newest
  scale: number;
};

export type ModalChart = {
  imageUrl: string;
  alt: string | null;
  // Pre-extracted integer bar counts from the source PNG, captured at CTEC
  // load time. Lets the histogram render synchronously without an on-demand
  // image fetch. Undefined for entries cached before pre-extraction landed
  // or when extraction failed at load time.
  counts?: number[];
};

export type ModalHoursBucket = { label: string; count: number };

export type ModalTerm = {
  id: string;
  term: string;
  instructor: string;
  description: string;
  responses: number;
  reportUrl: string | null;
  metrics: Partial<Record<ModalMetricKind, number>>;
  // Per-metric response count (= the "[ Total (N) ]" shown inside the chart
  // image). Distinct from `responses`, which is the max across metrics.
  // Used as the integer total when extracting counts from a chart PNG.
  metricResponseCounts: Partial<Record<ModalMetricKind, number>>;
  // Chart images sourced directly from the parsed CTEC report. Optional per
  // metric — if a chart isn't in the source HTML, the modal shows a
  // "no chart available" placeholder instead of synthesizing one.
  charts: Partial<Record<ModalMetricKind, ModalChart>>;
  // Real per-bucket counts for the hours-per-week table. Empty when the
  // entry was cached before parseHoursMetric started capturing buckets — the
  // modal degrades to the chart image in that case.
  hoursBuckets: ModalHoursBucket[];
};

export type ModalCommentTone = "pos" | "neu" | "mix" | "neg";

export type ModalComment = {
  term: string;
  instructor: string;
  prompt: string;
  text: string;
  topics: string[];
  tone: ModalCommentTone;
  length: number;
};

export type ModalCourseInfo = {
  subject: string;
  catalog: string;
  title: string;
  instructor: string;
  sectionTerm: string;
  reportUrl: string | null;
};

export type ModalDisplayData = {
  course: ModalCourseInfo;
  terms: ModalTerm[]; // newest-first
  trendTerms: ModalTerm[]; // oldest-first
  responses: number;
  metrics: Record<ModalMetricKind, ModalMetricSummary>;
  // Aggregate hours buckets summed across loaded terms. Empty when no term
  // has parsed buckets (old cache); the modal hides the workload strip in
  // that case rather than displaying fake data.
  aggregateHoursBuckets: ModalHoursBucket[];
  comments: ModalComment[];
  topics: ModalTopicEntry[];
};

// Per-topic aggregate: how many comments contain this phrase, and the
// sentiment distribution among those comments. Lets the rail show a small
// tone bar so users can see at a glance whether mentions of "office hours"
// skew positive or critical.
export type ModalTopicEntry = {
  label: string;
  count: number;
  sentiments: Record<ModalCommentTone, number>;
};

// Memoized wrapper for buildModalDisplayData. The modal's sync() loop calls
// this on every interaction (tab change, filter, sort, refresh tick), and
// the comments-tab work — bigram/trigram extraction in collectComments and
// per-comment sentiment scoring — dominates that cost. The signature
// captures everything that can shift the result: identity inputs plus, per
// entry, the url/status/comment-counts that change when a new term loads or
// a background refresh adds evaluations. Backed by a chrome.storage.local
// LRU in modal-cache.ts so repeat opens across page reloads stay fast.

function modalCacheKey(params: CtecLinkParams, titleHint: string): string {
  return `${params.subject}|${params.catalogNumber}|${params.instructor}|${titleHint}`;
}

function snapshotSignature(snapshot: CtecCourseAnalytics): string {
  const parts: string[] = [];
  for (const entry of snapshot.entries) {
    let commentCount = 0;
    for (const group of entry.commentGroups) commentCount += group.comments.length;
    parts.push(
      `${entry.url ?? ""}#${entry.status}#${entry.commentGroups.length}#${commentCount}`
    );
  }
  return parts.join("|");
}

export function buildModalDisplayData(
  snapshot: CtecCourseAnalytics,
  params: CtecLinkParams,
  titleHint: string
): ModalDisplayData | null {
  const key = modalCacheKey(params, titleHint);
  const signature = snapshotSignature(snapshot);
  const hit = readModalCache(key, signature);
  if (hit) return hit.result;
  const result = buildModalDisplayDataUncached(snapshot, params, titleHint);
  writeModalCache(key, signature, result);
  return result;
}

function buildModalDisplayDataUncached(
  snapshot: CtecCourseAnalytics,
  params: CtecLinkParams,
  titleHint: string
): ModalDisplayData | null {
  const instructor = params.instructor;
  const allEntries = snapshot.entries.filter(
    (entry) => entry.status === "ready"
  );
  const scopedEntries = allEntries.filter(
    (entry) => normalize(entry.instructor) === normalize(instructor)
  );

  const entries = scopedEntries.length > 0 ? scopedEntries : allEntries;
  if (entries.length === 0) return null;

  const terms = entries.map((entry, index) => buildModalTerm(entry, index));
  const trendTerms = [...terms].reverse();

  const metrics = buildMetricSummaries(trendTerms);
  const aggregateHoursBuckets = aggregateHoursBucketsFor(terms);
  const comments = collectComments(entries, params, titleHint);
  const topics = aggregateTopics(comments);
  const responses = terms.reduce((sum, term) => sum + term.responses, 0);

  const titleParts = titleHint
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const courseTitle = titleParts[titleParts.length - 1] ?? titleHint.trim();

  return {
    course: {
      subject: params.subject,
      catalog: params.catalogNumber,
      title: courseTitle,
      instructor,
      sectionTerm: terms[0]?.term ?? "",
      reportUrl: terms[0]?.reportUrl ?? null
    },
    terms,
    trendTerms,
    responses,
    metrics,
    aggregateHoursBuckets,
    comments,
    topics
  };
}

function buildModalTerm(
  entry: CtecCourseAnalyticsEntry,
  index: number
): ModalTerm {
  const responses = entryResponses(entry);
  const metrics: Partial<Record<ModalMetricKind, number>> = {};
  const metricResponseCounts: Partial<Record<ModalMetricKind, number>> = {};
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as const) {
    const metric = entry.metrics[kind];
    if (metric) {
      metrics[kind] = metric.mean;
      if (metric.responseCount > 0) metricResponseCounts[kind] = metric.responseCount;
    }
  }

  const charts = mapChartsToMetrics(entry.charts);
  const hoursBuckets = entry.metrics.hours?.buckets ?? [];

  return {
    id: `${entry.term || "term"}-${index}`,
    term: entry.term,
    instructor: entry.instructor,
    description: entry.description,
    responses,
    reportUrl: entry.url,
    metrics,
    metricResponseCounts,
    charts,
    hoursBuckets
  };
}

// Maps the parsed CTEC chart images onto our metric kinds via the same
// question-text classifier the report parser uses internally. Charts that
// don't match a known metric (free-form Likert questions, demographic
// breakdowns) are dropped — they don't fit anywhere in the modal.
function mapChartsToMetrics(
  charts: CtecReportChart[]
): Partial<Record<ModalMetricKind, ModalChart>> {
  const out: Partial<Record<ModalMetricKind, ModalChart>> = {};
  for (const chart of charts) {
    const kind = classifyQuestion(chart.question);
    if (!kind) continue;
    // Only keep the first chart per metric — reports occasionally include
    // duplicate visuals for the same question.
    if (out[kind as ModalMetricKind]) continue;
    out[kind as ModalMetricKind] = {
      imageUrl: chart.imageUrl,
      alt: chart.alt,
      counts: chart.counts
    };
  }
  return out;
}

function buildMetricSummaries(
  trendTerms: ModalTerm[]
): Record<ModalMetricKind, ModalMetricSummary> {
  const out = {} as Record<ModalMetricKind, ModalMetricSummary>;
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as const) {
    const trend: number[] = [];
    for (const term of trendTerms) {
      const value = term.metrics[kind];
      if (typeof value === "number") trend.push(value);
    }
    const mean = trend.length > 0
      ? trend.reduce((sum, value) => sum + value, 0) / trend.length
      : 0;
    out[kind] = { mean, trend, scale: MODAL_METRIC_SCALES[kind] };
  }
  return out;
}

// Sums per-bucket counts across loaded terms, keyed by bucket label so we
// don't depend on every term having identical bucket lists. Returns [] when
// no term has parsed buckets — the modal hides the workload strip rather
// than showing a row of zeros.
function aggregateHoursBucketsFor(terms: ModalTerm[]): ModalHoursBucket[] {
  const totals = new Map<string, number>();
  const order: string[] = [];
  for (const term of terms) {
    for (const bucket of term.hoursBuckets) {
      if (!totals.has(bucket.label)) order.push(bucket.label);
      totals.set(bucket.label, (totals.get(bucket.label) ?? 0) + bucket.count);
    }
  }
  if (totals.size === 0) return [];
  return order.map((label) => ({ label, count: totals.get(label) ?? 0 }));
}

function entryResponses(entry: CtecCourseAnalyticsEntry): number {
  const counts: number[] = [];
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as const) {
    const metric = entry.metrics[kind];
    if (metric?.responseCount) counts.push(metric.responseCount);
  }
  if (counts.length === 0) {
    const totalComments = entry.commentGroups.reduce(
      (sum, group) => sum + group.comments.length,
      0
    );
    return totalComments;
  }
  return Math.max(...counts);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
