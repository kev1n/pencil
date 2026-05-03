import {
  RATING_METRIC_COLORS,
  abbrTerm,
  renderRatingMetricLegend
} from "../chart-shared";
import { renderMetricDistribution } from "../dist-render";
import { renderHoursDensity } from "../hours-density";
import {
  MODAL_METRIC_LABELS,
  MODAL_METRIC_SCALES,
  MODAL_RATING_METRICS,
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";

// Tracks the active trend-chart ResizeObserver across renders so we can
// disconnect a stale one when the modal re-renders (avoids leaking
// references to detached wrappers).
let activeTrendObserver: ResizeObserver | null = null;

export function disposeTrendChartObserver(): void {
  if (activeTrendObserver) {
    activeTrendObserver.disconnect();
    activeTrendObserver = null;
  }
}

// Trend chart: per-metric line over loaded terms with area fill and value
// labels. Uses a ResizeObserver to track wrapper width so the SVG aspect
// matches the container instead of letterboxing or stretching.
export function renderTrendChart(
  doc: Document,
  data: ModalDisplayData,
  metric: ModalMetricKind
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-trend";

  const values = data.metrics[metric].trend;
  if (values.length < 2) {
    const empty = doc.createElement("div");
    empty.className = "bc-paper-ctec-modal-trend-empty";
    empty.textContent = "Only one term on record — no trend to plot.";
    wrapper.append(empty);
    return wrapper;
  }

  const H = 220;

  const draw = (W: number) => {
    if (W <= 0) return;
    wrapper.replaceChildren();

    const PL = 44;
    const PR = 24;
    const PT = 24;
    const PB = 36;

    const min = Math.min(...values) - 0.3;
    const max = Math.max(...values) + 0.3;
    const range = max - min || 1;
    const xAt = (i: number) =>
      PL + (i / Math.max(1, values.length - 1)) * (W - PL - PR);
    const yAt = (v: number) =>
      H - PB - ((v - min) / range) * (H - PT - PB);

    const SVG_NS = "http://www.w3.org/2000/svg";
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "bc-paper-ctec-modal-trend-svg");

    const ticks = 4;
    for (let i = 0; i < ticks; i++) {
      const yv = min + ((max - min) * i) / (ticks - 1);
      const line = doc.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(PL));
      line.setAttribute("x2", String(W - PR));
      line.setAttribute("y1", String(yAt(yv)));
      line.setAttribute("y2", String(yAt(yv)));
      line.setAttribute("stroke", "#f1ebef");
      svg.append(line);

      const tick = doc.createElementNS(SVG_NS, "text");
      tick.setAttribute("x", String(PL - 6));
      tick.setAttribute("y", String(yAt(yv) + 3));
      tick.setAttribute("fill", "#9b8290");
      tick.setAttribute("font-size", "10");
      tick.setAttribute("text-anchor", "end");
      tick.textContent = yv.toFixed(1);
      svg.append(tick);
    }

    const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
    const area = doc.createElementNS(SVG_NS, "path");
    area.setAttribute(
      "d",
      `M ${xAt(0)},${H - PB} L ${points.split(" ").join(" L ")} L ${xAt(
        values.length - 1
      )},${H - PB} Z`
    );
    area.setAttribute("fill", "rgba(102,2,60,0.08)");
    svg.append(area);

    const polyline = doc.createElementNS(SVG_NS, "polyline");
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "#66023c");
    polyline.setAttribute("stroke-width", "2");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");
    polyline.setAttribute("points", points);
    svg.append(polyline);

    values.forEach((v, i) => {
      const circle = doc.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", String(xAt(i)));
      circle.setAttribute("cy", String(yAt(v)));
      circle.setAttribute("r", "3.5");
      circle.setAttribute("fill", "white");
      circle.setAttribute("stroke", "#66023c");
      circle.setAttribute("stroke-width", "1.6");
      svg.append(circle);

      const valueLabel = doc.createElementNS(SVG_NS, "text");
      valueLabel.setAttribute("x", String(xAt(i)));
      valueLabel.setAttribute("y", String(yAt(v) - 8));
      valueLabel.setAttribute("fill", "#66023c");
      valueLabel.setAttribute("font-size", "11");
      valueLabel.setAttribute("font-weight", "700");
      valueLabel.setAttribute("text-anchor", "middle");
      valueLabel.textContent = v.toFixed(1);
      svg.append(valueLabel);

      const termLabel = doc.createElementNS(SVG_NS, "text");
      termLabel.setAttribute("x", String(xAt(i)));
      termLabel.setAttribute("y", String(H - 12));
      termLabel.setAttribute("fill", "#7a596a");
      termLabel.setAttribute("font-size", "10");
      termLabel.setAttribute("text-anchor", "middle");
      termLabel.textContent = abbrTerm(data.trendTerms[i]?.term ?? "");
      svg.append(termLabel);
    });

    wrapper.append(svg);
  };

  // Disconnect any prior observer (the wrapper it watched is being thrown
  // away by replaceChildren on the parent, so its callback would fire on a
  // detached element until GC).
  disposeTrendChartObserver();

  if (typeof ResizeObserver !== "undefined") {
    activeTrendObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      if (w > 0) draw(w);
    });
    activeTrendObserver.observe(wrapper);
  }

  // Initial draw at a sensible default; the observer will redraw with the
  // real width as soon as the wrapper is mounted.
  draw(800);

  return wrapper;
}

