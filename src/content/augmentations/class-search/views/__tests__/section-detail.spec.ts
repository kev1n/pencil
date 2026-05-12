import { describe, expect, it, vi } from "vitest";

import type { SeatsNotesResult, SeatsNotesSuccess } from "../../../seats-notes/types";
import {
  renderSectionDetail,
  renderSectionDetailError,
  renderSectionDetailLoading
} from "../section-detail";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function makeSuccess(overrides: Partial<SeatsNotesSuccess> = {}): SeatsNotesSuccess {
  return {
    ok: true,
    requestedClassNumber: "11111",
    criteriaClassNumber: "11111",
    classCapacity: "30",
    enrollmentTotal: "20",
    availableSeats: "10",
    waitListCapacity: "5",
    waitListTotal: "0",
    classAttributes: "Discovery Seminar",
    enrollmentRequirements: "Permission of instructor",
    classNotes: "Bring laptop",
    isCombinedSection: false,
    combinedSectionRows: [],
    ...overrides
  };
}

describe("renderSectionDetail — success", () => {
  it("does not render a duplicated section/time/room header", () => {
    const doc = fresh();
    const wrap = renderSectionDetail(doc, {
      detail: makeSuccess(),
      fetchedAt: Date.now(),
      onRefresh: vi.fn()
    });
    // The section row above the panel already shows section label, time,
    // and room — re-rendering them inside the panel was visual noise.
    expect(wrap.querySelector(".bc-cs-detail-header")).toBeNull();
  });

  it("renders all stat cells with values + labels", () => {
    const doc = fresh();
    const wrap = renderSectionDetail(doc, {
      detail: makeSuccess(),
      fetchedAt: Date.now(),
      onRefresh: vi.fn()
    });
    const stats = wrap.querySelectorAll<HTMLElement>(".bc-cs-stat");
    expect(stats.length).toBe(5);
    const labels = Array.from(stats).map(
      (s) => s.querySelector(".bc-cs-stat-label")?.textContent
    );
    expect(labels).toEqual(["Capacity", "Enrolled", "Open seats", "Wait cap", "Wait total"]);
  });

  it("renders class notes / attributes / requirements blocks", () => {
    const doc = fresh();
    const wrap = renderSectionDetail(doc, {
      detail: makeSuccess(),
      fetchedAt: Date.now(),
      onRefresh: vi.fn()
    });
    const blocks = Array.from(wrap.querySelectorAll<HTMLElement>(".bc-cs-detail-block"));
    const labels = blocks.map((b) => b.querySelector(".bc-cs-detail-block-label")?.textContent);
    expect(labels).toEqual(["Class Attributes", "Enrollment Requirements", "Class Notes"]);
    const bodies = blocks.map((b) => b.querySelector(".bc-cs-detail-block-body")?.textContent);
    expect(bodies).toEqual([
      "Discovery Seminar",
      "Permission of instructor",
      "Bring laptop"
    ]);
  });

  it("skips empty stats and blocks when their values are null", () => {
    const doc = fresh();
    const wrap = renderSectionDetail(doc, {
      detail: makeSuccess({
        classCapacity: null,
        availableSeats: null,
        classAttributes: null
      }),
      fetchedAt: Date.now(),
      onRefresh: vi.fn()
    });
    const labels = Array.from(wrap.querySelectorAll<HTMLElement>(".bc-cs-stat-label")).map(
      (l) => l.textContent
    );
    expect(labels).not.toContain("Capacity");
    expect(labels).not.toContain("Open seats");
    const blockLabels = Array.from(
      wrap.querySelectorAll<HTMLElement>(".bc-cs-detail-block-label")
    ).map((l) => l.textContent);
    expect(blockLabels).not.toContain("Class Attributes");
  });

  it("shows the 'no detail panel' note when only the search-page row was returned", () => {
    const doc = fresh();
    const detail: SeatsNotesSuccess = {
      ok: true,
      requestedClassNumber: "X",
      criteriaClassNumber: null,
      classCapacity: null,
      enrollmentTotal: null,
      availableSeats: null,
      waitListCapacity: null,
      waitListTotal: null,
      classAttributes: null,
      enrollmentRequirements: null,
      classNotes: null,
      isCombinedSection: false,
      combinedSectionRows: []
    };
    const wrap = renderSectionDetail(doc, {
      detail,
      fetchedAt: Date.now(),
      onRefresh: vi.fn()
    });
    expect(wrap.querySelector(".bc-cs-detail-note")?.textContent).toContain(
      "did not return a detail panel"
    );
  });

  it("renders a stats-bar with the relative timestamp + 'Refresh seats' button (no bottom footer)", () => {
    const doc = fresh();
    const wrap = renderSectionDetail(doc, {
      detail: makeSuccess(),
      fetchedAt: Date.now(),
      onRefresh: vi.fn()
    });
    const bar = wrap.querySelector<HTMLElement>(".bc-cs-detail-stats-bar");
    expect(bar?.querySelector(".bc-cs-detail-stamp")?.textContent).toContain("just now");
    expect(bar?.querySelector(".bc-cs-detail-refresh")?.textContent).toBe("Refresh seats");
    // Refresh control no longer lives in a separate bottom footer on success.
    expect(wrap.querySelector(".bc-cs-detail-footer")).toBeNull();
  });

  it("calls onRefresh when the Refresh button is clicked + disables it", () => {
    const doc = fresh();
    const onRefresh = vi.fn();
    const wrap = renderSectionDetail(doc, {
      detail: makeSuccess(),
      fetchedAt: Date.now(),
      onRefresh
    });
    const btn = wrap.querySelector<HTMLButtonElement>(".bc-cs-detail-refresh");
    btn?.click();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(btn?.disabled).toBe(true);
    expect(btn?.textContent).toBe("Refreshing…");
  });

  it("renders the combined-section disclaimer when isCombinedSection + no perSection", () => {
    const doc = fresh();
    const wrap = renderSectionDetail(doc, {
      detail: makeSuccess({ isCombinedSection: true, classCapacity: "60" }),
      fetchedAt: Date.now(),
      onRefresh: vi.fn()
    });
    const warning = wrap.querySelector(".bc-cs-detail-combined-warning");
    expect(warning?.textContent).toContain("Many of these 60 seats");
    expect(wrap.querySelector(".bc-cs-detail-per-section")).toBeNull();
  });

  it("renders real per-section numbers when perSection is provided + drops the disclaimer", () => {
    const doc = fresh();
    const wrap = renderSectionDetail(doc, {
      detail: makeSuccess({ isCombinedSection: true, classCapacity: "60", enrollmentTotal: "20" }),
      fetchedAt: Date.now(),
      onRefresh: vi.fn(),
      perSection: {
        capacity: 30,
        enrolled: 20,
        available: 10,
        waitlist: 0,
        status: "Closed",
        label: "COMP_SCI 346-0-1"
      }
    });
    const block = wrap.querySelector(".bc-cs-detail-per-section");
    expect(block).not.toBeNull();
    expect(block?.querySelector(".bc-cs-detail-per-section-headline")?.textContent).toBe(
      "20/30 enrolled in this section"
    );
    expect(block?.querySelector(".bc-cs-detail-per-section-line")?.textContent).toContain(
      "10 open"
    );
    expect(block?.querySelector(".bc-cs-detail-per-section-line")?.textContent).toContain(
      "combined 20/60"
    );
    expect(wrap.querySelector(".bc-cs-detail-combined-warning")).toBeNull();
  });
});

