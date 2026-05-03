import {
  MODAL_METRIC_LABELS,
  MODAL_METRIC_SCALES,
  MODAL_RATING_METRICS,
  type ModalDisplayData
} from "./modal-data";
import {
  RATING_METRIC_COLORS,
  abbrTerm,
  renderRatingMetricLegend
} from "./chart-shared";

const SVG_NS = "http://www.w3.org/2000/svg";

// Multi-line trend chart: one line per rating metric, plotted across terms
// (oldest → newest) on a fixed 0–6 scale. Missing metric values for a term
// break the line at that gap rather than synthesizing a midpoint.
export function renderMultilineRatingsChart(
  doc: Document,
  data: ModalDisplayData
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-multibar";

  const terms = data.trendTerms;
  if (terms.length < 2) {
    const empty = doc.createElement("div");
    empty.className = "bc-paper-ctec-modal-trend-empty";
    empty.textContent = "Need at least two terms to draw a trend.";
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
  const xAt = (i: number) =>
    PL + (i / Math.max(1, terms.length - 1)) * innerW;
  const yAt = (v: number) => PT + innerH - (v / yMax) * innerH;

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

  for (const kind of MODAL_RATING_METRICS) {
    const color = RATING_METRIC_COLORS[kind];

    // Build polyline segments, breaking on gaps (missing metric values).
    const segments: { i: number; v: number }[][] = [];
    let current: { i: number; v: number }[] = [];
    terms.forEach((term, i) => {
      const v = term.metrics[kind];
      if (typeof v === "number") {
        current.push({ i, v });
      } else if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    });
    if (current.length > 0) segments.push(current);

    for (const seg of segments) {
      if (seg.length >= 2) {
        const polyline = doc.createElementNS(SVG_NS, "polyline");
        polyline.setAttribute(
          "points",
          seg.map((p) => `${xAt(p.i)},${yAt(p.v)}`).join(" ")
        );
        polyline.setAttribute("fill", "none");
        polyline.setAttribute("stroke", color);
        polyline.setAttribute("stroke-width", "1.8");
        polyline.setAttribute("stroke-linecap", "round");
        polyline.setAttribute("stroke-linejoin", "round");
        svg.append(polyline);
      }

      for (const p of seg) {
        const dot = doc.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", String(xAt(p.i)));
        dot.setAttribute("cy", String(yAt(p.v)));
        dot.setAttribute("r", "3");
        dot.setAttribute("fill", "white");
        dot.setAttribute("stroke", color);
        dot.setAttribute("stroke-width", "1.6");
        const title = doc.createElementNS(SVG_NS, "title");
        title.textContent = `${terms[p.i]!.term} · ${MODAL_METRIC_LABELS[kind]}: ${p.v.toFixed(2)}`;
        dot.append(title);
        svg.append(dot);
      }
    }
  }

  terms.forEach((term, i) => {
    const termLabel = doc.createElementNS(SVG_NS, "text");
    termLabel.setAttribute("x", String(xAt(i)));
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
