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

  const xMid = (i: number) => PL + ((i + 0.5) / numBuckets) * innerW;

  // Catmull-Rom → Cubic Bezier path through bucket midpoints. The area is
  // anchored to baseline at the first and last bucket centers (not the plot
  // edges) so the fill doesn't sweep down to the chart's left/right padding
  // and create misleading wings beyond the data.
  const buildPath = (
    pcts: number[]
  ): { path: string; pts: [number, number][] } => {
    const baseline = PT + innerH;
    const pts = pcts.map<[number, number]>((pct, i) => {
      const safePct = Number.isFinite(pct) ? pct : 0;
      const x = xMid(i);
      const y = baseline - (safePct / yMax) * innerH;
      return [
        Number.isFinite(x) ? x : PL,
        Number.isFinite(y) ? y : baseline
      ];
    });
    if (pts.length === 0) return { path: "", pts };
    const firstX = pts[0]![0];
    const lastX = pts[pts.length - 1]![0];
    const segs: string[] = [];
    segs.push(`M ${firstX} ${baseline}`);
    segs.push(`L ${firstX} ${pts[0]![1]}`);
    for (let i = 0; i < pts.length - 1; i++) {
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
  const defs = doc.createElementNS(SVG_NS, "defs");
  const gradId = `bc-paper-ctec-hours-grad-${Math.random().toString(36).slice(2, 8)}`;
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
    if (v !== 0) line.setAttribute("stroke-dasharray", "2 3");
    if (v !== 0) line.setAttribute("opacity", "0.6");
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

  // Y-axis title (rotated).
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
    const { path, pts } = buildPath(seriesPcts[i]!);
    if (!path) continue;

    const isPrimary = s.style === "primary";
    const stroke = isPrimary ? "#66023c" : "#475569";

    const curve = doc.createElementNS(SVG_NS, "path");
    curve.setAttribute("d", path);
    curve.setAttribute("fill", isPrimary ? `url(#${gradId})` : "none");
    curve.setAttribute("stroke", stroke);
    curve.setAttribute("stroke-width", isPrimary ? "1.5" : "1.4");
    if (!isPrimary) curve.setAttribute("stroke-dasharray", "5 3");
    svg.append(curve);

    for (const [x, y] of pts) {
      const dot = doc.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(y));
      dot.setAttribute("r", isPrimary ? "2.5" : "1.8");
      dot.setAttribute("fill", "white");
      dot.setAttribute("stroke", stroke);
      dot.setAttribute("stroke-width", isPrimary ? "1.4" : "1.2");
      svg.append(dot);
    }
  }

  // AVG pills + dashed mean lines, stacked from the top of the SVG. Pills
  // are emitted in input order so the latest term's amber pill sits on
  // top with the multi-term average's slate pill below.
  let pillSlot = 0;
  for (const s of usable) {
    const frac = meanFracFor(s.mean);
    if (frac == null) continue;
    const meanX = PL + (Math.max(0, Math.min(100, frac)) / 100) * innerW;
    const pillTop = pillSlot * PILL_STEP;
    pillSlot++;
    const isPrimary = s.style === "primary";
    // Pill + mean line take the curve's stroke color so each pill visually
    // belongs to its curve. Primary uses maroon (filled-curve color);
    // secondary uses slate (dashed-line color).
    const pillColor = isPrimary ? "#66023c" : "#475569";

    const meanLine = doc.createElementNS(SVG_NS, "line");
    meanLine.setAttribute("x1", String(meanX));
    meanLine.setAttribute("x2", String(meanX));
    meanLine.setAttribute("y1", String(pillTop + PILL_H + 1));
    meanLine.setAttribute("y2", String(PT + innerH));
    meanLine.setAttribute("stroke", pillColor);
    meanLine.setAttribute("stroke-width", "1.5");
    meanLine.setAttribute("stroke-dasharray", "3 3");
    svg.append(meanLine);

    // Width grows with label length so longer text doesn't clip; clamp to
    // chart bounds so the pill stays visible when the mean is near an edge.
    const pillW = Math.max(60, s.label.length * 5.5 + 12);
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
    pill.setAttribute("fill", pillColor);
    svg.append(pill);

    const pillLabel = doc.createElementNS(SVG_NS, "text");
    pillLabel.setAttribute("x", String(pillX + pillW / 2));
    pillLabel.setAttribute("y", String(pillTop + 10));
    pillLabel.setAttribute("text-anchor", "middle");
    pillLabel.setAttribute("font-size", "9");
    pillLabel.setAttribute("font-weight", "700");
    pillLabel.setAttribute("fill", "white");
    pillLabel.setAttribute("letter-spacing", "0.5");
    pillLabel.textContent = s.label;
    svg.append(pillLabel);
  }

  // X-axis bucket labels.
  for (let i = 0; i < numBuckets; i++) {
    const x = xMid(i);
    const label = doc.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(H - 12));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "9");
    label.setAttribute("fill", "#6b7280");
    label.textContent = axisLabels[i]!;
    svg.append(label);
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
  xTitle.textContent = "HOURS PER WEEK";
  svg.append(xTitle);

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
