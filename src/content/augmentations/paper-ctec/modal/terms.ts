import { renderMetricDistribution } from "../dist-render";
import { renderHoursDensity } from "../hours-density";
import {
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { preventAndStop } from "../ui-shared";
import { pickSelectedTerm, renderCard, spacerCell } from "./common";
import type { AnalyticsModalCallbacks, AnalyticsModalState } from "./types";

// Terms tab: term × metric heatmap, then a two-column drill-in for the
// selected term (per-metric stats with vs-other-terms delta on the left,
// per-metric distribution charts on the right).
export function renderTerms(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const root = doc.createElement("div");
  root.className = "bc-paper-ctec-modal-terms";

  const heatCard = renderCard(
    doc,
    "Term × Metric heatmap",
    "Shading scaled within these terms only"
  );
  heatCard.body.append(renderHeatmap(doc, data, state, callbacks));
  root.append(heatCard.root);

  const selectedTerm = pickSelectedTerm(data, state.selectedTermId);
  if (!selectedTerm) return root;

  const drillRow = doc.createElement("div");
  drillRow.className = "bc-paper-ctec-modal-drill";

  const metricCard = renderCard(
    doc,
    selectedTerm.term,
    `${selectedTerm.instructor} · ${selectedTerm.responses} responded`,
    selectedTerm.reportUrl
      ? { label: "↗ Report", href: selectedTerm.reportUrl }
      : undefined
  );
  metricCard.body.append(renderTermMetricGrid(doc, data, selectedTerm));
  drillRow.append(metricCard.root);

  const distsCard = renderCard(doc, "Distributions · all metrics", selectedTerm.term);
  distsCard.body.append(renderTermDistributionList(doc, selectedTerm));
  drillRow.append(distsCard.root);

  root.append(drillRow);
  return root;
}

function renderHeatmap(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const grid = doc.createElement("div");
  grid.className = "bc-paper-ctec-modal-heatmap";

  // Header row.
  grid.append(spacerCell(doc));
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as ModalMetricKind[]) {
    const header = doc.createElement("div");
    header.className = "bc-paper-ctec-modal-heatmap-header";
    header.textContent = MODAL_METRIC_LABELS[kind];
    grid.append(header);
  }

  // Rating cells share one shading scale (deep maroon → light) and hours
  // cells share another (purple) — different units, different scales.
  const ratings: number[] = [];
  data.terms.forEach((term) =>
    MODAL_RATING_METRICS.forEach((kind) => {
      const value = term.metrics[kind];
      if (typeof value === "number") ratings.push(value);
    })
  );
  const minR = ratings.length ? Math.min(...ratings) : 0;
  const maxR = ratings.length ? Math.max(...ratings) : 0;
  const spanR = maxR - minR;
  const cellR = (value: number) => {
    if (spanR < 0.05) return "rgba(102,2,60,0.45)";
    return `rgba(102,2,60,${0.18 + ((value - minR) / spanR) * 0.72})`;
  };

  const hourValues: number[] = [];
  data.terms.forEach((term) => {
    const value = term.metrics.hours;
    if (typeof value === "number") hourValues.push(value);
  });
  const minH = hourValues.length ? Math.min(...hourValues) : 0;
  const maxH = hourValues.length ? Math.max(...hourValues) : 0;
  const spanH = maxH - minH;
  const cellH = (value: number) => {
    if (spanH < 0.05) return "rgba(162,28,175,0.45)";
    return `rgba(162,28,175,${0.18 + ((value - minH) / spanH) * 0.72})`;
  };

  for (const term of data.terms) {
    const isActive = state.selectedTermId === term.id;
    const termCell = doc.createElement("button");
    termCell.type = "button";
    termCell.className = `bc-paper-ctec-modal-heatmap-term${isActive ? " is-active" : ""}`;
    const termTitle = doc.createElement("div");
    termTitle.className = "bc-paper-ctec-modal-heatmap-term-title";
    termTitle.textContent = term.term;
    const termSub = doc.createElement("div");
    termSub.className = "bc-paper-ctec-modal-heatmap-term-sub";
    termSub.textContent = `${term.responses} responded`;
    termCell.append(termTitle, termSub);
    termCell.addEventListener("click", (event) => {
      preventAndStop(event);
      callbacks.onTermChange(term.id);
    });
    grid.append(termCell);

    for (const kind of MODAL_RATING_METRICS) {
      const value = term.metrics[kind];
      const cell = doc.createElement("div");
      cell.className = "bc-paper-ctec-modal-heatmap-cell";
      if (typeof value === "number") {
        cell.style.background = cellR(value);
        cell.textContent = value.toFixed(1);
      } else {
        cell.classList.add("is-empty");
        cell.textContent = "—";
      }
      grid.append(cell);
    }

    const hoursValue = term.metrics.hours;
    const hoursCell = doc.createElement("div");
    hoursCell.className = "bc-paper-ctec-modal-heatmap-cell";
    if (typeof hoursValue === "number") {
      hoursCell.style.background = cellH(hoursValue);
      hoursCell.textContent = `${hoursValue.toFixed(1)}h`;
    } else {
      hoursCell.classList.add("is-empty");
      hoursCell.textContent = "—";
    }
    grid.append(hoursCell);
  }

  return grid;
}

