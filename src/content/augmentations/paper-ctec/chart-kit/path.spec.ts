import { describe, expect, it } from "vitest";

import { buildLinePath, type Point } from "./path";

describe("buildLinePath", () => {
  it("returns empty path for no points", () => {
    const result = buildLinePath([]);
    expect(result.path).toBe("");
    expect(result.pts).toEqual([]);
  });

  it("starts with M for an open curve and contains Catmull-Rom Bezier segments", () => {
    const points: Point[] = [
      [0, 100],
      [50, 80],
      [100, 60],
      [150, 90]
    ];
    const result = buildLinePath(points);
    expect(result.path.startsWith("M 0 100")).toBe(true);
    expect(result.path).toContain("C ");
    // 3 segments between 4 points, each begins with `C `.
    expect(result.path.match(/C /g)?.length).toBe(3);
    // No baseline closure when baseline option is omitted.
    expect(result.path.endsWith("Z")).toBe(false);
  });

  it("opens to baseline and closes with Z when baseline is provided", () => {
    const points: Point[] = [
      [10, 50],
      [20, 30],
      [30, 60]
    ];
    const result = buildLinePath(points, { baseline: 100 });
    expect(result.path.startsWith("M 10 100 L 10 50")).toBe(true);
    expect(result.path.endsWith("L 30 100 Z")).toBe(true);
  });

  it("preserves the input points in the result", () => {
    const points: Point[] = [
      [0, 0],
      [1, 1]
    ];
    const result = buildLinePath(points);
    expect(result.pts).toBe(points);
  });

  it("uses degenerate phantom anchors at the endpoints", () => {
    // For the first interior segment, p0 falls back to p[0] itself when
    // i=0; for the last, p3 falls back to p2. We can verify by
    // hand-computing the first cp1: cp1x = p1.x + (p2.x - p0.x) / 6 with
    // p0 == p1 → cp1x = p1.x + (p2.x - p1.x) / 6.
    const points: Point[] = [
      [0, 0],
      [60, 0],
      [120, 0]
    ];
    const result = buildLinePath(points);
    // Expected first control point x: 0 + (60 - 0) / 6 = 10
    expect(result.path).toContain("C 10 0");
  });
});
