// @vitest-environment-options {"url":"https://caesar.ent.northwestern.edu/psc/csnu_5/EMPLOYEE/SA/c/SSR_STUDENT_ACAD_REC_FL.SSR_CRSE_HIST_FL.GBL"}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseHistoryViewAugmentation, courseHistoryCsv } from ".";

type Fixture = [catalog: string, term: string, start: string, grade: string, status: string];

function row(i: number, [catalog, term, start, grade, status]: Fixture, win = "win5"): string {
  return `<tr class="ps_grid-row psc_rowact" id="CRSE_HIST2$0_row_${i}">
    <td><div id="${win}divSSR_CLASS_BTN$${i}"><span class="ps-link-wrapper" title="Desc ${i}"><a id="SSR_CLASS_BTN$${i}">${catalog}</a></span></div></td>
    <td><span id="DERIVED_SSS_HST_SSR_CLASSNAME_LONG$83$$${i}">Desc ${i}</span></td>
    <td><div id="${win}divDERIVED_SSR_FL_SS_MESSAGE_LONG$${i}"><!--${start}-->${term}</div></td>
    <td>${grade ? `<div id="${win}divDERIVED_SSS_HST_SSR_GRADE_LONG$${i}"><div class="ps-htmlarea"><span class="ps_box-value">${grade}</span></div></div>` : ""}</td>
    <td><span id="DERIVED_SSS_HST_UNT_TAKEN$${i}">1.00</span></td>
    <td><div id="${win}divDERIVED_SSS_HST_SSR_STATUS_LONG$${i}"><img alt="${status}"></div></td>
    <td></td>
  </tr>`;
}

function mount(rows: Fixture[], win = "win5"): HTMLTableSectionElement {
  document.body.innerHTML = `<div><div id="${win}divCRSE_HIST2$0"><div class="ps_header-grid-custom"><a>Filter</a></div><table class="ps_grid-flex">
    <thead><tr><th>Class</th><th>Description</th><th>Term</th><th>Grade</th><th>Units</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map((r, i) => row(i, r, win)).join("")}</tbody>
  </table></div></div>`;
  return document.querySelector("tbody")!;
}

const ROWS: Fixture[] = [
  ["COMP_SCI 329-0", "2026 Fall", "2026-09-23", "", "In Cart"],
  ["COMP_SCI 333-0", "2026 Spring", "2026-03-30", "A", "Taken"],
  ["DSGN 370-0", "2026 Fall", "2026-09-23", "", "In Progress"],
  ["DSGN 240-0", "2026 Spring", "2026-03-30", "A", "Taken"]
];

function order(tbody: HTMLTableSectionElement): string[] {
  return Array.from(tbody.rows)
    .filter((tr) => !tr.hasAttribute("data-bc-ch-hidden"))
    .map((tr) => tr.dataset.bcChTerm ?? tr.querySelector("a")!.textContent!);
}

