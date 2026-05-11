import { beforeAll, describe, expect, it } from "vitest";
import type { EligibilityHistoryEntry, PrereqNode } from "../../prereqs";
import { renderPrereqTree } from "./tree-render";

const SVG_NS = "http://www.w3.org/2000/svg";

// jsdom logs a noisy "Not implemented" message every time we touch
// HTMLCanvasElement#getContext. The tree renderer's canvas-based text
// measurer is wrapped in try/catch and falls back to an estimate in
// jsdom, but the warning leaks to stderr anyway. Override the prototype
// to return null silently so the test output stays clean.
beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});

function emptyHistory(): ReadonlyMap<string, EligibilityHistoryEntry> {
  return new Map();
}

function takenWith(grade: string | null = null): EligibilityHistoryEntry {
  return { status: "Taken", grade };
}

function rectsByFill(svg: SVGSVGElement): string[] {
  const rects = svg.querySelectorAll("rect");
  return Array.from(rects).map((r) => r.getAttribute("fill") ?? "");
}

function leafRectAt(svg: SVGSVGElement, label: string): SVGRectElement | null {
  const texts = Array.from(svg.querySelectorAll("text"));
  const t = texts.find((node) => (node.textContent ?? "").includes(label));
  if (!t) return null;
  const tx = parseFloat(t.getAttribute("x") ?? "");
  const ty = parseFloat(t.getAttribute("y") ?? "");
  let best: SVGRectElement | null = null;
  let bestArea = Infinity;
  for (const r of Array.from(svg.querySelectorAll("rect"))) {
    const x = parseFloat(r.getAttribute("x") ?? "");
    const y = parseFloat(r.getAttribute("y") ?? "");
    const w = parseFloat(r.getAttribute("width") ?? "");
    const h = parseFloat(r.getAttribute("height") ?? "");
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h)) continue;
    if (tx < x || tx > x + w || ty < y - 4 || ty > y + h + 4) continue;
    const area = w * h;
    if (area < bestArea) {
      bestArea = area;
      best = r as SVGRectElement;
    }
  }
  return best;
}

function fillOf(rect: SVGRectElement | null): string {
  return rect?.getAttribute("fill") ?? "";
}

