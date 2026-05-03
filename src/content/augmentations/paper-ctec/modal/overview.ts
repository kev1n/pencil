import { renderMultilineRatingsChart } from "../chart-multiline";
import {
  renderHoursDensity,
  type HoursDensitySeries
} from "../hours-density";
import {
  MODAL_METRIC_LABELS,
  MODAL_METRIC_SCALES,
  MODAL_RATING_METRICS,
  type ModalDisplayData,
  type ModalMetricKind
} from "../modal-data";
import { preventAndStop } from "../ui-shared";
import {
  renderDistChart,
  renderGroupedRatingsChart,
  renderStackedRatingsChart,
  renderTrendChart
} from "./charts";
import { pickSelectedTerm, renderCard } from "./common";
import type { AnalyticsModalCallbacks, AnalyticsModalState } from "./types";

// Overview tab: KPI strip (one card per metric), trend + selected-term
// distribution, workload (hours) density, and three experimental ratings
// charts (stacked, grouped, multi-line).
export function renderOverview(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const root = doc.createElement("div");
  root.className = "bc-paper-ctec-modal-overview";

  const showDelta = data.terms.length >= 2;

  const kpiStrip = doc.createElement("div");
  kpiStrip.className = "bc-paper-ctec-modal-kpi-strip";
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as ModalMetricKind[]) {
    kpiStrip.append(renderKpiCard(doc, kind, data, state, callbacks, showDelta));
  }
  root.append(kpiStrip);

  const selectedTerm = pickSelectedTerm(data, state.selectedTermId);

  const charts = doc.createElement("div");
  charts.className = "bc-paper-ctec-modal-charts";

  const trendCard = renderCard(
    doc,
    `Trend · ${data.terms.length} ${data.terms.length === 1 ? "term" : "terms"}`,
    `${MODAL_METRIC_LABELS[state.activeMetric]}${
      state.activeMetric === "hours" ? " · hrs/wk" : " · mean rating"
    }`
  );
  trendCard.body.append(renderTrendChart(doc, data, state.activeMetric));
  charts.append(trendCard.root);

  const distCard = renderCard(
    doc,
    "Distribution",
    selectedTerm
      ? `${selectedTerm.term} · ${selectedTerm.responses} responses`
      : ""
  );
  distCard.body.append(renderDistChart(doc, selectedTerm, state.activeMetric));
  charts.append(distCard.root);

  root.append(charts);

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
  root.append(hoursCard.root);

  const stackedCard = renderCard(
    doc,
    "Ratings stacked · per term (experimental)",
    "Sum of mean ratings (instruction + course + learned + challenge + interest)"
  );
  stackedCard.body.append(renderStackedRatingsChart(doc, data));
  root.append(stackedCard.root);

  const groupedCard = renderCard(
    doc,
    "Ratings grouped · per term (experimental)",
    "Mean rating per metric · 0–6 scale"
  );
  groupedCard.body.append(renderGroupedRatingsChart(doc, data));
  root.append(groupedCard.root);

  const lineCard = renderCard(
    doc,
    "Ratings trend lines · per metric (experimental)",
    "One line per metric across terms · 0–6 scale"
  );
  lineCard.body.append(renderMultilineRatingsChart(doc, data));
  root.append(lineCard.root);

  return root;
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
