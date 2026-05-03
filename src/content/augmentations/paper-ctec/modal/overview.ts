import {
  renderHoursDensity,
  type HoursDensitySeries
} from "../hours-density";
import { weightedMean } from "../../ctec-links/reports";
import {
  GLOBAL_KPI_METRICS,
  MODAL_METRIC_LABELS,
  MODAL_METRIC_SCALES,
  computeGlobalMean,
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { getRecentAggregationTerms, isFeatureEnabled } from "../../../settings";
import { PAPER_CTEC_CONFIG } from "../config";
import { COMPACT_CARD_STARS_FEATURE_ID } from "../constants";
import { formatChipRating, isRatingPercentMode } from "../rating-format";
import { attachTooltip, createRatingStars, preventAndStop } from "../ui-shared";
import { pickMetricHue } from "../widget-chips";
import { renderDistChart, renderTrendChart } from "./charts";
import { pickSelectedTerm, renderCard } from "./common";
import { renderHeatmap } from "./heatmap";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalState,
  ModalActiveView
} from "./types";

function isStarMode(): boolean {
  return isFeatureEnabled(COMPACT_CARD_STARS_FEATURE_ID);
}

// Response-count-weighted average of one metric across the most-recent
// N terms (newest-first slice of data.terms). Routed through the shared
// `weightedMean` helper in ctec-links/reports.ts — the same helper the
// schedule-card chip aggregation uses — so chip and KPI are guaranteed
// to land on the exact same number for the same window.
function recentMean(
  terms: ModalTerm[],
  kind: ModalMetricKind,
  recent: number
): number {
  return weightedMean(terms.slice(0, recent), (term) => {
    const value = term.metrics[kind];
    const responses = term.metricResponseCounts[kind] ?? 0;
    if (typeof value !== "number" || responses <= 0) return undefined;
    return { mean: value, responseCount: responses };
  }).mean;
}

// Per-term {value, term} pairs for one metric, oldest → newest, restricted
// to the most-recent N. Used for the KPI sparkline + delta so they describe
// the same window as the headline number — and so the delta caption can
// name the actual term it's comparing against (instead of saying a generic
// "vs recent term" that leaves users guessing whether a missing-data term
// silently shifted the comparison).
function recentTrendEntries(
  trendTerms: ModalTerm[],
  kind: ModalMetricKind,
  recent: number
): Array<{ value: number; term: ModalTerm }> {
  // trendTerms is oldest-first, so the recent N are the LAST N.
  const slice =
    recent >= trendTerms.length ? trendTerms : trendTerms.slice(-recent);
  const out: Array<{ value: number; term: ModalTerm }> = [];
  for (const term of slice) {
    const v = term.metrics[kind];
    if (typeof v === "number") out.push({ value: v, term });
  }
  return out;
}

// Suffix shown next to the KPI pill. Hidden in stars mode (the stars
// already convey the scale) and in percent mode (the "/ 6" denominator
// is meaningless when the value is a percent).
function kpiUnitText(kind: ModalMetricKind | "global"): string {
  if (kind === "hours") return "h/wk avg";
  if (isStarMode()) return "";
  if (isRatingPercentMode()) return "avg";
  const max = kind === "global" ? 6 : MODAL_METRIC_SCALES[kind];
  return `/ ${max} avg`;
}

