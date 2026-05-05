import { describe, expect, it } from "vitest";

import {
  applyResponseState,
  buildActionParams,
  extractHiddenInputs,
  serializeForm
} from "./params";

describe("buildActionParams", () => {
  it("preserves the base params and stamps the canonical IC* envelope", () => {
    const base = new URLSearchParams();
    base.set("ICSID", "abc123");
    base.set("ICStateNum", "5");
    base.set("CUSTOM_FIELD", "kept");

    const result = buildActionParams(base, "MYLINK1$2");

    // Caller-provided fields survive.
    expect(result.get("ICSID")).toBe("abc123");
    expect(result.get("ICStateNum")).toBe("5");
    expect(result.get("CUSTOM_FIELD")).toBe("kept");

    // Stamped envelope.
    expect(result.get("ICAJAX")).toBe("1");
    expect(result.get("ICAction")).toBe("MYLINK1$2");
    expect(result.get("ICType")).toBe("Panel");
    expect(result.get("ICElementNum")).toBe("0");
    expect(result.get("ICModelCancel")).toBe("0");
    expect(result.get("ICXPos")).toBe("0");
    expect(result.get("ICYPos")).toBe("0");
    expect(result.get("ResponsetoDiffFrame")).toBe("-1");
    expect(result.get("TargetFrameName")).toBe("None");
    expect(result.get("FacetPath")).toBe("None");
    expect(result.get("ICChanged")).toBe("0");
    expect(result.get("ICResubmit")).toBe("0");
  });

  it("does not mutate the input params", () => {
    const base = new URLSearchParams();
    base.set("KEEP", "yes");
    const before = base.toString();

    buildActionParams(base, "MYLINK$0");

    expect(base.toString()).toBe(before);
  });

  it("overwrites a pre-existing ICAction with the new actionId", () => {
    const base = new URLSearchParams();
    base.set("ICAction", "OLD");

    const result = buildActionParams(base, "NEW");

    expect(result.get("ICAction")).toBe("NEW");
  });
});

describe("applyResponseState", () => {
  it("updates ICStateNum when the response embeds it", () => {
    const base = new URLSearchParams();
    base.set("ICStateNum", "1");

    const html = `
      <script>
        win0.ICStateNum.value = '7';
      </script>
    `;

    const result = applyResponseState(base, html);

    expect(result.get("ICStateNum")).toBe("7");
  });

  it("leaves ICStateNum untouched when no embedded value is found", () => {
    const base = new URLSearchParams();
    base.set("ICStateNum", "1");

    const result = applyResponseState(base, "<html>no script</html>");

    expect(result.get("ICStateNum")).toBe("1");
  });

  it("merges hidden inputs from the response over the base params", () => {
    const base = new URLSearchParams();
    base.set("EXISTING", "old");

    const html =
      `<input type='hidden' name='EXISTING' value='new'>` +
      `<input type='hidden' name='ADDED' value='42'>`;

    const result = applyResponseState(base, html);

    expect(result.get("EXISTING")).toBe("new");
    expect(result.get("ADDED")).toBe("42");
  });
});

describe("extractHiddenInputs", () => {
  it("returns name/value pairs for every hidden input", () => {
    const html = `
      <input type="hidden" name="ICSID" value="abc">
      <input type="hidden" name="ICStateNum" value="3">
      <input type="text" name="VISIBLE" value="ignored">
      <input type='hidden' name='SINGLE_QUOTE' value='ok'>
    `;

    const params = extractHiddenInputs(html);

    expect(params.get("ICSID")).toBe("abc");
    expect(params.get("ICStateNum")).toBe("3");
    expect(params.get("SINGLE_QUOTE")).toBe("ok");
    expect(params.has("VISIBLE")).toBe(false);
  });

  it("decodes HTML entities in name and value attributes", () => {
    const html = `<input type="hidden" name="A&amp;B" value="Tom &amp; Jerry">`;

    const params = extractHiddenInputs(html);

    expect(params.get("A&B")).toBe("Tom & Jerry");
  });

  it("returns an empty params object when no hidden inputs are present", () => {
    const params = extractHiddenInputs("<div>no inputs</div>");
    expect(Array.from(params.keys())).toHaveLength(0);
  });
});

describe("serializeForm", () => {
  function makeForm(html: string): HTMLFormElement {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const form = doc.forms[0];
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Test fixture must contain a form");
    }
    return form;
  }

  it("includes text/select/textarea fields and skips submit/button/reset/image inputs", () => {
    const form = makeForm(`
      <form>
        <input name="FOO" value="alpha">
        <textarea name="NOTES">multi line</textarea>
        <select name="CHOICE">
          <option value="x">x</option>
          <option value="y" selected>y</option>
        </select>
        <input type="submit" name="SUBMIT_BTN" value="Go">
        <input type="button" name="BUTTON" value="X">
        <input type="reset" name="RESET" value="R">
        <input type="image" name="IMG" value="I">
      </form>
    `);

    const params = serializeForm(form);

    expect(params.get("FOO")).toBe("alpha");
    expect(params.get("NOTES")).toBe("multi line");
    expect(params.get("CHOICE")).toBe("y");
    expect(params.has("SUBMIT_BTN")).toBe(false);
    expect(params.has("BUTTON")).toBe(false);
    expect(params.has("RESET")).toBe(false);
    expect(params.has("IMG")).toBe(false);
  });

  it("skips disabled and unnamed fields", () => {
    const form = makeForm(`
      <form>
        <input name="ACTIVE" value="1">
        <input name="DEAD" value="2" disabled>
        <input value="no-name">
      </form>
    `);

    const params = serializeForm(form);

    expect(params.get("ACTIVE")).toBe("1");
    expect(params.has("DEAD")).toBe(false);
    expect(Array.from(params.keys())).toEqual(["ACTIVE"]);
  });

  it("emits only the checked radio in a group", () => {
    const form = makeForm(`
      <form>
        <input type="radio" name="PICK" value="a">
        <input type="radio" name="PICK" value="b" checked>
        <input type="radio" name="PICK" value="c">
      </form>
    `);

    const params = serializeForm(form);

    expect(params.get("PICK")).toBe("b");
  });

  it("emits checkbox values per PeopleSoft conventions", () => {
    const form = makeForm(`
      <form>
        <input type="checkbox" name="ON_BOX" value="Y" checked>
        <input type="checkbox" name="ON_BOX_EMPTY_VAL" value="" checked>
        <input type="checkbox" name="OFF_PLAIN">
        <input type="checkbox" name="OFF_$chk$0">
      </form>
    `);

    const params = serializeForm(form);

    // Checked → use the value attribute.
    expect(params.get("ON_BOX")).toBe("Y");
    // Checked with empty value → fall back to "Y".
    expect(params.get("ON_BOX_EMPTY_VAL")).toBe("Y");
    // Unchecked, plain name → omitted entirely.
    expect(params.has("OFF_PLAIN")).toBe(false);
    // Unchecked $chk$ field → emitted as empty string.
    expect(params.get("OFF_$chk$0")).toBe("");
  });
});
