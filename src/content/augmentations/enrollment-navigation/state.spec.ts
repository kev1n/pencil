import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type EnrollmentContext,
  clearSubmittedUrl,
  clearTargetTermSelection,
  extractContextFromHtml,
  getTargetTermSelection,
  parseContext,
  persistContext,
  readContextFromCandidates,
  readStoredContext,
  readSubmittedUrl,
  setTargetTermSelection,
  writeSubmittedUrl,
} from "./state";

const CONTEXT_KEY = "better-caesar:enrollment-context:v1";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("persistContext + readStoredContext", () => {
  it("round-trips a full context (with EMPLID)", () => {
    const ctx: EnrollmentContext = {
      ACAD_CAREER: "UGRD",
      INSTITUTION: "NWUNV",
      STRM: "4750",
      EMPLID: "1234567",
    };
    persistContext(ctx);
    expect(readStoredContext()).toEqual(ctx);
  });

  it("round-trips a context without EMPLID (omits the field on the way out)", () => {
    const ctx: EnrollmentContext = {
      ACAD_CAREER: "TGS",
      INSTITUTION: "NWUNV",
      STRM: "4760",
    };
    persistContext(ctx);
    const restored = readStoredContext();
    expect(restored?.ACAD_CAREER).toBe("TGS");
    expect(restored?.INSTITUTION).toBe("NWUNV");
    expect(restored?.STRM).toBe("4760");
    expect(restored?.EMPLID).toBeUndefined();
  });

  it("returns null on empty storage", () => {
    expect(readStoredContext()).toBeNull();
  });

  it("returns null when stored JSON is missing required fields", () => {
    window.localStorage.setItem(
      CONTEXT_KEY,
      JSON.stringify({ ACAD_CAREER: "UGRD" })
    );
    expect(readStoredContext()).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    window.localStorage.setItem(CONTEXT_KEY, "not json");
    expect(readStoredContext()).toBeNull();
  });
});

describe("parseContext", () => {
  it("parses a CAESAR-shaped URL into an EnrollmentContext", () => {
    const url =
      "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A&ACAD_CAREER=UGRD&INSTITUTION=NWUNV&STRM=4750&EMPLID=1234567";
    expect(parseContext(url)).toEqual({
      ACAD_CAREER: "UGRD",
      INSTITUTION: "NWUNV",
      STRM: "4750",
      EMPLID: "1234567",
    });
  });

  it("returns a context without EMPLID when the URL omits it", () => {
    const url =
      "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES_2.SSR_SSENRL_CART.GBL?ACAD_CAREER=UGRD&INSTITUTION=NWUNV&STRM=4750";
    const ctx = parseContext(url);
    expect(ctx?.EMPLID).toBeUndefined();
    expect(ctx?.STRM).toBe("4750");
  });

  it("returns null when ACAD_CAREER is missing", () => {
    expect(
      parseContext("/foo?INSTITUTION=NWUNV&STRM=4750")
    ).toBeNull();
  });

  it("returns null when STRM is missing", () => {
    expect(
      parseContext("/foo?ACAD_CAREER=UGRD&INSTITUTION=NWUNV")
    ).toBeNull();
  });

  it("returns null when INSTITUTION is missing", () => {
    expect(
      parseContext("/foo?ACAD_CAREER=UGRD&STRM=4750")
    ).toBeNull();
  });
});

describe("extractContextFromHtml", () => {
  it("pulls a context from a strCurrUrl assignment", () => {
    const html = `
      <html><body>
        <script>
          var strCurrUrl = '/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?ACAD_CAREER=UGRD&INSTITUTION=NWUNV&STRM=4750&EMPLID=999';
        </script>
      </body></html>
    `;
    expect(extractContextFromHtml(html)).toEqual({
      ACAD_CAREER: "UGRD",
      INSTITUTION: "NWUNV",
      STRM: "4750",
      EMPLID: "999",
    });
  });

  it("falls back to refererURL when strCurrUrl has no params", () => {
    const html = `
      var strCurrUrl = '/no/params';
      var refererURL = "/x?ACAD_CAREER=TGS&INSTITUTION=NWUNV&STRM=4760";
    `;
    expect(extractContextFromHtml(html)?.ACAD_CAREER).toBe("TGS");
  });

  it("returns null when no recognizable URL is present", () => {
    expect(extractContextFromHtml("<html></html>")).toBeNull();
  });
});

describe("readContextFromCandidates", () => {
  it("returns the first parseable candidate", () => {
    const ctx = readContextFromCandidates([
      null,
      "/foo?ACAD_CAREER=UGRD",
      "/bar?ACAD_CAREER=TGS&INSTITUTION=NWUNV&STRM=4760",
      "/baz?ACAD_CAREER=KGSM&INSTITUTION=NWUNV&STRM=4770",
    ]);
    expect(ctx?.ACAD_CAREER).toBe("TGS");
  });

  it("returns null when nothing parses", () => {
    expect(
      readContextFromCandidates([null, undefined, "/no/params"])
    ).toBeNull();
  });
});

describe("targetTermSelection sessionStorage helpers", () => {
  it("round-trips a value", () => {
    setTargetTermSelection("4760");
    expect(getTargetTermSelection()).toBe("4760");
  });

  it("returns null when nothing is set", () => {
    expect(getTargetTermSelection()).toBeNull();
  });

  it("clears a previously set value", () => {
    setTargetTermSelection("4760");
    clearTargetTermSelection();
    expect(getTargetTermSelection()).toBeNull();
  });
});

describe("submittedUrl sessionStorage sentinel", () => {
  it("round-trips through write/read/clear", () => {
    expect(readSubmittedUrl()).toBeNull();
    writeSubmittedUrl("https://example.test/page");
    expect(readSubmittedUrl()).toBe("https://example.test/page");
    clearSubmittedUrl();
    expect(readSubmittedUrl()).toBeNull();
  });
});
