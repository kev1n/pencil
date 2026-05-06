import { html, svg, type SVGTemplateResult, type TemplateResult } from "lit-html";

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
import { preventAndStop, ratingStarsTemplate } from "../ui-shared";
import { pickMetricHue } from "../widget-chips";
import { bandLabelFor } from "./band-labels";
import { renderDistChart, renderTrendChart } from "./charts";
import { abbrTerm } from "../term-format";
import { cardTemplate, pickSelectedTerm } from "./common";
import { renderHeatmap } from "./heatmap";
import type { Section } from "./section";
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

function trendValuesFor(
  trendTerms: ModalTerm[],
  kind: ModalMetricKind
): number[] {
  const out: number[] = [];
  for (const term of trendTerms) {
    const v = term.metrics[kind];
    if (typeof v === "number") out.push(v);
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

// Value portion of a KPI as a chip-style pill. Pure template so lit-html
// can diff in place across re-renders — important because the modal
// re-syncs on every paper.nu DOM mutation tick (RAF-debounced) and
// imperative DOM nodes splatted into templates would be replaced every
// render, destroying click targets mid-click.
function kpiPillTemplate(
  value: number,
  kind: ModalMetricKind | "global"
): TemplateResult {
  const isHours = kind === "hours";
  const isRating = !isHours;
  const showStars = isRating && value > 0 && isStarMode();
  const isEmpty = value <= 0;

  let className = "bc-paper-ctec-modal-kpi-mean";
  if (showStars) className += " is-stars";
  if (isEmpty) className += " is-empty";

  // Skip the colored chip background when stars are showing — the stars
  // already encode the value, and the tinted pill behind them visually
  // duplicates the signal. Mirrors the schedule-card chip behavior, which
  // also drops `tone` in stars mode (see widget-chips.ts metricChip).
  let styleStr = "";
  if (value > 0 && !showStars) {
    const max = isHours
      ? PAPER_CTEC_CONFIG.aggregate.hoursGraphMax
      : PAPER_CTEC_CONFIG.aggregate.ratingScaleMax;
    const hue = pickMetricHue(value, max, isHours);
    styleStr =
      `--bc-paper-ctec-kpi-bg: hsla(${hue}, 96%, 68%, 0.98);` +
      `--bc-paper-ctec-kpi-bg-dark: hsla(${hue}, 78%, 32%, 0.94);` +
      `--bc-paper-ctec-kpi-border: hsla(${hue}, 82%, 24%, 0.38);` +
      `--bc-paper-ctec-kpi-border-dark: hsla(${hue}, 90%, 78%, 0.28);` +
      `--bc-paper-ctec-kpi-fg: hsl(${hue}, 62%, 18%);` +
      `--bc-paper-ctec-kpi-fg-dark: var(--bc-color-kpi-fg-dark);`;
  }

  let inner: TemplateResult | string;
  if (showStars) {
    inner = ratingStarsTemplate(value);
  } else if (value > 0) {
    inner = isHours ? value.toFixed(1) : formatChipRating(value);
  } else {
    inner = "—";
  }

  return html`<span class=${className} style=${styleStr}>${inner}</span>`;
}

// Small explanatory line above the KPI strip so the user knows the
// headline numbers are scoped to the most recent N terms (and that the
// scope is configurable in extension settings). Adapts copy to the actual
// number of loaded terms — if fewer than N are loaded, says so honestly.
function renderKpiScopeNote(
  data: ModalDisplayData,
  recent: number
): TemplateResult {
  const effective = Math.min(recent, data.terms.length);
  const term = effective === 1 ? "term" : "terms";
  if (effective < recent) {
    return html`<div class="bc-paper-ctec-modal-kpi-scope">
      <strong>Averages below cover all ${effective} loaded ${term}</strong>
      (recent-terms aggregation set to ${recent} in extension settings).
    </div>`;
  }
  return html`<div class="bc-paper-ctec-modal-kpi-scope">
    <strong
      >Averages below use the most recent ${effective} ${term}.</strong
    >
    Adjust the “Recent terms aggregation” number in the extension popup to
    widen or narrow the window.
  </div>`;
}

const GLOBAL_KPI_TOOLTIP =
  "Global = average of the Instruction, Course, and Learned mean ratings (each 0–6). Excludes Challenge and Interest because they're descriptive rather than quality signals, and excludes Hours because it's a different scale.";

export type OverviewSectionProps = {
  doc: Document;
  data: ModalDisplayData;
  state: AnalyticsModalState;
  callbacks: AnalyticsModalCallbacks;
};

// Overview tab. KPI strip selects a view: a specific metric (instruction,
// course, learned, challenge, interest, hours) or "Global" — the global
// view replaces the per-metric trend + distribution with the heatmap and
// the cross-metric experimental charts (stacked + trend-lines). The
// workload-distribution card stays visible in both views as a stable
// reference for the hours data.
export const OverviewSection: Section<OverviewSectionProps> = {
  render({ doc, data, state, callbacks }) {
    const recent = getRecentAggregationTerms();
    return html`<div class="bc-paper-ctec-modal-overview">
      ${renderKpiScopeNote(data, recent)}
      ${renderKpiStrip(data, state, callbacks, recent)}
      ${state.activeMetric === "global"
        ? html`${renderGlobalSection(doc, data, state, callbacks)}${renderWorkloadCard(
            doc,
            data
          )}`
        : renderMetricSection(doc, data, state, state.activeMetric)}
    </div>`;
  }
};

// Per-metric body: trend + selected-term distribution. Always shown when a
// metric category (not Global) is active.
function renderMetricSection(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  metric: ModalMetricKind
): TemplateResult {
  const selectedTerm = pickSelectedTerm(data, state.selectedTermId);
  return html`<div class="bc-paper-ctec-modal-charts">
    ${cardTemplate(
      `Trend · ${data.terms.length} ${data.terms.length === 1 ? "term" : "terms"}`,
      `${MODAL_METRIC_LABELS[metric]}${
        metric === "hours" ? " · hrs/wk" : " · mean rating"
      }`,
      renderTrendChart(doc, data, metric)
    )}
    ${cardTemplate(
      "Distribution",
      selectedTerm ? `${selectedTerm.term} · ${selectedTerm.responses} responses` : "",
      renderDistChart(doc, selectedTerm, metric, data)
    )}
  </div>`;
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
): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-global-section">
    ${cardTemplate(
      "Term × Metric heatmap",
      "Shading scaled within these terms only",
      renderHeatmap(doc, data, state, callbacks)
    )}
  </div>`;
}

function renderWorkloadCard(doc: Document, data: ModalDisplayData): TemplateResult {
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
    const latestAbbr = abbrTerm(latestTerm.term) || "LATEST";
    hoursSeries.push({
      label:
        typeof latestMean === "number"
          ? `${latestAbbr} ${latestMean.toFixed(1)}h`
          : latestAbbr,
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

  const right = showBoth && latestTerm
    ? `${latestTerm.term} vs ${data.terms.length}-term avg${
        aggregateTotal > 0
          ? ` · ${aggregateTotal.toLocaleString()} responses`
          : ""
      }`
    : `Self-reported hours per week, across ${data.terms.length} ${
        data.terms.length === 1 ? "term" : "terms"
      }${aggregateTotal > 0 ? ` · ${aggregateTotal.toLocaleString()} responses` : ""}`;

  return cardTemplate(
    "Workload distribution",
    right,
    renderHoursDensity(doc, hoursSeries)
  );
}

// KPI strip: each gestalt grouping is rendered as a labeled rectangle that
// holds its KPI cards. Groups in order:
//   [Overall: Global] [Quality: Inst, Course, Learn] [Character: Chal, Int]
//   [Workload: Hours]
// The outer grid sizes each group proportionally to its card count so card
// widths stay roughly consistent across groups.
function renderKpiStrip(
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  recent: number
): TemplateResult {
  const groups: Array<{ label: string; cards: TemplateResult[] }> = [
    {
      label: "Overall",
      cards: [renderGlobalKpiCard(data, state, callbacks, recent)]
    },
    {
      label: "Quality",
      cards: (["instruction", "course", "learned"] as const).map((kind) =>
        renderKpiCard(kind, data, state, callbacks, recent)
      )
    },
    {
      label: "Character",
      cards: (["challenging", "stimulating"] as const).map((kind) =>
        renderKpiCard(kind, data, state, callbacks, recent)
      )
    },
    {
      label: "Workload",
      cards: [renderKpiCard("hours", data, state, callbacks, recent)]
    }
  ];

  // Set column templates via CSS custom properties (not inline
  // grid-template-columns) so the responsive media queries in
  // styles/modal-charts.ts can override them at narrow widths.
  const stripStyle = `--bc-paper-ctec-kpi-cols: ${groups
    .map((group) => `${group.cards.length}fr`)
    .join(" ")}`;

  return html`<div class="bc-paper-ctec-modal-kpi-strip" style=${stripStyle}>
    ${groups.map(
      (group) => html`<div class="bc-paper-ctec-modal-kpi-group">
        <div class="bc-paper-ctec-modal-kpi-group-label">${group.label}</div>
        <div
          class="bc-paper-ctec-modal-kpi-group-cards"
          style=${`--bc-paper-ctec-kpi-card-cols: repeat(${group.cards.length}, minmax(0, 1fr))`}
        >${group.cards}</div>
      </div>`
    )}
  </div>`;
}

// Per-metric KPI card. Pure template — see kpiPillTemplate's comment for
// why imperative DOM here would break clickability.
function renderKpiCard(
  kind: ModalMetricKind,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  recent: number
): TemplateResult {
  const trend = trendValuesFor(data.trendTerms, kind);
  const meanValue = recentMean(data.terms, kind, recent);
  const isActive = state.activeMetric === kind;
  const className = `bc-paper-ctec-modal-kpi${isActive ? " is-active" : ""}`;
  const unitText = kpiUnitText(kind);
  const band =
    Number.isFinite(meanValue) && meanValue > 0 ? bandLabelFor(kind, meanValue) : null;

  return html`<button
    type="button"
    class=${className}
    @click=${(event: Event) => {
      preventAndStop(event);
      callbacks.onMetricChange(kind);
    }}
  ><div class="bc-paper-ctec-modal-kpi-top"><span
        class="bc-paper-ctec-modal-kpi-label"
        >${MODAL_METRIC_LABELS[kind]}</span
      >${trend.length >= 2 ? sparklineTemplate(trend, 80, 20, kind) : ""}</div
    ><div class="bc-paper-ctec-modal-kpi-value"
      >${kpiPillTemplate(meanValue, kind)}${
        unitText
          ? html`<span class="bc-paper-ctec-modal-kpi-scale">${unitText}</span>`
          : ""
      }</div
    >${
      band ? html`<span class="bc-paper-ctec-modal-kpi-band">${band}</span>` : ""
    }</button>`;
}

// "Global" KPI card. Value is the avg of the Instruction / Course / Learned
// mean ratings across the most-recent N terms (matches the chip
// aggregation), plus a sparkline of the same per-term average so the trend
// is visible at a glance. Clicking switches the body to the global view.
function renderGlobalKpiCard(
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  recent: number
): TemplateResult {
  const isActive = state.activeMetric === "global";

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
  const trend = data.trendTerms
    .map((term) => computeGlobalMean([term]))
    .filter((value) => value > 0);

  const className = `bc-paper-ctec-modal-kpi is-global${isActive ? " is-active" : ""}`;
  const unitText = kpiUnitText("global");
  const band =
    Number.isFinite(overallMean) && overallMean > 0
      ? bandLabelFor("global", overallMean)
      : null;

  return html`<button
    type="button"
    class=${className}
    @click=${(event: Event) => {
      preventAndStop(event);
      callbacks.onMetricChange("global" satisfies ModalActiveView);
    }}
  ><div class="bc-paper-ctec-modal-kpi-top"><span
        class="bc-paper-ctec-modal-kpi-label-group"
        ><span class="bc-paper-ctec-modal-kpi-label">Global</span><span
          class="bc-paper-ctec-modal-kpi-info bc-tooltip-host"
          aria-label=${GLOBAL_KPI_TOOLTIP}
          tabindex="0"
          @click=${preventAndStop}
          >i<span class="bc-tooltip bc-tooltip--rich"
            >${GLOBAL_KPI_TOOLTIP}</span
          ></span
        ></span
      >${trend.length >= 2 ? sparklineTemplate(trend, 80, 20, "global") : ""}</div
    ><div class="bc-paper-ctec-modal-kpi-value"
      >${kpiPillTemplate(overallMean, "global")}${
        unitText
          ? html`<span class="bc-paper-ctec-modal-kpi-scale">${unitText}</span>`
          : ""
      }</div
    >${
      band ? html`<span class="bc-paper-ctec-modal-kpi-band">${band}</span>` : ""
    }</button>`;
}

// Padded scale: shows trend shape without faking magnitude. A 5.0 → 5.2
// trend sits in the upper region rather than filling the whole chart.
// The padding (1 rating unit, 4 hours) leaves visible breathing room
// above and below the line, clamped to the metric's natural bounds.
function sparklineTemplate(
  values: number[],
  width: number,
  height: number,
  kind: ModalMetricKind | "global"
): SVGTemplateResult {
  const isHours = kind === "hours";
  const scaleMin = isHours ? 0 : 1;
  const scaleMax = isHours ? 20 : 6;
  const padding = isHours ? 4 : 1;
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const yMin = Math.max(scaleMin, Math.floor(dataMin) - padding);
  const yMax = Math.min(scaleMax, Math.ceil(dataMax) + padding);
  const span = yMax - yMin || 1;

  const xAt = (i: number) => (i / Math.max(1, values.length - 1)) * width;
  const yAt = (v: number) =>
    height - 1 - ((v - yMin) / span) * (height - 2);

  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const lastIdx = values.length - 1;
  const lastX = xAt(lastIdx);
  const lastY = yAt(values[lastIdx]!);

  return svg`<svg
    width=${width}
    height=${height}
    class="bc-paper-ctec-modal-sparkline"
  ><polyline
      fill="none"
      style="stroke: var(--bc-color-accent)"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      points=${points}
    ></polyline><circle
      cx=${lastX}
      cy=${lastY}
      r="2"
      style="fill: var(--bc-color-accent)"
    ></circle></svg>`;
}

// Backwards-compat for callers still on the imperative entry point.
export function renderOverview(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return OverviewSection.render({ doc, data, state, callbacks });
}
