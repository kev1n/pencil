import {
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  type ModalMetricKind
} from "./modal-data";

export const RATING_METRIC_COLORS: Record<
  Exclude<ModalMetricKind, "hours">,
  string
> = {
  instruction: "#66023c",
  course: "#2563eb",
  learned: "#16a34a",
  challenging: "#ea580c",
  stimulating: "#9333ea"
};

export function renderRatingMetricLegend(doc: Document): HTMLElement {
  const legend = doc.createElement("div");
  legend.className = "bc-paper-ctec-modal-multibar-legend";
  for (const kind of MODAL_RATING_METRICS) {
    const item = doc.createElement("span");
    item.className = "bc-paper-ctec-modal-multibar-legend-item";
    const swatch = doc.createElement("span");
    swatch.className = "bc-paper-ctec-modal-multibar-legend-swatch";
    swatch.style.background = RATING_METRIC_COLORS[kind];
    item.append(swatch);
    const label = doc.createElement("span");
    label.textContent = MODAL_METRIC_LABELS[kind];
    item.append(label);
    legend.append(item);
  }
  return legend;
}

export function abbrTerm(term: string): string {
  if (!term) return "";
  return term
    .replace("Fall ", "F'")
    .replace("Winter ", "W'")
    .replace("Spring ", "Sp'")
    .replace("Summer ", "Su'")
    .replace(" 20", "'");
}
