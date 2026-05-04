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
  // Callback to render the hours-bucket density curve when real bucket
  // counts are available. modal owns this renderer (it's tied to the
  // modal's series-aware drawing primitives), so we accept it as an
  // injection rather than re-implement here.
  renderHoursBuckets: (term: ModalTerm) => HTMLElement | null;
  // Override for the histogram's primary pill label (e.g. "Sp'23 5.4").
  // Only applies to the chart-histogram path (rating metrics, or hours
  // when buckets aren't available).
  primaryLabel?: string;
  // Optional historical-avg indicator for the chart-histogram path.
  // Renders as a secondary slate pill stacked above the primary one.
  historicalMean?: number;
  historicalLabel?: string;
  // Optional aggregate bar counts (across all loaded terms) used to draw
  // a dashed slate spline behind the primary curve, mirroring the
  // workload card's two-series overlay. Length must match the metric's
  // bucket count; total is the sum of counts (or a precomputed total).
  historicalCounts?: number[];
  historicalTotal?: number;
};

export function renderMetricDistribution(
  options: RenderMetricDistributionOptions
): HTMLElement {
  const {
    doc,
    term,
    metric,
    altLabel,
    className,
    renderHoursBuckets,
    primaryLabel,
    historicalMean,
    historicalLabel,
    historicalCounts,
    historicalTotal
  } = options;

  if (metric === "hours" && term.hoursBuckets.length > 0) {
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
      meanLabel: primaryLabel,
      secondaryMean:
        typeof historicalMean === "number" && Number.isFinite(historicalMean)
          ? historicalMean
          : undefined,
      secondaryLabel: historicalLabel,
      secondaryCounts: historicalCounts,
      secondaryTotal: historicalTotal,
      xAxisTitle: isHours ? "HOURS PER WEEK" : "RATING",
      preExtractedCounts: chart.counts,
      className
    });
  }

  const empty = doc.createElement("div");
  empty.className = "bc-paper-ctec-modal-dist-empty";
  empty.textContent = "No distribution chart available for this term.";
  return empty;
}
