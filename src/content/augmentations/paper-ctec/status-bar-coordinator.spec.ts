import { describe, expect, it, vi } from "vitest";

import {
  createStatusBarCoordinator,
  type StatusBarCoordinatorDeps
} from "./status-bar-coordinator";
import type {
  PaperCtecAnalyticsState,
  PaperCtecStatusBarData,
  PaperCtecWidgetData
} from "./types";

function makeDeps(
  overrides: Partial<StatusBarCoordinatorDeps> = {}
): StatusBarCoordinatorDeps {
  return {
    getVisibleKeys: vi.fn().mockReturnValue(new Set<string>()),
    getResolved: vi.fn().mockReturnValue(new Map<string, PaperCtecWidgetData>()),
    getAnalyticsResolved: vi
      .fn()
      .mockReturnValue(new Map<string, PaperCtecAnalyticsState>()),
    getInFlight: vi.fn().mockReturnValue(new Map<string, unknown>()),
    getAnalyticsInFlight: vi.fn().mockReturnValue(new Map<string, unknown>()),
    getLoadingMessages: vi.fn().mockReturnValue(new Map<string, { message: string; updatedAt: number }>()),
    buildStatusBarData: vi.fn().mockReturnValue(null),
    renderStatusBar: vi.fn(),
    ...overrides
  };
}

describe("createStatusBarCoordinator — derivation + render", () => {
  it("calls buildStatusBarData with the augmentation's live state maps", () => {
    const visibleKeys = new Set(["chip-1", "chip-2"]);
    const resolved = new Map<string, PaperCtecWidgetData>();
    const inFlight = new Map<string, unknown>();
    const buildStatusBarData = vi.fn().mockReturnValue(null);
    const deps = makeDeps({
      getVisibleKeys: () => visibleKeys,
      getResolved: () => resolved,
      getInFlight: () => inFlight,
      buildStatusBarData
    });
    const coord = createStatusBarCoordinator(deps);
    coord.syncStatusBar(document);

    expect(buildStatusBarData).toHaveBeenCalledTimes(1);
    const args = buildStatusBarData.mock.calls[0][0];
    expect(args.visibleKeys).toBe(visibleKeys);
    expect(args.resolved).toBe(resolved);
    expect(args.inFlight).toBe(inFlight);
  });

  it("renders the status bar when buildStatusBarData returns a non-null payload", () => {
    const status: PaperCtecStatusBarData = {
      state: "loading",
      totalCount: 3,
      resolvedCount: 1,
      activeCount: 2,
      foundCount: 1,
      notFoundCount: 0,
      errorCount: 0
    };
    const renderStatusBar = vi.fn();
    const deps = makeDeps({
      buildStatusBarData: vi.fn().mockReturnValue(status),
      renderStatusBar
    });
    const coord = createStatusBarCoordinator(deps);
    coord.syncStatusBar(document);
    expect(renderStatusBar).toHaveBeenCalledWith(document, status);
  });

  it("does not render when status is null", () => {
    const renderStatusBar = vi.fn();
    const deps = makeDeps({
      buildStatusBarData: vi.fn().mockReturnValue(null),
      renderStatusBar
    });
    const coord = createStatusBarCoordinator(deps);
    coord.syncStatusBar(document);
    expect(renderStatusBar).not.toHaveBeenCalled();
  });

  it("re-entry guard: a recursive sync triggered inside renderStatusBar is suppressed", () => {
    let calls = 0;
    const status: PaperCtecStatusBarData = {
      state: "loading",
      totalCount: 1,
      resolvedCount: 1,
      activeCount: 0,
      foundCount: 1,
      notFoundCount: 0,
      errorCount: 0
    };
    const buildStatusBarData = vi.fn().mockImplementation(() => {
      calls += 1;
      return status;
    });
    const coordRef: { current?: ReturnType<typeof createStatusBarCoordinator> } = {};
    const deps = makeDeps({
      buildStatusBarData,
      renderStatusBar: vi.fn().mockImplementation(() => {
        // Simulate a listener firing back into syncStatusBar.
        coordRef.current?.syncStatusBar(document);
      })
    });
    const coord = createStatusBarCoordinator(deps);
    coordRef.current = coord;
    coord.syncStatusBar(document);
    // Outer call once + inner re-entry suppressed → still just one
    // buildStatusBarData call.
    expect(calls).toBe(1);
  });
});

describe("createStatusBarCoordinator — start/stop", () => {
  it("start(doc) runs an initial sync", () => {
    const renderStatusBar = vi.fn();
    const status: PaperCtecStatusBarData = {
      state: "ready",
      totalCount: 1,
      resolvedCount: 1,
      activeCount: 0,
      foundCount: 1,
      notFoundCount: 0,
      errorCount: 0
    };
    const deps = makeDeps({
      buildStatusBarData: vi.fn().mockReturnValue(status),
      renderStatusBar
    });
    const coord = createStatusBarCoordinator(deps);
    coord.start(document);
    expect(renderStatusBar).toHaveBeenCalledTimes(1);
  });

  it("stop(doc) is a no-op (DOM teardown lives in the augmentation)", () => {
    const coord = createStatusBarCoordinator(makeDeps());
    expect(() => coord.stop(document)).not.toThrow();
  });
});
