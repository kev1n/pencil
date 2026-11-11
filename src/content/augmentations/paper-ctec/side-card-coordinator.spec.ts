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
    closeModal: vi.fn(),
    setHost: vi.fn(),
    sync: vi.fn(),
    openKey: vi.fn().mockReturnValue(null),
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
    renderSideCardAnalytics: vi.fn().mockReturnValue(null),
    findCard: vi.fn().mockReturnValue(null),
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
  it("selecting CTECs renders the sheet inside Paper.nu's panel", () => {
    let onTabChange!: (tab: "paper" | "analytics") => void;
    const host = document.createElement("section");
    const renderSideCardAnalytics = vi.fn().mockImplementation(
      (_ctx, state, onTab) => {
        onTabChange = onTab;
        return state.selectedTab === "analytics" ? host : null;
      }
    );
    const { deps, modal } = makeDeps({
      hasUserActivated: vi.fn().mockReturnValue(true),
      renderSideCardAnalytics
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    onTabChange("analytics");
    expect(modal.setHost).toHaveBeenCalledWith(host);
    expect(modal.openModal).toHaveBeenCalledWith(
      expect.objectContaining({ key: "course-1" })
    );
  });

  it("closes the hosted sheet when Paper.nu's panel goes away", () => {
    let onTabChange!: (tab: "paper" | "analytics") => void;
    const host = document.createElement("section");
    const extractSideCardContext = vi.fn().mockReturnValue(makeContext());
    const modal = makeModal();
    const { deps } = makeDeps({
      modalController: () => modal,
      extractSideCardContext,
      hasUserActivated: vi.fn().mockReturnValue(true),
      renderSideCardAnalytics: vi.fn().mockImplementation((_ctx, state, onTab) => {
        onTabChange = onTab;
        return state.selectedTab === "analytics" ? host : null;
      })
    });
    const coord = createSideCardCoordinator(deps);
    coord.syncSideCard(document);
    onTabChange("analytics");
    (modal.openKey as ReturnType<typeof vi.fn>).mockReturnValue("course-1");
    extractSideCardContext.mockReturnValue(null);
    coord.syncSideCard(document);
    expect(modal.setHost).toHaveBeenLastCalledWith(null);
    expect(modal.closeModal).toHaveBeenCalledTimes(1);
  });

  it("a card's Analytics button falls back to the docked sheet when there is no card to open", () => {
    const { deps, modal } = makeDeps();
    const coord = createSideCardCoordinator(deps);
    const source = { ...makeContext(), key: "course-9" };
    coord.openAnalytics(source);
    expect(modal.openModal).toHaveBeenCalledWith(source);
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
