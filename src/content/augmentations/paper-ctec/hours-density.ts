import {
  appendStackedAvgPills,
  appendVerticalGradient,
  appendXAxis,
  appendYAxis,
  buildLinePath,
  niceStep,
  PERCENT_AXIS_STEPS,
  type AvgIndicator,
  type Point
} from "./chart-kit";
import type { ModalHoursBucket } from "./modal-data";

// One series in the hours-density chart. The Overview card stacks two
// (the latest term as primary + the multi-term aggregate as secondary);
// the per-term Terms-tab cards pass a single primary series.
export type HoursDensitySeries = {
  label: string; // pill text, e.g. "LATEST 8.5h" or "AVG 7.2h · 5 terms"
  buckets: ModalHoursBucket[];
  mean: number | undefined;
  style: "primary" | "secondary";
};

// Density curve over the hours-per-week bucket histogram. Used in both the
// Overview "Workload distribution" card (latest term overlaid on multi-term
// average) and the per-term hours card on the Terms tab.
//
// Visual: smooth Catmull-Rom path through bucket midpoints, percent y-axis
// with nice-stepped ticks, dashed AVG indicator pinned to each series'
// mean position along the bucket strip. Primary series is filled maroon;
// secondary is a dashed slate stroke for context. Pills stack vertically
// when more than one mean is shown. Empty state when no buckets are
// available (older cached entries before parseHoursMetric started
// recording bucket counts).
export function renderHoursDensity(
  doc: Document,
  series: HoursDensitySeries[]
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-hours-density";

  const usable = series.filter((s) => s.buckets.length > 0);
  if (usable.length === 0) {
    const empty = doc.createElement("div");
    empty.className = "bc-paper-ctec-modal-dist-empty";
    empty.textContent =
      "Hours-per-week breakdown wasn't captured for these terms. Reload the term to fetch it.";
    wrapper.append(empty);
    return wrapper;
  }

  // X-axis labels: take from the series with the most buckets so we
  // capture the union (rare, but possible if an older term used different
  // bucket boundaries). Other series get aligned by label lookup with
  // missing buckets defaulting to 0%.
  const axisOwner = usable.reduce(
    (best, s) => (s.buckets.length > best.buckets.length ? s : best),
    usable[0]!
  );
  const axisLabels = axisOwner.buckets.map((b) => b.label);
  const numBuckets = axisLabels.length;

  // Bucket counts can come back non-finite (NaN/Infinity) when a CTEC report
  // has a malformed numeric cell; coerce to a safe number before the divide
  // so we never propagate NaN into the SVG path.
  const safeCount = (n: unknown): number => {
    const v = typeof n === "number" ? n : Number(n);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const seriesPcts = usable.map((s) => {
    const map = new Map(s.buckets.map((b) => [b.label, safeCount(b.count)]));
    const counts = axisLabels.map((label) => map.get(label) ?? 0);
    const total = counts.reduce((sum, c) => sum + c, 0) || 1;
    return counts.map((c) => (c / total) * 100);
  });

  // Layout. Top padding grows to fit one stacked AVG pill per series with
  // a defined mean.
  const W = 600;
  const PILL_H = 14;
  const PILL_STEP = 16;
  const numPills = usable.filter((s) => typeof s.mean === "number").length;
  const pillsHeight =
    numPills > 0 ? PILL_H + Math.max(0, numPills - 1) * PILL_STEP : 0;
  const PT = Math.max(14, pillsHeight);
  const innerHTarget = 118;
  const PB = 28;
  const PL = 42;
  const PR = 8;
  const H = PT + innerHTarget + PB;
  const innerW = W - PL - PR;
  const innerH = innerHTarget;

  // Y-axis: scale to whichever series peaks highest so both curves fit.
  // Spread on an empty array yields -Infinity, which would NaN-poison the
  // whole path; fall back to 0 in that case (will still produce a flat
  // baseline curve, but won't break the SVG).
  const flatPcts = seriesPcts.flat().filter((n) => Number.isFinite(n));
  const maxPct = flatPcts.length > 0 ? Math.max(...flatPcts) : 0;
  const step = niceStep(maxPct, [...PERCENT_AXIS_STEPS]);
  const yMax = Math.max(step, Math.ceil(maxPct / step) * step) || step;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);
  const yPct = (v: number) => PT + innerH - (v / yMax) * innerH;

  // Distribute bucket centers edge-to-edge from PL to PL+innerW so the
  // chart has no half-slot margin on either side.
  const xMid = (i: number) =>
    numBuckets > 1
      ? PL + (i * innerW) / (numBuckets - 1)
      : PL + innerW / 2;

  // Catmull-Rom → Cubic Bezier path through bucket midpoints. The area is
  // anchored to baseline at the first and last bucket centers (not the plot
  // edges) so the fill doesn't sweep down to the chart's left/right padding
  // and create misleading wings beyond the data.
  const baseline = PT + innerH;
  const seriesPath = (
    pcts: number[]
  ): { path: string; pts: Point[] } => {
    const pts: Point[] = pcts.map<Point>((pct, i) => {
      const safePct = Number.isFinite(pct) ? pct : 0;
      const x = xMid(i);
      const y = baseline - (safePct / yMax) * innerH;
      return [
        Number.isFinite(x) ? x : PL,
        Number.isFinite(y) ? y : baseline
      ];
    });
    return buildLinePath(pts, { baseline });
  };

  // Mean position along the bucket strip. Each bucket label is parsed for
  // its right edge (e.g. "0–3" → 3, "20+" → 24); we then linearly
  // interpolate where the mean falls within the [edge[i], edge[i+1])
  // bucket range and convert to a 0–100% offset across the SVG.
  const edges = buildBucketEdges(axisOwner.buckets);
  const meanFracFor = (mean: number | undefined): number | null => {
    if (typeof mean !== "number" || edges.length < 2) return null;
    for (let i = 0; i < edges.length - 1; i++) {
      const lo = edges[i]!;
      const hi = edges[i + 1]!;
      if (mean >= lo && mean <= hi) {
        const within = hi === lo ? 0 : (mean - lo) / (hi - lo);
        return ((i + within) / numBuckets) * 100;
      }
    }
    return mean < edges[0]! ? 0 : 100;
  };

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("class", "bc-paper-ctec-modal-hours-density-svg");

  // Gradient fill (used by primary series only).
  const gradId = appendVerticalGradient(doc, svg, {
    idPrefix: "bc-paper-ctec-hours-grad",
    topColor: "var(--bc-color-accent-fill-45)",
    bottomColor: "var(--bc-color-accent-fill-05)"
  });

  // Y-axis ticks + horizontal gridlines + rotated title.
  appendYAxis(doc, svg, {
    ticks,
    yAt: yPct,
    PL,
    innerW,
    title: "% OF RESPONSES",
    titleY: PT + innerH / 2
  });

  // Draw secondary series first so the primary's filled curve sits on top.
  const drawOrder = usable
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = usable[a]!.style === "primary" ? 1 : 0;
      const rb = usable[b]!.style === "primary" ? 1 : 0;
      return ra - rb;
    });
  for (const i of drawOrder) {
    const s = usable[i]!;
    const { path, pts } = seriesPath(seriesPcts[i]!);
    if (!path) continue;

    const isPrimary = s.style === "primary";
    const strokeVar = isPrimary
      ? "var(--bc-color-accent)"
      : "var(--bc-color-chart-axis-cool)";

    const curve = doc.createElementNS(SVG_NS, "path");
    curve.setAttribute("d", path);
    curve.setAttribute("fill", isPrimary ? `url(#${gradId})` : "none");
    curve.style.stroke = strokeVar;
    curve.setAttribute("stroke-width", isPrimary ? "1.5" : "1.4");
    if (!isPrimary) curve.setAttribute("stroke-dasharray", "5 3");
    svg.append(curve);

    for (const [x, y] of pts) {
      const dot = doc.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(y));
      dot.setAttribute("r", isPrimary ? "2.5" : "1.8");
      dot.style.fill = "var(--bc-color-bg)";
      dot.style.stroke = strokeVar;
      dot.setAttribute("stroke-width", isPrimary ? "1.4" : "1.2");
      svg.append(dot);
    }
  }

  // AVG pills + dashed mean lines, stacked from the top of the SVG. Pills
  // are emitted in input order so the latest term's amber pill sits on
  // top with the multi-term average's slate pill below.
  const indicators: AvgIndicator[] = [];
  for (const s of usable) {
    const frac = meanFracFor(s.mean);
    if (frac == null) continue;
    const meanX = PL + (Math.max(0, Math.min(100, frac)) / 100) * innerW;
    const isPrimary = s.style === "primary";
    indicators.push({
      x: meanX,
      label: s.label,
      // Pill + mean line take the curve's stroke color so each pill visually
      // belongs to its curve. Primary uses maroon (filled-curve color);
      // secondary uses slate (dashed-line color).
      color: isPrimary
        ? "var(--bc-color-accent)"
        : "var(--bc-color-chart-axis-cool)"
    });
  }
  appendStackedAvgPills(doc, svg, indicators, {
    PILL_H,
    PILL_STEP,
    PL,
    innerW,
    baselineY: PT + innerH
  });

  // X-axis bucket labels + title.
  appendXAxis(doc, svg, {
    labels: axisLabels,
    xAt: xMid,
    H,
    W,
    title: "HOURS PER WEEK"
  });

  wrapper.append(svg);
  return wrapper;
}