describe("Course History view", () => {
  let augmentation = new CourseHistoryViewAugmentation();
  beforeEach(() => {
    augmentation = new CourseHistoryViewAugmentation();
  });

  afterEach(() => {
    augmentation.cleanup(document);
    sessionStorage.clear();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  function chip(group: string, label: string): HTMLButtonElement {
    return Array.from(document.querySelectorAll<HTMLButtonElement>(
      `#bc-course-history-toolbar [aria-label="${group}"] .bc-ch-chips button`
    )).find((b) => b.firstChild?.textContent === label)!;
  }

  function chips(group: string): string[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>(
      `#bc-course-history-toolbar [aria-label="${group}"] .bc-ch-chips button`
    )).map((b) => b.textContent! + (b.getAttribute("aria-pressed") === "true" ? "*" : ""));
  }

  function setSubject(value: string): void {
    chip("Subject", value).click();
  }

  function setShowInProgress(_checked: boolean): void {
    chip("Status", "In Progress").click();
  }

  it("groups by term, hides in-progress classes, filters by subject and restores the native grid", () => {
    const tbody = mount(ROWS);
    const nativeRows = Array.from(tbody.rows);
    const nativeHtml = document.body.innerHTML;
    augmentation.run(document);
    augmentation.run(document);

    expect(order(tbody)).toEqual([
      "2026 Fall", "COMP_SCI 329-0",
      "2026 Spring", "COMP_SCI 333-0", "DSGN 240-0"
    ]);
    expect(document.getElementById("bc-course-history-toolbar")?.parentElement?.className).toBe("ps_header-grid-custom");
    expect(tbody.querySelector("tr.bc-ch-term-row th")?.getAttribute("colspan")).toBe("7");
    expect(tbody.querySelector(".bc-ch-term-meta")?.textContent).toBe("1 class · 1.00 unit");
    expect(chips("Status")).toEqual(["Taken2*", "In Cart1*", "In Progress1"]);
    expect(chips("Subject")).toEqual(["All*", "COMP_SCI2", "DSGN2"]);

    setShowInProgress(true);
    expect(order(tbody)).toEqual([
      "2026 Fall", "COMP_SCI 329-0", "DSGN 370-0",
      "2026 Spring", "COMP_SCI 333-0", "DSGN 240-0"
    ]);

    setSubject("DSGN");
    expect(order(tbody)).toEqual(["2026 Fall", "DSGN 370-0", "2026 Spring", "DSGN 240-0"]);

    setShowInProgress(false);
    expect(order(tbody)).toEqual(["2026 Spring", "DSGN 240-0"]);

    // The native <tr>s are moved, never cloned, so CAESAR's row onclick survives.
    expect(nativeRows.every((tr) => tbody.contains(tr))).toBe(true);

    augmentation.cleanup(document);
    expect(document.body.innerHTML).toBe(nativeHtml);
  });

  it("truncates the subject list and keeps the selection visible", () => {
    mount(Array.from({ length: 9 }, (_, i): Fixture => [`S${"ABCDEFGHI"[i]} 101-0`, "2026 Spring", "2026-03-30", "A", "Taken"]));
    augmentation.run(document);
    expect(chips("Subject")).toEqual(["All*", "SA1", "SB1", "SC1", "SD1", "SE1", "SF1", "+3 more"]);
    chip("Subject", "+3 more").click();
    setSubject("SI");
    chip("Subject", "Show less").click();
    expect(chips("Subject")).toEqual(["All", "SA1", "SB1", "SC1", "SD1", "SE1", "SF1", "SI1*", "+2 more"]);
  });

  it("reads terms and statuses whatever CAESAR window the page opened in", () => {
    // Academic Records' sidebar opens Course History under /csnu_2670/,
    // so wrapper ids carry win2670 rather than win5.
    const tbody = mount(ROWS, "win2670");
    augmentation.run(document);
    expect(order(tbody)).toEqual([
      "2026 Fall", "COMP_SCI 329-0",
      "2026 Spring", "COMP_SCI 333-0", "DSGN 240-0"
    ]);
    expect(chips("Status")).toEqual(["Taken2*", "In Cart1*", "In Progress1"]);
  });

  it("orders terms newest first whatever the native sort", () => {
    const tbody = mount([...ROWS].reverse());
    augmentation.run(document);
    expect(order(tbody).filter((label) => label.startsWith("2026"))).toEqual(["2026 Fall", "2026 Spring"]);
  });

  it("downloads the visible rows as CSV", async () => {
    mount(ROWS);
    augmentation.run(document);
    setSubject("COMP_SCI");

    let blob: Blob | null = null;
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => { blob = b as Blob; return "blob:x"; });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("course-history-comp_sci.csv");
    });
    document.querySelector<HTMLButtonElement>(".bc-ch-download")!.click();
    expect(clicked).toHaveBeenCalledOnce();
    expect(await (blob as Blob | null)!.text()).toBe(
      "Term,Class,Description,Grade,Units,Status\r\n" +
      "2026 Fall,COMP_SCI 329-0,Desc 0,,1.00,In Cart\r\n" +
      "2026 Spring,COMP_SCI 333-0,Desc 1,A,1.00,Taken\r\n"
    );
  });

  it("escapes CSV cells", () => {
    expect(courseHistoryCsv([{
      catalog: "ENGLISH 332-0", subject: "ENGLISH", number: "332-0",
      description: 'Drama, "Staging"', termLabel: "2026 Fall", termStartDate: null,
      grade: null, units: 1, status: "In Cart"
    }])).toBe('Term,Class,Description,Grade,Units,Status\r\n2026 Fall,ENGLISH 332-0,"Drama, ""Staging""",,1.00,In Cart\r\n');
  });
});
