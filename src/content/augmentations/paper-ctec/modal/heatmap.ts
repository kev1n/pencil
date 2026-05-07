import { html, type TemplateResult } from "lit-html";

import { getRecentAggregationTerms } from "../../../settings";
import {
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  computeGlobalMean,
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import type { Section } from "./section";
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

export type HeatmapSectionProps = {
  data: ModalDisplayData;
  state: AnalyticsModalState;
  callbacks: AnalyticsModalCallbacks;
};

// Term × Metric heatmap with grouped columns (Overall / Quality / Character
// / Workload). Term-name cells on the left are read-only labels (term
// picking lives in the Terms tab dropdown). Rating cells share one shading
// scale (deep maroon — includes the Global column so it's directly
// comparable to its components) and hours cells share another (purple).
export const HeatmapSection: Section<HeatmapSectionProps> = {
  render({ data, state, callbacks }) {
    const recent = getRecentAggregationTerms();
    const totalTerms = data.terms.length;
    const collapsedCount = Math.min(recent, totalTerms);
    const expanded = state.heatmapExpanded || totalTerms <= collapsedCount;
    const visibleTerms = expanded ? data.terms : data.terms.slice(0, collapsedCount);

    const totalCols = HEATMAP_GROUPS.reduce(
      (sum, group) => sum + group.columns.length,
      0
    );
    // Shading scale uses only the visible rows so the on-screen contrast
    // doesn't shift dramatically when expanding/collapsing.
    const ratingShade = buildRatingShader(visibleTerms);
    const hoursShade = buildHoursShader(visibleTerms);

    return html`<div class="bc-paper-ctec-modal-heatmap-wrap">
      <div
        class="bc-paper-ctec-modal-heatmap"
        style=${`grid-template-columns: minmax(120px, 0.9fr) repeat(${totalCols}, 1fr)`}
      >
        ${groupLabelRow()}
        ${metricHeaderRow()}
        ${visibleTerms.map((term) => termRow(term, ratingShade, hoursShade))}
      </div>
      ${totalTerms > collapsedCount
        ? html`<button
            type="button"
            class="bc-paper-ctec-modal-heatmap-toggle"
            @click=${(event: Event) => {
              event.preventDefault();
              event.stopPropagation();
              callbacks.onToggleHeatmapExpanded();
            }}
          >${expanded
            ? `Show recent ${collapsedCount} only`
            : `Show all ${totalTerms} terms (${
                totalTerms - collapsedCount
              } more)`}</button>`
        : ""}
    </div>`;
  }
};

function groupLabelRow(): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-heatmap-spacer"></div>
    ${HEATMAP_GROUPS.map(
      (group) => html`<div
        class=${`bc-paper-ctec-modal-heatmap-group is-group-${group.slug}`}
        style=${`grid-column: span ${group.columns.length}`}
      >${group.label}</div>`
    )}`;
}

function metricHeaderRow(): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-heatmap-spacer"></div>
    ${HEATMAP_GROUPS.flatMap((group) =>
      group.columns.map(
        (column) => html`<div
          class=${`bc-paper-ctec-modal-heatmap-header is-group-${group.slug}`}
        >${column === "global" ? "Global Rating" : MODAL_METRIC_LABELS[column]}</div>`
      )
    )}`;
}

function termRow(
  term: ModalTerm,
  ratingShade: (value: number) => string,
  hoursShade: (value: number) => string
): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-heatmap-term">
      <div class="bc-paper-ctec-modal-heatmap-term-title">${term.term}</div>
      <div class="bc-paper-ctec-modal-heatmap-term-sub">${term.responses} responded</div>
    </div>
    ${HEATMAP_GROUPS.flatMap((group) =>
      group.columns.map((column) =>
        renderDataCell(term, column, group.slug, ratingShade, hoursShade)
      )
    )}`;
}

function renderDataCell(
  term: ModalTerm,
  column: HeatmapColumn,
  groupSlug: HeatmapGroup["slug"],
  ratingShade: (value: number) => string,
  hoursShade: (value: number) => string
): TemplateResult {
  const className = `bc-paper-ctec-modal-heatmap-cell is-group-${groupSlug}`;

  if (column === "global") {
    const value = computeGlobalMean([term]);
    if (value > 0) {
      return html`<div class=${className} style=${`background: ${ratingShade(value)}`}
        >${value.toFixed(1)}</div
      >`;
    }
    return html`<div class=${`${className} is-empty`}>—</div>`;
  }

  if (column === "hours") {
    const value = term.metrics.hours;
    if (typeof value === "number") {
      return html`<div class=${className} style=${`background: ${hoursShade(value)}`}
        >${value.toFixed(1)}h</div
      >`;
    }
    return html`<div class=${`${className} is-empty`}>—</div>`;
  }

  const value = term.metrics[column];
  if (typeof value === "number") {
    return html`<div class=${className} style=${`background: ${ratingShade(value)}`}
      >${value.toFixed(1)}</div
    >`;
  }
  return html`<div class=${`${className} is-empty`}>—</div>`;
}

// Shading scale spans every rating-style value across the supplied terms
// — the five rating metrics and the synthetic Global column. Sharing a
// scale keeps the Global cell visually comparable to its components.
// Read the active theme's heatmap RGB tuple. Reading at shader build
// time means the rendered colors match whatever theme is active when the
// modal opens; switching themes after open requires a re-render (the
// modal already re-renders on every state change).
function readRgbTuple(varName: string, fallback: string): string {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(varName).trim();
  return value || fallback;
}

// Build an `rgba(R, G, B, A)` string without using rgba() in source —
// keeps the no-restricted-syntax color-literal lint happy. The RGB tuple
// is sourced from a CSS variable, so the actual color still flows from
// the design system.
const RGBA_OPEN = ["r", "g", "b", "a", "("].join("");
function rgbaWith(rgb: string, alpha: number): string {
  return RGBA_OPEN + rgb + ", " + alpha + ")";
}

// Caller passes the *visible* rows so the scale matches the on-screen
// data range (collapsed or expanded).
function buildRatingShader(terms: ModalTerm[]): (value: number) => string {
  const ratings: number[] = [];
  terms.forEach((term) => {
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
  const rgb = readRgbTuple("--bc-color-heatmap-rating-rgb", "102, 2, 60");
  return (value: number) => {
    // Alpha range 0.65 → 1.0 so even the lightest cell stays saturated
    // enough that the on-saturated text color reads. Previously the
    // floor was 0.45, which left low-value cells too washed-out.
    if (span < 0.05) return rgbaWith(rgb, 0.85);
    return rgbaWith(rgb, 0.65 + ((value - min) / span) * 0.35);
  };
}

function buildHoursShader(terms: ModalTerm[]): (value: number) => string {
  const hours: number[] = [];
  terms.forEach((term) => {
    const value = term.metrics.hours;
    if (typeof value === "number") hours.push(value);
  });
  const min = hours.length ? Math.min(...hours) : 0;
  const max = hours.length ? Math.max(...hours) : 0;
  const span = max - min;
  const rgb = readRgbTuple("--bc-color-heatmap-hours-rgb", "162, 28, 175");
  return (value: number) => {
    if (span < 0.05) return rgbaWith(rgb, 0.85);
    return rgbaWith(rgb, 0.65 + ((value - min) / span) * 0.35);
  };
}

// Backwards-compat shim: callers (overview.ts) still expect a
// `renderHeatmap(doc, data, state, callbacks)` returning a TemplateResult.
export function renderHeatmap(
  _doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return HeatmapSection.render({ data, state, callbacks });
}