// Distribution chart for the currently-selected term + metric. Hours uses
// the parsed buckets if available; rating metrics use chart-extract counts
// or fall back to the raw chart image. Routing lives in dist-render.ts.
export function renderDistChart(
  doc: Document,
  term: ModalTerm | null,
  metric: ModalMetricKind
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-dist";

  if (!term) {
    wrapper.textContent = "No term selected.";
    return wrapper;
  }

  wrapper.append(
    renderMetricDistribution({
      doc,
      term,
      metric,
      altLabel: `${metric} distribution for ${term.term}`,
      className: "bc-paper-ctec-modal-dist-image",
      renderHoursBuckets: (t) =>
        renderHoursDensity(doc, [
          {
            label:
              typeof t.metrics.hours === "number"
                ? `AVG ${t.metrics.hours.toFixed(1)}h`
                : "AVG",
            buckets: t.hoursBuckets,
            mean: t.metrics.hours,
            style: "primary"
          }
        ])
    })
  );
  return wrapper;
}

// Stacked bar chart of summed mean ratings (instruction + course + learned +
// challenge + interest) per term. Y-scale snaps to the next multiple of 5
// above the max so the axis stays readable across courses.
export function renderStackedRatingsChart(
  doc: Document,
  data: ModalDisplayData
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-multibar";

  const terms = data.trendTerms;
  if (terms.length === 0) {
    const empty = doc.createElement("div");
    empty.className = "bc-paper-ctec-modal-trend-empty";
    empty.textContent = "No terms to plot.";
    wrapper.append(empty);
    return wrapper;
  }

  const W = 700;
  const H = 260;
  const PL = 40;
  const PR = 16;
  const PT = 16;
  const PB = 40;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const sums = terms.map((term) =>
    MODAL_RATING_METRICS.reduce(
      (sum, kind) => sum + (term.metrics[kind] ?? 0),
      0
    )
  );
  const maxSum = Math.max(...sums, 1);
  const yMax = Math.max(5, Math.ceil(maxSum / 5) * 5);
  const yAt = (v: number) => PT + innerH - (v / yMax) * innerH;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "bc-paper-ctec-modal-multibar-svg");

  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const yv = (yMax * i) / ticks;
    const line = doc.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(PL));
    line.setAttribute("x2", String(W - PR));
    line.setAttribute("y1", String(yAt(yv)));
    line.setAttribute("y2", String(yAt(yv)));
    line.setAttribute("stroke", "#f1ebef");
    svg.append(line);

    const tick = doc.createElementNS(SVG_NS, "text");
    tick.setAttribute("x", String(PL - 6));
    tick.setAttribute("y", String(yAt(yv) + 3));
    tick.setAttribute("fill", "#9b8290");
    tick.setAttribute("font-size", "10");
    tick.setAttribute("text-anchor", "end");
    tick.textContent = yv.toFixed(0);
    svg.append(tick);
  }

  const bandW = innerW / terms.length;
  const barW = Math.min(56, Math.max(8, bandW * 0.55));

  terms.forEach((term, i) => {
    const cx = PL + bandW * (i + 0.5);
    const x = cx - barW / 2;
    let yCursor = PT + innerH;

    for (const kind of MODAL_RATING_METRICS) {
      const v = term.metrics[kind] ?? 0;
      if (v <= 0) continue;
      const segH = (v / yMax) * innerH;
      const yTop = yCursor - segH;
      const rect = doc.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(yTop));
      rect.setAttribute("width", String(barW));
      rect.setAttribute("height", String(segH));
      rect.setAttribute("fill", RATING_METRIC_COLORS[kind]);

      const title = doc.createElementNS(SVG_NS, "title");
      title.textContent = `${term.term} · ${MODAL_METRIC_LABELS[kind]}: ${v.toFixed(2)}`;
      rect.append(title);
      svg.append(rect);
      yCursor = yTop;
    }

    if (sums[i]! > 0) {
      const total = doc.createElementNS(SVG_NS, "text");
      total.setAttribute("x", String(cx));
      total.setAttribute("y", String(yCursor - 6));
      total.setAttribute("fill", "#6b7280");
      total.setAttribute("font-size", "10");
      total.setAttribute("font-weight", "600");
      total.setAttribute("text-anchor", "middle");
      total.textContent = sums[i]!.toFixed(1);
      svg.append(total);
    }

    const termLabel = doc.createElementNS(SVG_NS, "text");
    termLabel.setAttribute("x", String(cx));
    termLabel.setAttribute("y", String(H - 14));
    termLabel.setAttribute("fill", "#7a596a");
    termLabel.setAttribute("font-size", "10");
    termLabel.setAttribute("text-anchor", "middle");
    termLabel.textContent = abbrTerm(term.term);
    svg.append(termLabel);
  });

  wrapper.append(svg);
  wrapper.append(renderRatingMetricLegend(doc));
  return wrapper;
}

