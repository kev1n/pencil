import { renderSparkline } from "../chart-kit";
import {
  appendTrendZones,
  HOURS_TREND_ZONES,
  RATING_TREND_ZONES
} from "../chart-zones";
import { renderMetricDistribution } from "../dist-render";
import {
  renderHoursDensity,
  type HoursDensitySeries
} from "../hours-density";
import {
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { abbrTerm } from "../term-format";

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
//
// NOTE: The SVG-emission math here is owned by Wave 7 (chart kit migration to
// d3). This module is intentionally left imperative — modal/charts-section.ts
// (Wave 6c) splats the returned HTMLElement into a lit-html template.
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

    // Fixed scale per metric: rating metrics share a 1–6 axis, hours uses
    // 0–20. This keeps trend lines visually comparable across courses
    // (auto-scaling makes a 4.5→5.4 trend look identical to a 2.0→2.3
    // one). Integer (or 4-step) ticks anchor the colored zones.
    const isHours = metric === "hours";
    const yMin = isHours ? 0 : 1;
    const yMax = isHours ? 20 : 6;
    const range = yMax - yMin;
    const tickValues = isHours ? [0, 4, 8, 12, 16, 20] : [1, 2, 3, 4, 5, 6];
    const zones = isHours ? HOURS_TREND_ZONES : RATING_TREND_ZONES;

    const xAt = (i: number) =>
      PL + (i / Math.max(1, values.length - 1)) * (W - PL - PR);
    const yAt = (v: number) =>
      H - PB - ((v - yMin) / range) * (H - PT - PB);

    const SVG_NS = "http://www.w3.org/2000/svg";
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "bc-paper-ctec-modal-trend-svg");

    appendTrendZones(doc, svg, zones, PL, W - PR, yAt);

    for (const yv of tickValues) {
      const line = doc.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(PL));
      line.setAttribute("x2", String(W - PR));
      line.setAttribute("y1", String(yAt(yv)));
      line.setAttribute("y2", String(yAt(yv)));
      line.style.stroke = "var(--bc-color-chart-trend-axis)";
      svg.append(line);

      const tick = doc.createElementNS(SVG_NS, "text");
      tick.setAttribute("x", String(PL - 6));
      tick.setAttribute("y", String(yAt(yv) + 3));
      tick.style.fill = "var(--bc-color-chart-trend-text)";
      tick.setAttribute("font-size", "10");
      tick.setAttribute("text-anchor", "end");
      tick.textContent = String(yv);
      svg.append(tick);
    }

    const points = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    renderSparkline(doc, svg, points, {
      strokeColor: "var(--bc-color-accent)",
      strokeWidth: 2,
      dotRadius: 3.5
    });

    values.forEach((v, i) => {
      const valueLabel = doc.createElementNS(SVG_NS, "text");
      valueLabel.setAttribute("x", String(xAt(i)));
      valueLabel.setAttribute("y", String(yAt(v) - 8));
      valueLabel.style.fill = "var(--bc-color-accent)";
      valueLabel.setAttribute("font-size", "11");
      valueLabel.setAttribute("font-weight", "700");
      valueLabel.setAttribute("text-anchor", "middle");
      valueLabel.textContent = v.toFixed(1);
      svg.append(valueLabel);

      const termLabel = doc.createElementNS(SVG_NS, "text");
      termLabel.setAttribute("x", String(xAt(i)));
      termLabel.setAttribute("y", String(H - 12));
      termLabel.style.fill = "var(--bc-color-chart-trend-text-strong)";
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
//
// When `data` is supplied we mirror the workload card's two-pill pattern:
// the selected term's pill is labeled with the term abbreviation (e.g.
// "Sp'23 5.4") and a secondary "HISTORICAL AVG" pill stacks above it.
export function renderDistChart(
  doc: Document,
  term: ModalTerm | null,
  metric: ModalMetricKind,
  data?: ModalDisplayData
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-dist";

  if (!term) {
    wrapper.textContent = "No term selected.";
    return wrapper;
  }

  const isHours = metric === "hours";
  const unit = isHours ? "h" : "";
  const termAbbr = abbrTerm(term.term);
  const termValue = term.metrics[metric];
  const primaryLabel = termAbbr
    ? typeof termValue === "number"
      ? `${termAbbr} ${termValue.toFixed(1)}${unit}`
      : termAbbr
    : undefined;

  const historicalMean =
    data && data.terms.length >= 2 ? data.metrics[metric].mean : undefined;
  const showHistorical =
    typeof historicalMean === "number" && historicalMean > 0;
  const historicalLabel = showHistorical
    ? `HISTORICAL AVG ${historicalMean!.toFixed(1)}${unit}`
    : undefined;

  // Aggregate per-bar counts across every term that has a chart for this
  // metric, so the histogram can overlay a dashed slate spline through
  // the multi-term distribution. Length matches the metric's bucket
  // count (6 for both ratings and hours histograms).
  const historicalCountsAndTotal = (() => {
    if (!showHistorical || !data) return null;
    let summed: number[] | null = null;
    let total = 0;
    for (const t of data.terms) {
      const chart = t.charts[metric];
      if (!chart?.counts) continue;
      if (!summed) summed = new Array(chart.counts.length).fill(0);
      if (summed.length !== chart.counts.length) continue;
      for (let i = 0; i < chart.counts.length; i += 1) {
        summed[i]! += chart.counts[i] ?? 0;
      }
      total += chart.counts.reduce((sum, c) => sum + c, 0);
    }
    return summed && total > 0 ? { counts: summed, total } : null;
  })();

  wrapper.append(
    renderMetricDistribution({
      doc,
      term,
      metric,
      altLabel: `${metric} distribution for ${term.term}`,
      className: "bc-paper-ctec-modal-dist-image",
      primaryLabel,
      historicalMean: showHistorical ? historicalMean : undefined,
      historicalLabel: showHistorical ? historicalLabel : undefined,
      historicalCounts: historicalCountsAndTotal?.counts,
      historicalTotal: historicalCountsAndTotal?.total,
      renderHoursBuckets: (t) => {
        const series: HoursDensitySeries[] = [];
        if (
          showHistorical &&
          data &&
          data.aggregateHoursBuckets.length > 0
        ) {
          series.push({
            label: historicalLabel ?? "HISTORICAL AVG",
            buckets: data.aggregateHoursBuckets,
            mean: historicalMean,
            style: "secondary"
          });
        }
        const tAbbr = abbrTerm(t.term);
        const tValue = t.metrics.hours;
        const primary =
          tAbbr && typeof tValue === "number"
            ? `${tAbbr} ${tValue.toFixed(1)}h`
            : typeof tValue === "number"
              ? `AVG ${tValue.toFixed(1)}h`
              : tAbbr || "AVG";
        series.push({
          label: primary,
          buckets: t.hoursBuckets,
          mean: tValue,
          style: "primary"
        });
        return renderHoursDensity(doc, series);
      }
    })
  );
  return wrapper;
}
