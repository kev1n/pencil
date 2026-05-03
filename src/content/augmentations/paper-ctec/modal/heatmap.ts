import {
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  computeGlobalMean,
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { spacerCell } from "./common";
import type { AnalyticsModalCallbacks, AnalyticsModalState } from "./types";

// Internal column kind: ModalMetricKind plus the synthetic "global" column
// (avg of Inst/Course/Learn). Heatmap is the only place these mix.
type HeatmapColumn = ModalMetricKind | "global";

// Same gestalt grouping as the KPI strip: Overall (Global), Quality
// (Inst+Course+Learn), Character (Chal+Int), Workload (Hours). Each group
// gets its own header label spanning its columns and a tinted background
// across the body cells.
type HeatmapGroup = {
  label: string;
  slug: "overall" | "quality" | "character" | "workload";
  columns: HeatmapColumn[];
};

const HEATMAP_GROUPS: HeatmapGroup[] = [
  { label: "Overall", slug: "overall", columns: ["global"] },
  { label: "Quality", slug: "quality", columns: ["instruction", "course", "learned"] },
  { label: "Character", slug: "character", columns: ["challenging", "stimulating"] },
  { label: "Workload", slug: "workload", columns: ["hours"] }
];

// Term × Metric heatmap with grouped columns (Overall / Quality / Character
// / Workload). Term-name cells on the left are read-only labels (term
// picking lives in the Terms tab dropdown). Rating cells share one shading
// scale (deep maroon — includes the Global column so it's directly
// comparable to its components) and hours cells share another (purple).
export function renderHeatmap(
  doc: Document,
  data: ModalDisplayData,
  _state: AnalyticsModalState,
  _callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const grid = doc.createElement("div");
  grid.className = "bc-paper-ctec-modal-heatmap";

  const totalCols = HEATMAP_GROUPS.reduce(
    (sum, group) => sum + group.columns.length,
    0
  );
  // First column for term names; one column per metric after.
  grid.style.gridTemplateColumns = `minmax(120px, 0.9fr) repeat(${totalCols}, 1fr)`;

  appendGroupLabelRow(doc, grid);
  appendMetricHeaderRow(doc, grid);

  const ratingShade = buildRatingShader(data);
  const hoursShade = buildHoursShader(data);

  for (const term of data.terms) {
    appendTermRow(doc, grid, term, ratingShade, hoursShade);
  }

  return grid;
}

function appendGroupLabelRow(doc: Document, grid: HTMLElement): void {
  // Empty cell over the term-name column.
  grid.append(spacerCell(doc));
  for (const group of HEATMAP_GROUPS) {
    const label = doc.createElement("div");
    label.className = `bc-paper-ctec-modal-heatmap-group is-group-${group.slug}`;
    label.style.gridColumn = `span ${group.columns.length}`;
    label.textContent = group.label;
    grid.append(label);
  }
}

function appendMetricHeaderRow(doc: Document, grid: HTMLElement): void {
  grid.append(spacerCell(doc));
  for (const group of HEATMAP_GROUPS) {
    for (const column of group.columns) {
      const header = doc.createElement("div");
      header.className = `bc-paper-ctec-modal-heatmap-header is-group-${group.slug}`;
      header.textContent = column === "global" ? "Global" : MODAL_METRIC_LABELS[column];
      grid.append(header);
    }
  }
}

function appendTermRow(
  doc: Document,
  grid: HTMLElement,
  term: ModalTerm,
  ratingShade: (value: number) => string,
  hoursShade: (value: number) => string
): void {
  const termCell = doc.createElement("div");
  termCell.className = "bc-paper-ctec-modal-heatmap-term";
  const termTitle = doc.createElement("div");
  termTitle.className = "bc-paper-ctec-modal-heatmap-term-title";
  termTitle.textContent = term.term;
  const termSub = doc.createElement("div");
  termSub.className = "bc-paper-ctec-modal-heatmap-term-sub";
  termSub.textContent = `${term.responses} responded`;
  termCell.append(termTitle, termSub);
  grid.append(termCell);

  for (const group of HEATMAP_GROUPS) {
    for (const column of group.columns) {
      grid.append(renderDataCell(doc, term, column, group.slug, ratingShade, hoursShade));
    }
  }
}

function renderDataCell(
  doc: Document,
  term: ModalTerm,
  column: HeatmapColumn,
  groupSlug: HeatmapGroup["slug"],
  ratingShade: (value: number) => string,
  hoursShade: (value: number) => string
): HTMLElement {
  const cell = doc.createElement("div");
  cell.className = `bc-paper-ctec-modal-heatmap-cell is-group-${groupSlug}`;

  if (column === "global") {
    const value = computeGlobalMean([term]);
    if (value > 0) {
      cell.style.background = ratingShade(value);
      cell.textContent = value.toFixed(1);
    } else {
      cell.classList.add("is-empty");
      cell.textContent = "—";
    }
    return cell;
  }

  if (column === "hours") {
    const value = term.metrics.hours;
    if (typeof value === "number") {
      cell.style.background = hoursShade(value);
      cell.textContent = `${value.toFixed(1)}h`;
    } else {
      cell.classList.add("is-empty");
      cell.textContent = "—";
    }
    return cell;
  }

  const value = term.metrics[column];
  if (typeof value === "number") {
    cell.style.background = ratingShade(value);
    cell.textContent = value.toFixed(1);
  } else {
    cell.classList.add("is-empty");
    cell.textContent = "—";
  }
  return cell;
}

// Shading scale spans every rating-style value across all loaded terms —
// the five rating metrics and the synthetic Global column. Sharing a scale
// keeps the Global cell visually comparable to its components.
function buildRatingShader(data: ModalDisplayData): (value: number) => string {
  const ratings: number[] = [];
  data.terms.forEach((term) => {
    MODAL_RATING_METRICS.forEach((kind) => {
      const value = term.metrics[kind];
      if (typeof value === "number") ratings.push(value);
    });
    const globalValue = computeGlobalMean([term]);
    if (globalValue > 0) ratings.push(globalValue);
  });
  const min = ratings.length ? Math.min(...ratings) : 0;
  const max = ratings.length ? Math.max(...ratings) : 0;
  const span = max - min;
  return (value: number) => {
    if (span < 0.05) return "rgba(102,2,60,0.45)";
    return `rgba(102,2,60,${0.18 + ((value - min) / span) * 0.72})`;
  };
}

function buildHoursShader(data: ModalDisplayData): (value: number) => string {
  const hours: number[] = [];
  data.terms.forEach((term) => {
    const value = term.metrics.hours;
    if (typeof value === "number") hours.push(value);
  });
  const min = hours.length ? Math.min(...hours) : 0;
  const max = hours.length ? Math.max(...hours) : 0;
  const span = max - min;
  return (value: number) => {
    if (span < 0.05) return "rgba(162,28,175,0.45)";
    return `rgba(162,28,175,${0.18 + ((value - min) / span) * 0.72})`;
  };
}