describe("renderPrereqTree", () => {
  it("renders a 'No prerequisites' ready-styled pill for a null node", () => {
    const result = renderPrereqTree(document, null, emptyHistory());
    expect(result.svg.namespaceURI).toBe(SVG_NS);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    const text = result.svg.querySelector("text");
    expect(text?.textContent).toMatch(/No prerequisites/i);
    // Null prereq data really means "no prereqs needed" — paint it green.
    const fills = rectsByFill(result.svg);
    expect(fills.some((f) => f.includes("gate-ok-bg"))).toBe(true);
  });

  it("renders a 'No prerequisites' pill for a none node", () => {
    const node: PrereqNode = { kind: "none" };
    const result = renderPrereqTree(document, node, emptyHistory());
    const text = result.svg.querySelector("text");
    expect(text?.textContent).toMatch(/No prerequisites/i);
    const fills = rectsByFill(result.svg);
    expect(fills.some((f) => f.includes("gate-ok-bg"))).toBe(true);
  });

  it("renders a satisfied course with the ok gate fill", () => {
    const node: PrereqNode = {
      kind: "course",
      subject: "COMP_SCI",
      number: "211",
      section: ""
    };
    const history = new Map<string, EligibilityHistoryEntry>([
      ["COMP_SCI 211", takenWith("A")]
    ]);
    const result = renderPrereqTree(document, node, history);
    const rect = leafRectAt(result.svg, "COMP_SCI 211");
    expect(fillOf(rect)).toContain("gate-ok-bg");
  });

  it("renders a missing course with the lock fill", () => {
    const node: PrereqNode = {
      kind: "course",
      subject: "COMP_SCI",
      number: "211",
      section: ""
    };
    const result = renderPrereqTree(document, node, emptyHistory());
    const rect = leafRectAt(result.svg, "COMP_SCI 211");
    expect(fillOf(rect)).toContain("gate-lock-bg");
  });

  it("respects minGrade: sufficient grade passes", () => {
    const node: PrereqNode = {
      kind: "course",
      subject: "MATH",
      number: "220",
      section: "",
      minGrade: "B-"
    };
    const history = new Map<string, EligibilityHistoryEntry>([
      ["MATH 220", takenWith("A-")]
    ]);
    const result = renderPrereqTree(document, node, history);
    const rect = leafRectAt(result.svg, "MATH 220");
    expect(fillOf(rect)).toContain("gate-ok-bg");
  });

  it("respects minGrade: insufficient grade fails", () => {
    const node: PrereqNode = {
      kind: "course",
      subject: "MATH",
      number: "220",
      section: "",
      minGrade: "B-"
    };
    const history = new Map<string, EligibilityHistoryEntry>([
      ["MATH 220", takenWith("C+")]
    ]);
    const result = renderPrereqTree(document, node, history);
    const rect = leafRectAt(result.svg, "MATH 220");
    expect(fillOf(rect)).toContain("gate-lock-bg");
  });

  it("paints in-progress courses with the warn fill", () => {
    const node: PrereqNode = {
      kind: "course",
      subject: "EECS",
      number: "230",
      section: ""
    };
    const history = new Map<string, EligibilityHistoryEntry>([
      ["EECS 230", { status: "In Progress", grade: null }]
    ]);
    const result = renderPrereqTree(document, node, history);
    const rect = leafRectAt(result.svg, "EECS 230");
    expect(fillOf(rect)).toContain("gate-warn-bg");
  });

  it("paints transferred courses with the ok fill", () => {
    const node: PrereqNode = {
      kind: "course",
      subject: "COMP_SCI",
      number: "111",
      section: ""
    };
    const history = new Map<string, EligibilityHistoryEntry>([
      ["COMP_SCI 111", { status: "Transferred", grade: null }]
    ]);
    const result = renderPrereqTree(document, node, history);
    const rect = leafRectAt(result.svg, "COMP_SCI 111");
    expect(fillOf(rect)).toContain("gate-ok-bg");
  });

  it("renders recommended courses as satisfied with a dashed stroke", () => {
    const node: PrereqNode = {
      kind: "course",
      subject: "MATH",
      number: "300",
      section: "",
      recommended: true
    };
    const result = renderPrereqTree(document, node, emptyHistory());
    const rect = leafRectAt(result.svg, "MATH 300");
    expect(fillOf(rect)).toContain("gate-ok-bg");
    expect(rect?.getAttribute("stroke-dasharray")).toBeTruthy();
    const text = result.svg.querySelector("text");
    expect(text?.textContent).toMatch(/rec\./);
  });

  it("renders an AND composition with two satisfied courses and edge convergence", () => {
    const node: PrereqNode = {
      kind: "all",
      of: [
        { kind: "course", subject: "COMP_SCI", number: "111", section: "" },
        { kind: "course", subject: "COMP_SCI", number: "150", section: "" }
      ]
    };
    const history = new Map<string, EligibilityHistoryEntry>([
      ["COMP_SCI 111", takenWith("A")],
      ["COMP_SCI 150", takenWith("B")]
    ]);
    const result = renderPrereqTree(document, node, history);
    const compLabel = Array.from(result.svg.querySelectorAll("text")).find(
      (t) => t.textContent === "AND"
    );
    expect(compLabel).toBeTruthy();
    expect(fillOf(leafRectAt(result.svg, "COMP_SCI 111"))).toContain("gate-ok-bg");
    expect(fillOf(leafRectAt(result.svg, "COMP_SCI 150"))).toContain("gate-ok-bg");
    expect(result.width).toBeLessThanOrEqual(900);
    expect(result.height).toBeGreaterThan(40);
    // Edges to the convergence point should be solid (no dasharray) for AND.
    const edges = Array.from(result.svg.querySelectorAll("path.bc-prereq-tree__edge"));
    expect(edges.length).toBeGreaterThanOrEqual(2);
    for (const edge of edges) {
      expect(edge.getAttribute("stroke-dasharray")).toBeNull();
    }
    // The convergence dot is the visual anchor for the AND label.
    expect(result.svg.querySelector("circle.bc-prereq-tree__junction")).toBeTruthy();
  });

  it("renders an OR composition where only one child is satisfied", () => {
    const node: PrereqNode = {
      kind: "any",
      of: [
        { kind: "course", subject: "COMP_SCI", number: "211", section: "" },
        { kind: "course", subject: "COMP_SCI", number: "212", section: "" },
        { kind: "course", subject: "COMP_SCI", number: "213", section: "" }
      ]
    };
    const history = new Map<string, EligibilityHistoryEntry>([
      ["COMP_SCI 212", takenWith("A")]
    ]);
    const result = renderPrereqTree(document, node, history);
    const compLabel = Array.from(result.svg.querySelectorAll("text")).find(
      (t) => t.textContent === "OR"
    );
    expect(compLabel).toBeTruthy();
    expect(fillOf(leafRectAt(result.svg, "COMP_SCI 212"))).toContain("gate-ok-bg");
    expect(fillOf(leafRectAt(result.svg, "COMP_SCI 211"))).toContain("gate-lock-bg");
    expect(fillOf(leafRectAt(result.svg, "COMP_SCI 213"))).toContain("gate-lock-bg");
    // Edges for OR should be dashed.
    const edges = Array.from(result.svg.querySelectorAll("path.bc-prereq-tree__edge"));
    for (const edge of edges) {
      expect(edge.getAttribute("stroke-dasharray")).toBeTruthy();
    }
  });

  it("renders nested all-of-any-of-course with both AND and OR labels", () => {
    const node: PrereqNode = {
      kind: "all",
      of: [
        { kind: "course", subject: "MATH", number: "220", section: "" },
        {
          kind: "any",
          of: [
            { kind: "course", subject: "COMP_SCI", number: "211", section: "" },
            { kind: "course", subject: "COMP_SCI", number: "212", section: "" }
          ]
        }
      ]
    };
    const history = new Map<string, EligibilityHistoryEntry>([
      ["MATH 220", takenWith("A")],
      ["COMP_SCI 212", takenWith("B")]
    ]);
    const result = renderPrereqTree(document, node, history);
    const labels = Array.from(result.svg.querySelectorAll("text")).map((t) => t.textContent ?? "");
    expect(labels.some((l) => l === "AND")).toBe(true);
    expect(labels.some((l) => l === "OR")).toBe(true);
    expect(labels.some((l) => l.includes("MATH 220"))).toBe(true);
    expect(labels.some((l) => l.includes("COMP_SCI 211"))).toBe(true);
    expect(labels.some((l) => l.includes("COMP_SCI 212"))).toBe(true);
    expect(result.width).toBeLessThanOrEqual(900);
  });

  it("collapses single-child composites into the child directly (no AND/OR label)", () => {
    const node: PrereqNode = {
      kind: "all",
      of: [{ kind: "course", subject: "MATH", number: "220", section: "" }]
    };
    const result = renderPrereqTree(document, node, emptyHistory());
    const labels = Array.from(result.svg.querySelectorAll("text")).map((t) => t.textContent ?? "");
    expect(labels.some((l) => l === "AND")).toBe(false);
    expect(labels.some((l) => l.includes("MATH 220"))).toBe(true);
  });

  it("pill widths grow with label length (no textLength stretching)", () => {
    const short: PrereqNode = { kind: "topic", topic: "math" };
    const long: PrereqNode = { kind: "topic", topic: "advanced multivariable calculus with linear algebra" };
    const shortR = renderPrereqTree(document, short, emptyHistory());
    const longR = renderPrereqTree(document, long, emptyHistory());
    expect(longR.width).toBeGreaterThan(shortR.width);
    // None of the text nodes should carry a textLength attribute that would
    // stretch glyphs.
    for (const text of Array.from(longR.svg.querySelectorAll("text"))) {
      expect(text.getAttribute("textLength")).toBeNull();
      expect(text.getAttribute("lengthAdjust")).toBeNull();
    }
  });

  it("renders consent as a warn leaf labeled with consent", () => {
    const node: PrereqNode = { kind: "consent", source: "instructor" };
    const result = renderPrereqTree(document, node, emptyHistory());
    const text = result.svg.querySelector("text");
    expect(text?.textContent).toMatch(/consent/i);
    const fills = rectsByFill(result.svg);
    expect(fills.some((f) => f.includes("gate-warn-bg"))).toBe(true);
  });

  it("renders topic as a dashed neutral leaf", () => {
    const node: PrereqNode = { kind: "topic", topic: "calculus" };
    const result = renderPrereqTree(document, node, emptyHistory());
    const rect = result.svg.querySelector("rect");
    expect(rect?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(rect?.getAttribute("fill")).toContain("bg-app");
  });

  it("renders standing as a dashed neutral leaf", () => {
    const node: PrereqNode = { kind: "standing", level: "junior", orAbove: true };
    const result = renderPrereqTree(document, node, emptyHistory());
    const rect = result.svg.querySelector("rect");
    expect(rect?.getAttribute("stroke-dasharray")).toBeTruthy();
    const text = result.svg.querySelector("text");
    expect(text?.textContent).toMatch(/junior standing\+/);
  });

  it("handles empty all/any as 'trivially satisfied'", () => {
    const node: PrereqNode = { kind: "all", of: [] };
    const result = renderPrereqTree(document, node, emptyHistory());
    const text = result.svg.querySelector("text");
    expect(text?.textContent).toMatch(/Trivially satisfied/);
  });

  it("returns dimensions within bounds for all-of-two layout", () => {
    const node: PrereqNode = {
      kind: "all",
      of: [
        { kind: "course", subject: "COMP_SCI", number: "111", section: "" },
        { kind: "course", subject: "COMP_SCI", number: "150", section: "" }
      ]
    };
    const result = renderPrereqTree(document, node, emptyHistory());
    expect(result.width).toBeGreaterThan(0);
    expect(result.width).toBeLessThanOrEqual(900);
    expect(result.height).toBeGreaterThanOrEqual(40);
  });

  it("scales deep trees via viewBox to stay under MAX_WIDTH", () => {
    const node: PrereqNode = {
      kind: "any",
      of: Array.from({ length: 8 }, (_, i) => ({
        kind: "course",
        subject: "SUBJ",
        number: String(100 + i),
        section: ""
      })) as PrereqNode[]
    };
    const result = renderPrereqTree(document, node, emptyHistory());
    expect(result.width).toBeLessThanOrEqual(900);
    expect(result.svg.getAttribute("viewBox")).toMatch(/^0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?$/);
  });
});