// Builds the cumulative edge list for a sequence of bucket labels so we
// can interpolate where the mean falls. Each label's upper bound becomes
// the next bucket's lower bound. Falls back to evenly-spaced edges if a
// label is unparseable, so the mean indicator still shows.
function buildBucketEdges(buckets: ModalHoursBucket[]): number[] {
  if (buckets.length === 0) return [];
  const edges: number[] = [0];
  let cursor = 0;
  for (const bucket of buckets) {
    const upper = parseBucketUpper(bucket.label, cursor);
    edges.push(upper);
    cursor = upper;
  }
  return edges;
}

// Parses the upper bound from a CTEC bucket label. CTEC formats vary:
// "0–3", "0-3", "4 - 7", "20 or more", "20+". For open-ended top buckets
// we add a small padding above the lower edge so the mean indicator can
// sit within the bucket if it's pulling the average up.
function parseBucketUpper(label: string, prevUpper: number): number {
  const cleaned = label.replace(/[–—]/g, "-").toLowerCase();
  if (/\b(more|or more|\+)\b/.test(cleaned) || cleaned.endsWith("+")) {
    const lower = parseFirstNumber(cleaned);
    if (lower != null) return lower + 4;
    return prevUpper + 4;
  }
  const range = cleaned.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) return Number(range[2]);
  const single = parseFirstNumber(cleaned);
  if (single != null) return single;
  return prevUpper + 1;
}

function parseFirstNumber(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}
