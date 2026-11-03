import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../class-search/paper-data");
vi.mock("../paper-combos/data");
vi.mock("../class-search/caesar-search", async (importOriginal) => ({
  ...await importOriginal<typeof import("../class-search/caesar-search")>(),
  searchCaesarCatalog: vi.fn(),
  addSectionToCart: vi.fn()
}));

import { addSectionToCart, searchCaesarCatalog, type CaesarCourseGroup } from "../class-search/caesar-search";
import { getDataMapInfo, getTermCourses, refreshTermCourses, type PaperSection } from "../class-search/paper-data";
import { readPaperScheduleSnapshot } from "../paper-combos/data";
import { addChipSectionToCart } from "./cart-flow";

const auth = { ensure: vi.fn(), dispose: vi.fn() };
const params = { subject: "COMP_SCI", catalogNumber: "211", instructor: "Example" };
const section: PaperSection = {
  section_id: "COMP_SCI;winter-2", course_id: "COMP_SCI;211-0",
  subject: "COMP_SCI", catalog: "211-0", title: "Systems", section: "2", component: "LEC",
  instructors: [{ name: "Alex Example" }], meeting_days: [], start_time: [], end_time: [], room: []
};
const otherSection = { ...section, section_id: "COMP_SCI;winter-1", section: "1" };
const course = {
  course_id: section.course_id, subject: section.subject, catalog: section.catalog,
  title: section.title, sections: [section, otherSection]
};
const groups: CaesarCourseGroup[] = [{
  courseId: "COMP_SCI 211-0 - Systems", catalog: "211-0", title: "Systems",
  sections: [{
    classNumber: "24943", sectionLabel: "2-LEC", sectionNumber: "2", component: "LEC",
    instructor: "Alex Example", status: "Open", selectActionId: "SSR_PB_SELECT$0",
    selectAvailable: true, daysTime: "", room: "", meetingDates: "", grading: ""
  }]
}];

beforeEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML = '<div class="hidden"><button>2027 Winter<div class="absolute hidden">Change term</div></button></div>';
  vi.mocked(getDataMapInfo).mockResolvedValue({
    latest: "5040", plan: "", subjects: "",
    terms: { "5040": { name: "2026 Fall", updated: "" }, "5050": { name: "2027 Winter", updated: "" } }
  });
  vi.mocked(getTermCourses).mockResolvedValue([course]);
  vi.mocked(readPaperScheduleSnapshot).mockResolvedValue({ termId: "5050", sectionIds: [section.section_id] });
  vi.mocked(searchCaesarCatalog).mockResolvedValue({ groups });
  vi.mocked(addSectionToCart).mockResolvedValue({
    ok: true, classNumber: "24943", sectionLabel: "2-LEC", courseTitle: "Systems", searchGroups: groups
  });
});

it("uses the saved Winter term and exact scheduled section with the Search pane hidden", async () => {
  expect(await addChipSectionToCart(auth, params, "Systems")).toMatchObject({
    ok: true, termId: "5050", classNumber: "24943"
  });
  expect(searchCaesarCatalog).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ termId: "5050" }));
  expect(addSectionToCart).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    termId: "5050", classNumber: "24943"
  }));
});

it("reads the Winter search placeholder and refreshes a catalog missing the scheduled section", async () => {
  document.body.innerHTML = '<input placeholder="Search 2027 Winter..." value="comp_sci 211">';
  vi.mocked(getTermCourses).mockResolvedValueOnce([{ ...course, sections: [otherSection] }]);
  vi.mocked(refreshTermCourses).mockResolvedValueOnce([course]);

  expect(await addChipSectionToCart(auth, params, "Systems")).toMatchObject({
    ok: true, termId: "5050", classNumber: "24943"
  });
  expect(refreshTermCourses).toHaveBeenCalledExactlyOnceWith("5050");
  expect(addSectionToCart).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    termId: "5050", classNumber: "24943"
  }));
});

it("uses a unique saved section even when the catalog instructor differs from the card", async () => {
  vi.mocked(getTermCourses).mockResolvedValueOnce([{
    ...course,
    sections: [{ ...section, instructors: [{ name: "Earlier Instructor" }] }, otherSection]
  }]);

  expect(await addChipSectionToCart(auth, params, "Systems")).toMatchObject({
    ok: true, termId: "5050", classNumber: "24943"
  });
  expect(addSectionToCart).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    termId: "5050", classNumber: "24943"
  }));
});

it("makes no CAESAR requests when the visible term disagrees with the saved schedule", async () => {
  document.body.innerHTML = '<button>2026 Fall<div class="absolute hidden">Change term</div></button>';
  expect(await addChipSectionToCart(auth, params, "Systems")).toMatchObject({ ok: false, error: expect.stringContaining("doesn't match this tab's term") });
  expect(searchCaesarCatalog).not.toHaveBeenCalled();
  expect(addSectionToCart).not.toHaveBeenCalled();
});

it("makes no CAESAR requests when the tab's term can't be verified", async () => {
  document.body.replaceChildren();
  expect((await addChipSectionToCart(auth, params, "Systems")).ok).toBe(false);
  expect(searchCaesarCatalog).not.toHaveBeenCalled();
  expect(addSectionToCart).not.toHaveBeenCalled();
});

it("makes no CAESAR requests when the schedule is missing or the card is ambiguous", async () => {
  vi.mocked(readPaperScheduleSnapshot).mockResolvedValueOnce(null);
  expect((await addChipSectionToCart(auth, params, "Systems")).ok).toBe(false);
  vi.mocked(readPaperScheduleSnapshot).mockResolvedValueOnce({
    termId: "5050", sectionIds: [section.section_id, otherSection.section_id]
  });
  expect((await addChipSectionToCart(auth, params, "Systems")).ok).toBe(false);
  expect(searchCaesarCatalog).not.toHaveBeenCalled();
  expect(addSectionToCart).not.toHaveBeenCalled();
});
