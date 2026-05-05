// Axis emission helpers shared by chart-histogram + hours-density.
//
// These render percent-axis ticks (with gridlines + numeric labels) and
// x-axis bucket labels into an SVG. Token-aware: every fill/stroke goes
// through `var(--bc-color-*)` so theme switching flows through CSS.

const SVG_NS = "http://www.w3.org/2000/svg";

export type YAxisOptions = {
  ticks: number[];
  yAt: (v: number) => number;
  PL: number;
  innerW: number;
  // Title rendered rotated -90° on the left (e.g. "% OF RESPONSES").
  title?: string;
  // Y-position of the title's anchor along the rotation pivot.
  titleY: number;
};

// Emits horizontal gridlines + numeric tick labels for a percent y-axis.
// Mirrors the chart-histogram + hours-density pattern: zero-line is solid,
// non-zero ticks are dashed at 60% opacity. Tick labels are right-anchored
// at PL - 6 with 9px muted text.
export function appendYAxis(
  doc: Document,
  svg: SVGSVGElement,
  opts: YAxisOptions
): void {
  const { ticks, yAt, PL, innerW } = opts;
  for (const v of ticks) {
    const line = doc.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(PL));
    line.setAttribute("x2", String(PL + innerW));
    line.setAttribute("y1", String(yAt(v)));
    line.setAttribute("y2", String(yAt(v)));
    line.style.stroke = "var(--bc-color-border)";
    line.setAttribute("stroke-width", "1");
    if (v !== 0) {
      line.setAttribute("stroke-dasharray", "2 3");
      line.setAttribute("opacity", "0.6");
    }
    svg.append(line);

    const tickLabel = doc.createElementNS(SVG_NS, "text");
    tickLabel.setAttribute("x", String(PL - 6));
    tickLabel.setAttribute("y", String(yAt(v) + 3));
    tickLabel.setAttribute("text-anchor", "end");
    tickLabel.setAttribute("font-size", "9");
    tickLabel.style.fill = "var(--bc-color-text-muted)";
    tickLabel.textContent = `${v}%`;
    svg.append(tickLabel);
  }

  if (opts.title) {
    const yTitle = doc.createElementNS(SVG_NS, "text");
    yTitle.setAttribute("x", "10");
    yTitle.setAttribute("y", String(opts.titleY));
    yTitle.setAttribute("text-anchor", "middle");
    yTitle.setAttribute("font-size", "8.5");
    yTitle.style.fill = "var(--bc-color-text-subtle)";
    yTitle.setAttribute("letter-spacing", "0.6");
    yTitle.setAttribute("font-weight", "600");
    yTitle.setAttribute("transform", `rotate(-90 10 ${opts.titleY})`);
    yTitle.textContent = opts.title;
    svg.append(yTitle);
  }
}

export type XAxisOptions = {
  labels: ReadonlyArray<string>;
  // Returns the x-pixel of the i-th bucket center.
  xAt: (i: number) => number;
  // Total svg height — bucket labels sit at H-12, the title at H-1.
  H: number;
  W: number;
  title?: string;
};

// Emits the per-bucket text labels along the bottom of the chart and an
// optional all-caps axis title centered below them.
export function appendXAxis(
  doc: Document,
  svg: SVGSVGElement,
  opts: XAxisOptions
): void {
  const { labels, xAt, H, W } = opts;
  for (let i = 0; i < labels.length; i += 1) {
    const t = doc.createElementNS(SVG_NS, "text");
    t.setAttribute("x", String(xAt(i)));
    t.setAttribute("y", String(H - 12));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "9");
    t.style.fill = "var(--bc-color-text-muted)";
    t.textContent = labels[i] ?? "";
    svg.append(t);
  }

  if (opts.title) {
    const xTitle = doc.createElementNS(SVG_NS, "text");
    xTitle.setAttribute("x", String(W / 2));
    xTitle.setAttribute("y", String(H - 1));
    xTitle.setAttribute("text-anchor", "middle");
    xTitle.setAttribute("font-size", "8.5");
    xTitle.style.fill = "var(--bc-color-text-subtle)";
    xTitle.setAttribute("letter-spacing", "0.6");
    xTitle.setAttribute("font-weight", "600");
    xTitle.textContent = opts.title;
    svg.append(xTitle);
  }
}
