import { describe, expect, it, vi } from "vitest";
import type { PaperSection } from "../class-search/paper-data";
import { formatScheduleMarkdown } from "./schedule-markdown";

vi.mock("../ctec-links/reports", () => ({
  getCachedReportAggregate: () => ({
    metrics: {
      instruction: { mean: 5.25 },
      course: { mean: 4.75 }
    }
  })
}));

describe("formatScheduleMarkdown", () => {
  it("includes section meetings, dates, rooms, professor, requirements, and cached CTEC scores", () => {
    const section: PaperSection = {
      section_id: "123",
      course_id: "456",
      subject: "COMP_SCI",
      catalog: "449-0",
      title: "Deep Learning",
      section: "01",
      component: "LEC",
      meeting_days: ["13"],
      start_time: [{ h: 11, m: 0 }],
      end_time: [{ h: 12, m: 20 }],
      room: ["Tech L221"],
      start_date: "2026-09-22",
      end_date: "2026-12-05",
      instructors: [{ name: "Ada Lovelace" }],
      enrl_req: "COMP_SCI 349-0"
    };
    const markdown = formatScheduleMarkdown("Fall 2026", [section]);
    expect(markdown).toContain("# Fall 2026");
    expect(markdown).toContain("## COMP_SCI 449-0 — Deep Learning");
    expect(markdown).toContain("Section: 01 (LEC)");
    expect(markdown).toContain("Instructor: Ada Lovelace");
    expect(markdown).toContain("TuTh");
    expect(markdown).toContain("Tech L221");
    expect(markdown).toContain("Dates: 2026-09-22–2026-12-05");
    expect(markdown).toContain("Requirements: COMP_SCI 349-0");
    expect(markdown).toContain("Instruction 5.3/6; Course 4.8/6");
  });
});
