import { describe, expect, it } from "vitest";

import {
  buildClassNumberSearchParams,
  buildSearchPostParams,
  isCartLandingPage,
  looksLikeError,
  matchCaesarGroup,
  matchCaesarSection,
  normalizeSectionNumber,
  parseAjaxFragment,
  parseCaesarGroups,
  parseRelatedComponentOptions,
  parseSectionRow,
  parseStatus,
  splitCourseIdAndTitle,
  statusFromAlt,
  type CaesarCourseGroup
} from "..";
import {
  CART_LANDING_HTML,
  DETAIL_PAGE_HTML,
  PREFS_PAGE_HTML,
  RELATED_PAGE_HTML
} from "../__fixtures__/cart-pages";
import {
  GENMSG_ERROR_HTML,
  NORMAL_FRAGMENT_HTML,
  TERM_STATUS_PAGE_HTML
} from "../__fixtures__/error-fragments";
import {
  RELATED_COMPONENT_HTML,
  RELATED_COMPONENT_NONE_HTML
} from "../__fixtures__/related-component";
import {
  SEARCH_RESULTS_HTML,
  SEARCH_RESULTS_HTML_NO_SELECT
} from "../__fixtures__/search-results";

describe("parseAjaxFragment", () => {
  it("extracts the iframe-wrapped CDATA payload", () => {
    const doc = parseAjaxFragment(SEARCH_RESULTS_HTML);
    expect(doc.querySelector("#MTG_CLASS_NBR\\$0")).not.toBeNull();
    // The CDATA wrapper itself should not leak into the parsed body.
    expect(doc.body.textContent).not.toContain("CDATA");
  });

  it("falls back to the raw payload when no PAGECONTAINER FIELD is present", () => {
    const doc = parseAjaxFragment(`<div id="loose">hi</div>`);
    expect(doc.querySelector("#loose")?.textContent).toBe("hi");
  });
});

describe("looksLikeError", () => {
  it("flags GENMSG payloads", () => {
    expect(looksLikeError(GENMSG_ERROR_HTML)).toBe(true);
  });

  it("flags the NW_TERM_STA1_FL term-status guard rail", () => {
    expect(looksLikeError(TERM_STATUS_PAGE_HTML)).toBe(true);
  });

  it("returns false on a normal payload", () => {
    expect(looksLikeError(NORMAL_FRAGMENT_HTML)).toBe(false);
    expect(looksLikeError(SEARCH_RESULTS_HTML)).toBe(false);
  });
});

describe("parseCaesarGroups", () => {
  it("produces the typed group structure from a search-results fragment", () => {
    const groups = parseCaesarGroups(SEARCH_RESULTS_HTML);
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.catalog).toBe("111-0");
    expect(group.title).toBe("Fundamentals of Computer Programming");
    expect(group.sections).toHaveLength(1);
    expect(group.sections[0]?.classNumber).toBe("12345");
  });

  it("flags selectAvailable=false when CAESAR omits the Select button", () => {
    const groups = parseCaesarGroups(SEARCH_RESULTS_HTML_NO_SELECT);
    expect(groups).toHaveLength(1);
    const section = groups[0]!.sections[0]!;
    expect(section.classNumber).toBe("22222");
    expect(section.selectAvailable).toBe(false);
  });
});

describe("parseSectionRow", () => {
  it("extracts class number, label, component, schedule, status", () => {
    const doc = parseAjaxFragment(SEARCH_RESULTS_HTML);
    const section = parseSectionRow(doc, 0);
    expect(section).not.toBeNull();
    expect(section?.classNumber).toBe("12345");
    expect(section?.sectionLabel).toBe("20-LEC");
    expect(section?.sectionNumber).toBe("20");
    expect(section?.component).toBe("LEC");
    expect(section?.daysTime).toBe("MoWeFr 1:00PM - 1:50PM");
    expect(section?.room).toBe("Tech LR2");
    // textById collapses runs of whitespace (incl. <br>-derived newlines)
    // through decodeEntities → joined with a single space.
    expect(section?.instructor).toBe("Connor Bain Sara Sood");
    expect(section?.status).toBe("Open");
    expect(section?.selectActionId).toBe("SSR_PB_SELECT$0");
    expect(section?.selectAvailable).toBe(true);
  });

  it("returns null when the row index doesn't exist", () => {
    const doc = parseAjaxFragment(SEARCH_RESULTS_HTML);
    expect(parseSectionRow(doc, 99)).toBeNull();
  });
});

