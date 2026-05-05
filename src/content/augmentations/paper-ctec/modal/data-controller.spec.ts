import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `data-controller.ts` transitively imports `ctec-index/storage.ts`,
// which fires `chrome.storage.local.get` at module load. jsdom doesn't ship
// `chrome` — install a no-op stub before importing under test. (ESM
// imports are hoisted, so this assignment must happen before the dynamic
// import below.)
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
    // credit-pool's notifyConsumed expects a chainable promise off sendMessage.
    sendMessage: () => Promise.resolve(undefined),
    getURL: (path: string) => path
  }
};

const { createModalDataController } = await import("./data-controller");
import type { fetchCtecCourseAnalytics } from "../../ctec-links/reports";
type CtecAnalyticsFetcher = typeof fetchCtecCourseAnalytics;

import type { ModalDataControllerDeps } from "./data-controller";
import type {
  AnalyticsModalSource,
  PaperCtecAnalyticsState,
  PaperCtecWidgetData
} from "../types";

function makeSource(overrides: Partial<AnalyticsModalSource> = {}): AnalyticsModalSource {
  return {
    key: "course-1",
    params: {
      subject: "COMP_SCI",
      catalogNumber: "111",
      instructor: "Smith"
    },
    titleHint: "Fundamentals",
    ...overrides
  };
}

function makeDeps(
  overrides: Partial<{
    fetcher: CtecAnalyticsFetcher;
    callbacks: Partial<ModalDataControllerDeps["callbacks"]>;
    state: Partial<ModalDataControllerDeps["state"]>;
  }> = {}
): {
  deps: ModalDataControllerDeps;
  state: ModalDataControllerDeps["state"];
  callbacks: ModalDataControllerDeps["callbacks"];
  fetcher: CtecAnalyticsFetcher;
} {
  const state: ModalDataControllerDeps["state"] = {
    resolved: new Map<string, PaperCtecWidgetData>(),
    inFlight: new Map<string, Promise<PaperCtecWidgetData>>(),
    analyticsResolved: new Map<string, PaperCtecAnalyticsState>(),
    analyticsInFlight: new Map<string, Promise<PaperCtecAnalyticsState>>(),
    loadingMessages: new Map<string, { message: string; updatedAt: number }>(),
    ...overrides.state
  };
  const callbacks: ModalDataControllerDeps["callbacks"] = {
    generation: vi.fn().mockReturnValue(0),
    setProgress: vi.fn(),
    syncStatusBar: vi.fn(),
    syncSideCard: vi.fn(),
    syncView: vi.fn(),
    renderForKey: vi.fn(),
    ...overrides.callbacks
  };
  const fetcher = (overrides.fetcher ??
    (vi
      .fn<CtecAnalyticsFetcher>()
      .mockResolvedValue({ state: "not-found" }))) as CtecAnalyticsFetcher;
  const deps: ModalDataControllerDeps = {
    state,
    callbacks,
    fetcher
  };
  return { deps, state, callbacks, fetcher };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createModalDataController — kickBatch", () => {
  it("invokes the fetcher and writes the resolved state on success", async () => {
    const fetcher = vi.fn<CtecAnalyticsFetcher>().mockResolvedValue({
      state: "found",
      analytics: { stub: true } as never
    });
    const { deps, state, callbacks } = makeDeps({ fetcher });
    const controller = createModalDataController(deps);

    controller.kickBatch(makeSource());
    expect(state.analyticsInFlight.has("course-1")).toBe(true);

    await vi.runAllTimersAsync();
    await vi.waitFor(() => {
      expect(state.analyticsInFlight.has("course-1")).toBe(false);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(state.analyticsResolved.get("course-1")).toEqual({
      state: "found",
      analytics: { stub: true }
    });
    expect(callbacks.syncView).toHaveBeenCalled();
    expect(callbacks.syncStatusBar).toHaveBeenCalled();
    expect(callbacks.syncSideCard).toHaveBeenCalled();
  });

  it("guards re-entrancy: a second kickBatch while in-flight is a no-op", () => {
    let resolveFetch: (v: { state: "not-found" }) => void = () => undefined;
    const fetcher = vi.fn<CtecAnalyticsFetcher>().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const { deps } = makeDeps({ fetcher });
    const controller = createModalDataController(deps);

    controller.kickBatch(makeSource());
    controller.kickBatch(makeSource());
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch({ state: "not-found" });
  });

  it("error inside the fetcher writes the error analyticsResolved + still clears inFlight", async () => {
    const fetcher = vi
      .fn<CtecAnalyticsFetcher>()
      .mockRejectedValue(new Error("boom"));
    const { deps, state } = makeDeps({ fetcher });
    const controller = createModalDataController(deps);

    controller.kickBatch(makeSource());
    await vi.runAllTimersAsync();
    await vi.waitFor(() => {
      expect(state.analyticsInFlight.has("course-1")).toBe(false);
    });

    expect(state.analyticsResolved.get("course-1")).toEqual({
      state: "error",
      message: "boom"
    });
  });

  it("stale generation suppresses state writes (post-invalidate semantics)", async () => {
    let resolveFetch: (v: { state: "found"; analytics: unknown }) => void = () => undefined;
    const fetcher = vi.fn<CtecAnalyticsFetcher>().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve as typeof resolveFetch;
      })
    );
    const generation = vi.fn().mockReturnValue(0);
    const { deps, state } = makeDeps({
      fetcher,
      callbacks: { generation }
    });
    const controller = createModalDataController(deps);

    controller.kickBatch(makeSource());
    // Bump the generation between fetch start and resolve — a login retry
    // (clearAuthRequiredStates) does this in the real augmentation.
    generation.mockReturnValue(1);
    resolveFetch({ state: "found", analytics: { stub: true } });
    await vi.runAllTimersAsync();
    await vi.waitFor(() => {
      expect(state.analyticsInFlight.has("course-1")).toBe(false);
    });

    // stale → analyticsResolved should NOT be written
    expect(state.analyticsResolved.has("course-1")).toBe(false);
  });
});

