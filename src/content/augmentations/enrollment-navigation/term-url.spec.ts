import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { persistContext } from "./state";
import {
  buildTermSelectorUrl,
  extractUrlsFromInlineScripts,
  getComponentId,
  getPageId,
  isEnrollmentWorkflowPage,
} from "./term-url";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function setPageInfo(
  doc: Document,
  attrs: Record<string, string> | null,
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

const ORIGINAL_LOCATION = window.location;

function setLocation(href: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: new URL(href),
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: ORIGINAL_LOCATION,
  });
});

describe("getPageId / getComponentId", () => {
  it("returns the Page and Component attributes when present", () => {
    const doc = fresh();
    setPageInfo(doc, {
      Page: "SSR_SSENRL_TERM",
      Component: "SSR_SSENRL_CART",
    });
    expect(getPageId(doc)).toBe("SSR_SSENRL_TERM");
    expect(getComponentId(doc)).toBe("SSR_SSENRL_CART");
  });

  it("returns null when #pt_pageinfo_win0 is absent", () => {
    expect(getPageId(fresh())).toBeNull();
    expect(getComponentId(fresh())).toBeNull();
  });
});

describe("isEnrollmentWorkflowPage", () => {
  it("returns true for the SSR_SSENRL_CART component", () => {
    const doc = fresh();
    setPageInfo(doc, { Component: "SSR_SSENRL_CART", Page: "SSR_SSENRL_CART" });
    expect(isEnrollmentWorkflowPage(doc, "SSR_SSENRL_CART")).toBe(true);
  });

  it("returns true for SSR_SSENRL_DROP/SWAP/EDIT/UPDT/APPT", () => {
    for (const component of [
      "SSR_SSENRL_DROP",
      "SSR_SSENRL_SWAP",
      "SSR_SSENRL_EDIT",
      "SSR_SSENRL_UPDT",
      "SSR_SSENRL_APPT",
    ]) {
      const doc = fresh();
      setPageInfo(doc, { Component: component, Page: component });
      expect(isEnrollmentWorkflowPage(doc, component)).toBe(true);
    }
  });

  it("returns false on the term selector page itself", () => {
    const doc = fresh();
    setPageInfo(doc, { Component: "SSR_SSENRL_CART", Page: "SSR_SSENRL_TERM" });
    expect(isEnrollmentWorkflowPage(doc, "SSR_SSENRL_TERM")).toBe(false);
  });

  it("returns false for an unrelated SSR_SSENRL_* component", () => {
    const doc = fresh();
    setPageInfo(doc, { Component: "SSR_SSENRL_FAKE", Page: "SSR_SSENRL_FAKE" });
    expect(isEnrollmentWorkflowPage(doc, "SSR_SSENRL_FAKE")).toBe(false);
  });

  it("returns false when pageId/component don't start with SSR_SSENRL_", () => {
    const doc = fresh();
    setPageInfo(doc, { Component: "CLASS_SEARCH", Page: "SSR_CLSRCH_ENTRY" });
    expect(isEnrollmentWorkflowPage(doc, "SSR_CLSRCH_ENTRY")).toBe(false);
  });
});

describe("extractUrlsFromInlineScripts", () => {
  it("extracts every distinct strCurrUrl/sHistURL/refererURL value", () => {
    const doc = fresh();
    const script = doc.createElement("script");
    script.textContent = `
      var strCurrUrl = '/a?ACAD_CAREER=UGRD';
      sHistURL = "/b?STRM=4750";
      refererURL='/c?INSTITUTION=NWUNV';
    `;
    doc.body.appendChild(script);
    const urls = extractUrlsFromInlineScripts(doc);
    expect(urls).toContain("/a?ACAD_CAREER=UGRD");
    expect(urls).toContain("/b?STRM=4750");
    expect(urls).toContain("/c?INSTITUTION=NWUNV");
  });

  it("ignores scripts with src attributes", () => {
    const doc = fresh();
    const external = doc.createElement("script");
    external.setAttribute("src", "/foo.js");
    external.textContent = "var strCurrUrl = '/should/be/ignored?ACAD_CAREER=X';";
    doc.body.appendChild(external);
    expect(extractUrlsFromInlineScripts(doc)).toHaveLength(0);
  });

  it("returns an empty array when no matching assignments exist", () => {
    const doc = fresh();
    const script = doc.createElement("script");
    script.textContent = "var unrelated = 'x';";
    doc.body.appendChild(script);
    expect(extractUrlsFromInlineScripts(doc)).toEqual([]);
  });
});

describe("buildTermSelectorUrl", () => {
  it("returns the current URL when already on the term page", () => {
    const doc = fresh();
    setPageInfo(doc, { Page: "SSR_SSENRL_TERM" });
    setLocation("https://example.test/term-page");
    expect(buildTermSelectorUrl(doc)).toBe("https://example.test/term-page");
  });

  it("patches the SSR_SSENRL_*.GBL URL with PAGE=SSR_SSENRL_TERM when on a workflow page", () => {
    const doc = fresh();
    setPageInfo(doc, {
      Component: "SSR_SSENRL_CART",
      Page: "SSR_SSENRL_CART",
    });
    setLocation(
      "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART"
    );
    const url = buildTermSelectorUrl(doc);
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.searchParams.get("PAGE")).toBe("SSR_SSENRL_TERM");
    expect(parsed.searchParams.get("Action")).toBe("A");
    expect(parsed.searchParams.get("NavColl")).toBe("true");
    expect(parsed.searchParams.get("ICAGTarget")).toBe("start");
    expect(parsed.searchParams.get("ICAJAXTrf")).toBe("true");
  });

  it("falls back to a stored EnrollmentContext when neither current page nor URL gives one", () => {
    const doc = fresh();
    setPageInfo(doc, { Page: "SOMETHING_ELSE" });
    persistContext({
      ACAD_CAREER: "UGRD",
      INSTITUTION: "NWUNV",
      STRM: "4750",
      EMPLID: "1234567",
    });
    setLocation(
      "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SOME_OTHER.GBL"
    );
    const url = buildTermSelectorUrl(doc);
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.pathname).toContain("SA_LEARNER_SERVICES_2.SSR_SSENRL_CART.GBL");
    expect(parsed.searchParams.get("ACAD_CAREER")).toBe("UGRD");
    expect(parsed.searchParams.get("INSTITUTION")).toBe("NWUNV");
    expect(parsed.searchParams.get("STRM")).toBe("4750");
    expect(parsed.searchParams.get("EMPLID")).toBe("1234567");
    expect(parsed.searchParams.get("PAGE")).toBe("SSR_SSENRL_TERM");
  });

  it("returns null when nothing yields a context and we're not on an enrollment page", () => {
    const doc = fresh();
    setPageInfo(doc, { Page: "UNRELATED_PAGE" });
    setLocation("https://example.test/unrelated");
    expect(buildTermSelectorUrl(doc)).toBeNull();
  });
});
