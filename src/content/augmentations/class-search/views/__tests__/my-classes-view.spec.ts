import { describe, expect, it } from "vitest";

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

  it("paints the formatted course id (strips -0 suffix) and section label", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      catalogIndex: EMPTY_INDEX,
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
      catalogIndex: EMPTY_INDEX,
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

  it("enriches the card with paper.nu title, meeting+room, and instructor when matched", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry()],
      inCart: []
    });
    const card = wrap.querySelector<HTMLElement>(".bc-cs-myclass-card");
    expect(card?.querySelector(".bc-cs-myclass-title")?.textContent).toBe(
      "Fundamentals of Computer Programming"
    );
    const detailText = Array.from(card?.querySelectorAll(".bc-cs-myclass-detail") ?? [])
      .map((el) => el.textContent ?? "")
      .join(" | ");
    expect(detailText).toContain("MoWeFr");
    expect(detailText).toContain("Tech L168");
    expect(detailText).toContain("Riesbeck");
  });

  it("renders a facts line with class number when only the cart entry is known", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry({ classNumber: "44444" })],
      inCart: []
    });
    const card = wrap.querySelector<HTMLElement>(".bc-cs-myclass-card");
    expect(card?.querySelector(".bc-cs-myclass-facts")?.textContent).toContain("#44444");
  });

  it("includes capacity and date range in the facts line when paper.nu has them", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [
        makeCourse({
          sections: [
            makeSection({
              capacity: "120",
              start_date: "01/06/2026",
              end_date: "03/13/2026"
            })
          ]
        })
      ],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry()],
      inCart: []
    });
    const facts = wrap.querySelector<HTMLElement>(".bc-cs-myclass-facts")?.textContent ?? "";
    expect(facts).toContain("#11111");
    expect(facts).toContain("cap 120");
    expect(facts).toContain("01/06/2026");
    expect(facts).toContain("03/13/2026");
  });

  it("renders units, distro, discipline, and school tags from the catalog index", () => {
    const doc = fresh();
    const catalogIndex = new Map<string, PaperCourse>([
      [
        "COMP_SCI 111-0",
        makePlanCourse({ units: "1.00", distros: "2", disciplines: "B", school: "MEAS" })
      ]
    ]);
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse({ school: "MEAS" })],
      catalogIndex,
      enrolled: [makeEntry()],
      inCart: []
    });
    const tags = Array.from(
      wrap.querySelectorAll<HTMLElement>(".bc-cs-myclass-tag")
    ).map((el) => ({ kind: el.dataset.kind, text: el.textContent }));
    expect(tags).toEqual(
      expect.arrayContaining([
        { kind: "units", text: "1.00 unit" },
        { kind: "distro", text: expect.stringContaining("Dist 2") },
        { kind: "discipline", text: expect.stringContaining("Disc B") },
        { kind: "school", text: "MEAS" }
      ])
    );
  });

  it("renders the course description from the catalog index", () => {
    const doc = fresh();
    const catalogIndex = new Map<string, PaperCourse>([
      [
        "COMP_SCI 111-0",
        makePlanCourse({ description: "An introduction to programming." })
      ]
    ]);
    const wrap = renderMyClassesView(doc, {
      paperCourses: [makeCourse()],
      catalogIndex,
      enrolled: [makeEntry()],
      inCart: []
    });
    expect(wrap.querySelector(".bc-cs-myclass-desc")?.textContent).toBe(
      "An introduction to programming."
    );
  });

  it("appends the section topic to the title when present", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [
        makeCourse({
          title: "Topics in Literature",
          sections: [makeSection({ topic: "Speculative Fiction" })]
        })
      ],
      catalogIndex: EMPTY_INDEX,
      enrolled: [makeEntry()],
      inCart: []
    });
    expect(wrap.querySelector(".bc-cs-myclass-title")?.textContent).toBe(
      "Topics in Literature — Speculative Fiction"
    );
  });

  it("falls back to a title-less card when paper.nu data isn't loaded", () => {
    const doc = fresh();
    const wrap = renderMyClassesView(doc, {
      paperCourses: [],
      catalogIndex: EMPTY_INDEX,
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
});
