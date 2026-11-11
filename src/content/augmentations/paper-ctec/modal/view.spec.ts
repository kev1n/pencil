import { afterEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_MODAL_ID } from "../constants";
import type { ModalComment, ModalDisplayData, ModalTerm } from "../modal-data";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState
} from "./types";
import { createModalView, type ModalView } from "./view";

function term(name: string, index: number, rating: number): ModalTerm {
  return {
    id: `${name}-${index}`,
    term: name,
    instructor: "Sample Instructor",
    description: "STAT 210-0-20 Introductory Statistics",
    responses: 40,
    reportUrl: `https://example.com/${index}`,
    metrics: {
      instruction: rating,
      course: rating,
      learned: rating,
      challenging: rating,
      stimulating: rating,
      hours: 5
    },
    metricResponseCounts: { instruction: 40, course: 40, learned: 40, hours: 40 },
    charts: { instruction: { imageUrl: "", alt: null, counts: [0, 0, 2, 8, 20, 10] } },
    hoursBuckets: [
      { label: "3 or fewer", count: 30 },
      { label: "4 - 7", count: 10 }
    ]
  };
}

function comment(termName: string, text: string, topics: string[]): ModalComment {
  return {
    term: termName,
    instructor: "Sample Instructor",
    description: "STAT 210-0-20 Introductory Statistics",
    prompt: "",
    text,
    topics,
    tone: "pos",
    length: text.length
  };
}

function sampleData(): ModalDisplayData {
  const terms = [term("2026 Fall", 0, 5.4), term("2026 Spring", 1, 5.0)];
  return {
    course: {
      subject: "STAT",
      catalog: "210-0",
      title: "Introductory Statistics",
      instructor: "Sample Instructor",
      sectionTerm: "2026 Fall",
      reportUrl: null
    },
    terms,
    trendTerms: [...terms].reverse(),
    responses: 80,
    metrics: {} as ModalDisplayData["metrics"],
    aggregateHoursBuckets: [
      { label: "3 or fewer", count: 60 },
      { label: "4 - 7", count: 20 }
    ],
    comments: [
      comment("2026 Fall", "Office hours saved me.", ["office hours"]),
      comment("2026 Spring", "Go to office hours early.", ["office hours"]),
      comment("2026 Spring", "The slides were clear.", [])
    ],
    topics: []
  };
}

function setup(overrides: Partial<AnalyticsModalInput> = {}) {
  const view: ModalView = createModalView({ doc: document });
  const state: AnalyticsModalState = {
    selectedTermId: null,
    commentsQuery: "",
    commentsSentimentFilter: "all",
    commentsVisibleCount: 50,
    dryRun: null,
    dryRunDismissed: false,
    activePreset: null
  };
  const input: AnalyticsModalInput = {
    identity: {
      subject: "STAT",
      catalog: "210-0",
      title: "Introductory Statistics",
      instructor: "Sample Instructor",
      sectionTerm: ""
    },
    data: sampleData(),
    loading: false,
    errorMessage: null,
    notFound: false,
    canRefresh: true,
    canLoadMore: false,
    loadMoreBatchSize: 3,
    remainingTerms: 0,
    parsedTermCount: 2,
    backgroundRefreshing: false,
    refreshFlash: null,
    strategy: "combo",
    freshLensLoading: false,
    courseLensRedundant: false,
    instructorLensRedundant: false,
    ...overrides
  };
  const rerender = () => view.open(input, state, callbacks);
  const callbacks = new Proxy(
    {
      onClose: vi.fn(() => view.close()),
      onTermChange: vi.fn((id: string | null) => {
        state.selectedTermId = id;
        rerender();
      }),
      onRefresh: vi.fn(),
      onOpenDryRun: vi.fn()
    } as Record<string, (...args: never[]) => void>,
    { get: (target, key: string) => target[key] ?? (() => undefined) }
  ) as unknown as AnalyticsModalCallbacks & {
    onClose: ReturnType<typeof vi.fn>;
    onTermChange: ReturnType<typeof vi.fn>;
    onRefresh: ReturnType<typeof vi.fn>;
    onOpenDryRun: ReturnType<typeof vi.fn>;
  };
  rerender();
  const sheet = document.getElementById(ANALYTICS_MODAL_ID)!;
  return { view, state, input, callbacks, sheet };
}

const texts = (root: Element, selector: string): string[] =>
  Array.from(root.querySelectorAll(selector)).map((el) =>
    (el.textContent ?? "").replace(/\s+/g, " ").trim()
  );

