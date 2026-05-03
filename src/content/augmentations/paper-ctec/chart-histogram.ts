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

// Per-bar fill colors, matching Bluera's source charts for visual continuity.
const ROW_FILLS = [
  "#fcb6b6", // salmon (row 1, very low)
  "#a3d3d3", // teal
  "#ebbcbc", // pink
  "#fff196", // yellow
  "#cdebaa", // green
  "#bdb0b9"  // lavender (row 6, very high)
] as const;

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
  // Numeric anchors for each bar (1..6 for ratings, bucket midpoints for
  // hours). Used to position the mean indicator correctly. Defaults to
  // [1..6] when omitted.
  rowValues?: ReadonlyArray<number>;
  // Axis label below the chart (e.g. "RATING", "HOURS PER WEEK").
  xAxisTitle?: string;
  // Optional fallback image rendered if extraction fails.
  fallbackOnError?: boolean;
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
  const hasMean = typeof opts.mean === "number" && Number.isFinite(opts.mean);
  const PT = hasMean ? PILL_H : 14;
  const innerHTarget = 118;
  const PB = 28;
  const PL = 42;
  const PR = 8;
  const H = PT + innerHTarget + PB;
  const innerW = W - PL - PR;
  const innerH = innerHTarget;

  // Y-axis scale: nice-stepped to fit the tallest bar. For very flat
  // distributions step=2; very peaked ones step=50.
  const maxPct = pcts.length > 0 ? Math.max(...pcts) : 0;
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

  // Mean indicator: interpolate the mean's x-position along the rowValues
  // anchors. Outside the range clamps to the extreme.
  const meanX = (() => {
    if (!hasMean) return null;
    const m = opts.mean!;
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
  })();

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

  // Bars. Drawn first so the curve sits on top.
  pcts.forEach((p, i) => {
    if (p <= 0) return;
    const x = xMid(i) - barW / 2;
    const yTop = yPct(p);
    const h = PT + innerH - yTop;
    const rect = doc.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(yTop));
    rect.setAttribute("width", String(barW));
    rect.setAttribute("height", String(h));
    rect.setAttribute("fill", ROW_FILLS[i] ?? "#cdebaa");
    rect.setAttribute("rx", "2");
    rect.setAttribute("opacity", "0.9");
    svg.append(rect);

    // Count label above the bar (only when bar tall enough to leave room).
    if (h >= 14) {
      const t = doc.createElementNS(SVG_NS, "text");
      t.setAttribute("x", String(xMid(i)));
      t.setAttribute("y", String(yTop - 3));
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
  const pts: [number, number][] = pcts.map((p, i) => [xMid(i), yPct(p)]);
  const segs: string[] = [];
  if (pts.length > 0) {
    const firstX = pts[0]![0];
    const lastX = pts[pts.length - 1]![0];
    segs.push(`M ${firstX} ${baseline}`);
    segs.push(`L ${firstX} ${pts[0]![1]}`);
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
  }
  const curvePath = segs.join(" ");

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

  // Mean indicator: dashed maroon line + AVG pill at top.
  if (meanX !== null && hasMean) {
    const meanLine = doc.createElementNS(SVG_NS, "line");
    meanLine.setAttribute("x1", String(meanX));
    meanLine.setAttribute("x2", String(meanX));
    meanLine.setAttribute("y1", String(PILL_H + 1));
    meanLine.setAttribute("y2", String(PT + innerH));
    meanLine.setAttribute("stroke", "#66023c");
    meanLine.setAttribute("stroke-width", "1.5");
    meanLine.setAttribute("stroke-dasharray", "3 3");
    svg.append(meanLine);

    const labelText = `AVG ${opts.mean!.toFixed(1)}`;
    const pillW = Math.max(60, labelText.length * 5.5 + 12);
    const pillX = Math.max(
      PL,
      Math.min(PL + innerW - pillW, meanX - pillW / 2)
    );
    const pill = doc.createElementNS(SVG_NS, "rect");
    pill.setAttribute("x", String(pillX));
    pill.setAttribute("y", "0");
    pill.setAttribute("width", String(pillW));
    pill.setAttribute("height", String(PILL_H));
    pill.setAttribute("rx", "3");
    pill.setAttribute("fill", "#66023c");
    svg.append(pill);

    const pillLabel = doc.createElementNS(SVG_NS, "text");
    pillLabel.setAttribute("x", String(pillX + pillW / 2));
    pillLabel.setAttribute("y", "10");
    pillLabel.setAttribute("text-anchor", "middle");
    pillLabel.setAttribute("font-size", "9");
    pillLabel.setAttribute("font-weight", "700");
    pillLabel.setAttribute("fill", "white");
    pillLabel.setAttribute("letter-spacing", "0.5");
    pillLabel.textContent = labelText;
    svg.append(pillLabel);
  }

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
