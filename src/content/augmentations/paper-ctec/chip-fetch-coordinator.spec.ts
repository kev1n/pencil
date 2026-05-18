import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// chip-fetch-coordinator transitively imports `dom.ts`, which pulls in
// `settings.ts` and fires `chrome.storage.local.get` at module load.
// jsdom doesn't ship `chrome` — install a no-op stub first. (ESM imports
// hoist, so the assignment must happen before the dynamic import below.)
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve()
    },
    onChanged: { addListener: () => undefined }
  },
  runtime: {
    sendMessage: () => Promise.resolve(undefined),
    getURL: (path: string) => path
  }
};

// jsdom exposes `window.CSS.escape` but doesn't bind a top-level `CSS`
// global. dom.ts uses `CSS.escape(...)` unqualified — shim it for tests.
if (typeof (globalThis as { CSS?: unknown }).CSS === "undefined") {
  (globalThis as { CSS?: unknown }).CSS = {
    escape: (value: string) => value.replace(/[^\w-]/g, (c) => `\\${c}`)
  };
}

const { createChipFetchCoordinator } = await import("./chip-fetch-coordinator");
const { WIDGET_CLASS } = await import("./constants");

import type { ChipFetchCoordinatorDeps } from "./chip-fetch-coordinator";
import type {
  PaperCtecTarget,
  PaperCtecWidgetData
} from "./types";
import type { CtecLinkParams } from "../ctec-links/types";
import type { CtecReportAggregate } from "../ctec-links/reports";

function makeWidget(): HTMLElement {
  const el = document.createElement("div");
  el.classList.add(WIDGET_CLASS);
  return el;
}

function makeCard(): HTMLElement {
  return document.createElement("div");
}

function makeTarget(overrides: Partial<PaperCtecTarget> = {}): PaperCtecTarget {
  const widget = overrides.widget ?? makeWidget();
  const card = overrides.card ?? makeCard();
  const params: CtecLinkParams = overrides.params ?? {
    subject: "COMP_SCI",
    catalogNumber: "111",
    instructor: "Smith"
  };
  return {
    key: overrides.key ?? "chip-1",
    widget,
    card,
    params,
    titleHint: overrides.titleHint ?? "Fundamentals"
  };
}

function makeAggregate(): CtecReportAggregate {
  return {
    rows: [],
    yearLabel: "2024-25",
    quarterLabels: [],
    instructor: "Smith",
    overallRating: 5,
    instructionRating: 5,
    metrics: { challenge: { mean: 3, count: 10 }, hours: { mean: 5, count: 10 } }
  } as unknown as CtecReportAggregate;
}

