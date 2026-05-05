import { describe, expect, it, vi } from "vitest";

import type { CaesarSearchResult } from "../../caesar-search";
import type { PaperCourse } from "../../paper-data";
import type { ResultRow } from "../../types";
import { applyLiveDataToCard, renderCourseCard } from "../course-card";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function makeRow(): ResultRow {
  return {
    course: {
      course_id: "COMP_SCI;111-0",
      subject: "COMP_SCI",
      catalog: "111-0",
      title: "Fundamentals of Computer Programming",
      school: "MEAS",
      sections: []
    },
    sections: []
  };
}

function makePlanEntry(overrides: Partial<PaperCourse> = {}): PaperCourse {
  return {
    id: "COMP_SCI 111-0",
    subject: "COMP_SCI",
    catalog: "111-0",
    name: "Intro",
    units: "1.00",
    description: "An intro course.",
    distros: "26",
    disciplines: "B",
    ...overrides
  };
}

function makeSearchResult(): CaesarSearchResult {
  return {
    groups: [
      {
        courseId: "COMP_SCI 111-0 - Intro",
        catalog: "111-0",
        title: "Intro",
        sections: [
          {
            classNumber: "11111",
            sectionLabel: "20-LEC",
            sectionNumber: "20",
            component: "LEC",
            daysTime: "",
            room: "",
            instructor: "",
            meetingDates: "",
            grading: "",
            status: "Open",
            selectActionId: "S",
            selectAvailable: true
          }
        ]
      }
    ]
  };
}

describe("renderCourseCard", () => {
  it("renders the course id (formatted), title, and units", () => {
    const doc = fresh();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry(),
      sectionRows: [],
      onRefresh: vi.fn()
    });
    expect(card.classList.contains("bc-cs-course")).toBe(true);
    expect(card.querySelector(".bc-cs-course-id")?.textContent).toBe("COMP_SCI 111");
    expect(card.querySelector(".bc-cs-course-title")?.textContent).toBe(
      "Fundamentals of Computer Programming"
    );
    // Singular suffix when units is exactly "1.00".
    expect(card.querySelector(".bc-cs-course-units")?.textContent).toBe("1.00 unit");
  });

  it("paints distro and discipline pills when planEntry has them", () => {
    const doc = fresh();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry({ distros: "2", disciplines: "B" }),
      sectionRows: [],
      onRefresh: vi.fn()
    });
    const tags = Array.from(card.querySelectorAll<HTMLElement>(".bc-cs-tag"));
    const kinds = tags.map((t) => t.dataset.kind);
    expect(kinds).toContain("school");
    expect(kinds).toContain("distro");
    expect(kinds).toContain("discipline");
    const distroTag = tags.find((t) => t.dataset.kind === "distro");
    expect(distroTag?.textContent).toContain("Dist 2");
    const discTag = tags.find((t) => t.dataset.kind === "discipline");
    expect(discTag?.textContent).toContain("Disc B");
  });

  it("hides the refresh button by default and calls onRefresh on click", () => {
    const doc = fresh();
    const onRefresh = vi.fn();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry(),
      sectionRows: [],
      onRefresh
    });
    const refreshBtn = card.querySelector<HTMLButtonElement>(".bc-cs-refresh-btn");
    expect(refreshBtn?.style.display).toBe("none");
    refreshBtn?.click();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders the description block when planEntry.description is present", () => {
    const doc = fresh();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry({ description: "Hello world" }),
      sectionRows: [],
      onRefresh: vi.fn()
    });
    expect(card.querySelector(".bc-cs-course-desc")?.textContent).toBe("Hello world");
  });

  it("appends section rows in order inside .bc-cs-section-list", () => {
    const doc = fresh();
    const liA = doc.createElement("li");
    liA.dataset.marker = "a";
    const liB = doc.createElement("li");
    liB.dataset.marker = "b";
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: null,
      sectionRows: [liA, liB],
      onRefresh: vi.fn()
    });
    const list = card.querySelector(".bc-cs-section-list");
    expect(list?.children.length).toBe(2);
    expect((list?.children[0] as HTMLElement).dataset.marker).toBe("a");
    expect((list?.children[1] as HTMLElement).dataset.marker).toBe("b");
  });

  it("works without a planEntry (no units, distros, disciplines, description)", () => {
    const doc = fresh();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: null,
      sectionRows: [],
      onRefresh: vi.fn()
    });
    expect(card.querySelector(".bc-cs-course-units")?.textContent).toBe("");
    expect(card.querySelector(".bc-cs-course-desc")).toBeNull();
    // school still renders since it's on row.course
    expect(
      card.querySelector<HTMLElement>('.bc-cs-tag[data-kind="school"]')?.textContent
    ).toBe("MEAS");
  });
});

describe("applyLiveDataToCard", () => {
  function buildCard(): { doc: Document; card: HTMLElement } {
    const doc = fresh();
    const sectionLi = doc.createElement("li");
    sectionLi.className = "bc-cs-section";
    sectionLi.dataset.sectionNumber = "20";
    sectionLi.dataset.component = "LEC";
    const live = doc.createElement("div");
    live.dataset.role = "live";
    sectionLi.appendChild(live);
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry(),
      sectionRows: [sectionLi as HTMLLIElement],
      onRefresh: vi.fn()
    });
    doc.body.appendChild(card);
    return { doc, card };
  }

  it("reveals the refresh button when live data lands", () => {
    const { card } = buildCard();
    const refreshBtn = card.querySelector<HTMLButtonElement>(".bc-cs-refresh-btn");
    expect(refreshBtn?.style.display).toBe("none");
    applyLiveDataToCard(card, makeSearchResult(), "111-0");
    expect(refreshBtn?.style.display).toBe("");
  });

  it("paints a status pill in the live cell of matching sections", () => {
    const { card } = buildCard();
    applyLiveDataToCard(card, makeSearchResult(), "111-0");
    const pill = card.querySelector<HTMLElement>(".bc-cs-status-pill");
    expect(pill?.textContent).toBe("Open");
    expect(pill?.dataset.status).toBe("Open");
  });

  it("paints '(course not on CAESAR)' when no group matches", () => {
    const { card } = buildCard();
    applyLiveDataToCard(card, { groups: [] }, "111-0");
    const live = card.querySelector<HTMLElement>("[data-role='live']");
    expect(live?.textContent).toBe("(course not on CAESAR)");
    expect(live?.dataset.tone).toBe("muted");
  });

  it("paints '(no CAESAR row)' when the group matches but the section doesn't", () => {
    const { card } = buildCard();
    const result = makeSearchResult();
    // Force a group/section mismatch by changing the section number.
    result.groups[0].sections[0].sectionNumber = "99";
    applyLiveDataToCard(card, result, "111-0");
    const live = card.querySelector<HTMLElement>("[data-role='live']");
    expect(live?.textContent).toBe("(no CAESAR row)");
  });

  it("returns the LIs whose status pill was painted", () => {
    const { card } = buildCard();
    const touched = applyLiveDataToCard(card, makeSearchResult(), "111-0");
    expect(touched.length).toBe(1);
    expect(touched[0].dataset.sectionNumber).toBe("20");
  });
});
