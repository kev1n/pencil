import { beforeEach, describe, expect, it } from "vitest";

import { findDialogCancel, hasDialog, readSideTab, viewContent, viewName } from "./page";

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.title = "";
});

describe("readSideTab", () => {
  it("names a link-menu tab by its psa_tab_ class", () => {
    document.body.innerHTML = `
      <li class="ps_box-scrollarea-row psa_tab_SSR_CRSE_HIST_FL">Course History</li>
      <li class="ps_box-scrollarea-row psa_tab_SSR_VWGD_GRADE_FL psc_selected">View Grades</li>`;
    expect(readSideTab(document)).toBe("tab:psa_tab_SSR_VWGD_GRADE_FL");
  });

  it("names a step-list tab by the step in its click handler", () => {
    document.body.innerHTML = `
      <div class="ps_ag-step-button psc_selected"
           onclick="if (!top.ptgpPage.openCustomStepButton('ADMN_S2017')) top.ptgpPage.openUrlWithWarning()">Cart</div>`;
    expect(readSideTab(document)).toBe("step:ADMN_S2017");
  });

  it("is null on a page without a selected tab", () => {
    document.body.innerHTML = `<li class="psa_tab_X">Not selected</li>`;
    expect(readSideTab(document)).toBeNull();
  });
});

describe("viewContent", () => {
  const context = { shell: false, searchTab: "better" };

  it("names a view by Pencil's search tab, the title and the page's headings", () => {
    document.title = "Class Search";
    document.body.innerHTML = `<form class="PSForm"><span class="PAPAGETITLE">Enter Search Criteria</span></form>`;
    expect(viewContent(document, context)).toBe("better|Class Search|Enter Search Criteria");
  });

  it("ignores Pencil's own headings, which come and go as its panels mount", () => {
    document.title = "Class Search";
    document.body.innerHTML = `
      <form class="PSForm">
        <span class="PAPAGETITLE">Enter Search Criteria</span>
        <div class="bc-class-search"><h1>Sharper Search</h1></div>
      </form>`;
    expect(viewContent(document, context)).toBe("better|Class Search|Enter Search Criteria");
  });

  it("marks a view with a PeopleSoft dialog open", () => {
    document.title = "Term GPA Details";
    document.body.innerHTML = `<form class="PSForm"><h1>Grade Details</h1></form><div id="pt_modals"><div id="ptMod_0"></div></div>`;
    expect(viewContent(document, context)).toBe("better|Term GPA Details|Grade Details|dialog");
  });

  it("leaves a shell around a content frame unnamed, so the frame's search tab does not count twice", () => {
    document.title = "Shopping Cart";
    expect(viewContent(document, { shell: true, searchTab: "classic" })).toBe("");
  });
});

describe("viewName", () => {
  it("adds the selected tab in the top window, and nothing in the frame", () => {
    expect(viewName("tab:A", "better|Title")).toBe("tab:A|better|Title");
    expect(viewName(null, "better|Title")).toBe("|better|Title");
    expect(viewName(undefined, "better|Title")).toBe("better|Title");
  });
});

describe("dialogs", () => {
  it("finds the open dialog's own Cancel control", () => {
    document.body.innerHTML = `<div id="pt_modals"><div id="ptMod_0"><a id="#ICCancel" href="javascript:void(0)">x</a></div></div>`;
    expect(hasDialog(document)).toBe(true);
    expect(findDialogCancel(document)?.id).toBe("#ICCancel");
  });

  it("finds nothing when no dialog is open", () => {
    document.body.innerHTML = `<div id="pt_modals"></div>`;
    expect(hasDialog(document)).toBe(false);
    expect(findDialogCancel(document)).toBeNull();
  });
});
