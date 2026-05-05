import { describe, expect, it } from "vitest";

import {
  isSummerTermLabel,
  normalizeText,
  pickDefaultRadio,
  radioRowIndex,
} from "./term-picker";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function radio(
  doc: Document,
  attrs: { id: string; value: string; checked?: boolean },
): HTMLInputElement {
  const r = doc.createElement("input");
  r.type = "radio";
  r.id = attrs.id;
  r.value = attrs.value;
  if (attrs.checked) r.checked = true;
  doc.body.appendChild(r);
  return r;
}

function termCarLabel(doc: Document, rowIndex: string, text: string): void {
  const div = doc.createElement("div");
  div.id = `TERM_CAR$${rowIndex}`;
  div.textContent = text;
  doc.body.appendChild(div);
}

describe("normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  Fall   2025\n\t")).toBe("Fall 2025");
  });

  it("returns empty string when input is whitespace only", () => {
    expect(normalizeText("   \n\t")).toBe("");
  });
});

describe("radioRowIndex", () => {
  it("extracts the row index from a $N$$0 suffix", () => {
    const doc = fresh();
    const r = radio(doc, {
      id: "SSR_DUMMY_RECV1$sels$3$$0",
      value: "4750",
    });
    expect(radioRowIndex(r)).toBe("3");
  });

  it("falls back to the radio value when the id has no suffix", () => {
    const doc = fresh();
    const r = radio(doc, { id: "weird-id", value: "4760" });
    expect(radioRowIndex(r)).toBe("4760");
  });
});

describe("isSummerTermLabel", () => {
  it("matches Summer regardless of casing/surroundings", () => {
    expect(isSummerTermLabel("Summer 2025 | UGRD")).toBe(true);
    expect(isSummerTermLabel("2025 SUMMER | TGS")).toBe(true);
  });

  it("doesn't match non-summer terms", () => {
    expect(isSummerTermLabel("Fall 2025 | UGRD")).toBe(false);
    expect(isSummerTermLabel("Spring 2026 | TGS")).toBe(false);
  });
});

describe("pickDefaultRadio", () => {
  it("returns null on an empty array", () => {
    expect(pickDefaultRadio(fresh(), [])).toBeNull();
  });

  it("returns the only radio when there is exactly one", () => {
    const doc = fresh();
    const r = radio(doc, { id: "SSR_DUMMY_RECV1$sels$0$$0", value: "4750" });
    termCarLabel(doc, "0", "Fall 2025 | UGRD");
    expect(pickDefaultRadio(doc, [r])).toBe(r);
  });

  it("skips the trailing summer term and picks the second-to-last", () => {
    const doc = fresh();
    const fall = radio(doc, {
      id: "SSR_DUMMY_RECV1$sels$0$$0",
      value: "4750",
    });
    const summer = radio(doc, {
      id: "SSR_DUMMY_RECV1$sels$1$$0",
      value: "4760",
    });
    termCarLabel(doc, "0", "Fall 2025 | UGRD");
    termCarLabel(doc, "1", "Summer 2026 | UGRD");
    expect(pickDefaultRadio(doc, [fall, summer])).toBe(fall);
  });

  it("returns the last radio when none is summer", () => {
    const doc = fresh();
    const fall = radio(doc, {
      id: "SSR_DUMMY_RECV1$sels$0$$0",
      value: "4750",
    });
    const winter = radio(doc, {
      id: "SSR_DUMMY_RECV1$sels$1$$0",
      value: "4760",
    });
    termCarLabel(doc, "0", "Fall 2025 | UGRD");
    termCarLabel(doc, "1", "Winter 2026 | UGRD");
    expect(pickDefaultRadio(doc, [fall, winter])).toBe(winter);
  });

  it("respects an already-checked radio when summer-trim doesn't apply", () => {
    const doc = fresh();
    const fall = radio(doc, {
      id: "SSR_DUMMY_RECV1$sels$0$$0",
      value: "4750",
      checked: true,
    });
    const winter = radio(doc, {
      id: "SSR_DUMMY_RECV1$sels$1$$0",
      value: "4760",
    });
    termCarLabel(doc, "0", "Fall 2025 | UGRD");
    termCarLabel(doc, "1", "Winter 2026 | UGRD");
    // checked-radio fallback wins when no summer trim happened.
    expect(pickDefaultRadio(doc, [fall, winter])).toBe(fall);
  });
});
