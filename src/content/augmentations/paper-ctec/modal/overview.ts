import { html, type TemplateResult } from "lit-html";

import { renderSparkline as paintSparkline } from "../chart-kit";
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
import { appendBandLabel } from "./band-labels";
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

// Renders the value portion of a KPI as a chip-style pill. Returns an
// imperative element rather than a template because createRatingStars
// (the stars-mode branch) builds DOM nodes directly. lit-html splats the
// element via ${pill} interpolation.
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
    pill.style.setProperty(
      "--bc-paper-ctec-kpi-fg-dark",
      "var(--bc-color-kpi-fg-dark)"
    );
  }

  return pill;
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
      ${renderKpiStrip(doc, data, state, callbacks, recent)}
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
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  recent: number
): TemplateResult {
  const groups: Array<{ label: string; cards: HTMLElement[] }> = [
    {
      label: "Overall",
      cards: [renderGlobalKpiCard(doc, data, state, callbacks, recent)]
    },
    {
      label: "Quality",
      cards: (["instruction", "course", "learned"] as const).map((kind) =>
        renderKpiCard(doc, kind, data, state, callbacks, recent)
      )
    },
    {
      label: "Character",
      cards: (["challenging", "stimulating"] as const).map((kind) =>
        renderKpiCard(doc, kind, data, state, callbacks, recent)
      )
    },
    {
      label: "Workload",
      cards: [renderKpiCard(doc, "hours", data, state, callbacks, recent)]
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

// Returns an imperative HTMLElement (not a TemplateResult) because the card's
// children are themselves imperative artifacts: `renderSparkline` paints an
// SVG via the chart-kit primitives, `renderKpiPill` builds an HTMLElement
// (CSS custom properties + `createRatingStars` SVG composition), and
// `appendBandLabel` mutates the host. Wrapping that mix in lit-html would
// just splat all three back as `${child}` interpolations with no real win.
// The caller (`renderKpiStrip`) splats the returned button via
// `${group.cards}` inside its lit-html template.
function renderKpiCard(
  doc: Document,
  kind: ModalMetricKind,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  recent: number
): HTMLElement {
  const trend = trendValuesFor(data.trendTerms, kind);
  const meanValue = recentMean(data.terms, kind, recent);
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
    top.append(renderSparkline(doc, trend, 80, 20, kind));
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

  appendBandLabel(doc, button, kind, meanValue);

  return button;
}

// Renders the "Global" KPI card alongside the per-metric ones. Value is
// the avg of the Instruction / Course / Learned mean ratings across the
// most-recent N terms (matches the chip aggregation), plus a sparkline
// of the same per-term average so the trend is visible at a glance.
// Clicking switches the body to the global view.
//
// Imperative for the same reason as `renderKpiCard` above (sparkline SVG +
// pill + band-label all build DOM directly). Additionally calls
// `attachTooltip` on the info icon — that helper writes a tip-host class
// + appends a tip span, both of which need a live element to bind to.
function renderGlobalKpiCard(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  recent: number
): HTMLElement {
  const isActive: boolean = state.activeMetric === "global";

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
    top.append(renderSparkline(doc, trend, 80, 20, "global"));
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

  appendBandLabel(doc, button, "global", overallMean);

  return button;
}

function renderSparkline(
  doc: Document,
  values: number[],
  width: number,
  height: number,
  kind: ModalMetricKind | "global"
): SVGElement {
  // Padded scale: shows trend shape without faking magnitude. A 5.0 → 5.2
  // trend sits in the upper region rather than filling the whole chart.
  // The padding (1 rating unit, 4 hours) leaves visible breathing room
  // above and below the line, clamped to the metric's natural bounds.
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

  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("class", "bc-paper-ctec-modal-sparkline");

  const points = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  paintSparkline(doc, svg, points, {
    strokeColor: "var(--bc-color-accent)",
    strokeWidth: 1.5,
    lastDotOnly: true,
    lastDotRadius: 2
  });

  return svg;
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
