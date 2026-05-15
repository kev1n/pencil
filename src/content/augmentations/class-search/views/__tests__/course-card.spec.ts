import { describe, expect, it } from "vitest";

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
      sectionRows: []
    });
    expect(card.classList.contains("bc-cs-course")).toBe(true);
    expect(card.querySelector(".bc-cs-course-id")?.textContent).toBe("COMP_SCI 111");
    expect(card.querySelector(".bc-cs-course-title")?.textContent).toBe(
      "Fundamentals of Computer Programming"
    );
    // Singular suffix when units is exactly "1.00".
    expect(card.querySelector(".bc-cs-course-units")?.textContent).toBe("1.00 unit");
  });

  it("renders FD icons in chip order for matching distros/disciplines", () => {
    const doc = fresh();
    // distros "63" → LA (6) + SBS (3); disciplines "2" → EDR. Order
    // returned should match FOUNDATIONAL_DISCIPLINES: EDR, SBS, LA.
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry({ distros: "63", disciplines: "2" }),
      sectionRows: []
    });
    const wraps = card.querySelectorAll<HTMLSpanElement>(
      ".bc-cs-course-fds .bc-cs-fd-icon-wrap"
    );
    expect(Array.from(wraps).map((w) => w.dataset.fd)).toEqual(["EDR", "SBS", "LA"]);
    // Each wrap carries a CSS tooltip with the full FD name.
    expect(wraps[0].querySelector(".bc-tooltip")?.textContent).toBe(
      "Empirical & Deductive Reasoning"
    );
  });

  it("renders an empty fd row when the course has no matching tags", () => {
    const doc = fresh();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry({ distros: "7", disciplines: undefined }),
      sectionRows: []
    });
    expect(
      card.querySelectorAll(".bc-cs-course-fds .bc-cs-fd-icon-wrap").length
    ).toBe(0);
  });

  it("renders the description block when planEntry.description is present", () => {
    const doc = fresh();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry({ description: "Hello world" }),
      sectionRows: []
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
      sectionRows: [liA, liB]
    });
    const list = card.querySelector(".bc-cs-section-list");
    expect(list?.children.length).toBe(2);
    expect((list?.children[0] as HTMLElement).dataset.marker).toBe("a");
    expect((list?.children[1] as HTMLElement).dataset.marker).toBe("b");
  });

  it("collapses multiple section rows behind a disclosure when requested", () => {
    const doc = fresh();
    const liA = doc.createElement("li");
    liA.dataset.marker = "a";
    const liB = doc.createElement("li");
    liB.dataset.marker = "b";
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: null,
      sectionRows: [liA, liB],
      collapseSections: true
    });
    const disclosure = card.querySelector<HTMLDetailsElement>(
      ".bc-cs-sections-disclosure"
    );
    expect(disclosure).not.toBeNull();
    expect(disclosure?.open).toBe(false);
    expect(disclosure?.querySelector("summary")?.textContent).toBe("2 sections");
    const list = disclosure?.querySelector(".bc-cs-section-list");
    expect(list?.children.length).toBe(2);
  });

  it("keeps a single section row visible even when collapse is requested", () => {
    const doc = fresh();
    const li = doc.createElement("li");
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: null,
      sectionRows: [li],
      collapseSections: true
    });
    expect(card.querySelector(".bc-cs-sections-disclosure")).toBeNull();
    expect(card.querySelector(".bc-cs-section-list")?.children.length).toBe(1);
  });

  it("works without a planEntry (no units, no description, no tag row)", () => {
    const doc = fresh();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: null,
      sectionRows: []
    });
    expect(card.querySelector(".bc-cs-course-units")?.textContent).toBe("");
    expect(card.querySelector(".bc-cs-course-desc")).toBeNull();
    expect(card.querySelector(".bc-cs-course-tags")).toBeNull();
  });

  it("omits the description block entirely when planEntry has no description", () => {
    const doc = fresh();
    const card = renderCourseCard(doc, {
      row: makeRow(),
      planEntry: makePlanEntry({ description: undefined }),
      sectionRows: []
    });
    expect(card.querySelector(".bc-cs-course-desc")).toBeNull();
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
      sectionRows: [sectionLi as HTMLLIElement]
    });
    doc.body.appendChild(card);
    return { doc, card };
  }

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