function makeDeps(
  overrides: Partial<ChipFetchCoordinatorDeps> = {}
): ChipFetchCoordinatorDeps {
  return {
    ctecCreditPool: {
      tryConsume: vi.fn().mockReturnValue({ allowed: true, waitMs: 0 }),
      format: vi.fn().mockReturnValue(null),
      formatLimitReached: vi.fn().mockReturnValue("limit reached")
    },
    showToast: vi.fn(),
    fetchAggregate: vi.fn().mockResolvedValue({
      state: "found",
      aggregate: makeAggregate()
    } as PaperCtecWidgetData),
    enrichParams: vi.fn().mockImplementation((p) => Promise.resolve(p)),
    getCachedAggregate: vi.fn().mockReturnValue(null),
    getCourseAnalyticsSnapshot: vi.fn().mockReturnValue(null),
    getAggregateLimit: vi.fn().mockReturnValue(8),
    getFetchLimit: vi.fn().mockReturnValue(8),
    buildModalDisplayData: vi.fn().mockReturnValue(null),
    ctecErrorToastMessage: "ctec error",
    attachCartButton: vi.fn(),
    isCustomScheduleCard: vi.fn().mockReturnValue(false),
    isCtecAccessDenied: vi.fn().mockReturnValue(false),
    openAnalyticsModal: vi.fn(),
    renderIdle: vi.fn(),
    renderLoading: vi.fn(),
    renderWidget: vi.fn(),
    setProgress: vi.fn(),
    syncStatusBar: vi.fn(),
    syncSideCard: vi.fn(),
    syncModal: vi.fn(),
    modalHasInFlight: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("createChipFetchCoordinator — syncTargets", () => {
  it("populates visibleKeys, wires the cart button, and tags the widget with data-bc-paper-ctec-key", () => {
    const deps = makeDeps();
    const coord = createChipFetchCoordinator(deps);
    const target = makeTarget();
    coord.syncTargets([target]);

    expect(coord.state.visibleKeys.has("chip-1")).toBe(true);
    expect(target.widget.dataset.bcPaperCtecKey).toBe("chip-1");
    expect(deps.attachCartButton).toHaveBeenCalledWith(target);
  });

  it("paints idle on the widget when no cache and no userActivated entry", () => {
    const deps = makeDeps();
    const coord = createChipFetchCoordinator(deps);
    coord.syncTargets([makeTarget()]);
    expect(deps.renderIdle).toHaveBeenCalledTimes(1);
    expect(deps.renderWidget).not.toHaveBeenCalled();
  });

  it("renders found state from cache without touching the network", () => {
    const aggregate = makeAggregate();
    const deps = makeDeps({
      getCachedAggregate: vi.fn().mockReturnValue(aggregate)
    });
    const coord = createChipFetchCoordinator(deps);
    const target = makeTarget();
    coord.syncTargets([target]);

    expect(deps.fetchAggregate).not.toHaveBeenCalled();
    expect(deps.renderWidget).toHaveBeenCalledTimes(1);
    expect(coord.state.resolved.get("chip-1")).toEqual({
      state: "found",
      aggregate
    });
  });

  it("skips cart-button wiring for custom (dashed) schedule blocks", () => {
    const deps = makeDeps({
      isCustomScheduleCard: vi.fn().mockReturnValue(true)
    });
    const coord = createChipFetchCoordinator(deps);
    coord.syncTargets([makeTarget()]);
    expect(deps.attachCartButton).not.toHaveBeenCalled();
  });

  it("renders the no-access pill and skips Load CTEC when access is denied", () => {
    const deps = makeDeps({
      isCtecAccessDenied: vi.fn().mockReturnValue(true)
    });
    const coord = createChipFetchCoordinator(deps);
    coord.syncTargets([makeTarget()]);
    // Cart button still wires up — independent of CTEC.
    expect(deps.attachCartButton).toHaveBeenCalledTimes(1);
    expect(deps.renderIdle).not.toHaveBeenCalled();
    expect(deps.renderWidget).toHaveBeenCalledTimes(1);
    expect(deps.renderWidget).toHaveBeenCalledWith(
      expect.anything(),
      { state: "no-access" },
      undefined,
      undefined
    );
    expect(deps.fetchAggregate).not.toHaveBeenCalled();
  });
});

describe("createChipFetchCoordinator — kickTargetFetch", () => {
  it("consumes credit, marks userActivated, calls fetchAggregate, and resolves into the resolved map", async () => {
    const deps = makeDeps();
    const coord = createChipFetchCoordinator(deps);
    const target = makeTarget();
    target.widget.dataset.bcPaperCtecKey = target.key;
    document.body.appendChild(target.widget);

    coord.kickTargetFetch(target);
    expect(deps.ctecCreditPool.tryConsume).toHaveBeenCalledWith(
      "paper-ctec-chip-fetch"
    );
    expect(coord.state.inFlight.has("chip-1")).toBe(true);
    expect(coord.hasUserActivated("chip-1")).toBe(true);

    await vi.runAllTimersAsync();
    expect(deps.fetchAggregate).toHaveBeenCalledTimes(1);
    expect(coord.state.resolved.get("chip-1")?.state).toBe("found");
    expect(coord.state.inFlight.has("chip-1")).toBe(false);
    expect(deps.syncStatusBar).toHaveBeenCalled();
  });

  it("blocks when credit pool is exhausted, no fetch, no state mutation", () => {
    const deps = makeDeps({
      ctecCreditPool: {
        tryConsume: vi.fn().mockReturnValue({ allowed: false, waitMs: 999 }),
        format: vi.fn().mockReturnValue(null),
        formatLimitReached: vi.fn().mockReturnValue("paper limit hit")
      }
    });
    const coord = createChipFetchCoordinator(deps);
    coord.kickTargetFetch(makeTarget());
    expect(deps.fetchAggregate).not.toHaveBeenCalled();
    expect(deps.showToast).toHaveBeenCalledWith(
      "paper limit hit",
      expect.objectContaining({ tone: "warn" })
    );
    expect(coord.state.inFlight.has("chip-1")).toBe(false);
    expect(coord.hasUserActivated("chip-1")).toBe(false);
  });

  it("guards re-entrancy: second kick while first in-flight is a no-op", async () => {
    const deps = makeDeps();
    const coord = createChipFetchCoordinator(deps);
    coord.kickTargetFetch(makeTarget());
    coord.kickTargetFetch(makeTarget());
    // enrichParams awaits one microtask before fetchAggregate is invoked.
    await Promise.resolve();
    expect(deps.fetchAggregate).toHaveBeenCalledTimes(1);
  });

  it("error result paints error state and shows the error toast", async () => {
    const deps = makeDeps({
      fetchAggregate: vi.fn().mockResolvedValue({
        state: "error",
        message: "boom"
      } as PaperCtecWidgetData)
    });
    const coord = createChipFetchCoordinator(deps);
    coord.kickTargetFetch(makeTarget());
    await vi.runAllTimersAsync();

    expect(coord.state.resolved.get("chip-1")?.state).toBe("error");
    expect(deps.showToast).toHaveBeenCalledWith(
      "ctec error",
      expect.objectContaining({ tone: "warn" })
    );
  });

  it("rejected fetch synthesizes an error widget data and toasts", async () => {
    const deps = makeDeps({
      fetchAggregate: vi.fn().mockRejectedValue(new Error("network down"))
    });
    const coord = createChipFetchCoordinator(deps);
    coord.kickTargetFetch(makeTarget());
    await vi.runAllTimersAsync();
    const resolved = coord.state.resolved.get("chip-1");
    expect(resolved?.state).toBe("error");
    if (resolved?.state === "error") {
      expect(resolved.message).toContain("network down");
    }
  });

  it("auto-resumes a kick on the next sync if userActivated is set but inFlight + resolved are empty", async () => {
    const deps = makeDeps();
    const coord = createChipFetchCoordinator(deps);
    // Simulate: user clicked Load CTEC, fetch was cleared by some external
    // path (e.g. modal close mid-fetch) without resolving. userActivated stays.
    const target = makeTarget();
    coord.kickTargetFetch(target);
    coord.state.inFlight.clear();
    coord.state.resolved.clear();
    coord.state.loadingMessages.clear();
    expect(coord.state.inFlight.has("chip-1")).toBe(false);
    expect(coord.hasUserActivated("chip-1")).toBe(true);

    // syncTargets should re-fire kickTargetFetch.
    coord.syncTargets([target]);
    // enrichParams awaits one microtask before fetchAggregate is invoked.
    await Promise.resolve();
    // Two total fetch calls now: the original + the auto-resume.
    expect(deps.fetchAggregate).toHaveBeenCalledTimes(2);
  });
});

describe("createChipFetchCoordinator — preview + introspection", () => {
  it("previewDataCallbackFor returns null when snapshot is empty", () => {
    const deps = makeDeps();
    const coord = createChipFetchCoordinator(deps);
    coord.syncTargets([makeTarget()]);
    const cb = coord.previewDataCallbackFor("chip-1");
    expect(cb).toBeTypeOf("function");
    expect(cb?.()).toBeNull();
  });

  it("getSource returns the AnalyticsModalSource for an active key", () => {
    const deps = makeDeps();
    const coord = createChipFetchCoordinator(deps);
    coord.syncTargets([makeTarget()]);
    expect(coord.getSource("chip-1")).toEqual({
      key: "chip-1",
      params: { subject: "COMP_SCI", catalogNumber: "111", instructor: "Smith" },
      titleHint: "Fundamentals"
    });
  });

  it("stop() clears all state", () => {
    const deps = makeDeps();
    const coord = createChipFetchCoordinator(deps);
    coord.syncTargets([makeTarget()]);
    coord.kickTargetFetch(makeTarget());
    coord.stop();
    expect(coord.state.visibleKeys.size).toBe(0);
    expect(coord.state.inFlight.size).toBe(0);
    expect(coord.state.userActivated.size).toBe(0);
    expect(coord.state.loadingMessages.size).toBe(0);
    expect(coord.getSource("chip-1")).toBeUndefined();
  });
});
