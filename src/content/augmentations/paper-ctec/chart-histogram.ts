// Replacement for Bluera's bar chart PNG: an inline SVG histogram rendered
// from extracted integer counts + the externally-known total respondents.
//
// Design follows the "Workload distribution" / Trend cards: vertical bars
// in row colors, a smooth Catmull-Rom distribution curve filled with the
// maroon gradient overlaid on top, dashed mean indicator with an AVG pill,
// % y-axis with light gridlines, x-axis bucket labels.

import {
  extractChartFromImage,
  type ChartExtraction
} from "./chart-extract";
import type { ModalMetricKind } from "./modal-data";

const SVG_NS = "http://www.w3.org/2000/svg";

const RATING_LABELS = ["1", "2", "3", "4", "5", "6"] as const;

export type HistogramKind = ModalMetricKind;

export type RenderHistogramOptions = {
  doc: Document;
  imageUrl: string;
  alt?: string | null;
  total: number;
  kind: HistogramKind;
  // Optional explicit row labels (for hours, where Bluera uses bucket
  // ranges like "3 or fewer" instead of the rating ladder).
  rowLabels?: ReadonlyArray<string>;
  // Pre-known mean from the CTEC metric. If provided, an AVG pill +
  // dashed line is drawn at the corresponding x-position.
  mean?: number;
  // Optional override for the primary pill text. Defaults to
  // `AVG ${mean.toFixed(1)}`. Used to label the pill with the term name
  // (e.g. "Sp'23 5.4") when the chart represents a specific term.
  meanLabel?: string;
  // Optional second indicator drawn in slate as a "historical avg" or
  // similar context line. Stacks above the primary pill.
  secondaryMean?: number;
  secondaryLabel?: string;
  // Optional second distribution drawn as a dashed slate curve behind
  // the primary one. Mirrors the workload card's "historical" overlay.
  // Pairs with secondaryTotal so percentages can be computed; both must
  // be present and positive for the curve to render.
  secondaryCounts?: number[];
  secondaryTotal?: number;
  // Numeric anchors for each bar (1..6 for ratings, bucket midpoints for
  // hours). Used to position the mean indicator correctly. Defaults to
  // [1..6] when omitted.
  rowValues?: ReadonlyArray<number>;
  // Axis label below the chart (e.g. "RATING", "HOURS PER WEEK").
  xAxisTitle?: string;
  // Optional fallback image rendered if extraction fails.
  fallbackOnError?: boolean;
  // Bar counts already extracted at CTEC load time. When provided the
  // histogram renders synchronously and skips the on-demand image fetch.
  preExtractedCounts?: number[];
  className?: string;
};

export function renderChartHistogram(
  options: RenderHistogramOptions
): HTMLElement {
  const { doc, imageUrl, total, kind, alt } = options;
  const wrapper = doc.createElement("div");
  wrapper.className =
    options.className ?? "bc-paper-ctec-chart-histogram";
  wrapper.dataset.kind = kind;

  if (options.preExtractedCounts && total > 0) {
    wrapper.append(
      renderHistogramSvg(
        doc,
        {
          counts: options.preExtractedCounts,
          percentages: options.preExtractedCounts.map((c) => (c / total) * 100),
          total
        },
        options
      )
    );
    return wrapper;
  }

  const placeholder = doc.createElement("div");
  placeholder.className = "bc-paper-ctec-chart-histogram-loading";
  placeholder.textContent = "Reading chart…";
  wrapper.append(placeholder);

  void extractChartFromImage(imageUrl, total).then((result) => {
    if (result.ok) {
      wrapper.replaceChildren(renderHistogramSvg(doc, result.data, options));
      return;
    }
    console.warn("[paper-ctec] chart extraction failed", {
      imageUrl,
      kind,
      total,
      reason: result.reason
    });
    const fallback = doc.createElement("div");
    fallback.className = "bc-paper-ctec-chart-histogram-fallback-wrap";
    if (options.fallbackOnError !== false) {
      const img = doc.createElement("img");
      img.className = "bc-paper-ctec-chart-histogram-fallback";
      img.src = imageUrl;
      img.alt = alt ?? `${kind} distribution`;
      img.loading = "lazy";
      fallback.append(img);
    }
    const errBox = doc.createElement("div");
    errBox.className = "bc-paper-ctec-chart-histogram-error";
    errBox.textContent = `Histogram unavailable — ${result.reason} (n=${total})`;
    fallback.append(errBox);
    wrapper.replaceChildren(fallback);
  });

  return wrapper;
}

