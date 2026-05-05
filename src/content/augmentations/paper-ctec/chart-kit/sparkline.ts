// Polyline + per-point dots emitter shared by the trend charts in
// modal/charts.ts, analytics-preview.ts, and the tiny sparkline in
// modal/overview.ts. Replaces three near-identical SVG-emit loops.
//
// The caller owns axes, zones, value labels, and tick labels — this
// helper just paints the line itself plus optional dots. Stroke colors
// flow through `var(--bc-color-*)` tokens so theme switching propagates.

const SVG_NS = "http://www.w3.org/2000/svg";

export type SparklinePoint = { x: number; y: number };

export type RenderSparklineOptions = {
  // CSS color reference for the polyline + dot strokes (e.g.
  // "var(--bc-color-accent)"). Always token-based, never raw hex.
  strokeColor: string;
  strokeWidth: number;
  // CSS color reference for dot fill. Defaults to the chart background
  // var so dots sit visually "on top of" the line — same look the trend
  // charts use today.
  dotFill?: string;
  // Per-point radius. When 0/undefined, no dots are emitted.
  dotRadius?: number;
  // When true, only the last point gets a dot (sparkline mode in
  // overview.ts) and that dot's fill is the stroke color (filled, not
  // outlined). Mutually exclusive with `dotRadius` for "all points".
  lastDotOnly?: boolean;
  // Last-dot radius for sparkline mode. Defaults to 2.
  lastDotRadius?: number;
  // Per-point dot stroke width. Defaults to a polyline-derived value
  // (1.6 if strokeWidth >= 2, else 1.4) — matches what the existing
  // trend renderers had baked in.
  dotStrokeWidth?: number;
};

// Appends a single <polyline> through `points`, then optionally one
// <circle> per point. Returns the polyline element so the caller can
// further decorate it (e.g. add `stroke-dasharray` for "secondary"
// trends). Empty `points` is a no-op.
export function renderSparkline(
  doc: Document,
  svg: SVGSVGElement,
  points: SparklinePoint[],
  opts: RenderSparklineOptions
): SVGPolylineElement | null {
  if (points.length === 0) return null;

  const polyline = doc.createElementNS(SVG_NS, "polyline");
  polyline.setAttribute("fill", "none");
  polyline.style.stroke = opts.strokeColor;
  polyline.setAttribute("stroke-width", String(opts.strokeWidth));
  polyline.setAttribute("stroke-linecap", "round");
  polyline.setAttribute("stroke-linejoin", "round");
  polyline.setAttribute(
    "points",
    points.map((p) => `${p.x},${p.y}`).join(" ")
  );
  svg.append(polyline);

  if (opts.lastDotOnly) {
    const last = points[points.length - 1]!;
    const dot = doc.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", String(last.x));
    dot.setAttribute("cy", String(last.y));
    dot.setAttribute("r", String(opts.lastDotRadius ?? 2));
    dot.style.fill = opts.strokeColor;
    svg.append(dot);
    return polyline;
  }

  if (typeof opts.dotRadius === "number" && opts.dotRadius > 0) {
    for (const p of points) {
      const dot = doc.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", String(p.x));
      dot.setAttribute("cy", String(p.y));
      dot.setAttribute("r", String(opts.dotRadius));
      dot.style.fill = opts.dotFill ?? "var(--bc-color-bg)";
      dot.style.stroke = opts.strokeColor;
      dot.setAttribute(
        "stroke-width",
        String(
          opts.dotStrokeWidth ?? (opts.strokeWidth >= 2 ? 1.6 : 1.4)
        )
      );
      svg.append(dot);
    }
  }

  return polyline;
}
