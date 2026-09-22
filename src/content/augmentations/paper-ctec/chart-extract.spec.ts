import { describe, expect, it } from "vitest";

import { readChartCounts } from "./chart-extract";

// Synthetic Bluera distribution chart matching the production geometry:
// 712x268, y-axis at x=224, light gridlines at 25/50/75/100% of a 446px
// span, six bars centered on the extractor's fixed row centers.
const W = 712;
const H = 268;
const AXIS_LEFT = 224;
const SPAN = 446;
const ROW_CENTERS = [30, 62, 93, 124, 155, 186];

type Rgb = [number, number, number];

const YELLOW: Rgb = [255, 255, 153];
const GREEN: Rgb = [204, 238, 153];

function drawChart(counts: number[], colors: Rgb[]): Uint8ClampedArray {
  const total = counts.reduce((a, b) => a + b, 0);
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  const paint = (x: number, y: number, [r, g, b]: Rgb) => {
    const i = (y * W + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  };
  for (let y = 0; y < 217; y += 1) {
    paint(AXIS_LEFT, y, [174, 174, 174]);
    // Anti-aliased y-axis bleed into axis_left+1.
    paint(AXIS_LEFT + 1, y, [238, 238, 238]);
    for (const pct of [0.25, 0.5, 0.75, 1]) {
      paint(Math.round(AXIS_LEFT + SPAN * pct), y, [210, 210, 210]);
    }
  }
  counts.forEach((count, row) => {
    const width = Math.round((count * SPAN) / total);
    const yc = ROW_CENTERS[row]!;
    for (let x = AXIS_LEFT + 1; x <= AXIS_LEFT + width - 1; x += 1) {
      for (let y = yc - 12; y <= yc + 12; y += 1) paint(x, y, colors[row]!);
    }
  });
  return data;
}

function colorsWithTop(top: Rgb): Rgb[] {
  return [YELLOW, YELLOW, YELLOW, YELLOW, GREEN, top];
}

describe("readChartCounts", () => {
  it("reads a desaturated mauve 6-Very High bar (the reported failure)", () => {
    const counts = [0, 0, 0, 4, 4, 7];
    const result = readChartCounts(drawChart(counts, colorsWithTop([192, 178, 192])), W, H, 15);
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ counts }) });
  });

  it("doesn't stretch a near-gridline-gray bar out to the next gridline", () => {
    const counts = [0, 0, 0, 2, 3, 11];
    const result = readChartCounts(drawChart(counts, colorsWithTop([200, 190, 200])), W, H, 16);
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ counts }) });
  });

  it("still treats axis bleed on an empty row as no bar", () => {
    const counts = [0, 0, 0, 0, 5, 10];
    const result = readChartCounts(drawChart(counts, colorsWithTop([192, 178, 192])), W, H, 15);
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ counts }) });
  });

  it("reads saturated bars as before", () => {
    const counts = [1, 2, 3, 4, 5, 6];
    const result = readChartCounts(
      drawChart(counts, [YELLOW, YELLOW, YELLOW, YELLOW, GREEN, [120, 60, 140]]),
      W,
      H,
      21
    );
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ counts }) });
  });
});
