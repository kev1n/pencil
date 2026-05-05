import { describe, expect, it } from "vitest";

import type { CartEntry } from "../../../../cart-cache";
import type { PaperSection, PaperTermCourse } from "../../paper-data";
import {
  findPaperSection,
  renderMyClassesView
} from "../my-classes-view";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function makeEntry(overrides: Partial<CartEntry> = {}): CartEntry {
  return {
    classNumber: "11111",
    subject: "COMP_SCI",
    catalog: "111-0",
    sectionLabel: "1-LEC",
    capturedAt: 0,
    ...overrides
  };
}

function makeSection(overrides: Partial<PaperSection> = {}): PaperSection {
  return {
    section_id: "COMP_SCI;X",
    course_id: "COMP_SCI;111-0",
    subject: "COMP_SCI",
    catalog: "111-0",
    title: "Intro",
    section: "1",
    component: "LEC",
    meeting_days: ["MoWeFr"],
    start_time: [{ h: 11, m: 0 }],
    end_time: [{ h: 11, m: 50 }],
    room: ["Tech L168"],
    instructors: [{ name: "Riesbeck" }],
    ...overrides
  };
}

function makeCourse(overrides: Partial<PaperTermCourse> = {}): PaperTermCourse {
  return {
    course_id: "COMP_SCI;111-0",
    subject: "COMP_SCI",
    catalog: "111-0",
    title: "Fundamentals of Computer Programming",
    sections: [makeSection()],
    ...overrides
  };
}

describe("renderMyClassesView", () => {
  it("renders both Enrolled and In your cart sections in order", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      enrolled: [makeEntry()],
      inCart: [makeEntry({ catalog: "211-0", classNumber: "22222" })]
    });
    const sections = wrap.querySelectorAll<HTMLElement>("section.bc-cs-myclasses");
    expect(sections.length).toBe(2);
    expect(sections[0].querySelector(".bc-cs-myclasses-label")?.textContent).toBe("Enrolled");
    expect(sections[1].querySelector(".bc-cs-myclasses-label")?.textContent).toBe("In your cart");
  });

  it("renders Enrolled-only when cart is empty", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      enrolled: [makeEntry()],
      inCart: []
    });
    const sections = wrap.querySelectorAll<HTMLElement>("section.bc-cs-myclasses");
    expect(sections.length).toBe(1);
    expect(sections[0].querySelector(".bc-cs-myclasses-label")?.textContent).toBe("Enrolled");
  });

  it("renders the entry count next to the section label", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      enrolled: [makeEntry(), makeEntry({ catalog: "211-0" })],
      inCart: []
    });
    const count = wrap.querySelector(".bc-cs-myclasses-count");
    expect(count?.textContent).toBe("2");
  });

  it("paints the formatted course id (strips -0 suffix) and section label", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      enrolled: [makeEntry()],
      inCart: []
    });
    const card = wrap.querySelector<HTMLElement>(".bc-cs-myclass-card");
    expect(card?.dataset.status).toBe("enrolled");
    expect(card?.querySelector(".bc-cs-myclass-id")?.textContent).toBe("COMP_SCI 111");
    expect(card?.querySelector(".bc-cs-myclass-section")?.textContent).toBe("1-LEC");
  });

  it("paints status badges with the right text + dataset", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      enrolled: [makeEntry()],
      inCart: [makeEntry({ catalog: "211-0", classNumber: "22222" })]
    });
    const enrolledBadge = wrap
      .querySelectorAll<HTMLElement>(".bc-cs-myclass-card")[0]
      .querySelector<HTMLElement>(".bc-cs-myclass-badge");
    const cartBadge = wrap
      .querySelectorAll<HTMLElement>(".bc-cs-myclass-card")[1]
      .querySelector<HTMLElement>(".bc-cs-myclass-badge");
    expect(enrolledBadge?.textContent).toBe("Enrolled");
    expect(enrolledBadge?.dataset.status).toBe("enrolled");
    expect(cartBadge?.textContent).toBe("In cart");
    expect(cartBadge?.dataset.status).toBe("in-cart");
  });

  it("enriches the card with paper.nu title + meeting/instructor when matched", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      enrolled: [makeEntry()],
      inCart: []
    });
    const card = wrap.querySelector<HTMLElement>(".bc-cs-myclass-card");
    expect(card?.querySelector(".bc-cs-myclass-title")?.textContent).toBe(
      "Fundamentals of Computer Programming"
    );
    const detail = card?.querySelector(".bc-cs-myclass-detail")?.textContent ?? "";
    expect(detail).toContain("Riesbeck");
    expect(detail).toContain("MoWeFr");
  });

  it("falls back to a title-less card when paper.nu data isn't loaded", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      enrolled: [makeEntry()],
      inCart: []
    });
    const card = wrap.querySelector<HTMLElement>(".bc-cs-myclass-card");
    expect(card?.querySelector(".bc-cs-myclass-title")).toBeNull();
    expect(card?.querySelector(".bc-cs-myclass-detail")).toBeNull();
  });

  it("returns a wrap with display:contents so it doesn't disturb layout", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      enrolled: [makeEntry()],
      inCart: []
    });
    expect(wrap.style.display).toBe("contents");
  });
});

describe("findPaperSection", () => {
  it("matches catalog with -0 suffix tolerance", () => {
    const courses = [makeCourse()];
    const found = findPaperSection(
      courses,
      makeEntry({ catalog: "111", sectionLabel: "1-LEC" })
    );
    expect(found?.course.catalog).toBe("111-0");
  });

  it("returns null when subject mismatches", () => {
    const courses = [makeCourse()];
    expect(
      findPaperSection(courses, makeEntry({ subject: "MATH" }))
    ).toBeNull();
  });

  it("returns null when section label has no matching component", () => {
    const courses = [makeCourse()];
    expect(
      findPaperSection(courses, makeEntry({ sectionLabel: "1-LAB" }))
    ).toBeNull();
  });
});
