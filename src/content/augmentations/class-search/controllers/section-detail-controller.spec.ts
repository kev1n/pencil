import { describe, expect, it, vi } from "vitest";

import {
  createSectionDetailController,
  type SectionDetailDeps
} from "./section-detail-controller";
import type { CaesarSearchResult } from "../caesar-search";
import type { PaperSection, PaperTermCourse } from "../paper-data";
import type { ResultRow } from "../types";

function makeButton(doc: Document): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.textContent = "Details";
  return b;
}

function makeRow(): ResultRow {
  const course = {
    subject: "COMP_SCI",
    catalog: "111-0",
    title: "Fundamentals"
  } as unknown as PaperTermCourse;
  return { course, sections: [] };
}

function makeSection(overrides: Partial<PaperSection> = {}): PaperSection {
  return {
    section: "20",
    component: "LEC",
    ...overrides
  } as unknown as PaperSection;
}

function makeLi(doc: Document): HTMLLIElement {
  // Section row + a parent <ul>, since the controller calls
  // `li.parentElement?.insertBefore(...)` on the success path.
  const ul = doc.createElement("ul");
  const li = doc.createElement("li");
  li.className = "bc-cs-section";
  ul.appendChild(li);
  return li;
}

function makeDeps(overrides: Partial<SectionDetailDeps> = {}): SectionDetailDeps {
  return {
    doc: document,
    consumePsCredit: vi.fn().mockReturnValue(true),
    ensureLiveData: vi.fn().mockResolvedValue(null),
    ...overrides
  };
}

describe("createSectionDetailController — re-entry guard", () => {
  it("synchronous double-click on Details only triggers one ensureLiveData fetch", async () => {
    const doc = document;
    const button = makeButton(doc);
    const li = makeLi(doc);
    type Resolver = (v: CaesarSearchResult | null) => void;
    const resolverRef: { current: Resolver | null } = { current: null };
    const deps = makeDeps({
      doc,
      ensureLiveData: vi.fn().mockImplementation(
        () =>
          new Promise<CaesarSearchResult | null>((res) => {
            resolverRef.current = res;
          })
      )
    });
    const ctrl = createSectionDetailController(deps);

    // Two synchronous clicks: the first should kick off the fetch and
    // mark the button as loading; the second should be filtered by the
    // re-entry guard.
    const first = ctrl.toggle(makeRow(), makeSection(), li, button);
    const second = ctrl.toggle(makeRow(), makeSection(), li, button);

    expect(button.disabled).toBe(true);
    expect(button.dataset.state).toBe("loading");
    expect(button.textContent).toBe("Loading…");

    // Resolve the in-flight fetch with null so both promises settle.
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    resolverRef.current?.(null);
    await Promise.all([first, second]);

    expect(deps.consumePsCredit).toHaveBeenCalledTimes(1);
    expect(deps.ensureLiveData).toHaveBeenCalledTimes(1);
  });

  it("Details button shows loading state synchronously after click", () => {
    const doc = document;
    const button = makeButton(doc);
    const li = makeLi(doc);
    const deps = makeDeps({
      doc,
      ensureLiveData: vi.fn().mockImplementation(() => new Promise<null>(() => undefined))
    });
    const ctrl = createSectionDetailController(deps);

    void ctrl.toggle(makeRow(), makeSection(), li, button);
    // Synchronous prefix has already run; assert the visible loading state.
    expect(button.dataset.state).toBe("loading");
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("Loading…");
  });

  it("restores idle when ensureLiveData fails", async () => {
    const doc = document;
    const button = makeButton(doc);
    const li = makeLi(doc);
    const deps = makeDeps({
      doc,
      ensureLiveData: vi.fn().mockResolvedValue(null)
    });
    const ctrl = createSectionDetailController(deps);

    await ctrl.toggle(makeRow(), makeSection(), li, button);

    expect(button.dataset.state).toBe("");
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("Details");
  });

  it("restores idle when consumePsCredit returns false", async () => {
    const doc = document;
    const button = makeButton(doc);
    const li = makeLi(doc);
    const deps = makeDeps({
      doc,
      consumePsCredit: vi.fn().mockReturnValue(false)
    });
    const ctrl = createSectionDetailController(deps);

    await ctrl.toggle(makeRow(), makeSection(), li, button);

    expect(button.dataset.state).toBe("");
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("Details");
    expect(deps.ensureLiveData).not.toHaveBeenCalled();
  });

  it("collapses an open detail row without leaving the button stuck disabled", async () => {
    const doc = document;
    const button = makeButton(doc);
    const li = makeLi(doc);

    // Synthesize an already-open detail row directly under `li`. The toggle
    // should remove it and reset the button to idle.
    const detailRow = doc.createElement("li");
    detailRow.className = "bc-cs-detail-row";
    li.parentElement?.insertBefore(detailRow, li.nextSibling);

    const deps = makeDeps({ doc });
    const ctrl = createSectionDetailController(deps);

    button.dataset.state = "expanded";
    button.disabled = false;
    button.dataset.expanded = "true";
    button.textContent = "Hide";

    await ctrl.toggle(makeRow(), makeSection(), li, button);
    expect(button.dataset.expanded).toBe("false");
    expect(button.dataset.state).toBe("");
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("Details");
    expect(deps.consumePsCredit).not.toHaveBeenCalled();
  });
});

describe("createSectionDetailController — async failure recovery", () => {
  it("rejected ensureLiveData → button restored to idle, retryable", async () => {
    const doc = document;
    const button = makeButton(doc);
    const li = makeLi(doc);
    // Production `ensureLiveData` catches its own errors and returns null,
    // but a defensive controller-side catch covers the case where the
    // implementation rejects (e.g. an unexpected sync throw downstream).
    const deps = makeDeps({
      doc,
      ensureLiveData: vi
        .fn()
        .mockRejectedValue(new Error("storage layer panicked"))
    });
    const ctrl = createSectionDetailController(deps);

    await ctrl.toggle(makeRow(), makeSection(), li, button);

    expect(button.dataset.state).toBe("");
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("Details");
    // No detail row should be left mounted under `li`.
    const detailRow = li.nextElementSibling;
    expect(detailRow).toBeNull();
  });
});
