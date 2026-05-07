import { html, type TemplateResult } from "lit-html";

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
// Heatmap kept around but unused — renderGlobalSection now shows
// vertical-bar averages instead of the term × metric heatmap.
// import { renderHeatmap } from "./heatmap";
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

// Suffix shown next to the KPI pill. Hidden in stars mode (the stars
// already convey the scale) and in percent mode (the "/ 6" denominator
// is meaningless when the value is a percent).
function kpiUnitText(kind: ModalMetricKind | "global"): string {
  if (kind === "hours") return "h/wk";
  if (isStarMode()) return "";
  if (isRatingPercentMode()) return "";
  const max = kind === "global" ? 6 : MODAL_METRIC_SCALES[kind];
  return `/ ${max}`;
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
  "Global Rating = average of the Instruction, Course, and Learned mean ratings (each 0–6). Excludes Challenge and Interest because they're descriptive rather than quality signals, and excludes Hours because it's a different scale.";

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
        ? html`<div class="bc-paper-ctec-modal-global-grid">
            ${renderGlobalSection(doc, data, state, callbacks)}${renderWorkloadCard(
              doc,
              data
            )}
          </div>`
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

// Global body: per-metric horizontal bars showing each metric's average
// across every loaded term. Global on top, then the six component metrics.
// Each bar's track represents the metric's full scale (6 for ratings,
// 20 for hours) shown in grey, with the actual mean filled in the primary
// accent color.
//
// Heatmap kept available via the heatmap module / re-export but no longer
// rendered here. Old call:
//   ${cardTemplate("Term × Metric heatmap",
//     "Shading scaled within these terms only",
//     renderHeatmap(doc, data, state, callbacks))}
function renderGlobalSection(
  _doc: Document,
  data: ModalDisplayData,
  _state: AnalyticsModalState,
  _callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-global-section">
    ${cardTemplate(
      "Averages across all terms",
      `${data.terms.length} ${data.terms.length === 1 ? "term" : "terms"}`,
      renderGlobalBars(data)
    )}
  </div>`;
}

const GLOBAL_BAR_METRICS: ReadonlyArray<ModalMetricKind> = [
  "instruction",
  "course",
  "learned",
  "challenging",
  "stimulating",
  "hours"
];

function renderGlobalBars(data: ModalDisplayData): TemplateResult {
  const globalMean = computeGlobalMean(data.terms);
  return html`<div class="bc-paper-ctec-modal-global-bars">
    ${renderGlobalBarRow("Global Rating", globalMean, 6, "global")}
    <div class="bc-paper-ctec-modal-global-bars-rest">
      ${GLOBAL_BAR_METRICS.map((kind) =>
        renderGlobalBarRow(
          MODAL_METRIC_LABELS[kind],
          data.metrics[kind].mean,
          MODAL_METRIC_SCALES[kind],
          kind
        )
      )}
    </div>
  </div>`;
}

function renderGlobalBarRow(
  label: string,
  value: number,
  scale: number,
  kind: ModalMetricKind | "global"
): TemplateResult {
  const pct =
    scale > 0 && value > 0 ? Math.min(100, (value / scale) * 100) : 0;
  const isHours = kind === "hours";
  const display =
    value > 0
      ? isHours
        ? `${value.toFixed(1)}h`
        : value.toFixed(1)
      : "—";
  const isGlobal = kind === "global";
  const className = `bc-paper-ctec-modal-global-bar${
    isGlobal ? " is-global" : ""
  }`;
  // Dotted gridlines at every integer between 0 and scale (excluding the
  // endpoints, which are drawn by the track outline itself).
  const tickPositions: number[] = [];
  for (let i = 1; i < scale; i++) tickPositions.push((i / scale) * 100);
  // Hue-driven fill that mirrors the KPI pill palette so the bar reads at
  // the same "good/bad" glance as the strip above. Hours invert the scale
  // (more hours = worse). Empty (value=0) rows fall back to accent via the
  // CSS var default.
  const rowStyle =
    value > 0
      ? (() => {
          const hue = pickMetricHue(value, scale, isHours);
          return (
            `--bc-paper-ctec-bar-fill: hsla(${hue}, 84%, 52%, 0.95);` +
            `--bc-paper-ctec-bar-fill-dark: hsla(${hue}, 70%, 56%, 0.92);`
          );
        })()
      : "";
  return html`<div class=${className} style=${rowStyle}>
    <div class="bc-paper-ctec-modal-global-bar-label">${label}</div>
    <div class="bc-paper-ctec-modal-global-bar-chart">
      <div class="bc-paper-ctec-modal-global-bar-track">
        ${tickPositions.map(
          (pos) =>
            html`<span
              class="bc-paper-ctec-modal-global-bar-tick"
              style=${`left: ${pos}%`}
            ></span>`
        )}
        <div
          class="bc-paper-ctec-modal-global-bar-fill"
          style=${`width: ${pct}%`}
        ></div>
        ${value > 0
          ? html`<span
              class="bc-paper-ctec-modal-global-bar-arrow"
              style=${`left: ${pct}%`}
            ></span>`
          : ""}
      </div>
    </div>
    <div class="bc-paper-ctec-modal-global-bar-value">
      ${display}<span class="bc-paper-ctec-modal-global-bar-scale">/${scale}</span>
    </div>
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
      ></div
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
// aggregation). Clicking switches the body to the global view.
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
        ><span class="bc-paper-ctec-modal-kpi-label">Global Rating</span><span
          class="bc-paper-ctec-modal-kpi-info bc-tooltip-host"
          aria-label=${GLOBAL_KPI_TOOLTIP}
          tabindex="0"
          @click=${preventAndStop}
          >i<span class="bc-tooltip bc-tooltip--rich"
            >${GLOBAL_KPI_TOOLTIP}</span
          ></span
        ></span
      ></div
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

// Backwards-compat for callers still on the imperative entry point.
export function renderOverview(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return OverviewSection.render({ doc, data, state, callbacks });
}