describe("parseStatus / statusFromAlt", () => {
  it("classifies Open, Closed, Wait List from img alt text", () => {
    expect(statusFromAlt("Status: Open")).toBe("Open");
    expect(statusFromAlt("status: closed")).toBe("Closed");
    expect(statusFromAlt("Wait List")).toBe("Wait List");
  });

  it("falls back to Unknown for missing or unrecognized alt", () => {
    expect(statusFromAlt(null)).toBe("Unknown");
    expect(statusFromAlt(undefined)).toBe("Unknown");
    expect(statusFromAlt("Cancelled")).toBe("Unknown");
  });

  it("parseStatus reads the row's status image", () => {
    const open = parseAjaxFragment(SEARCH_RESULTS_HTML);
    expect(parseStatus(open, 0)).toBe("Open");
    const closed = parseAjaxFragment(SEARCH_RESULTS_HTML_NO_SELECT);
    expect(parseStatus(closed, 0)).toBe("Closed");
  });
});

describe("parseRelatedComponentOptions", () => {
  it("extracts every radio row with its column data", () => {
    const options = parseRelatedComponentOptions(RELATED_COMPONENT_HTML);
    expect(options).not.toBeNull();
    expect(options).toHaveLength(2);
    expect(options![0]).toEqual({
      rowIndex: 0,
      classNumber: "34601",
      section: "61-DIS",
      schedule: "Mo 4:00PM - 4:50PM",
      room: "Tech L168",
      instructor: "TA Alpha",
      status: "Open"
    });
    expect(options![1]?.rowIndex).toBe(1);
    expect(options![1]?.status).toBe("Wait List");
  });

  it("returns null when no related-component radios are present", () => {
    expect(parseRelatedComponentOptions(RELATED_COMPONENT_NONE_HTML)).toBeNull();
  });
});

describe("splitCourseIdAndTitle", () => {
  it("splits SUBJECT  CATALOG - TITLE form", () => {
    expect(splitCourseIdAndTitle("COMP_SCI  111-0 - Fundamentals of Computer Programming"))
      .toEqual({ catalog: "111-0", title: "Fundamentals of Computer Programming" });
  });

  it("returns the trimmed value as the title when no dash is present", () => {
    expect(splitCourseIdAndTitle("just a title")).toEqual({ catalog: "", title: "just a title" });
  });

  it("treats only the first dash as the catalog/title boundary", () => {
    const out = splitCourseIdAndTitle("MATH  230-1 - Multi-Variable Differential Calculus");
    expect(out.catalog).toBe("230-1");
    expect(out.title).toBe("Multi-Variable Differential Calculus");
  });
});

describe("matchCaesarGroup / matchCaesarSection", () => {
  const groups: CaesarCourseGroup[] = parseCaesarGroups(SEARCH_RESULTS_HTML);

  it("matches an exact catalog string", () => {
    const g = matchCaesarGroup(groups, "111-0");
    expect(g).not.toBeNull();
    expect(g?.catalog).toBe("111-0");
  });

  it("matches when paper.nu strips '-0' but CAESAR keeps it", () => {
    const g = matchCaesarGroup(groups, "111");
    expect(g?.catalog).toBe("111-0");
  });

  it("returns null when there's no matching catalog", () => {
    expect(matchCaesarGroup(groups, "999")).toBeNull();
  });

  it("matches sections by number + component", () => {
    const g = groups[0]!;
    const s = matchCaesarSection(g, "20", "LEC");
    expect(s?.classNumber).toBe("12345");
  });

  it("collapses leading-zero differences when matching sections", () => {
    const g = groups[0]!;
    expect(matchCaesarSection(g, "020", "LEC")?.classNumber).toBe("12345");
  });

  it("returns null when component differs", () => {
    const g = groups[0]!;
    expect(matchCaesarSection(g, "20", "DIS")).toBeNull();
  });
});

