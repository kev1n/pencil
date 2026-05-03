import {
  renderHoursDensity,
  type HoursDensitySeries
} from "../hours-density";
import {
  MODAL_METRIC_LABELS,
  MODAL_METRIC_SCALES,
  MODAL_RATING_METRICS,
  computeGlobalMean,
  type ModalDisplayData,
  type ModalMetricKind
} from "../modal-data";
import { preventAndStop } from "../ui-shared";
import { renderDistChart, renderTrendChart } from "./charts";
import { pickSelectedTerm, renderCard } from "./common";
import { renderHeatmap } from "./heatmap";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalState,
  ModalActiveView
} from "./types";

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

  const showDelta = data.terms.length >= 2;
  root.append(renderKpiStrip(doc, data, state, callbacks, showDelta));

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
  showDelta: boolean
): HTMLElement {
  const groups: Array<{
    label: string;
    cards: HTMLElement[];
  }> = [
    {
      label: "Overall",
      cards: [renderGlobalKpiCard(doc, data, state, callbacks)]
    },
    {
      label: "Quality",
      cards: (["instruction", "course", "learned"] as const).map((kind) =>
        renderKpiCard(doc, kind, data, state, callbacks, showDelta)
      )
    },
    {
      label: "Character",
      cards: (["challenging", "stimulating"] as const).map((kind) =>
        renderKpiCard(doc, kind, data, state, callbacks, showDelta)
      )
    },
    {
      label: "Workload",
      cards: [renderKpiCard(doc, "hours", data, state, callbacks, showDelta)]
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
  showDelta: boolean
): HTMLElement {
  const metric = data.metrics[kind];
  const trend = metric.trend;
  const last = trend[trend.length - 1];
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
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
  const big = doc.createElement("span");
  big.className = "bc-paper-ctec-modal-kpi-mean";
  big.textContent = metric.mean.toFixed(1);
  const unit = doc.createElement("span");
  unit.className = "bc-paper-ctec-modal-kpi-scale";
  unit.textContent = kind === "hours" ? "h/wk avg" : `/ ${MODAL_METRIC_SCALES[kind]} avg`;
  value.append(big, unit);
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
    note.textContent = " vs prior term";
    deltaRow.append(
      doc.createTextNode(`${arrow} ${Math.abs(delta).toFixed(1)}`),
      note
    );
  }
  button.append(deltaRow);

  return button;
}

// Renders the "Global" KPI card alongside the per-metric ones. Value is
// the avg of the Instruction / Course / Learned mean ratings across all
// loaded terms, plus a sparkline of the same average per term so trend
// is visible at a glance. Clicking switches the body to the global view.
function renderGlobalKpiCard(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const isActive: boolean = state.activeMetric === "global";

  const overallMean = computeGlobalMean(data.terms);
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
  const tip = doc.createElement("span");
  tip.className = "bc-paper-ctec-modal-kpi-tooltip";
  tip.textContent = GLOBAL_KPI_TOOLTIP;
  info.append(tip);
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
  const big = doc.createElement("span");
  big.className = "bc-paper-ctec-modal-kpi-mean";
  big.textContent = overallMean > 0 ? overallMean.toFixed(1) : "—";
  const unit = doc.createElement("span");
  unit.className = "bc-paper-ctec-modal-kpi-scale";
  unit.textContent = "/ 6 avg";
  value.append(big, unit);
  button.append(value);

  const last = trend[trend.length - 1];
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
  const delta = prev != null && last != null ? last - prev : 0;
  const positive = delta >= 0;
  const showDelta = data.terms.length >= 2;

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
    note.textContent = " vs prior term";
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