// SVG layout: pill at the top (when mean is known), then plot area with
// vertical bars + overlaid Catmull-Rom distribution curve, then bucket
// labels. Mirrors renderHoursDensity proportions so cards feel uniform.
function renderHistogramSvg(
  doc: Document,
  extraction: ChartExtraction,
  opts: RenderHistogramOptions
): SVGSVGElement {
  const labels = opts.rowLabels ?? RATING_LABELS;
  const rowValues =
    opts.rowValues ?? labels.map((_, i) => i + 1); // [1..6] default
  const counts = extraction.counts;
  const total = extraction.total || 1;
  const pcts = counts.map((c) => (c / total) * 100);

  const W = 600;
  const PILL_H = 14;
  const PILL_STEP = 16;
  const hasMean = typeof opts.mean === "number" && Number.isFinite(opts.mean);
  const hasSecondaryMean =
    typeof opts.secondaryMean === "number" && Number.isFinite(opts.secondaryMean);
  const numPills = (hasMean ? 1 : 0) + (hasSecondaryMean ? 1 : 0);
  const PT =
    numPills > 0 ? PILL_H + Math.max(0, numPills - 1) * PILL_STEP : 14;
  const innerHTarget = 118;
  const PB = 28;
  const PL = 42;
  const PR = 8;
  const H = PT + innerHTarget + PB;
  const innerW = W - PL - PR;
  const innerH = innerHTarget;

  // Secondary distribution percentages, when supplied. Computed up-front
  // so the y-axis can scale to fit whichever series peaks higher.
  const hasSecondaryCurve =
    Array.isArray(opts.secondaryCounts) &&
    opts.secondaryCounts.length === counts.length &&
    typeof opts.secondaryTotal === "number" &&
    Number.isFinite(opts.secondaryTotal) &&
    opts.secondaryTotal > 0;
  const secondaryPcts = hasSecondaryCurve
    ? opts.secondaryCounts!.map((c) => (c / opts.secondaryTotal!) * 100)
    : null;

  // Y-axis scale: nice-stepped to fit the tallest bar in either series.
  // For very flat distributions step=2; very peaked ones step=50.
  const allPcts = secondaryPcts ? [...pcts, ...secondaryPcts] : pcts;
  const maxPct = allPcts.length > 0 ? Math.max(...allPcts) : 0;
  const niceStep = (max: number): number => {
    const targets = [2, 5, 10, 20, 25, 50];
    for (const t of targets) if (max / t <= 4) return t;
    return 50;
  };
  const step = niceStep(maxPct);
  const yMax = Math.max(step, Math.ceil(maxPct / step) * step) || step;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);
  const yPct = (v: number) => PT + innerH - (v / yMax) * innerH;

  const numBars = labels.length;
  // Bar width is sized first; bars are then distributed so the leftmost
  // bar's left edge sits at PL and the rightmost bar's right edge at
  // PL+innerW (no half-slot margin on either side).
  const barSlot = innerW / numBars;
  const barW = Math.max(8, barSlot * 0.62);
  const xMid = (i: number) =>
    numBars > 1
      ? PL + barW / 2 + (i * (innerW - barW)) / (numBars - 1)
      : PL + innerW / 2;

  // Interpolate a mean value's x-position along the rowValues anchors.
  // Outside the range clamps to the extreme.
  const meanXFor = (m: number): number | null => {
    if (!Number.isFinite(m)) return null;
    if (m <= rowValues[0]!) return xMid(0);
    if (m >= rowValues[rowValues.length - 1]!) return xMid(numBars - 1);
    for (let i = 0; i < rowValues.length - 1; i += 1) {
      const a = rowValues[i]!;
      const b = rowValues[i + 1]!;
      if (m >= a && m <= b) {
        const t = b === a ? 0 : (m - a) / (b - a);
        return xMid(i) + t * (xMid(i + 1) - xMid(i));
      }
    }
    return null;
  };

  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("class", "bc-paper-ctec-histogram-svg");
  svg.setAttribute("role", "img");
  if (opts.alt) svg.setAttribute("aria-label", opts.alt);

  // Gradient fill for the distribution curve (matches hours-density).
  const defs = doc.createElementNS(SVG_NS, "defs");
  const gradId = `bc-paper-ctec-hist-grad-${Math.random().toString(36).slice(2, 8)}`;
  const grad = doc.createElementNS(SVG_NS, "linearGradient");
  grad.setAttribute("id", gradId);
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "0");
  grad.setAttribute("y2", "1");
  const stopTop = doc.createElementNS(SVG_NS, "stop");
  stopTop.setAttribute("offset", "0%");
  stopTop.setAttribute("stop-color", "rgba(102,2,60,0.45)");
  const stopBot = doc.createElementNS(SVG_NS, "stop");
  stopBot.setAttribute("offset", "100%");
  stopBot.setAttribute("stop-color", "rgba(102,2,60,0.05)");
  grad.append(stopTop, stopBot);
  defs.append(grad);
  svg.append(defs);

  // Y-axis ticks + horizontal gridlines.
  for (const v of ticks) {
    const line = doc.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(PL));
    line.setAttribute("x2", String(PL + innerW));
    line.setAttribute("y1", String(yPct(v)));
    line.setAttribute("y2", String(yPct(v)));
    line.setAttribute("stroke", "#e6e6ea");
    line.setAttribute("stroke-width", "1");
    if (v !== 0) {
      line.setAttribute("stroke-dasharray", "2 3");
      line.setAttribute("opacity", "0.6");
    }
    svg.append(line);

    const tickLabel = doc.createElementNS(SVG_NS, "text");
    tickLabel.setAttribute("x", String(PL - 6));
    tickLabel.setAttribute("y", String(yPct(v) + 3));
    tickLabel.setAttribute("text-anchor", "end");
    tickLabel.setAttribute("font-size", "9");
    tickLabel.setAttribute("fill", "#6b7280");
    tickLabel.textContent = `${v}%`;
    svg.append(tickLabel);
  }

  // Y-axis title.
  const yTitle = doc.createElementNS(SVG_NS, "text");
  yTitle.setAttribute("x", "10");
  yTitle.setAttribute("y", String(PT + innerH / 2));
  yTitle.setAttribute("text-anchor", "middle");
  yTitle.setAttribute("font-size", "8.5");
  yTitle.setAttribute("fill", "#9ca3af");
  yTitle.setAttribute("letter-spacing", "0.6");
  yTitle.setAttribute("font-weight", "600");
  yTitle.setAttribute("transform", `rotate(-90 10 ${PT + innerH / 2})`);
  yTitle.textContent = "% OF RESPONSES";
  svg.append(yTitle);

  // Count label above each curve point (only when there's room above).
  pcts.forEach((p, i) => {
    if (p <= 0) return;
    const yTop = yPct(p);
    const h = PT + innerH - yTop;
    if (h >= 14) {
      const t = doc.createElementNS(SVG_NS, "text");
      t.setAttribute("x", String(xMid(i)));
      t.setAttribute("y", String(yTop - 6));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "9.5");
      t.setAttribute("fill", "#3a2730");
      t.setAttribute("font-weight", "600");
      t.textContent = String(counts[i] ?? 0);
      svg.append(t);
    }
  });

  // Catmull-Rom distribution curve overlay through bar tops. The area is
  // anchored to baseline at the first and last bar centers (not the plot
  // edges) so the fill doesn't sweep down to the chart's left/right padding
  // and create misleading wings beyond the data.
  const baseline = PT + innerH;
  const buildPath = (seriesPcts: number[]): {
    path: string;
    pts: [number, number][];
  } => {
    const pts: [number, number][] = seriesPcts.map((p, i) => [xMid(i), yPct(p)]);
    if (pts.length === 0) return { path: "", pts };
    const firstX = pts[0]![0];
    const lastX = pts[pts.length - 1]![0];
    const segs: string[] = [
      `M ${firstX} ${baseline}`,
      `L ${firstX} ${pts[0]![1]}`
    ];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i - 1] ?? pts[i]!;
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      const p3 = pts[i + 2] ?? p2;
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      segs.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`);
    }
    segs.push(`L ${lastX} ${baseline} Z`);
    return { path: segs.join(" "), pts };
  };

  // Secondary curve drawn first so the primary's filled curve sits on
  // top — same z-order as the workload card. Dashed slate stroke, no
  // fill, smaller dots so it reads as context rather than the focus.
  if (secondaryPcts) {
    const { path: secPath, pts: secPts } = buildPath(secondaryPcts);
    if (secPath) {
      const secCurve = doc.createElementNS(SVG_NS, "path");
      secCurve.setAttribute("d", secPath);
      secCurve.setAttribute("fill", "none");
      secCurve.setAttribute("stroke", "#475569");
      secCurve.setAttribute("stroke-width", "1.4");
      secCurve.setAttribute("stroke-dasharray", "5 3");
      secCurve.setAttribute("stroke-linejoin", "round");
      svg.append(secCurve);

      for (const [x, y] of secPts) {
        const dot = doc.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", String(x));
        dot.setAttribute("cy", String(y));
        dot.setAttribute("r", "1.8");
        dot.setAttribute("fill", "white");
        dot.setAttribute("stroke", "#475569");
        dot.setAttribute("stroke-width", "1.2");
        svg.append(dot);
      }
    }
  }

  const { path: curvePath, pts } = buildPath(pcts);
  const area = doc.createElementNS(SVG_NS, "path");
  area.setAttribute("d", curvePath);
  area.setAttribute("fill", `url(#${gradId})`);
  area.setAttribute("stroke", "#66023c");
  area.setAttribute("stroke-width", "1.5");
  area.setAttribute("stroke-linejoin", "round");
  svg.append(area);

  // Curve dots at each bar top.
  for (const [x, y] of pts) {
    const dot = doc.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", "2.5");
    dot.setAttribute("fill", "white");
    dot.setAttribute("stroke", "#66023c");
    dot.setAttribute("stroke-width", "1.4");
    svg.append(dot);
  }

  // Mean indicators. Secondary (slate) stacks on top, primary (maroon)
  // sits below it — same vertical order as the workload card pills.
  type Indicator = { value: number; label: string; color: string };
  const indicators: Indicator[] = [];
  if (hasSecondaryMean) {
    indicators.push({
      value: opts.secondaryMean!,
      label: opts.secondaryLabel ?? `AVG ${opts.secondaryMean!.toFixed(1)}`,
      color: "#475569"
    });
  }
  if (hasMean) {
    indicators.push({
      value: opts.mean!,
      label: opts.meanLabel ?? `AVG ${opts.mean!.toFixed(1)}`,
      color: "#66023c"
    });
  }
  indicators.forEach((ind, slot) => {
    const meanX = meanXFor(ind.value);
    if (meanX === null) return;
    const pillTop = slot * PILL_STEP;

    const meanLine = doc.createElementNS(SVG_NS, "line");
    meanLine.setAttribute("x1", String(meanX));
    meanLine.setAttribute("x2", String(meanX));
    meanLine.setAttribute("y1", String(pillTop + PILL_H + 1));
    meanLine.setAttribute("y2", String(PT + innerH));
    meanLine.setAttribute("stroke", ind.color);
    meanLine.setAttribute("stroke-width", "1.5");
    meanLine.setAttribute("stroke-dasharray", "3 3");
    svg.append(meanLine);

    const pillW = Math.max(60, ind.label.length * 5.5 + 12);
    const pillX = Math.max(
      PL,
      Math.min(PL + innerW - pillW, meanX - pillW / 2)
    );
    const pill = doc.createElementNS(SVG_NS, "rect");
    pill.setAttribute("x", String(pillX));
    pill.setAttribute("y", String(pillTop));
    pill.setAttribute("width", String(pillW));
    pill.setAttribute("height", String(PILL_H));
    pill.setAttribute("rx", "3");
    pill.setAttribute("fill", ind.color);
    svg.append(pill);

    const pillLabel = doc.createElementNS(SVG_NS, "text");
    pillLabel.setAttribute("x", String(pillX + pillW / 2));
    pillLabel.setAttribute("y", String(pillTop + 10));
    pillLabel.setAttribute("text-anchor", "middle");
    pillLabel.setAttribute("font-size", "9");
    pillLabel.setAttribute("font-weight", "700");
    pillLabel.setAttribute("fill", "white");
    pillLabel.setAttribute("letter-spacing", "0.5");
    pillLabel.textContent = ind.label;
    svg.append(pillLabel);
  });

  // X-axis bucket labels.
  for (let i = 0; i < numBars; i += 1) {
    const t = doc.createElementNS(SVG_NS, "text");
    t.setAttribute("x", String(xMid(i)));
    t.setAttribute("y", String(H - 12));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "9");
    t.setAttribute("fill", "#6b7280");
    t.textContent = labels[i] ?? "";
    svg.append(t);
  }

  // X-axis title.
  const xTitle = doc.createElementNS(SVG_NS, "text");
  xTitle.setAttribute("x", String(W / 2));
  xTitle.setAttribute("y", String(H - 1));
  xTitle.setAttribute("text-anchor", "middle");
  xTitle.setAttribute("font-size", "8.5");
  xTitle.setAttribute("fill", "#9ca3af");
  xTitle.setAttribute("letter-spacing", "0.6");
  xTitle.setAttribute("font-weight", "600");
  xTitle.textContent =
    opts.xAxisTitle ?? (opts.kind === "hours" ? "HOURS PER WEEK" : "RATING");
  svg.append(xTitle);

  return svg;
}