describe("renderSectionDetail — failure", () => {
  it("renders the failure error message + footer", () => {
    const doc = fresh();
    const detail: SeatsNotesResult = { ok: false, error: "boom" };
    const wrap = renderSectionDetail(doc, {
      detail,
      fetchedAt: Date.now(),
      onRefresh: vi.fn()
    });
    expect(wrap.querySelector(".bc-cs-detail-error")?.textContent).toBe("boom");
    expect(wrap.querySelector(".bc-cs-detail-footer")).not.toBeNull();
    // No stats grid on failure.
    expect(wrap.querySelector(".bc-cs-detail-stats")).toBeNull();
  });
});

describe("renderSectionDetailLoading", () => {
  it("renders a spinner + 'Fetching…' line", () => {
    const doc = fresh();
    const wrap = renderSectionDetailLoading(doc);
    expect(wrap.classList.contains("bc-cs-detail")).toBe(true);
    expect(wrap.querySelector(".bc-cs-spinner")).not.toBeNull();
    expect(wrap.textContent).toContain("Fetching seats and notes from CAESAR");
  });
});

describe("renderSectionDetailError", () => {
  it("renders the error message and a Retry button that fires retry()", () => {
    const doc = fresh();
    const retry = vi.fn();
    const wrap = renderSectionDetailError(doc, new Error("network"), retry);
    expect(wrap.querySelector(".bc-cs-detail-error")?.textContent).toBe("network");
    const btn = wrap.querySelector<HTMLButtonElement>(".bc-cs-detail-refresh");
    expect(btn?.textContent).toBe("Refresh");
    btn?.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("stringifies non-Error values for the error label", () => {
    const doc = fresh();
    const wrap = renderSectionDetailError(doc, "raw string", vi.fn());
    expect(wrap.querySelector(".bc-cs-detail-error")?.textContent).toBe("raw string");
  });
});
