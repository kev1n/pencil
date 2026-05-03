// Per-metric distribution renderer. Owns the routing between:
//   - Hours-bucket density curve (when real bucket counts are present)
//   - SVG histogram extracted from the Bluera chart PNG
//   - "No chart available" empty state
//
// modal-ui.ts used to inline this logic across two sites; it now just
// calls renderMetricDistribution and stays focused on layout.

import { renderChartHistogram } from "./chart-histogram";
import type { ModalMetricKind, ModalTerm } from "./modal-data";

const HOURS_HISTOGRAM_LABELS = [
  "3 or fewer",
  "4 - 7",
  "8 - 11",
  "12 - 15",
  "16 - 19",
  "20 or more"
] as const;

// Bucket midpoints for the hours histogram, used to position the mean pill.
const HOURS_HISTOGRAM_VALUES = [3, 5.5, 9.5, 13.5, 17.5, 22] as const;

const RATING_HISTOGRAM_VALUES = [1, 2, 3, 4, 5, 6] as const;

export type RenderMetricDistributionOptions = {
  doc: Document;
  term: ModalTerm;
  metric: ModalMetricKind;
  altLabel: string;
  className: string;
  // Optional callback to render the hours-bucket density curve when real
  // bucket counts are available. modal-ui owns this renderer (it's tied
  // to the modal's series-aware drawing primitives), so we accept it as
  // an injection rather than re-implement here.
  renderHoursBuckets?: (term: ModalTerm) => HTMLElement | null;
};

export function renderMetricDistribution(
  options: RenderMetricDistributionOptions
): HTMLElement {
  const { doc, term, metric, altLabel, className, renderHoursBuckets } = options;

  if (metric === "hours" && term.hoursBuckets.length > 0 && renderHoursBuckets) {
    const buckets = renderHoursBuckets(term);
    if (buckets) return buckets;
  }

  const chart = term.charts[metric];
  if (chart) {
    const responseCount = term.metricResponseCounts?.[metric] ?? 0;
    const mean = term.metrics?.[metric];
    const isHours = metric === "hours";
    return renderChartHistogram({
      doc,
      imageUrl: chart.imageUrl,
      alt: chart.alt ?? altLabel,
      total: responseCount,
      kind: metric,
      rowLabels: isHours ? HOURS_HISTOGRAM_LABELS : undefined,
      rowValues: isHours ? HOURS_HISTOGRAM_VALUES : RATING_HISTOGRAM_VALUES,
      mean: typeof mean === "number" ? mean : undefined,
      xAxisTitle: isHours ? "HOURS PER WEEK" : "RATING",
      className
    });
  }

  const empty = doc.createElement("div");
  empty.className = "bc-paper-ctec-modal-dist-empty";
  empty.textContent = "No distribution chart available for this term.";
  return empty;
}