// Renders the value portion of a KPI as a chip-style pill: same hue
// palette and the same bg/border/fg vars the schedule-card chips use
// (see widget-chips.ts buildCompactChipTone). Honors the same two toggles
// the mini viewer respects:
//   - COMPACT_CARD_STARS_FEATURE_ID → stars instead of the number (rating
//     metrics only; hours never use stars)
//   - RATING_PERCENT_FEATURE_ID → "92%" instead of "5.5" (via
//     formatChipRating)
// When value <= 0 the pill stays neutral (no tone vars) so "no data"
// reads as muted rather than colored.
function renderKpiPill(
  doc: Document,
  value: number,
  kind: ModalMetricKind | "global"
): HTMLElement {
  const pill = doc.createElement("span");
  pill.className = "bc-paper-ctec-modal-kpi-mean";

  const isHours = kind === "hours";
  const isRating = !isHours;
  const showStars = isRating && value > 0 && isStarMode();

  if (showStars) {
    pill.classList.add("is-stars");
    pill.append(createRatingStars(doc, value));
  } else if (value > 0) {
    pill.textContent = isHours ? value.toFixed(1) : formatChipRating(value);
  } else {
    pill.textContent = "—";
    pill.classList.add("is-empty");
  }

  // Skip the colored chip background when stars are showing — the stars
  // already encode the value, and the tinted pill behind them visually
  // duplicates the signal. Mirrors the schedule-card chip behavior, which
  // also drops `tone` in stars mode (see widget-chips.ts metricChip).
  if (value > 0 && !showStars) {
    const max = isHours
      ? PAPER_CTEC_CONFIG.aggregate.hoursGraphMax
      : PAPER_CTEC_CONFIG.aggregate.ratingScaleMax;
    const hue = pickMetricHue(value, max, isHours);
    pill.style.setProperty("--bc-paper-ctec-kpi-bg", `hsla(${hue}, 96%, 68%, 0.98)`);
    pill.style.setProperty("--bc-paper-ctec-kpi-bg-dark", `hsla(${hue}, 78%, 32%, 0.94)`);
    pill.style.setProperty("--bc-paper-ctec-kpi-border", `hsla(${hue}, 82%, 24%, 0.38)`);
    pill.style.setProperty("--bc-paper-ctec-kpi-border-dark", `hsla(${hue}, 90%, 78%, 0.28)`);
    pill.style.setProperty("--bc-paper-ctec-kpi-fg", `hsl(${hue}, 62%, 18%)`);
    pill.style.setProperty("--bc-paper-ctec-kpi-fg-dark", "#f9fafb");
  }

  return pill;
}

// Small explanatory line above the KPI strip so the user knows the
// headline numbers are scoped to the most recent N terms (and that the
// scope is configurable in extension settings). Adapts copy to the actual
// number of loaded terms — if fewer than N are loaded, says so honestly.
function renderKpiScopeNote(
  doc: Document,
  data: ModalDisplayData,
  recent: number
): HTMLElement {
  const note = doc.createElement("div");
  note.className = "bc-paper-ctec-modal-kpi-scope";
  const effective = Math.min(recent, data.terms.length);
  const term = effective === 1 ? "term" : "terms";
  const lead = doc.createElement("strong");
  if (effective < recent) {
    lead.textContent = `Averages below cover all ${effective} loaded ${term}`;
    note.append(
      lead,
      doc.createTextNode(
        ` (recent-terms aggregation set to ${recent} in extension settings).`
      )
    );
  } else {
    lead.textContent = `Averages below use the most recent ${effective} ${term}.`;
    note.append(
      lead,
      doc.createTextNode(
        " Adjust the “Recent terms aggregation” number in the extension popup to widen or narrow the window."
      )
    );
  }
  return note;
}

const GLOBAL_KPI_TOOLTIP =
  "Global = average of the Instruction, Course, and Learned mean ratings (each 0–6). Excludes Challenge and Interest because they're descriptive rather than quality signals, and excludes Hours because it's a different scale.";

// Overview tab. KPI strip selects a view: a specific metric (instruction,
// course, learned, challenge, interest, hours) or "Global" — the global
// view replaces the per-metric trend + distribution with the heatmap and
// the cross-metric experimental charts (stacked + trend-lines). The
// workload-distribution card stays visible in both views as a stable
// reference for the hours data.
export function renderOverview(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const root = doc.createElement("div");
  root.className = "bc-paper-ctec-modal-overview";

  const recent = getRecentAggregationTerms();
  const effectiveRecent = Math.min(recent, data.terms.length);
  const showDelta = effectiveRecent >= 2;
  root.append(renderKpiScopeNote(doc, data, recent));
  root.append(renderKpiStrip(doc, data, state, callbacks, showDelta, recent));

  if (state.activeMetric === "global") {
    root.append(renderGlobalSection(doc, data, state, callbacks));
    root.append(renderWorkloadCard(doc, data));
  } else {
    root.append(renderMetricSection(doc, data, state, state.activeMetric));
  }

  return root;
}

// Per-metric body: trend + selected-term distribution. Always shown when a
// metric category (not Global) is active.
function renderMetricSection(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  metric: ModalMetricKind
): HTMLElement {
  const charts = doc.createElement("div");
  charts.className = "bc-paper-ctec-modal-charts";

  const selectedTerm = pickSelectedTerm(data, state.selectedTermId);

  const trendCard = renderCard(
    doc,
    `Trend · ${data.terms.length} ${data.terms.length === 1 ? "term" : "terms"}`,
    `${MODAL_METRIC_LABELS[metric]}${
      metric === "hours" ? " · hrs/wk" : " · mean rating"
    }`
  );
  trendCard.body.append(renderTrendChart(doc, data, metric));
  charts.append(trendCard.root);

  const distCard = renderCard(
    doc,
    "Distribution",
    selectedTerm
      ? `${selectedTerm.term} · ${selectedTerm.responses} responses`
      : ""
  );
  distCard.body.append(renderDistChart(doc, selectedTerm, metric));
  charts.append(distCard.root);

  return charts;
}

