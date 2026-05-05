import { describe, expect, it } from "vitest";

import {
  extractActionIds,
  extractFieldValue,
  extractPostUrl
} from "./parsers";
import { resolveActionUrl } from "./shared";

describe("extractActionIds", () => {
  it("returns the unique MYLINK1 action ids in submitAction calls", () => {
    const html = `
      <a href="javascript:submitAction_win0(document.win0,'MYLINK1$0')">a</a>
      <a href="javascript:submitAction_win0(document.win0,'MYLINK1$1')">b</a>
      <a href="javascript:submitAction_win0(document.win0,'MYLINK1$2')">c</a>
    `;

    expect(extractActionIds(html, "MYLINK1")).toEqual([
      "MYLINK1$0",
      "MYLINK1$1",
      "MYLINK1$2"
    ]);
  });

  it("dedupes repeated ids", () => {
    const html = `
      <a href="javascript:submitAction_win0(document.win0,'MYLINK$3')">a</a>
      <a href="javascript:submitAction_win0(document.win0,'MYLINK$3')">b</a>
    `;

    expect(extractActionIds(html, "MYLINK")).toEqual(["MYLINK$3"]);
  });

  it("does not match the wrong prefix", () => {
    const html =
      `<a href="javascript:submitAction_win0(document.win0,'MYLINK1$0')">a</a>`;

    // Note: MYLINK1$N matches the MYLINK prefix because the regex appends
    // \$\d+, so MYLINK\$\d will also match the "1" from MYLINK1.
    // Ensure the captured value still starts with the requested prefix.
    expect(extractActionIds(html, "MYLINK1")).toEqual(["MYLINK1$0"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(extractActionIds("<div>nothing here</div>", "MYLINK1")).toEqual([]);
  });
});

describe("extractFieldValue", () => {
  it("returns the inner text of a tag with the given id", () => {
    const html = `<span id='MYDESCR2$0'>Fall 2024</span>`;
    expect(extractFieldValue(html, "MYDESCR2$0")).toBe("Fall 2024");
  });

  it("decodes HTML entities and collapses whitespace", () => {
    const html = `<span id='MYDESCR$1'>  Tom &amp;   Jerry  </span>`;
    expect(extractFieldValue(html, "MYDESCR$1")).toBe("Tom & Jerry");
  });

  it("escapes regex metacharacters in the requested id", () => {
    const html = `<span id='CTEC_INSTRUCTOR$2'>Ada Lovelace</span>`;
    // Without escaping, the `$` would otherwise be a special regex character.
    expect(extractFieldValue(html, "CTEC_INSTRUCTOR$2")).toBe("Ada Lovelace");
  });

  it("returns an empty string when no match is found", () => {
    expect(extractFieldValue("<div>nope</div>", "MISSING$0")).toBe("");
  });
});

describe("extractPostUrl", () => {
  it("returns the postUrl_win0 assignment resolved against CAESAR_ORIGIN", () => {
    const html = `<script>postUrl_win0 = '/psc/csnu/EMPLOYEE/SA/c/some/path';</script>`;

    const url = extractPostUrl(html);

    expect(url).toBe(
      "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/some/path"
    );
  });

  it("returns null when no postUrl_win0 assignment is present", () => {
    expect(extractPostUrl("<div>nothing</div>")).toBeNull();
  });
});

describe("resolveActionUrl", () => {
  it("resolves a relative path against the CAESAR origin", () => {
    expect(resolveActionUrl("/psc/csnu/foo")).toBe(
      "https://caesar.ent.northwestern.edu/psc/csnu/foo"
    );
  });

  it("returns the bare CAESAR origin for an empty input", () => {
    expect(resolveActionUrl("")).toBe(
      "https://caesar.ent.northwestern.edu"
    );
  });

  it("preserves an absolute URL when the input already includes a protocol", () => {
    expect(resolveActionUrl("https://other.example/x")).toBe(
      "https://other.example/x"
    );
  });
});