function renderTermMetricGrid(
  doc: Document,
  data: ModalDisplayData,
  term: ModalTerm
): HTMLElement {
  const grid = doc.createElement("div");
  grid.className = "bc-paper-ctec-modal-term-metrics";

  const peers = data.terms.filter((t) => t.id !== term.id);
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as ModalMetricKind[]) {
    const value = term.metrics[kind];
    const cell = doc.createElement("div");
    cell.className = "bc-paper-ctec-modal-term-metric";

    const label = doc.createElement("div");
    label.className = "bc-paper-ctec-modal-term-metric-label";
    label.textContent = MODAL_METRIC_LABELS[kind];
    cell.append(label);

    const valueEl = doc.createElement("div");
    valueEl.className = "bc-paper-ctec-modal-term-metric-value";
    if (typeof value === "number") {
      const big = doc.createElement("span");
      big.textContent = value.toFixed(1);
      const unit = doc.createElement("span");
      unit.className = "bc-paper-ctec-modal-term-metric-unit";
      unit.textContent = kind === "hours" ? "h" : "/6";
      valueEl.append(big, unit);
    } else {
      valueEl.textContent = "—";
    }
    cell.append(valueEl);

    const peerValues = peers
      .map((peer) => peer.metrics[kind])
      .filter((entry): entry is number => typeof entry === "number");
    const peerMean = peerValues.length
      ? peerValues.reduce((sum, v) => sum + v, 0) / peerValues.length
      : null;

    const delta = doc.createElement("div");
    delta.className = "bc-paper-ctec-modal-term-metric-delta";
    if (peerMean == null || typeof value !== "number") {
      delta.textContent = "only term";
      delta.classList.add("is-muted");
    } else {
      const d = value - peerMean;
      const positive = kind === "hours" ? d <= 0 : d >= 0;
      if (Math.abs(d) < 0.05) {
        delta.textContent = "— vs other terms";
        delta.classList.add("is-muted");
      } else {
        delta.classList.add(positive ? "is-positive" : "is-negative");
        const arrow = positive ? "▲" : "▼";
        const note = doc.createElement("span");
        note.className = "bc-paper-ctec-modal-term-metric-delta-note";
        note.textContent = " vs other terms";
        delta.append(
          doc.createTextNode(`${arrow} ${Math.abs(d).toFixed(1)}`),
          note
        );
      }
    }
    cell.append(delta);
    grid.append(cell);
  }
  return grid;
}

function renderTermDistributionList(
  doc: Document,
  term: ModalTerm
): HTMLElement {
  const list = doc.createElement("div");
  list.className = "bc-paper-ctec-modal-term-charts";

  // Show one chart-image card per rating metric, plus the hours bucket
  // bars when buckets exist for this term. We don't fall back to fake
  // bars when a chart is missing — empty card + note instead.
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as ModalMetricKind[]) {
    const card = doc.createElement("div");
    card.className = "bc-paper-ctec-modal-term-chart-card";

    const head = doc.createElement("div");
    head.className = "bc-paper-ctec-modal-term-chart-head";

    const label = doc.createElement("div");
    label.className = "bc-paper-ctec-modal-term-chart-label";
    label.textContent = MODAL_METRIC_LABELS[kind];
    head.append(label);

    const meanValue = term.metrics[kind];
    if (typeof meanValue === "number") {
      const value = doc.createElement("div");
      value.className = "bc-paper-ctec-modal-term-chart-value";
      value.textContent = kind === "hours"
        ? `${meanValue.toFixed(1)} h`
        : meanValue.toFixed(1);
      head.append(value);
    }
    card.append(head);

    const body = doc.createElement("div");
    body.className = "bc-paper-ctec-modal-term-chart-body";

    body.append(
      renderMetricDistribution({
        doc,
        term,
        metric: kind,
        altLabel: `${MODAL_METRIC_LABELS[kind]} chart for ${term.term}`,
        className: "bc-paper-ctec-modal-term-chart-image",
        renderHoursBuckets: (t) =>
          renderHoursDensity(doc, [
            {
              label:
                typeof t.metrics.hours === "number"
                  ? `AVG ${t.metrics.hours.toFixed(1)}h`
                  : "AVG",
              buckets: t.hoursBuckets,
              mean: t.metrics.hours,
              style: "primary"
            }
          ])
      })
    );
    card.append(body);
    list.append(card);
  }

  return list;
}