describe("createModalDataController — kickRefresh", () => {
  it("does not flip analyticsInFlight (background refresh stays out of loading state)", async () => {
    let resolveFetch: (v: { state: "found"; analytics: unknown }) => void = () => undefined;
    const fetcher = vi.fn<CtecAnalyticsFetcher>().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve as typeof resolveFetch;
      })
    );
    const { deps, state } = makeDeps({ fetcher });
    const controller = createModalDataController(deps);

    controller.kickRefresh(makeSource());
    // The whole point of kickRefresh: doesn't touch analyticsInFlight.
    expect(state.analyticsInFlight.has("course-1")).toBe(false);
    // …but does flag the background-refresh set so the modal can show
    // "Checking…".
    expect(controller.isBackgroundRefreshing("course-1")).toBe(true);

    resolveFetch({ state: "found", analytics: { stub: true } });
    await vi.runAllTimersAsync();
    await vi.waitFor(() => {
      expect(controller.isBackgroundRefreshing("course-1")).toBe(false);
    });
  });

  it("guards re-entrancy: a second kickRefresh while one is running is a no-op", () => {
    let resolveFetch: (v: { state: "not-found" }) => void = () => undefined;
    const fetcher = vi.fn<CtecAnalyticsFetcher>().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const { deps } = makeDeps({ fetcher });
    const controller = createModalDataController(deps);

    controller.kickRefresh(makeSource());
    controller.kickRefresh(makeSource());
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch({ state: "not-found" });
  });

  it("auth-required result → sets refresh flash with kind 'auth' + loginUrl", async () => {
    const fetcher = vi.fn<CtecAnalyticsFetcher>().mockResolvedValue({
      state: "auth-required",
      loginUrl: "https://login.example.com"
    });
    const { deps } = makeDeps({ fetcher });
    const controller = createModalDataController(deps);

    controller.kickRefresh(makeSource());
    await vi.runAllTimersAsync();
    await vi.waitFor(() => {
      expect(controller.isBackgroundRefreshing("course-1")).toBe(false);
    });

    const flash = controller.getRefreshFlash("course-1");
    expect(flash).toEqual({ kind: "auth", loginUrl: "https://login.example.com" });
  });

  it("error result inside refresh → sets refresh flash with kind 'error'", async () => {
    const fetcher = vi
      .fn<CtecAnalyticsFetcher>()
      .mockRejectedValue(new Error("network down"));
    const { deps } = makeDeps({ fetcher });
    const controller = createModalDataController(deps);

    controller.kickRefresh(makeSource());
    await vi.runAllTimersAsync();
    await vi.waitFor(() => {
      expect(controller.isBackgroundRefreshing("course-1")).toBe(false);
    });

    const flash = controller.getRefreshFlash("course-1");
    expect(flash).toEqual({ kind: "error", message: "network down" });
  });

  it("not-found result → sets a success flash with addedCount=0", async () => {
    const fetcher = vi.fn<CtecAnalyticsFetcher>().mockResolvedValue({
      state: "not-found"
    });
    const { deps } = makeDeps({ fetcher });
    const controller = createModalDataController(deps);

    controller.kickRefresh(makeSource());
    // Drain microtasks so the awaited fetcher resolves and the flash is
    // set, but DON'T advance time — otherwise the 6s success-flash timer
    // would auto-dismiss before we get to assert it.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getRefreshFlash("course-1")).toEqual({
      kind: "success",
      addedCount: 0
    });
  });
});

