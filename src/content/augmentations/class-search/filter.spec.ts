import { describe, expect, it } from "vitest";
import { applyFilters } from "./filter";
import type { PaperSection, PaperTermCourse } from "./paper-data";
import type { SearchFilters } from "./types";

const title = "Special Topics in Computer Science";
function section(number: string, topic: string): PaperSection {
  return {
    section_id: `COMP_SCI;396-${number}`,
    course_id: "COMP_SCI;396-0",
    subject: "COMP_SCI", catalog: "396-0", title, topic,
    section: number, component: "LEC",
    meeting_days: [], start_time: [], end_time: [], room: []
  };
}
const healthTech = section("10", "Health Tech");
const security = section("7", "LLM-Assisted Security");
const course: PaperTermCourse = {
  course_id: "COMP_SCI;396-0", subject: "COMP_SCI", catalog: "396-0",
  title, school: "MEAS", sections: [security, healthTech]
};
function find(query: string, overrides: Partial<SearchFilters> = {}, courses = [course]) {
  return applyFilters(courses, new Map(), {
    COMP_SCI: { symbol: "COMP_SCI", display: "Computer Science" }
  }, { termId: "5050", query, disciplines: new Set(), ...overrides }, "UGRD");
}

describe("Sharper Search section topics", () => {
  it.each(["health tech", "HEALTH TECH", "cs 396 health tech", "computer science health tech"])(
    "finds only Health Tech's section for %s", (query) => {
      expect(find(query)).toEqual([{ course, sections: [healthTech] }]);
    }
  );

  it("also matches a section's own title when no topic is present", () => {
    const titledSection = { ...healthTech, title: "Health Tech", topic: undefined };
    const titledCourse = { ...course, sections: [security, titledSection] };
    expect(find("health tech", {}, [titledCourse])).toEqual([
      { course: titledCourse, sections: [titledSection] }
    ]);
  });

  it("does not combine words from different sections into a match", () => {
    expect(find("health security")).toEqual([]);
  });

  it.each(["cs 396", "cs 39x", "special topics", "computer science"])(
    "preserves every section for course-level query %s", (query) => {
      expect(find(query)).toEqual([{ course, sections: course.sections }]);
    }
  );

  it("still respects discipline filters on a topic search", () => {
    expect(find("health tech", { disciplines: new Set(["NS"]) })).toEqual([]);
  });
});
