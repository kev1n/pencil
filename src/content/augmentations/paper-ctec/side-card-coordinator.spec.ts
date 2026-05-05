import { describe, expect, it, vi } from "vitest";

import {
  createSideCardCoordinator,
  type SideCardCoordinatorDeps
} from "./side-card-coordinator";
import type { ModalController } from "./modal-controller";
import type {
  PaperCtecSideCardContext,
  PaperCtecWidgetData
} from "./types";

function makeContext(overrides: Partial<PaperCtecSideCardContext> = {}): PaperCtecSideCardContext {
  const panel = document.createElement("div");
  return {
    panel,
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

function makeModal(overrides: Partial<ModalController> = {}): ModalController {
  return {
    mirrorFrontPageState: vi.fn(),
    resumeIfNeeded: vi.fn(),
    openModal: vi.fn(),
    ...overrides
  } as unknown as ModalController;
}

function makeDeps(overrides: Partial<SideCardCoordinatorDeps> = {}): {
  deps: SideCardCoordinatorDeps;
  modal: ModalController;
} {
  const modal = overrides.modalController?.() ?? makeModal();
  const deps: SideCardCoordinatorDeps = {
    extractSideCardContext: vi.fn().mockReturnValue(makeContext()),
    modalController: () => modal,
    hasUserActivated: vi.fn().mockReturnValue(false),
    getResolved: vi.fn().mockReturnValue(new Map<string, PaperCtecWidgetData>()),
    getInFlight: vi.fn().mockReturnValue(new Map()),
    hasCachedReportAggregate: vi.fn().mockReturnValue(false),
    getAggregateLimit: vi.fn().mockReturnValue(8),
    renderSideCardAnalytics: vi.fn(),
    ...overrides
  };
  return { deps, modal };
}

describe("createSideCardCoordinator — context bridge", () => {
  it("returns early when no panel context is found", () => {
    const renderSideCardAnalytics = vi.fn();
    const { deps } = makeDeps({
      extractSideCardContext: vi.fn().mockReturnValue(null),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    expect(renderSideCardAnalytics).not.toHaveBeenCalled();
  });

  it("calls modal.mirrorFrontPageState + modal.resumeIfNeeded with the context", () => {
    const context = makeContext();
    const { deps, modal } = makeDeps({
      extractSideCardContext: vi.fn().mockReturnValue(context)
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    expect(modal.mirrorFrontPageState).toHaveBeenCalledWith(context);
    expect(modal.resumeIfNeeded).toHaveBeenCalledWith(context);
  });

  it("forces selectedTab=paper when analytics is unavailable", () => {
    const renderSideCardAnalytics = vi.fn();
    const { deps } = makeDeps({
      hasUserActivated: vi.fn().mockReturnValue(false),
      hasCachedReportAggregate: vi.fn().mockReturnValue(false),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    const [, state] = renderSideCardAnalytics.mock.calls[0];
    expect(state).toEqual({ selectedTab: "paper", analyticsAvailable: false });
  });

  it("flags analyticsAvailable when the user previously activated this chip", () => {
    const renderSideCardAnalytics = vi.fn();
    const { deps } = makeDeps({
      hasUserActivated: vi.fn().mockReturnValue(true),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    const [, state] = renderSideCardAnalytics.mock.calls[0];
    expect(state.analyticsAvailable).toBe(true);
  });

  it("flags analyticsAvailable when the cache already has an aggregate", () => {
    const renderSideCardAnalytics = vi.fn();
    const { deps } = makeDeps({
      hasUserActivated: vi.fn().mockReturnValue(false),
      hasCachedReportAggregate: vi.fn().mockReturnValue(true),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    const [, state] = renderSideCardAnalytics.mock.calls[0];
    expect(state.analyticsAvailable).toBe(true);
  });
});

describe("createSideCardCoordinator — tab events", () => {
  it("selecting Analytics opens the modal with the side-card context", () => {
    let onTabChange!: (tab: "paper" | "analytics") => void;
    const renderSideCardAnalytics = vi.fn().mockImplementation(
      (_ctx, _state, onTab) => {
        onTabChange = onTab;
      }
    );
    const { deps, modal } = makeDeps({
      hasUserActivated: vi.fn().mockReturnValue(true),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    onTabChange("analytics");
    expect(modal.openModal).toHaveBeenCalledWith(
      expect.objectContaining({ key: "course-1" })
    );
  });

  it("selecting Paper does NOT open the modal", () => {
    let onTabChange!: (tab: "paper" | "analytics") => void;
    const renderSideCardAnalytics = vi.fn().mockImplementation(
      (_ctx, _state, onTab) => {
        onTabChange = onTab;
      }
    );
    const { deps, modal } = makeDeps({
      hasUserActivated: vi.fn().mockReturnValue(true),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    onTabChange("paper");
    expect(modal.openModal).not.toHaveBeenCalled();
  });

  it("the openModal launcher fires when its callback is invoked", () => {
    let onLaunch!: () => void;
    const renderSideCardAnalytics = vi.fn().mockImplementation(
      (_ctx, _state, _onTab, onOpen) => {
        onLaunch = onOpen;
      }
    );
    const { deps, modal } = makeDeps({
      hasUserActivated: vi.fn().mockReturnValue(true),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    onLaunch();
    expect(modal.openModal).toHaveBeenCalledTimes(1);
  });

  it("remembers the user's selected tab across re-syncs (until analytics drops)", () => {
    let onTabChange!: (tab: "paper" | "analytics") => void;
    const renderSideCardAnalytics = vi.fn().mockImplementation(
      (_ctx, _state, onTab) => {
        onTabChange = onTab;
      }
    );
    const userActivated = { value: true };
    const { deps } = makeDeps({
      hasUserActivated: vi.fn().mockImplementation(() => userActivated.value),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    onTabChange("analytics");
    // The onTab callback re-runs syncSideCard; the second render should
    // reflect "analytics" as the selectedTab.
    const lastState = renderSideCardAnalytics.mock.calls.at(-1)?.[1];
    expect(lastState).toEqual({ selectedTab: "analytics", analyticsAvailable: true });

    // Drop analytics availability — selectedTab snaps back to "paper".
    userActivated.value = false;
    coord.syncSideCard(document);
    const after = renderSideCardAnalytics.mock.calls.at(-1)?.[1];
    expect(after).toEqual({ selectedTab: "paper", analyticsAvailable: false });
  });
});

describe("createSideCardCoordinator — start/stop", () => {
  it("start(doc) runs an initial sync", () => {
    const renderSideCardAnalytics = vi.fn();
    const { deps } = makeDeps({ renderSideCardAnalytics });
    const coord = createSideCardCoordinator(deps);
    coord.start(document);
    expect(renderSideCardAnalytics).toHaveBeenCalledTimes(1);
  });

  it("stop(doc) clears the selectedTabs memory", () => {
    let onTabChange!: (tab: "paper" | "analytics") => void;
    const renderSideCardAnalytics = vi.fn().mockImplementation(
      (_ctx, _state, onTab) => {
        onTabChange = onTab;
      }
    );
    const { deps } = makeDeps({
      hasUserActivated: vi.fn().mockReturnValue(true),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    onTabChange("analytics");
    coord.stop(document);
    coord.syncSideCard(document);
    // After stop, the memory is cleared — even though analytics is still
    // available, selectedTab defaults back to "paper".
    const lastState = renderSideCardAnalytics.mock.calls.at(-1)?.[1];
    expect(lastState).toEqual({ selectedTab: "paper", analyticsAvailable: true });
  });
});
