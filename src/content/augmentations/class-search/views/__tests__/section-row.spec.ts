import { describe, expect, it, vi } from "vitest";

import type { PaperSection } from "../../paper-data";
import { renderSectionRow } from "../section-row";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function makeSection(overrides: Partial<PaperSection> = {}): PaperSection {
  return {
    section_id: "X",
    course_id: "Y",
    subject: "COMP_SCI",
    catalog: "111-0",
    title: "T",
    section: "20",
    component: "LEC",
    meeting_days: ["MoWeFr"],
    start_time: [{ h: 11, m: 0 }],
    end_time: [{ h: 11, m: 50 }],
    room: ["Tech L168"],
    instructors: [{ name: "Riesbeck" }],
    start_date: "2026-09-15",
    end_date: "2026-12-09",
    ...overrides
  };
}

describe("renderSectionRow", () => {
  it("renders the section number, component, time, instructor, and room cells", () => {
    const doc = fresh();
    const li = renderSectionRow(doc, {
      section: makeSection(),
      sigKey: "K",
      showActions: true,
      registerAddButton: vi.fn(),
      onAddToCart: vi.fn(),
      onToggleDetails: vi.fn()
    });
    expect(li.classList.contains("bc-cs-section")).toBe(true);
    expect(li.dataset.sectionNumber).toBe("20");
    expect(li.dataset.component).toBe("LEC");
    expect(li.querySelector(".bc-cs-section-id")?.textContent).toBe("20");
    expect(li.querySelector(".bc-cs-section-component")?.textContent).toBe("LEC");
    expect(li.querySelector(".bc-cs-section-instructor")?.textContent).toBe("Riesbeck");
    expect(li.querySelector(".bc-cs-section-room")?.textContent).toBe("Tech L168");
  });

  it("renders the meeting time line", () => {
    const doc = fresh();
    const li = renderSectionRow(doc, {
      section: makeSection(),
      sigKey: "K",
      showActions: true,
      registerAddButton: vi.fn(),
      onAddToCart: vi.fn(),
      onToggleDetails: vi.fn()
    });
    const time = li.querySelector<HTMLElement>(".bc-cs-section-time");
    expect(time?.textContent).toContain("MoWeFr");
    expect(time?.textContent).toContain("11:00am");
  });

  it("renders an empty live cell with data-role='live'", () => {
    const doc = fresh();
    const li = renderSectionRow(doc, {
      section: makeSection(),
      sigKey: "K",
      showActions: true,
      registerAddButton: vi.fn(),
      onAddToCart: vi.fn(),
      onToggleDetails: vi.fn()
    });
    const live = li.querySelector<HTMLElement>("[data-role='live']");
    expect(live).not.toBeNull();
    expect(live?.classList.contains("bc-cs-section-live")).toBe(true);
    expect(live?.textContent).toBe("");
  });

  it("calls onAddToCart when the Add button is clicked", () => {
    const doc = fresh();
    const onAdd = vi.fn();
    const li = renderSectionRow(doc, {
      section: makeSection(),
      sigKey: "K",
      showActions: true,
      registerAddButton: vi.fn(),
      onAddToCart: onAdd,
      onToggleDetails: vi.fn()
    });
    const addBtn = li.querySelector<HTMLButtonElement>(".bc-cs-add");
    expect(addBtn?.textContent).toBe("Add to cart");
    expect(addBtn?.dataset.sigKey).toBe("K");
    addBtn?.click();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleDetails when the Details button is clicked", () => {
    const doc = fresh();
    const onToggle = vi.fn();
    const li = renderSectionRow(doc, {
      section: makeSection(),
      sigKey: "K",
      showActions: true,
      registerAddButton: vi.fn(),
      onAddToCart: vi.fn(),
      onToggleDetails: onToggle
    });
    li.querySelector<HTMLButtonElement>(".bc-cs-details-btn")?.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("invokes registerAddButton with the freshly-created button + sigKey", () => {
    const doc = fresh();
    const register = vi.fn();
    const li = renderSectionRow(doc, {
      section: makeSection(),
      sigKey: "SIG",
      showActions: true,
      registerAddButton: register,
      onAddToCart: vi.fn(),
      onToggleDetails: vi.fn()
    });
    expect(register).toHaveBeenCalledTimes(1);
    const [btn, sigKey] = register.mock.calls[0]!;
    expect(sigKey).toBe("SIG");
    expect(btn).toBe(li.querySelector(".bc-cs-add"));
  });

  it("renders a readable date range above the meeting line when start/end_date are present", () => {
    const doc = fresh();
    const li = renderSectionRow(doc, {
      section: makeSection(),
      sigKey: "K",
      showActions: true,
      registerAddButton: vi.fn(),
      onAddToCart: vi.fn(),
      onToggleDetails: vi.fn()
    });
    const time = li.querySelector<HTMLElement>(".bc-cs-section-time");
    const dates = time?.querySelector(".bc-cs-section-time-dates");
    const pattern = time?.querySelector(".bc-cs-section-time-pattern");
    expect(dates?.textContent).toBe("Sep 15 – Dec 9, 2026");
    // Dates should appear before the meeting pattern in DOM order.
    expect(time?.firstElementChild).toBe(dates ?? null);
    expect(pattern?.textContent).toContain("MoWeFr");
  });

  it("omits the Add button (Details still renders) when showAdd is false", () => {
    const doc = fresh();
    const register = vi.fn();
    const li = renderSectionRow(doc, {
      section: makeSection(),
      sigKey: "K",
      showActions: true,
      showAdd: false,
      registerAddButton: register,
      onAddToCart: vi.fn(),
      onToggleDetails: vi.fn()
    });
    expect(li.querySelector(".bc-cs-add")).toBeNull();
    expect(li.querySelector(".bc-cs-details-btn")).not.toBeNull();
    // No Add button means no registry callback either.
    expect(register).not.toHaveBeenCalled();
  });

  it("renders an empty actions cell with no buttons when showActions is false", () => {
    const doc = fresh();
    const register = vi.fn();
    const li = renderSectionRow(doc, {
      section: makeSection({ component: "DIS" }),
      sigKey: "K",
      showActions: false,
      registerAddButton: register,
      onAddToCart: vi.fn(),
      onToggleDetails: vi.fn()
    });
    const actions = li.querySelector<HTMLElement>(".bc-cs-section-actions");
    expect(actions).not.toBeNull();
    expect(actions?.dataset.hidden).toBe("true");
    expect(li.querySelector(".bc-cs-details-btn")).toBeNull();
    expect(li.querySelector(".bc-cs-add")).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });
});