// Grouped bar chart of the 5 rating-metric means per term. Each term gets a
// cluster of 5 thin bars (one per metric), all on a fixed 0–6 y-axis so
// terms are directly comparable.
export function renderGroupedRatingsChart(
  doc: Document,
  data: ModalDisplayData
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-multibar";

  const terms = data.trendTerms;
  if (terms.length === 0) {
    const empty = doc.createElement("div");
    empty.className = "bc-paper-ctec-modal-trend-empty";
    empty.textContent = "No terms to plot.";
    wrapper.append(empty);
    return wrapper;
  }

  const W = 700;
  const H = 260;
  const PL = 40;
  const PR = 16;
  const PT = 16;
  const PB = 40;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const yMax = MODAL_METRIC_SCALES.instruction;
  const yAt = (v: number) => PT + innerH - (v / yMax) * innerH;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "bc-paper-ctec-modal-multibar-svg");

  for (let i = 0; i <= yMax; i++) {
    const line = doc.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(PL));
    line.setAttribute("x2", String(W - PR));
    line.setAttribute("y1", String(yAt(i)));
    line.setAttribute("y2", String(yAt(i)));
    line.setAttribute("stroke", "#f1ebef");
    svg.append(line);

    const tick = doc.createElementNS(SVG_NS, "text");
    tick.setAttribute("x", String(PL - 6));
    tick.setAttribute("y", String(yAt(i) + 3));
    tick.setAttribute("fill", "#9b8290");
    tick.setAttribute("font-size", "10");
    tick.setAttribute("text-anchor", "end");
    tick.textContent = String(i);
    svg.append(tick);
  }

  const bandW = innerW / terms.length;
  const groupGap = Math.min(14, bandW * 0.2);
  const groupInner = bandW - groupGap;
  const barW = Math.max(2, groupInner / MODAL_RATING_METRICS.length);

  terms.forEach((term, i) => {
    const groupLeft = PL + bandW * i + groupGap / 2;

    MODAL_RATING_METRICS.forEach((kind, j) => {
      const v = term.metrics[kind] ?? 0;
      if (v <= 0) return;
      const x = groupLeft + j * barW;
      const y = yAt(v);
      const rect = doc.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(x + 0.5));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(Math.max(1, barW - 1)));
      rect.setAttribute("height", String(PT + innerH - y));
      rect.setAttribute("fill", RATING_METRIC_COLORS[kind]);

      const title = doc.createElementNS(SVG_NS, "title");
      title.textContent = `${term.term} · ${MODAL_METRIC_LABELS[kind]}: ${v.toFixed(2)}`;
      rect.append(title);
      svg.append(rect);
    });

    const cx = PL + bandW * (i + 0.5);
    const termLabel = doc.createElementNS(SVG_NS, "text");
    termLabel.setAttribute("x", String(cx));
    termLabel.setAttribute("y", String(H - 14));
    termLabel.setAttribute("fill", "#7a596a");
    termLabel.setAttribute("font-size", "10");
    termLabel.setAttribute("text-anchor", "middle");
    termLabel.textContent = abbrTerm(term.term);
    svg.append(termLabel);
  });

  wrapper.append(svg);
  wrapper.append(renderRatingMetricLegend(doc));
  return wrapper;
}