describe("createModalDataController — refresh-flash auto-dismiss timer", () => {
  it("success flash auto-dismisses after 6 seconds and triggers syncView", () => {
    const { deps, callbacks } = makeDeps();
    const controller = createModalDataController(deps);

    controller.setRefreshFlash("course-1", { kind: "success", addedCount: 3 });
    expect(controller.getRefreshFlash("course-1")).toEqual({
      kind: "success",
      addedCount: 3
    });
    (callbacks.syncView as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(5999);
    expect(controller.getRefreshFlash("course-1")).not.toBeNull();
    expect(callbacks.syncView).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(controller.getRefreshFlash("course-1")).toBeNull();
    expect(callbacks.syncView).toHaveBeenCalledTimes(1);
  });

  it("error flash is sticky (no auto-dismiss timer)", () => {
    const { deps } = makeDeps();
    const controller = createModalDataController(deps);

    controller.setRefreshFlash("course-1", { kind: "error", message: "x" });
    vi.advanceTimersByTime(60_000);
    expect(controller.getRefreshFlash("course-1")).toEqual({
      kind: "error",
      message: "x"
    });
  });

  it("clearRefreshFlash cancels the pending timer and removes the flash", () => {
    const { deps, callbacks } = makeDeps();
    const controller = createModalDataController(deps);

    controller.setRefreshFlash("course-1", { kind: "success", addedCount: 1 });
    controller.clearRefreshFlash("course-1");
    (callbacks.syncView as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(60_000);
    expect(controller.getRefreshFlash("course-1")).toBeNull();
    // The cancelled timer must not fire syncView.
    expect(callbacks.syncView).not.toHaveBeenCalled();
  });

  it("setRefreshFlash twice (success then success) replaces the timer", () => {
    const { deps } = makeDeps();
    const controller = createModalDataController(deps);

    const firstFlash = { kind: "success" as const, addedCount: 1 };
    const secondFlash = { kind: "success" as const, addedCount: 5 };
    controller.setRefreshFlash("course-1", firstFlash);
    vi.advanceTimersByTime(3000);
    controller.setRefreshFlash("course-1", secondFlash);
    expect(controller.getRefreshFlash("course-1")).toEqual(secondFlash);

    // The original 6s timer (set at t=0) would have fired at t=6000 — but
    // the second setRefreshFlash replaced it with a fresh timer at t=3000.
    // So at t=4000 (post-3s) the second timer hasn't fired yet.
    vi.advanceTimersByTime(1000);
    expect(controller.getRefreshFlash("course-1")).toEqual(secondFlash);

    // At t=9001 (3000 + 6001) the second timer should have fired and
    // cleared the flash.
    vi.advanceTimersByTime(5001);
    expect(controller.getRefreshFlash("course-1")).toBeNull();
  });

  it("reset() clears every pending timer + flash + background-refresh state", () => {
    const { deps, callbacks } = makeDeps();
    const controller = createModalDataController(deps);

    controller.setRefreshFlash("a", { kind: "success", addedCount: 1 });
    controller.setRefreshFlash("b", { kind: "success", addedCount: 2 });
    controller.reset();

    expect(controller.getRefreshFlash("a")).toBeNull();
    expect(controller.getRefreshFlash("b")).toBeNull();

    (callbacks.syncView as ReturnType<typeof vi.fn>).mockClear();
    vi.advanceTimersByTime(60_000);
    expect(callbacks.syncView).not.toHaveBeenCalled();
  });
});