describe("normalizeSectionNumber", () => {
  it("collapses leading zeros", () => {
    expect(normalizeSectionNumber("01")).toBe("1");
    expect(normalizeSectionNumber("001")).toBe("1");
    expect(normalizeSectionNumber("22")).toBe("22");
  });

  it("preserves a single zero", () => {
    expect(normalizeSectionNumber("0")).toBe("0");
    expect(normalizeSectionNumber("00")).toBe("0");
  });

  it("returns the value unchanged for empty input", () => {
    expect(normalizeSectionNumber("")).toBe("");
  });
});

describe("buildSearchPostParams", () => {
  it("sets ICAJAX, action id, subject, catalog, career", () => {
    const base = new URLSearchParams();
    const params = buildSearchPostParams(
      base,
      { termId: "4830", institution: "NWUNV", subject: "COMP_SCI", bareCatalog: "111" },
      "UGRD"
    );
    expect(params.get("ICAJAX")).toBe("1");
    expect(params.get("ICAction")).toBe("CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH");
    expect(params.get("SSR_CLSRCH_WRK_SUBJECT_SRCH")).toBe("COMP_SCI");
    expect(params.get("SSR_CLSRCH_WRK_CATALOG_NBR")).toBe("111");
    expect(params.get("SSR_CLSRCH_WRK_ACAD_CAREER")).toBe("UGRD");
    expect(params.get("CLASS_SRCH_WRK2_STRM")).toBe("4830");
    expect(params.get("CLASS_SRCH_WRK2_INSTITUTION")).toBe("NWUNV");
    // Exact match flag is "C" (contains) by design.
    expect(params.get("SSR_CLSRCH_WRK_SSR_EXACT_MATCH1")).toBe("C");
  });

  it("defaults institution to NWUNV when empty", () => {
    const base = new URLSearchParams();
    const params = buildSearchPostParams(
      base,
      { termId: "4830", institution: "", subject: "MATH", bareCatalog: "230" },
      "UGRD"
    );
    expect(params.get("CLASS_SRCH_WRK2_INSTITUTION")).toBe("NWUNV");
  });
});

describe("buildClassNumberSearchParams", () => {
  it("falls back to the canonical positional suffixes when prefixes are absent", () => {
    const base = new URLSearchParams();
    const params = buildClassNumberSearchParams(base, {
      termId: "4830",
      career: "UGRD",
      institution: "NWUNV",
      classNumber: "34612"
    });
    // Default field names from peoplesoft/shared.ts.
    expect(params.get("SSR_CLSRCH_WRK_CLASS_NBR$8")).toBe("34612");
    expect(params.get("CLASS_SRCH_WRK2_STRM$35$")).toBe("4830");
    expect(params.get("SSR_CLSRCH_WRK_ACAD_CAREER$2")).toBe("UGRD");
    expect(params.get("CLASS_SRCH_WRK2_INSTITUTION$31$")).toBe("NWUNV");
    // Subject + catalog should be wiped so previous-state values don't leak.
    expect(params.get("SSR_CLSRCH_WRK_SUBJECT_SRCH")).toBe("");
    expect(params.get("SSR_CLSRCH_WRK_CATALOG_NBR")).toBe("");
  });

  it("reuses an existing prefixed field name when one is already on the form", () => {
    const base = new URLSearchParams();
    base.set("SSR_CLSRCH_WRK_CLASS_NBR$15", "old");
    const params = buildClassNumberSearchParams(base, {
      termId: "4830",
      career: "TGS",
      institution: "NWUNV",
      classNumber: "99999"
    });
    expect(params.get("SSR_CLSRCH_WRK_CLASS_NBR$15")).toBe("99999");
    expect(params.get("SSR_CLSRCH_WRK_ACAD_CAREER$2")).toBe("TGS");
  });
});

describe("isCartLandingPage", () => {
  it("rejects the SSR_SSENRL_PREFS preferences page", () => {
    const r = isCartLandingPage(PREFS_PAGE_HTML, "12345");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/preferences/i);
  });

  it("rejects the SSR_SSENRL_RC related-class page", () => {
    const r = isCartLandingPage(RELATED_PAGE_HTML, "12345");
    expect(r.ok).toBe(false);
  });

  it("rejects the SSR_CLSRCH_DTL detail-bounce page", () => {
    const r = isCartLandingPage(DETAIL_PAGE_HTML, "12345");
    expect(r.ok).toBe(false);
  });

  it("accepts any other page (treats as success)", () => {
    expect(isCartLandingPage(CART_LANDING_HTML, "12345").ok).toBe(true);
  });
});
