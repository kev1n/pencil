import { describe, expect, it } from "vitest";

import { niceStep, PERCENT_AXIS_STEPS, scaleLinear } from "./scale";

describe("niceStep", () => {
  const steps = [...PERCENT_AXIS_STEPS];

  it("picks 2 for very flat distributions (max <= 8)", () => {
    expect(niceStep(0, steps)).toBe(2);
    expect(niceStep(7.5, steps)).toBe(2);
    expect(niceStep(8, steps)).toBe(2);
  });

  it("picks 5 when 8 < max <= 20", () => {
    expect(niceStep(8.1, steps)).toBe(5);
    expect(niceStep(15, steps)).toBe(5);
    expect(niceStep(20, steps)).toBe(5);
  });

  it("picks 10 when 20 < max <= 40", () => {
    expect(niceStep(21, steps)).toBe(10);
    expect(niceStep(30, steps)).toBe(10);
    expect(niceStep(40, steps)).toBe(10);
  });

  it("picks 20 when 40 < max <= 80", () => {
    expect(niceStep(41, steps)).toBe(20);
    expect(niceStep(60, steps)).toBe(20);
    expect(niceStep(80, steps)).toBe(20);
  });

  it("picks 25 when 80 < max <= 100", () => {
    expect(niceStep(81, steps)).toBe(25);
    expect(niceStep(100, steps)).toBe(25);
  });

  it("falls through to 50 when max exceeds the ladder", () => {
    expect(niceStep(101, steps)).toBe(50);
    expect(niceStep(500, steps)).toBe(50);
  });

  it("handles a custom candidate ladder", () => {
    expect(niceStep(3, [1, 5, 10])).toBe(1);
    expect(niceStep(15, [1, 5, 10])).toBe(5);
    expect(niceStep(99, [1, 5, 10])).toBe(10);
  });
});

describe("scaleLinear re-export", () => {
  it("creates a working linear scale from d3", () => {
    const s = scaleLinear().domain([0, 100]).range([0, 200]);
    expect(s(0)).toBe(0);
    expect(s(50)).toBe(100);
    expect(s(100)).toBe(200);
  });
});