// Global body: just the heatmap. The cross-metric "stacked" and
// "trend lines" charts that used to live here were dropped — the heatmap
// already carries the per-term × per-metric shape they were trying to
// show, in a denser form.
function renderGlobalSection(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-global-section";

  const heatCard = renderCard(
    doc,
    "Term × Metric heatmap",
    "Shading scaled within these terms only"
  );
  heatCard.body.append(renderHeatmap(doc, data, state, callbacks));
  wrapper.append(heatCard.root);

  return wrapper;
}

function renderWorkloadCard(doc: Document, data: ModalDisplayData): HTMLElement {
  const aggregateTotal = data.aggregateHoursBuckets.reduce(
    (sum, b) => sum + b.count,
    0
  );
  const latestTerm = data.terms[0] ?? null;
  const latestHasBuckets = !!latestTerm && latestTerm.hoursBuckets.length > 0;
  const aggHasBuckets = data.aggregateHoursBuckets.length > 0;
  const showBoth =
    data.terms.length >= 2 && latestHasBuckets && aggHasBuckets && !!latestTerm;

  const hoursSeries: HoursDensitySeries[] = [];
  if (showBoth && latestTerm) {
    const aggMean = data.metrics.hours.mean;
    hoursSeries.push({
      label:
        aggMean > 0
          ? `HISTORICAL AVG ${aggMean.toFixed(1)}h`
          : "HISTORICAL AVG",
      buckets: data.aggregateHoursBuckets,
      mean: aggMean > 0 ? aggMean : undefined,
      style: "secondary"
    });
    const latestMean = latestTerm.metrics.hours;
    hoursSeries.push({
      label:
        typeof latestMean === "number"
          ? `LATEST ${latestMean.toFixed(1)}h`
          : "LATEST",
      buckets: latestTerm.hoursBuckets,
      mean: latestMean,
      style: "primary"
    });
  } else if (aggHasBuckets) {
    const aggMean = data.metrics.hours.mean;
    hoursSeries.push({
      label: aggMean > 0 ? `AVG ${aggMean.toFixed(1)}h` : "AVG",
      buckets: data.aggregateHoursBuckets,
      mean: aggMean > 0 ? aggMean : undefined,
      style: "primary"
    });
  }

  const hoursCard = renderCard(
    doc,
    "Workload distribution",
    showBoth && latestTerm
      ? `${latestTerm.term} vs ${data.terms.length}-term avg${
          aggregateTotal > 0
            ? ` · ${aggregateTotal.toLocaleString()} responses`
            : ""
        }`
      : `Self-reported hours per week, across ${data.terms.length} ${
          data.terms.length === 1 ? "term" : "terms"
        }${aggregateTotal > 0 ? ` · ${aggregateTotal.toLocaleString()} responses` : ""}`
  );
  hoursCard.body.append(renderHoursDensity(doc, hoursSeries));
  return hoursCard.root;
}

// KPI strip: each gestalt grouping is rendered as a labeled rectangle that
// holds its KPI cards. Groups in order:
//   [Overall: Global] [Quality: Inst, Course, Learn] [Character: Chal, Int]
//   [Workload: Hours]
// The outer grid sizes each group proportionally to its card count so card
// widths stay roughly consistent across groups.
function renderKpiStrip(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  showDelta: boolean,
  recent: number
): HTMLElement {
  const groups: Array<{
    label: string;
    cards: HTMLElement[];
  }> = [
    {
      label: "Overall",
      cards: [renderGlobalKpiCard(doc, data, state, callbacks, recent)]
    },
    {
      label: "Quality",
      cards: (["instruction", "course", "learned"] as const).map((kind) =>
        renderKpiCard(doc, kind, data, state, callbacks, showDelta, recent)
      )
    },
    {
      label: "Character",
      cards: (["challenging", "stimulating"] as const).map((kind) =>
        renderKpiCard(doc, kind, data, state, callbacks, showDelta, recent)
      )
    },
    {
      label: "Workload",
      cards: [renderKpiCard(doc, "hours", data, state, callbacks, showDelta, recent)]
    }
  ];

  const strip = doc.createElement("div");
  strip.className = "bc-paper-ctec-modal-kpi-strip";
  strip.style.gridTemplateColumns = groups
    .map((group) => `${group.cards.length}fr`)
    .join(" ");

  for (const group of groups) {
    const groupEl = doc.createElement("div");
    groupEl.className = "bc-paper-ctec-modal-kpi-group";

    const label = doc.createElement("div");
    label.className = "bc-paper-ctec-modal-kpi-group-label";
    label.textContent = group.label;
    groupEl.append(label);

    const cardsEl = doc.createElement("div");
    cardsEl.className = "bc-paper-ctec-modal-kpi-group-cards";
    cardsEl.style.gridTemplateColumns = `repeat(${group.cards.length}, 1fr)`;
    for (const card of group.cards) cardsEl.append(card);
    groupEl.append(cardsEl);

    strip.append(groupEl);
  }

  return strip;
}

