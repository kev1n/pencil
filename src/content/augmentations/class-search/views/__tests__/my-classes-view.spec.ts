import { describe, expect, it, vi } from "vitest";

import type { CartEntry } from "../../../../cart-cache";
import type { PaperCourse, PaperSection, PaperTermCourse } from "../../paper-data";
import {
  findPaperSection,
  renderMyClassesView
} from "../my-classes-view";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

const EMPTY_INDEX = new Map<string, PaperCourse>();

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

function makePlanCourse(overrides: Partial<PaperCourse> = {}): PaperCourse {
  return {
    id: "COMP_SCI 111-0",
    subject: "COMP_SCI",
    catalog: "111-0",
    name: "Fundamentals of Computer Programming",
    units: "1.00",
    ...overrides
  };
}

describe("renderMyClassesView", () => {
  it("renders both Enrolled and In your cart sections in order", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      catalogIndex: EMPTY_INDEX,
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
      catalogIndex: EMPTY_INDEX,
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
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry(), makeEntry({ catalog: "211-0" })],
      inCart: []
    });
    const count = wrap.querySelector(".bc-cs-myclasses-count");
    expect(count?.textContent).toBe("2");
  });

  it("renders rich cards via renderCourseCard when paper data is loaded", () => {
    const doc = fresh();
    const catalogIndex = new Map<string, PaperCourse>([
      ["COMP_SCI 111-0", makePlanCourse({ description: "Hello" })]
    ]);
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      catalogIndex,
      enrolled: [makeEntry()],
      inCart: []
    });
    const card = wrap.querySelector<HTMLElement>(".bc-cs-course");
    expect(card).not.toBeNull();
    expect(card?.dataset.cartStatus).toBe("enrolled");
    expect(card?.querySelector(".bc-cs-course-id")?.textContent).toBe("COMP_SCI 111");
    expect(card?.querySelector(".bc-cs-course-title")?.textContent).toBe(
      "Fundamentals of Computer Programming"
    );
    expect(card?.querySelector(".bc-cs-course-desc")?.textContent).toBe("Hello");
    // Section row from renderSectionRow rides inside.
    const sectionRow = card?.querySelector(".bc-cs-section");
    expect(sectionRow).not.toBeNull();
    expect(sectionRow?.querySelector(".bc-cs-section-instructor")?.textContent).toBe(
      "Riesbeck"
    );
  });

  it("paints the cart status pill in the course-card head", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry()],
      inCart: [makeEntry({ catalog: "211-0", classNumber: "22222" })]
    });
    const cards = wrap.querySelectorAll<HTMLElement>(".bc-cs-course");
    expect(cards.length).toBe(2);
    const enrolledBadge = cards[0].querySelector<HTMLElement>(".bc-cs-cart-badge");
    expect(enrolledBadge?.textContent).toBe("Enrolled");
    expect(enrolledBadge?.dataset.status).toBe("enrolled");
    expect(cards[0].dataset.cartStatus).toBe("enrolled");
    // No paper course matches catalog 211 → fallback card.
    expect(cards[1].querySelector<HTMLElement>(".bc-cs-cart-badge")?.textContent).toBe(
      "In cart"
    );
    expect(cards[1].dataset.cartStatus).toBe("in-cart");
  });

  it("suppresses the Add-to-cart button on cart cards (Details remains)", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry()],
      inCart: []
    });
    const card = wrap.querySelector<HTMLElement>(".bc-cs-course");
    expect(card?.querySelector(".bc-cs-add")).toBeNull();
    expect(card?.querySelector(".bc-cs-details-btn")).not.toBeNull();
  });

  it("invokes registerCtecHost with the resolved paper course + section", () => {
    const doc = fresh();
    const calls: { course: PaperTermCourse; section: PaperSection }[] = [];
    renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry()],
      inCart: [],
      registerCtecHost: (host, course, section) => {
        expect(host.classList.contains("bc-cs-section-ctec")).toBe(true);
        calls.push({ course, section });
      }
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].course.subject).toBe("COMP_SCI");
    expect(calls[0].section.section).toBe("1");
  });

  it("invokes registerCartCard once per entry with the section's <li>", () => {
    const doc = fresh();
    const lis: HTMLLIElement[] = [];
    renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry()],
      inCart: [],
      registerCartCard: (li) => lis.push(li)
    });
    expect(lis).toHaveLength(1);
    expect(lis[0].classList.contains("bc-cs-section")).toBe(true);
  });

  it("forwards Details-button clicks to onDetailsClick with the live <li> + button", () => {
    const doc = fresh();
    const onDetails = vi.fn();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry()],
      inCart: [],
      onDetailsClick: onDetails
    });
    const detailsBtn = wrap.querySelector<HTMLButtonElement>(".bc-cs-details-btn");
    detailsBtn?.click();
    expect(onDetails).toHaveBeenCalledTimes(1);
    const [entry, li, button] = onDetails.mock.calls[0]!;
    expect(entry.subject).toBe("COMP_SCI");
    expect(li.classList.contains("bc-cs-section")).toBe(true);
    expect(button).toBe(detailsBtn);
  });

  it("groups multiple entries of the same course (LEC + DIS) into one card", () => {
    const doc = fresh();
    const lec = makeSection({ section: "1", component: "LEC" });
    const dis = makeSection({
      section: "61",
      component: "DIS",
      instructors: [],
      meeting_days: ["4"],
      start_time: [{ h: 10, m: 0 }],
      end_time: [{ h: 10, m: 50 }],
      room: ["TBA"]
    });
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse({ sections: [lec, dis] })],
      catalogIndex: EMPTY_INDEX,
      enrolled: [],
      inCart: [
        makeEntry({ sectionLabel: "1-LEC", classNumber: "11111" }),
        makeEntry({ sectionLabel: "61-DIS", classNumber: "61111" })
      ]
    });
    const cards = wrap.querySelectorAll<HTMLElement>(".bc-cs-course");
    expect(cards.length).toBe(1);
    const sectionRows = cards[0].querySelectorAll(".bc-cs-section");
    expect(sectionRows.length).toBe(2);
    expect(sectionRows[0].querySelector(".bc-cs-section-component")?.textContent).toBe(
      "LEC"
    );
    expect(sectionRows[1].querySelector(".bc-cs-section-component")?.textContent).toBe(
      "DIS"
    );
    // Single status badge (the card head's), not one per section row.
    expect(cards[0].querySelectorAll(".bc-cs-cart-badge").length).toBe(1);
  });

  it("keeps separate cards for entries with different catalogs", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      catalogIndex: EMPTY_INDEX,
      enrolled: [],
      inCart: [
        makeEntry({ catalog: "111-0", classNumber: "11111" }),
        makeEntry({ catalog: "211-0", classNumber: "22222" })
      ]
    });
    expect(wrap.querySelectorAll(".bc-cs-course").length).toBe(2);
  });

  it("falls back to a minimal card when paper data isn't loaded for the entry", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry({ description: "Cart-side description" })],
      inCart: []
    });
    const card = wrap.querySelector<HTMLElement>(".bc-cs-course");
    expect(card?.dataset.cartStatus).toBe("enrolled");
    expect(card?.querySelector(".bc-cs-course-id")?.textContent).toBe("COMP_SCI 111-0");
    expect(card?.querySelector(".bc-cs-cart-badge")?.textContent).toBe("Enrolled");
    expect(card?.querySelector(".bc-cs-course-desc")?.textContent).toBe(
      "Cart-side description"
    );
    // No section row in the fallback (paper data drove that branch).
    expect(card?.querySelector(".bc-cs-section")).toBeNull();
  });

  it("returns a wrap with display:contents so it doesn't disturb layout", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      catalogIndex: EMPTY_INDEX,
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

  it("matches by section number alone when sectionLabel has no component (cart-page hydrator)", () => {
    const courses = [makeCourse()];
    const found = findPaperSection(courses, makeEntry({ sectionLabel: "1" }));
    expect(found?.section.section).toBe("1");
    expect(found?.section.component).toBe("LEC");
  });

  it("prefers LEC over a sibling DIS when component is missing", () => {
    const lec = makeSection({ section: "1", component: "LEC" });
    const dis = makeSection({ section: "1", component: "DIS" });
    const courses = [makeCourse({ sections: [dis, lec] })];
    const found = findPaperSection(courses, makeEntry({ sectionLabel: "1" }));
    expect(found?.section.component).toBe("LEC");
  });
});
