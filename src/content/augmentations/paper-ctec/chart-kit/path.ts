// Path/curve primitives: the shared Catmull-Rom-to-Bezier helper used by
// both the chart-histogram distribution overlay and the hours-density area
// curve.
//
// We use the manual Catmull-Rom formula here (uniform parameterization,
// alpha=0) rather than reaching for d3-shape's `curveCatmullRom` because:
//   1. The two existing chart files are byte-identical in their math, so
//      lifting the formula is a strict dedupe with zero visual delta.
//   2. The legacy code anchors the area's first/last segment to the
//      baseline at the first/last *point* (not the chart edge). Stitching
//      that around d3's curve would leak more state through callbacks
//      than the current 12-line helper costs.
//
// d3-shape was previously re-exported as an escape hatch (`line`,
// `curveCatmullRom`) but nothing in production used it, so the dependency
// has been dropped. Anyone tempted to "fix" this with a d3 call should
// re-add the dep deliberately rather than silently leaning on a re-export.

export type Point = [number, number];

export type BuildLinePathOptions = {
  // When set, the path closes back to the y=baseline horizontal under
  // the first and last points (creating a fillable area). Without it,
  // the path is just an open Catmull-Rom polyline.
  baseline?: number;
};

export type BuildLinePathResult = {
  path: string;
  pts: Point[];
};

// Builds a smooth path through `points` using uniform Catmull-Rom
// interpolation. When `opts.baseline` is provided, the path opens with
// `M firstX baseline L firstX firstY` and closes with `L lastX baseline Z`
// so a fill renders as a closed area between the curve and the baseline.
export function buildLinePath(
  points: Point[],
  opts: BuildLinePathOptions = {}
): BuildLinePathResult {
  if (points.length === 0) return { path: "", pts: points };

  const firstX = points[0]![0];
  const lastX = points[points.length - 1]![0];
  const segs: string[] = [];
  const baseline = opts.baseline;

  if (typeof baseline === "number") {
    segs.push(`M ${firstX} ${baseline}`);
    segs.push(`L ${firstX} ${points[0]![1]}`);
  } else {
    segs.push(`M ${firstX} ${points[0]![1]}`);
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    segs.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`);
  }

  if (typeof baseline === "number") {
    segs.push(`L ${lastX} ${baseline} Z`);
  }

  return { path: segs.join(" "), pts: points };
}
