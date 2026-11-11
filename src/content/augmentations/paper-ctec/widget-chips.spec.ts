import { render } from "lit-html";
import { describe, expect, it } from "vitest";

import { errorChip, globalChip } from "./widget-chips";

type Aggregate = Parameters<typeof globalChip>[0];

function aggregate(lens: Aggregate["lens"]): Aggregate {
  const metric = { mean: 5, evaluationCount: 2, totalResponses: 40 };
  return {
    evaluationCount: 2,
    parsedCount: 2,
    aggregateEvaluationCount: 2,
    aggregateParsedCount: 2,
    maxEntriesUsed: null,
    windowTerms: [],
    latestTerm: null,
    latestUrl: null,
    allFetched: true,
    partial: false,
    lens,
    metrics: { instruction: metric, course: metric, learned: metric }
  };
}

function chipText(lens: Aggregate["lens"]): { text: string; title: string } {
  const host = document.createElement("div");
  render(globalChip(aggregate(lens)), host);
  const chip = host.querySelector("span")!;
  return { text: chip.textContent ?? "", title: chip.title };
}

describe("card rating chip", () => {
  it("shows this professor's own rating for the class unmarked", () => {
    expect(chipText("combo").text).not.toContain("≈");
  });

  it("marks a rating borrowed from the professor's other classes", () => {
    const chip = chipText("instructor");
    expect(chip.text).toContain("≈");
    expect(chip.title).toContain("their other classes");
  });

  it("marks a rating borrowed from other professors", () => {
    const chip = chipText("course");
    expect(chip.text).toContain("≈");
    expect(chip.title).toContain("other professors");
  });
});

describe("error chip", () => {
  it("asks for a refresh when the page outlived an extension update", () => {
    const host = document.createElement("div");
    render(errorChip("Extension context invalidated."), host);
    expect(host.textContent).toBe("Refresh page");
  });

  it("stays generic for other failures", () => {
    const host = document.createElement("div");
    render(errorChip("boom"), host);
    expect(host.textContent).toBe("CTEC unavailable");
  });
});
