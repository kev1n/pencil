import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findSelectByPrefix,
  isSearchEntryPage,
  pageIdFromDoc,
  readActiveTab,
  readCareerFromNativeForm,
  readInstitutionFromNativeForm,
  readTermFromNativeForm,
  writeActiveTab
} from "./page-detection";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function setPageInfo(
  doc: Document,
  attrs: Record<string, string> | null
): void {
  const existing = doc.getElementById("pt_pageinfo_win0");
  if (existing) existing.remove();
  if (!attrs) return;
  const div = doc.createElement("div");
  div.id = "pt_pageinfo_win0";
  for (const [k, v] of Object.entries(attrs)) {
    div.setAttribute(k, v);
  }
  doc.body.appendChild(div);
}

function appendSelect(
  doc: Document,
  name: string,
  value: string,
  options: string[] = [value]
): HTMLSelectElement {
  const select = doc.createElement("select");
  select.name = name;
  for (const opt of options) {
    const o = doc.createElement("option");
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  }
  select.value = value;
  doc.body.appendChild(select);
  return select;
}

describe("isSearchEntryPage / pageIdFromDoc", () => {
  it("returns true when both Component and Page match", () => {
    const doc = fresh();
    setPageInfo(doc, { Component: "CLASS_SEARCH", Page: "SSR_CLSRCH_ENTRY" });
    expect(isSearchEntryPage(doc)).toBe(true);
    expect(pageIdFromDoc(doc)).toBe("SSR_CLSRCH_ENTRY");
  });

  it("returns false when the Page attribute is wrong", () => {
    const doc = fresh();
    setPageInfo(doc, { Component: "CLASS_SEARCH", Page: "SSR_OTHER_PAGE" });
    expect(isSearchEntryPage(doc)).toBe(false);
    expect(pageIdFromDoc(doc)).toBe("SSR_OTHER_PAGE");
  });

  it("returns false when the Component attribute is wrong", () => {
    const doc = fresh();
    setPageInfo(doc, { Component: "OTHER_COMPONENT", Page: "SSR_CLSRCH_ENTRY" });
    expect(isSearchEntryPage(doc)).toBe(false);
  });

  it("returns false (and pageIdFromDoc returns null) when #pt_pageinfo_win0 is absent", () => {
    const doc = fresh();
    expect(isSearchEntryPage(doc)).toBe(false);
    expect(pageIdFromDoc(doc)).toBeNull();
  });

  it("returns false when the element exists but is missing Page/Component", () => {
    const doc = fresh();
    setPageInfo(doc, {});
    expect(isSearchEntryPage(doc)).toBe(false);
    expect(pageIdFromDoc(doc)).toBeNull();
  });
});

describe("findSelectByPrefix", () => {
  it("finds the first select whose name starts with the prefix", () => {
    const doc = fresh();
    appendSelect(doc, "OTHER_NAME", "x");
    const target = appendSelect(doc, "CLASS_SRCH_WRK2_STRM$0", "4750");
    appendSelect(doc, "CLASS_SRCH_WRK2_STRM$1", "4760");
    expect(findSelectByPrefix(doc, "CLASS_SRCH_WRK2_STRM")).toBe(target);
  });

  it("returns null when no select matches", () => {
    const doc = fresh();
    appendSelect(doc, "WRONG_NAME", "x");
    expect(findSelectByPrefix(doc, "ZZ_NO_MATCH")).toBeNull();
  });

  it("returns null on an empty document", () => {
    const doc = fresh();
    expect(findSelectByPrefix(doc, "ANY")).toBeNull();
  });
});

describe("native default extractors", () => {
  it("readCareerFromNativeForm returns the select value", () => {
    const doc = fresh();
    appendSelect(doc, "SSR_CLSRCH_WRK_ACAD_CAREER$0", "TGS", ["UGRD", "TGS"]);
    expect(readCareerFromNativeForm(doc)).toBe("TGS");
  });

  it("readCareerFromNativeForm falls back to ACAD_CAREER URL param when select absent", () => {
    const doc = fresh();
    const original = window.location.href;
    history.replaceState(null, "", "/some/path?ACAD_CAREER=KGSM");
    try {
      expect(readCareerFromNativeForm(doc)).toBe("KGSM");
    } finally {
      history.replaceState(null, "", original);
    }
  });

  it("readCareerFromNativeForm returns null when neither select nor URL param is present", () => {
    const doc = fresh();
    const original = window.location.href;
    history.replaceState(null, "", "/some/path");
    try {
      expect(readCareerFromNativeForm(doc)).toBeNull();
    } finally {
      history.replaceState(null, "", original);
    }
  });

  it("readInstitutionFromNativeForm returns the select value", () => {
    const doc = fresh();
    appendSelect(doc, "CLASS_SRCH_WRK2_INSTITUTION$0", "NWUNV");
    expect(readInstitutionFromNativeForm(doc)).toBe("NWUNV");
  });

  it("readInstitutionFromNativeForm returns null when select missing", () => {
    const doc = fresh();
    expect(readInstitutionFromNativeForm(doc)).toBeNull();
  });

  it("readTermFromNativeForm returns the select value", () => {
    const doc = fresh();
    appendSelect(doc, "CLASS_SRCH_WRK2_STRM$0", "4750");
    expect(readTermFromNativeForm(doc)).toBe("4750");
  });

  it("readTermFromNativeForm returns null when select missing", () => {
    const doc = fresh();
    expect(readTermFromNativeForm(doc)).toBeNull();
  });
});

describe("activeTab session storage helpers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("defaults to 'better' when storage is empty", () => {
    expect(readActiveTab()).toBe("better");
  });

  it("returns 'classic' when 'classic' is persisted", () => {
    writeActiveTab("classic");
    expect(readActiveTab()).toBe("classic");
  });

  it("returns 'better' when 'better' is persisted", () => {
    writeActiveTab("better");
    expect(readActiveTab()).toBe("better");
  });

  it("treats unknown stored values as 'better'", () => {
    window.sessionStorage.setItem(
      "better-caesar:class-search:active-tab",
      "garbage"
    );
    expect(readActiveTab()).toBe("better");
  });

  it("round-trips a write through readActiveTab", () => {
    writeActiveTab("classic");
    const raw = window.sessionStorage.getItem(
      "better-caesar:class-search:active-tab"
    );
    expect(raw).toBe("classic");
    expect(readActiveTab()).toBe("classic");
  });
});
