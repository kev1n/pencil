// Horizontal bar chart for rating distributions.
//
// Replaces the inline SVG histogram for the rating metrics (instruction,
// course, learned, challenging, stimulating). One row per rating value
// (6 → 1 from top to bottom), bar width proportional to count, response
// count printed to the right of the bar. Hours metrics still use the
// hours-density curve (or fall back to chart-histogram).

import { logQuiet } from "../../../shared/log";
import { el } from "../../framework/dom";
import { extractChartFromImage } from "./chart-extract";
import type { ModalMetricKind } from "./modal-data";

const RATING_LABELS = ["1", "2", "3", "4", "5", "6"] as const;

export type RenderHorizontalBarsOptions = {
  doc: Document;
  imageUrl: string;
  alt?: string | null;
  total: number;
  kind: ModalMetricKind;
  rowLabels?: ReadonlyArray<string>;
  preExtractedCounts?: number[];
  className?: string;
};

export function renderHorizontalBars(
  options: RenderHorizontalBarsOptions
): HTMLElement {
  const { doc, imageUrl, total, kind, alt } = options;
  const wrapper = el(doc, "div", {
    class: options.className ?? "bc-paper-ctec-chart-horizontal",
    dataset: { kind }
  });

  if (options.preExtractedCounts && total > 0) {
    wrapper.append(
      renderBars(doc, options.preExtractedCounts, total, options)
    );
    return wrapper;
  }

  wrapper.append(
    el(doc, "div", {
      class: "bc-paper-ctec-chart-horizontal-loading",
      text: "Reading chart…"
    })
  );

  void extractChartFromImage(imageUrl, total).then((result) => {
    if (result.ok) {
      wrapper.replaceChildren(
        renderBars(doc, result.data.counts, result.data.total, options)
      );
      return;
    }
    logQuiet("paper-ctec.chart-extract", {
      message: "chart extraction failed",
      imageUrl,
      kind,
      total,
      reason: result.reason
    });
    const fallback = el(doc, "div", {
      class: "bc-paper-ctec-chart-horizontal-fallback-wrap"
    });
    const img = el(doc, "img", {
      class: "bc-paper-ctec-chart-horizontal-fallback",
      attrs: {
        src: imageUrl,
        alt: alt ?? `${kind} distribution`,
        loading: "lazy"
      }
    });
    fallback.append(img);
    fallback.append(
      el(doc, "div", {
        class: "bc-paper-ctec-chart-horizontal-error",
        text: `Distribution unavailable — ${result.reason} (n=${total})`
      })
    );
    wrapper.replaceChildren(fallback);
  });

  return wrapper;
}

function renderBars(
  doc: Document,
  counts: number[],
  total: number,
  opts: RenderHorizontalBarsOptions
): HTMLElement {
  const labels = opts.rowLabels ?? RATING_LABELS;
  const list = el(doc, "div", {
    class: "bc-paper-ctec-chart-horizontal-list"
  });

  const maxCount = Math.max(1, ...counts);

  // Show highest rating at the top, lowest at the bottom — natural
  // "good first" ordering for a rating distribution. counts[] is indexed
  // 0 = rating 1 … 5 = rating 6 (matches chart-extract row order).
  for (let visIdx = 0; visIdx < labels.length; visIdx += 1) {
    const dataIdx = labels.length - 1 - visIdx;
    const count = counts[dataIdx] ?? 0;
    const widthPct = (count / maxCount) * 100;

    // Tier color matches the trend-chart spline zones, extended with a
    // 6th tier (deeper emerald) so each integer rating 1..6 carries its
    // own color — the spline backgrounds top out at zone-5 because they
    // band continuous y-ranges, but rating bars are discrete bins and
    // need rating 6 to read distinctly from rating 5. dataIdx 0 = rating
    // 1, dataIdx 5 = rating 6 → zone-1..zone-6.
    const zoneIdx = dataIdx + 1;
    const fill = el(doc, "div", {
      class: "bc-paper-ctec-chart-horizontal-fill",
      style: {
        width: `${widthPct}%`,
        background: `var(--bc-color-trend-zone-${zoneIdx}-solid)`
      }
    });
    const track = el(doc, "div", {
      class: "bc-paper-ctec-chart-horizontal-track"
    });
    track.append(fill);

    const row = el(doc, "div", {
      class: "bc-paper-ctec-chart-horizontal-row"
    });
    row.append(
      el(doc, "div", {
        class: "bc-paper-ctec-chart-horizontal-label",
        text: labels[dataIdx]!
      }),
      track,
      el(doc, "div", {
        class: "bc-paper-ctec-chart-horizontal-value",
        text: String(count)
      })
    );

    list.append(row);
  }

  // Light footer with total — useful context but unobtrusive.
  if (total > 0) {
    list.append(
      el(doc, "div", {
        class: "bc-paper-ctec-chart-horizontal-total",
        text: `${total} responses`
      })
    );
  }

  return list;
}