function renderKpiCard(
  doc: Document,
  kind: ModalMetricKind,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  showDelta: boolean,
  recent: number
): HTMLElement {
  const trendEntries = recentTrendEntries(data.trendTerms, kind, recent);
  const trend = trendEntries.map((entry) => entry.value);
  const meanValue = recentMean(data.terms, kind, recent);
  const lastEntry = trendEntries[trendEntries.length - 1] ?? null;
  const prevEntry =
    trendEntries.length >= 2 ? trendEntries[trendEntries.length - 2] : null;
  const last = lastEntry?.value ?? null;
  const prev = prevEntry?.value ?? null;
  const delta = prev != null && last != null ? last - prev : 0;
  const positive = kind === "hours" ? delta <= 0 : delta >= 0;
  const isActive = state.activeMetric === kind;

  const button = doc.createElement("button");
  button.type = "button";
  button.className = `bc-paper-ctec-modal-kpi${isActive ? " is-active" : ""}`;
  button.addEventListener("click", (event) => {
    preventAndStop(event);
    callbacks.onMetricChange(kind);
  });

  const top = doc.createElement("div");
  top.className = "bc-paper-ctec-modal-kpi-top";

  const label = doc.createElement("span");
  label.className = "bc-paper-ctec-modal-kpi-label";
  label.textContent = MODAL_METRIC_LABELS[kind];
  top.append(label);

  if (trend.length >= 2) {
    top.append(renderSparkline(doc, trend, 56, 18));
  }
  button.append(top);

  const value = doc.createElement("div");
  value.className = "bc-paper-ctec-modal-kpi-value";
  const big = renderKpiPill(doc, meanValue, kind);
  value.append(big);
  const unitText = kpiUnitText(kind);
  if (unitText) {
    const unit = doc.createElement("span");
    unit.className = "bc-paper-ctec-modal-kpi-scale";
    unit.textContent = unitText;
    value.append(unit);
  }
  button.append(value);

  const deltaRow = doc.createElement("div");
  deltaRow.className = `bc-paper-ctec-modal-kpi-delta${
    showDelta ? (positive ? " is-positive" : " is-negative") : " is-muted"
  }`;
  if (!showDelta) {
    deltaRow.textContent = "only term taught";
  } else if (delta === 0) {
    deltaRow.textContent = "—";
  } else {
    const arrow = positive ? "▲" : "▼";
    const note = doc.createElement("span");
    note.className = "bc-paper-ctec-modal-kpi-delta-note";
    note.textContent = prevEntry ? ` vs ${prevEntry.term.term}` : " vs recent term";
    deltaRow.append(
      doc.createTextNode(`${arrow} ${Math.abs(delta).toFixed(1)}`),
      note
    );
  }
  button.append(deltaRow);

  return button;
}

