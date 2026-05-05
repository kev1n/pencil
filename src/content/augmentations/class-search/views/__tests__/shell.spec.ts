import { describe, expect, it } from "vitest";

import {
  buildLoadingShell,
  ensureRoot,
  escapeHtml,
  hasAnyFilter,
  renderFatalError,
  ROOT_ID,
  setStatus
} from "../shell";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

describe("escapeHtml", () => {
  it("escapes &, <, >, \", and '", () => {
    expect(escapeHtml(`<a href="x">'O&"`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;O&amp;&quot;"
    );
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("hasAnyFilter", () => {
  it("returns false for empty query", () => {
    expect(hasAnyFilter({ termId: "X", query: "" })).toBe(false);
  });

  it("returns false for whitespace-only query", () => {
    expect(hasAnyFilter({ termId: "X", query: "   \t\n" })).toBe(false);
  });

  it("returns true for any non-whitespace query", () => {
    expect(hasAnyFilter({ termId: "X", query: "a" })).toBe(true);
    expect(hasAnyFilter({ termId: "X", query: "  hello  " })).toBe(true);
  });
});

describe("ensureRoot", () => {
  it("creates a fresh root with the canonical id and class", () => {
    const doc = fresh();
    const root = ensureRoot(doc);
    expect(root.id).toBe(ROOT_ID);
    expect(root.className).toBe("bc-cs-root");
    expect(doc.getElementById(ROOT_ID)).toBe(root);
  });

  it("reuses an existing root rather than duplicating", () => {
    const doc = fresh();
    const a = ensureRoot(doc);
    const b = ensureRoot(doc);
    expect(a).toBe(b);
    expect(doc.querySelectorAll(`#${ROOT_ID}`).length).toBe(1);
  });

  it("inserts before the PAGECONTAINER anchor when present", () => {
    const doc = fresh();
    const anchor = doc.createElement("div");
    anchor.id = "win0divPAGECONTAINER";
    doc.body.appendChild(anchor);
    const root = ensureRoot(doc);
    expect(root.nextSibling).toBe(anchor);
  });
});

describe("buildLoadingShell", () => {
  it("renders the bc-cs-root wrapper with a spinner", () => {
    const doc = fresh();
    const shell = buildLoadingShell(doc);
    expect(shell.classList.contains("bc-cs-root")).toBe(true);
    expect(shell.querySelector(".bc-cs-spinner")).not.toBeNull();
    expect(shell.textContent).toContain("paper.nu catalog");
  });
});

describe("renderFatalError", () => {
  it("paints the error message inside the root, escaped", () => {
    const doc = fresh();
    const root = doc.createElement("div");
    renderFatalError(root, doc, "boom <evil>");
    expect(root.textContent).toContain("Couldn't load paper.nu catalog data.");
    expect(root.innerHTML).toContain("boom &lt;evil&gt;");
    expect(root.innerHTML).not.toContain("<evil>");
  });

  it("clears any previous content when re-rendering", () => {
    const doc = fresh();
    const root = doc.createElement("div");
    root.innerHTML = "<span>before</span>";
    renderFatalError(root, doc, "boom");
    expect(root.querySelector("span")?.textContent).not.toBe("before");
  });
});

describe("setStatus", () => {
  it("paints loading status with a spinner", () => {
    const doc = fresh();
    const el = doc.createElement("div");
    setStatus(doc, el, "loading", "Loading...");
    expect(el.dataset.state).toBe("loading");
    expect(el.querySelector(".bc-cs-spinner")).not.toBeNull();
    expect(el.textContent).toContain("Loading...");
  });

  it("paints ok status without a spinner", () => {
    const doc = fresh();
    const el = doc.createElement("div");
    setStatus(doc, el, "ok", "Done");
    expect(el.dataset.state).toBe("ok");
    expect(el.querySelector(".bc-cs-spinner")).toBeNull();
    expect(el.textContent).toBe("Done");
  });

  it("replaces previous status content rather than appending", () => {
    const doc = fresh();
    const el = doc.createElement("div");
    setStatus(doc, el, "loading", "First");
    setStatus(doc, el, "error", "Second");
    expect(el.dataset.state).toBe("error");
    expect(el.textContent).toBe("Second");
    expect(el.querySelector(".bc-cs-spinner")).toBeNull();
  });
});