afterEach(() => {
  document.getElementById(ANALYTICS_MODAL_ID)?.remove();
});

describe("analytics side sheet", () => {
  it("docks one sheet with a term switch, ratings, hours and comments", () => {
    const { sheet } = setup();
    expect(sheet.classList.contains("bc-sheet")).toBe(true);
    expect(sheet.getAttribute("aria-modal")).toBeNull();
    expect(texts(sheet, ".bc-sheet-code")).toEqual(["STAT 210"]);
    expect(texts(sheet, ".bc-sheet-term")).toEqual(["All terms", "’26", "’26"]);
    expect(sheet.querySelectorAll(".bc-sheet-rate")).toHaveLength(5);
    expect(sheet.querySelectorAll(".bc-sheet-spark")).toHaveLength(5);
    expect(sheet.querySelectorAll(".bc-sheet-hist-col")).toHaveLength(2);
    expect(sheet.querySelectorAll(".bc-sheet-c")).toHaveLength(3);
    expect(texts(sheet, ".bc-sheet-meta")[0]).toBe("Sample Instructor·80 responses");
  });

  it("turns the whole sheet into one term when a term is picked", () => {
    const { sheet, callbacks } = setup();
    sheet.querySelectorAll<HTMLElement>(".bc-sheet-term")[2]!.click();
    expect(callbacks.onTermChange).toHaveBeenCalledWith("2026 Spring-1");
    expect(sheet.querySelector(".bc-sheet-link")?.getAttribute("href")).toBe(
      "https://example.com/1"
    );
    expect(sheet.querySelectorAll(".bc-sheet-spark")).toHaveLength(0);
    // One chart with counts, four without.
    expect(sheet.querySelectorAll(".bc-sheet-dist")).toHaveLength(1);
    expect(texts(sheet, ".bc-sheet-rate-note")).toEqual(Array(4).fill("No chart"));
    expect(sheet.querySelectorAll(".bc-sheet-c")).toHaveLength(2);
    expect(sheet.querySelector(".bc-sheet-c-meta")).toBeNull();
  });

  it("searches for an often-mentioned phrase and clears it on a second click", () => {
    const { sheet, state } = setup();
    const topic = () => sheet.querySelector<HTMLElement>(".bc-sheet-topic")!;
    expect(texts(sheet, ".bc-sheet-topic")).toEqual(["office hours2"]);
    topic().click();
    expect(state.commentsQuery).toBe("office hours");
    expect(topic().getAttribute("aria-pressed")).toBe("true");
    expect(sheet.querySelectorAll(".bc-sheet-c")).toHaveLength(2);
    expect(texts(sheet, "mark.bc-sheet-q")).toEqual(["Office hours", "office hours"]);
    topic().click();
    expect(state.commentsQuery).toBe("");
    expect(sheet.querySelectorAll(".bc-sheet-c")).toHaveLength(3);
  });

  it("says so when a search finds nothing", () => {
    const { sheet } = setup();
    const input = sheet.querySelector<HTMLInputElement>(".bc-sheet-search input")!;
    input.value = "zebra";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(texts(sheet, ".bc-sheet-empty")).toEqual(["No comments mention “zebra”"]);
  });

  it("shows loading, error and not-found in place of the report", () => {
    let s = setup({ data: null, loading: true, canRefresh: false });
    expect(texts(s.sheet, ".bc-sheet-status-title")).toEqual(["Loading CTEC reports"]);
    expect(s.sheet.querySelector(".bc-sheet-terms")).toBeNull();
    s.view.close();

    s = setup({ data: null, errorMessage: "Timed out." });
    expect(texts(s.sheet, ".bc-sheet-status-text")).toEqual(["Timed out."]);
    s.sheet.querySelector<HTMLElement>(".bc-sheet-status button")!.click();
    expect(s.callbacks.onRefresh).toHaveBeenCalled();
    s.view.close();

    s = setup({ data: null, notFound: true, canRefresh: false });
    s.sheet.querySelector<HTMLElement>(".bc-sheet-status button")!.click();
    expect(s.callbacks.onOpenDryRun).toHaveBeenCalled();
  });

  it("closes on Escape and removes itself", () => {
    const { view, callbacks } = setup();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    expect(view.isOpen()).toBe(false);
    expect(document.getElementById(ANALYTICS_MODAL_ID)).toBeNull();
  });
});