// Renders the "Global" KPI card alongside the per-metric ones. Value is
// the avg of the Instruction / Course / Learned mean ratings across the
// most-recent N terms (matches the chip aggregation), plus a sparkline
// of the same per-term average so the trend is visible at a glance.
// Clicking switches the body to the global view.
function renderGlobalKpiCard(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  recent: number
): HTMLElement {
  const isActive: boolean = state.activeMetric === "global";

  const recentTerms = data.terms.slice(0, recent);
  // Build the Global mean from each component metric's response-weighted
  // mean (the same `recentMean` the per-metric KPIs use), then average
  // those across the three metrics. This keeps the Global card consistent
  // with the per-metric pills above it instead of doing its own simple
  // arithmetic mean of per-term means.
  const components: number[] = [];
  for (const kind of GLOBAL_KPI_METRICS) {
    const m = recentMean(data.terms, kind, recent);
    if (m > 0) components.push(m);
  }
  const overallMean =
    components.length > 0
      ? components.reduce((sum, v) => sum + v, 0) / components.length
      : 0;
  const recentTrendTerms =
    recent >= data.trendTerms.length
      ? data.trendTerms
      : data.trendTerms.slice(-recent);
  const globalTrendEntries = recentTrendTerms
    .map((term) => ({ value: computeGlobalMean([term]), term }))
    .filter((entry) => entry.value > 0);
  const trend = globalTrendEntries.map((entry) => entry.value);

  const button = doc.createElement("button");
  button.type = "button";
  button.className = `bc-paper-ctec-modal-kpi is-global${isActive ? " is-active" : ""}`;
  button.addEventListener("click", (event) => {
    preventAndStop(event);
    callbacks.onMetricChange("global" satisfies ModalActiveView);
  });

  const top = doc.createElement("div");
  top.className = "bc-paper-ctec-modal-kpi-top";

  const labelGroup = doc.createElement("span");
  labelGroup.className = "bc-paper-ctec-modal-kpi-label-group";

  const label = doc.createElement("span");
  label.className = "bc-paper-ctec-modal-kpi-label";
  label.textContent = "Global";
  labelGroup.append(label);

  const info = doc.createElement("span");
  info.className = "bc-paper-ctec-modal-kpi-info";
  info.setAttribute("aria-label", GLOBAL_KPI_TOOLTIP);
  info.tabIndex = 0;
  info.append(doc.createTextNode("i"));
  attachTooltip(doc, info, GLOBAL_KPI_TOOLTIP);
  // Don't propagate clicks on the info icon — it's just a tooltip target,
  // not a separate action.
  info.addEventListener("click", preventAndStop);
  labelGroup.append(info);

  top.append(labelGroup);

  if (trend.length >= 2) {
    top.append(renderSparkline(doc, trend, 56, 18));
  }
  button.append(top);

  const value = doc.createElement("div");
  value.className = "bc-paper-ctec-modal-kpi-value";
  const big = renderKpiPill(doc, overallMean, "global");
  value.append(big);
  const unitText = kpiUnitText("global");
  if (unitText) {
    const unit = doc.createElement("span");
    unit.className = "bc-paper-ctec-modal-kpi-scale";
    unit.textContent = unitText;
    value.append(unit);
  }
  button.append(value);

  const lastGlobalEntry =
    globalTrendEntries[globalTrendEntries.length - 1] ?? null;
  const prevGlobalEntry =
    globalTrendEntries.length >= 2
      ? globalTrendEntries[globalTrendEntries.length - 2]
      : null;
  const last = lastGlobalEntry?.value ?? null;
  const prev = prevGlobalEntry?.value ?? null;
  const delta = prev != null && last != null ? last - prev : 0;
  const positive = delta >= 0;
  const showDelta = recentTerms.length >= 2;

  const deltaRow = doc.createElement("div");
  deltaRow.className = `bc-paper-ctec-modal-kpi-delta${
    showDelta ? (positive ? " is-positive" : " is-negative") : " is-muted"
  }`;
  if (!showDelta) {
    deltaRow.textContent = "only term taught";
  } else if (delta === 0) {
    deltaRow.textContent = "—";
  } else {
    const arrow = positive ? "▲" : "▼";
    const note = doc.createElement("span");
    note.className = "bc-paper-ctec-modal-kpi-delta-note";
    note.textContent = prevGlobalEntry
      ? ` vs ${prevGlobalEntry.term.term}`
      : " vs recent term";
    deltaRow.append(
      doc.createTextNode(`${arrow} ${Math.abs(delta).toFixed(1)}`),
      note
    );
  }
  button.append(deltaRow);

  return button;
}

function renderSparkline(
  doc: Document,
  values: number[],
  width: number,
  height: number
): SVGElement {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xAt = (i: number) => (i / Math.max(1, values.length - 1)) * width;
  const yAt = (v: number) => height - 1 - ((v - min) / span) * (height - 2);

  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("class", "bc-paper-ctec-modal-sparkline");

  const polyline = doc.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "#66023c");
  polyline.setAttribute("stroke-width", "1.5");
  polyline.setAttribute("stroke-linecap", "round");
  polyline.setAttribute("stroke-linejoin", "round");
  polyline.setAttribute(
    "points",
    values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ")
  );
  svg.append(polyline);

  const dot = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
  const lastValue = values[values.length - 1];
  if (typeof lastValue === "number") {
    dot.setAttribute("cx", String(xAt(values.length - 1)));
    dot.setAttribute("cy", String(yAt(lastValue)));
    dot.setAttribute("r", "2");
    dot.setAttribute("fill", "#66023c");
    svg.append(dot);
  }

  return svg;
}
