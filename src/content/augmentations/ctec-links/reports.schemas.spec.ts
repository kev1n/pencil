import { describe, expect, it } from "vitest";

// `reports.ts` transitively imports `ctec-index/storage.ts`, which fires
// a `chrome.storage.local.get` at module load. jsdom doesn't ship `chrome` —
// install a no-op stub before importing under test. (ESM imports are hoisted,
// so this assignment must happen before the dynamic require below.)
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve()
    },
    onChanged: { addListener: () => undefined }
  },
  runtime: { sendMessage: () => undefined, getURL: (path: string) => path }
};

const {
  CtecReportChartSchema,
  CtecReportScalarMetricSchema,
  CtecReportSummarySchema
} = await import("./reports.schemas");
const { parseCtecReportHtmlSafe } = await import("./reports.safe");

// Minimal synthesized Bluera report HTML mirroring the structure
// `parseCtecReportHtml` walks: a single `.report-block` with a numeric
// scalar metric (Mean + Response Count) under "Overall rating of the
// course". One frequency-block image gives us a chart entry.
const REPORT_HTML = `
<div class="report-block">
  <div class="ReportBlockTitle">Overall rating of the course</div>
  <table class="block-table">
    <tbody>
      <tr><th>Response Count</th><td>120</td></tr>
      <tr><th>Mean</th><td>4.7</td></tr>
    </tbody>
  </table>
  <div class="FrequencyBlock_chart">
    <img src="/chart.png" alt="distribution"/>
  </div>
</div>
`;

describe("parseCtecReportHtmlSafe (Wave 9)", () => {
  it("returns ok=true with a validated summary for the synthesized fixture", () => {
    const result = parseCtecReportHtmlSafe(REPORT_HTML, "https://example.com/r/1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBeNull();
    expect(result.value?.url).toBe("https://example.com/r/1");
    expect(result.value?.metrics.course?.mean).toBeCloseTo(4.7);
    expect(result.value?.metrics.course?.responseCount).toBe(120);
    expect(result.value?.charts).toHaveLength(1);
    expect(result.value?.charts[0]?.question).toBe("Overall rating of the course");
  });

  it("returns ok=true value=null when no .report-block elements exist", () => {
    const result = parseCtecReportHtmlSafe("<div>not a report</div>", "u");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });
});

describe("CtecReportSummarySchema (Wave 9)", () => {
  it("rejects a summary missing the metrics field", () => {
    const result = CtecReportSummarySchema.safeParse({
      url: "u",
      parsedAt: 0,
      charts: [],
      commentGroups: []
    });
    expect(result.success).toBe(false);
  });

  it("rejects a scalar metric where mean is a string", () => {
    const result = CtecReportScalarMetricSchema.safeParse({
      mean: "4.7",
      responseCount: 100
    });
    expect(result.success).toBe(false);
  });

  it("rejects a chart whose alt is undefined (must be string|null)", () => {
    const result = CtecReportChartSchema.safeParse({
      question: "q",
      imageUrl: "https://example/c.png"
    });
    expect(result.success).toBe(false);
  });
});
