import { describe, expect, it, vi } from "vitest";

import type { DataMapInfo } from "../../paper-data";
import {
  renderSearchShell,
  renderTabBar,
  syncTabButtonActive,
  TABS_ID
} from "../search-form";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function makeInfo(): DataMapInfo {
  return {
    latest: "4750",
    terms: {
      "4750": {
        id: "4750",
        name: "Fall 2025",
        finalized: true,
        sources: {}
      },
      "4760": {
        id: "4760",
        name: "Winter 2025",
        finalized: false,
        sources: {}
      }
    },
    plan: { updated: 0 }
  } as unknown as DataMapInfo;
}

describe("renderSearchShell", () => {
  it("renders title, query field, term <select>, and inserts caller's status + results elements", () => {
    const doc = fresh();
    const statusEl = doc.createElement("div");
    const resultsEl = doc.createElement("div");
    const root = renderSearchShell(doc, {
      termId: "4750",
      info: makeInfo(),
      statusEl,
      resultsEl,
      onQueryInput: vi.fn(),
      onTermChange: vi.fn()
    });
    expect(root.classList.contains("bc-cs-shell")).toBe(true);
    expect(root.querySelector(".bc-cs-title")?.textContent).toBe("Search for Classes");
    expect(root.querySelector("#bc-cs-query")).not.toBeNull();
    expect(root.querySelector("#bc-cs-term")).not.toBeNull();
    expect(root.contains(statusEl)).toBe(true);
    expect(root.contains(resultsEl)).toBe(true);
  });

  it("preselects the matching term option", () => {
    const doc = fresh();
    const root = renderSearchShell(doc, {
      termId: "4760",
      info: makeInfo(),
      statusEl: doc.createElement("div"),
      resultsEl: doc.createElement("div"),
      onQueryInput: vi.fn(),
      onTermChange: vi.fn()
    });
    const select = root.querySelector<HTMLSelectElement>("#bc-cs-term")!;
    expect(select.value).toBe("4760");
  });

  it("fires onQueryInput on input events", () => {
    const doc = fresh();
    const onQueryInput = vi.fn();
    const root = renderSearchShell(doc, {
      termId: "4750",
      info: makeInfo(),
      statusEl: doc.createElement("div"),
      resultsEl: doc.createElement("div"),
      onQueryInput,
      onTermChange: vi.fn()
    });
    const input = root.querySelector<HTMLInputElement>("#bc-cs-query")!;
    input.value = "comp_sci";
    input.dispatchEvent(new Event("input"));
    expect(onQueryInput).toHaveBeenCalledWith("comp_sci");
  });

  it("fires onTermChange on term <select> change events", () => {
    const doc = fresh();
    const onTermChange = vi.fn();
    const root = renderSearchShell(doc, {
      termId: "4750",
      info: makeInfo(),
      statusEl: doc.createElement("div"),
      resultsEl: doc.createElement("div"),
      onQueryInput: vi.fn(),
      onTermChange
    });
    const select = root.querySelector<HTMLSelectElement>("#bc-cs-term")!;
    select.value = "4760";
    select.dispatchEvent(new Event("change"));
    expect(onTermChange).toHaveBeenCalledWith("4760");
  });
});

describe("renderTabBar", () => {
  it("renders both tabs with the active one flagged data-active=true", () => {
    const doc = fresh();
    const bar = renderTabBar(doc, {
      getActiveTab: () => "better",
      onSelect: vi.fn()
    });
    expect(bar.id).toBe(TABS_ID);
    const buttons = bar.querySelectorAll<HTMLButtonElement>("button.bc-cs-tab");
    expect(buttons).toHaveLength(2);
    const better = bar.querySelector<HTMLButtonElement>('[data-tab="better"]')!;
    const classic = bar.querySelector<HTMLButtonElement>('[data-tab="classic"]')!;
    expect(better.dataset.active).toBe("true");
    expect(classic.dataset.active).toBe("false");
  });

  it("calls onSelect when clicking a non-active tab", () => {
    const doc = fresh();
    let active: "better" | "classic" = "better";
    const onSelect = vi.fn((id: "better" | "classic") => {
      active = id;
    });
    const bar = renderTabBar(doc, { getActiveTab: () => active, onSelect });
    const classic = bar.querySelector<HTMLButtonElement>('[data-tab="classic"]')!;
    classic.click();
    expect(onSelect).toHaveBeenCalledWith("classic");
  });

  it("ignores clicks on the already-active tab (re-evaluated at click time)", () => {
    const doc = fresh();
    let active: "better" | "classic" = "better";
    const onSelect = vi.fn();
    const bar = renderTabBar(doc, { getActiveTab: () => active, onSelect });
    const better = bar.querySelector<HTMLButtonElement>('[data-tab="better"]')!;
    better.click();
    expect(onSelect).not.toHaveBeenCalled();
    // Now flip the active state — clicking better should still no-op…
    active = "better";
    better.click();
    expect(onSelect).not.toHaveBeenCalled();
    // …while clicking classic should fire.
    const classic = bar.querySelector<HTMLButtonElement>('[data-tab="classic"]')!;
    classic.click();
    expect(onSelect).toHaveBeenCalledWith("classic");
  });
});

describe("syncTabButtonActive", () => {
  it("toggles data-active on every button under TABS_ID", () => {
    const doc = fresh();
    const bar = renderTabBar(doc, { getActiveTab: () => "better", onSelect: vi.fn() });
    doc.body.appendChild(bar);
    syncTabButtonActive(doc, "classic");
    const better = doc.querySelector<HTMLButtonElement>('[data-tab="better"]')!;
    const classic = doc.querySelector<HTMLButtonElement>('[data-tab="classic"]')!;
    expect(better.dataset.active).toBe("false");
    expect(classic.dataset.active).toBe("true");
  });

  it("is a no-op when no tab bar is mounted", () => {
    const doc = fresh();
    expect(() => syncTabButtonActive(doc, "better")).not.toThrow();
  });
});
