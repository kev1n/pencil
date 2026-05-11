// Inline-SVG renderer for parsed prereq trees. Pure function — no DOM
// globals, no chrome.*. Tooltip caller owns the returned <svg>.
//
// Layout flows TOP-DOWN: prereq leaves at the top fan into a convergence
// point with an AND/OR label, which then flows down to the implicit
// target course. Nested composites cascade convergence points.
//
// Pill widths come from real text-metrics (canvas 2D), so labels never
// stretch via SVG textLength — long labels naturally widen their pill.
//
// Colors flow exclusively through design-system gate tokens so the theme
// + dark-mode mirror auto-applies. No raw color literals (color-literal
// eslint rule).

import { evaluateEligibility, type EligibilityHistoryEntry, type PrereqNode } from "../../prereqs";

const SVG_NS = "http://www.w3.org/2000/svg";

// Layout constants.
const PILL_H = 32;
const PILL_PAD_X = 12;
const PILL_MIN_W = 80;
const LABEL_FONT = 11;
const COMP_LABEL_FONT = 10;
const COMP_GLYPH = "  ";
const X_GAP = 14;
const CONVERGE_GAP = 26; // y-distance from children's bottom to the convergence point
const TAIL = 4; // tiny tail under convergence so the dot doesn't kiss the bbox edge
const PADDING = 8;
const MAX_WIDTH = 560;
const MIN_SCALE = 0.55;
const FRAME_HEADER = 22;
const FRAME_PAD_X = 10;

const NULL_LABEL = "No prerequisites";

type Variant = "ok" | "warn" | "lock" | "neutral";

type LaidOut = {
  width: number;
  height: number;
  /** Where the edge from a parent composite connects (bottom-center for leaves;
   * the convergence point for composites). Coordinates are local to the
   * layout's own bbox. */
  outAnchor: { x: number; y: number };
  draw(svg: SVGSVGElement, originX: number, originY: number): void;
};

export type TreeRenderResult = {
  svg: SVGSVGElement;
  width: number;
  height: number;
};

export function renderPrereqTree(
  doc: Document,
  node: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>
): TreeRenderResult {
  const measure = makeMeasurer(doc);
  // null / absent prereq record = "this course has no prereqs". Surface as
  // an unconditional ready pill so the user doesn't see a vague "no data"
  // state.
  const effective: PrereqNode = node ?? { kind: "none" };
  const layout = layoutFor(effective, history, measure);

  const innerW = layout.width;
  const innerH = layout.height;
  const totalW = innerW + PADDING * 2;
  const totalH = innerH + PADDING * 2;

  const scale = totalW > MAX_WIDTH ? Math.max(MIN_SCALE, MAX_WIDTH / totalW) : 1;
  const renderedW = Math.round(totalW * scale);
  const renderedH = Math.round(totalH * scale);

  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
  svg.setAttribute("width", String(renderedW));
  svg.setAttribute("height", String(renderedH));
  svg.setAttribute("class", "bc-prereq-tree");

  layout.draw(svg, PADDING, PADDING);

  return { svg, width: renderedW, height: renderedH };
}

// === Text measurement =====================================================

type Measure = (text: string, fontSize: number, italic?: boolean, weight?: string) => number;

function makeMeasurer(doc: Document): Measure {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    const canvas = doc.createElement("canvas");
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  return (text, fontSize, italic = false, weight = "500") => {
    if (ctx) {
      ctx.font = `${italic ? "italic " : ""}${weight} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      return ctx.measureText(text).width;
    }
    // jsdom fallback — proportional estimate keyed to the font size. Good
    // enough for tests; production always hits the canvas path.
    return text.length * fontSize * 0.58;
  };
}

// === Layout ================================================================

function layoutFor(
  node: PrereqNode,
  history: ReadonlyMap<string, EligibilityHistoryEntry>,
  measure: Measure
): LaidOut {
  switch (node.kind) {
    case "none":
      return leaf(NULL_LABEL, { variant: "ok", glyph: "✓" }, measure);
    case "course":
      return courseLeaf(node, history, measure);
    case "consent":
      return leaf(`${node.source} consent`, { variant: "warn", glyph: "\u{1F511}" }, measure);
    case "standing":
      return leaf(standingLabel(node), { variant: "neutral", dashed: true, italic: true }, measure);
    case "topic":
      return leaf(node.topic, { variant: "neutral", glyph: "?", dashed: true, italic: true }, measure);
    case "raw":
      return leaf(node.text, { variant: "neutral", glyph: "?", dashed: true, italic: true }, measure);
    case "level-wildcard":
      return leaf(levelWildcardLabel(node), { variant: "neutral", glyph: "?", dashed: true, italic: true }, measure);
    case "program":
      return leaf(`${node.relation.replace(/-/g, " ")} ${node.name}`, { variant: "neutral", glyph: "?", dashed: true, italic: true }, measure);
    case "program-membership":
      return leaf(`${node.negated ? "not " : ""}${node.program}`, { variant: "neutral", glyph: "?", dashed: true, italic: true }, measure);
    case "placement":
      return leaf(`${node.exam} placement`, { variant: "neutral", glyph: "?", dashed: true, italic: true }, measure);
    case "gpa":
      return leaf(`GPA ≥ ${node.min}${node.scope ? ` (${node.scope})` : ""}`, { variant: "neutral", glyph: "?", dashed: true, italic: true }, measure);
    case "all":
      return composite("AND", node.of, history, measure, /* dashed */ false);
    case "any":
      return composite("OR", node.of, history, measure, /* dashed */ true);
    case "when":
      return frame(node, history, measure);
  }
}

type LeafOpts = {
  variant: Variant;
  glyph?: string;
  dashed?: boolean;
  italic?: boolean;
};

function leaf(label: string, opts: LeafOpts, measure: Measure): LaidOut {
  const glyph = opts.glyph ? `${opts.glyph}${COMP_GLYPH}` : "";
  const display = `${glyph}${label}`;
  const measuredW = measure(display, LABEL_FONT, opts.italic ?? false);
  const width = Math.max(PILL_MIN_W, Math.round(measuredW + PILL_PAD_X * 2));
  const height = PILL_H;
  return {
    width,
    height,
    outAnchor: { x: width / 2, y: height },
    draw(svg, x, y) {
      drawPill(svg, x, y, width, height, opts.variant, display, opts.dashed === true, opts.italic === true);
    }
  };
}

function courseLeaf(
  node: Extract<PrereqNode, { kind: "course" }>,
  history: ReadonlyMap<string, EligibilityHistoryEntry>,
  measure: Measure
): LaidOut {
  const label = node.minGrade ? `${node.subject} ${node.number} (≥ ${node.minGrade})` : `${node.subject} ${node.number}`;

  if (node.recommended === true) {
    // Recommended = soft suggestion — paints green but dashed + italic,
    // with "(rec.)" suffix so it's visually distinct from a hard prereq.
    return leaf(`${label} (rec.)`, { variant: "ok", glyph: "✓", dashed: true, italic: true }, measure);
  }

  const entry = history.get(courseHistoryKey(node));
  if (entry && entry.status === "In Progress") {
    return leaf(label, { variant: "warn", glyph: "⏳" }, measure);
  }

  const result = evaluateEligibility(node, history);
  const variant = stateToVariant(result.state);
  const glyph = variant === "ok" ? "✓" : variant === "warn" ? "⏳" : "⊘";
  return leaf(label, { variant, glyph }, measure);
}

// AND / OR composite. Children laid out left-to-right at the top; their
// out-anchors converge at a single point below with a small AND/OR text
// label adjacent. The composite's own out-anchor IS that convergence point,
// so nested composites cascade Y-junctions into a single trunk.
function composite(
  label: "AND" | "OR",
  children: PrereqNode[],
  history: ReadonlyMap<string, EligibilityHistoryEntry>,
  measure: Measure,
  dashed: boolean
): LaidOut {
  if (children.length === 0) {
    return leaf("Trivially satisfied", { variant: "ok", glyph: "✓" }, measure);
  }
  if (children.length === 1) {
    // A single-child all/any is degenerate — render the child as-is.
    return layoutFor(children[0], history, measure);
  }

  const laid = children.map((c) => layoutFor(c, history, measure));
  const childOffsets: number[] = [];
  let cursor = 0;
  for (const child of laid) {
    childOffsets.push(cursor);
    cursor += child.width + X_GAP;
  }
  const innerW = cursor - X_GAP;
  const maxChildH = laid.reduce((m, c) => Math.max(m, c.height), 0);
  const convergeY = maxChildH + CONVERGE_GAP;
  const convergeX = innerW / 2;

  // The AND/OR label sits to the right of the convergence point. Measure
  // it so the bbox includes the label width.
  const labelW = measure(label, COMP_LABEL_FONT, false, "700");
  const labelGap = 6;
  const widthForLabel = convergeX + labelGap + Math.ceil(labelW) + 4;
  const width = Math.max(innerW, widthForLabel);
  const height = convergeY + TAIL;

  return {
    width,
    height,
    outAnchor: { x: convergeX, y: convergeY },
    draw(svg, originX, originY) {
      // Center children if the label widened the bbox past the children row.
      const childOffset = (width - innerW) / 2;
      // The convergence point in absolute coords.
      const absConvX = originX + childOffset + convergeX;
      const absConvY = originY + convergeY;

      for (let i = 0; i < laid.length; i += 1) {
        const child = laid[i];
        const cx = originX + childOffset + childOffsets[i];
        const cy = originY;
        child.draw(svg, cx, cy);

        // Edge from this child's out-anchor down to the convergence point.
        drawEdge(
          svg,
          cx + child.outAnchor.x,
          cy + child.outAnchor.y,
          absConvX,
          absConvY,
          dashed
        );
      }

      // Convergence dot.
      const dot = svg.ownerDocument.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", String(absConvX));
      dot.setAttribute("cy", String(absConvY));
      dot.setAttribute("r", "2.5");
      dot.setAttribute("fill", "var(--bc-color-border-strong)");
      dot.setAttribute("class", "bc-prereq-tree__junction");
      svg.appendChild(dot);

      // AND / OR label.
      const text = svg.ownerDocument.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(absConvX + labelGap));
      text.setAttribute("y", String(absConvY + 3));
      text.setAttribute("font-size", String(COMP_LABEL_FONT));
      text.setAttribute("font-weight", "700");
      text.setAttribute("letter-spacing", "0.04em");
      text.setAttribute("fill", "var(--bc-color-text-muted)");
      text.setAttribute("class", `bc-prereq-tree__op bc-prereq-tree__op--${label.toLowerCase()}`);
      text.textContent = label;
      svg.appendChild(text);
    }
  };
}

function frame(
  node: Extract<PrereqNode, { kind: "when" }>,
  history: ReadonlyMap<string, EligibilityHistoryEntry>,
  measure: Measure
): LaidOut {
  const inner = layoutFor(node.then, history, measure);
  const titleText = `if ${whenCondition(node.condition)}`;
  const titleW = measure(titleText, COMP_LABEL_FONT, true);
  const width = Math.max(inner.width + FRAME_PAD_X * 2, Math.ceil(titleW) + FRAME_PAD_X * 2);
  const innerX = (width - inner.width) / 2;
  const innerY = FRAME_HEADER;
  const height = innerY + inner.height + 6;
  return {
    width,
    height,
    outAnchor: { x: innerX + inner.outAnchor.x, y: innerY + inner.outAnchor.y },
    draw(svg, ox, oy) {
      const rect = svg.ownerDocument.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(ox));
      rect.setAttribute("y", String(oy));
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", String(height));
      rect.setAttribute("rx", "8");
      rect.setAttribute("ry", "8");
      rect.setAttribute("fill", "none");
      rect.setAttribute("stroke", "var(--bc-color-border-strong)");
      rect.setAttribute("stroke-width", "1");
      rect.setAttribute("stroke-dasharray", "4 3");
      rect.setAttribute("class", "bc-prereq-tree__frame");
      svg.appendChild(rect);

      const title = svg.ownerDocument.createElementNS(SVG_NS, "text");
      title.setAttribute("x", String(ox + FRAME_PAD_X));
      title.setAttribute("y", String(oy + 14));
      title.setAttribute("font-size", String(COMP_LABEL_FONT));
      title.setAttribute("font-style", "italic");
      title.setAttribute("fill", "var(--bc-color-text-muted)");
      title.setAttribute("class", "bc-prereq-tree__frame-title");
      title.textContent = titleText;
      svg.appendChild(title);

      inner.draw(svg, ox + innerX, oy + innerY);
    }
  };
}

// === Drawing helpers =======================================================

function drawPill(
  svg: SVGSVGElement,
  x: number,
  y: number,
  width: number,
  height: number,
  variant: Variant,
  display: string,
  dashed: boolean,
  italic: boolean
): void {
  const doc = svg.ownerDocument;
  const tokens = variantTokens(variant);
  const rect = doc.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("rx", "8");
  rect.setAttribute("ry", "8");
  rect.setAttribute("fill", tokens.bg);
  rect.setAttribute("stroke", tokens.border);
  rect.setAttribute("stroke-width", "1");
  if (dashed) rect.setAttribute("stroke-dasharray", "4 3");
  rect.setAttribute("class", `bc-prereq-tree__leaf bc-prereq-tree__leaf--${variant}`);
  svg.appendChild(rect);

  const text = doc.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(x + width / 2));
  text.setAttribute("y", String(y + height / 2 + 4));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-size", String(LABEL_FONT));
  text.setAttribute("font-weight", "500");
  text.setAttribute("fill", tokens.text);
  if (italic) text.setAttribute("font-style", "italic");
  text.setAttribute("class", "bc-prereq-tree__label");
  text.textContent = display;
  svg.appendChild(text);
}

function drawEdge(
  svg: SVGSVGElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  dashed: boolean
): void {
  const doc = svg.ownerDocument;
  const line = doc.createElementNS(SVG_NS, "path");
  // Bezier curve so the join looks soft, not angular. Control points pull
  // the curve downward — child outAnchor goes down, then sweeps toward the
  // convergence point.
  const midY = (fromY + toY) / 2;
  const d = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
  line.setAttribute("d", d);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "var(--bc-color-border-strong)");
  line.setAttribute("stroke-width", "1");
  if (dashed) line.setAttribute("stroke-dasharray", "4 3");
  line.setAttribute("class", "bc-prereq-tree__edge");
  svg.appendChild(line);
}

// === Tokens / labels =======================================================

type VariantTokens = { bg: string; border: string; text: string };

function variantTokens(variant: Variant): VariantTokens {
  switch (variant) {
    case "ok":
      return {
        bg: "var(--bc-color-gate-ok-bg)",
        border: "var(--bc-color-gate-ok-border)",
        text: "var(--bc-color-gate-ok-text)"
      };
    case "warn":
      return {
        bg: "var(--bc-color-gate-warn-bg)",
        border: "var(--bc-color-gate-warn-border)",
        text: "var(--bc-color-gate-warn-text)"
      };
    case "lock":
      return {
        bg: "var(--bc-color-gate-lock-bg)",
        border: "var(--bc-color-gate-lock-border)",
        text: "var(--bc-color-gate-lock-text)"
      };
    case "neutral":
      return {
        bg: "var(--bc-color-bg-app)",
        border: "var(--bc-color-border-strong)",
        text: "var(--bc-color-text-muted)"
      };
  }
}

function stateToVariant(state: string): Variant {
  switch (state) {
    case "ready":
      return "ok";
    case "needs-consent":
    case "in-progress":
      return "warn";
    case "blocked":
      return "lock";
    default:
      return "neutral";
  }
}

// Mirrors evaluator's courseKey: drop "-0" since it means "no section",
// keep multi-quarter sequence suffixes ("MATH 220-1" stays distinct).
function courseHistoryKey(node: Extract<PrereqNode, { kind: "course" }>): string {
  const section = node.section && node.section !== "0" ? `-${node.section}` : "";
  return `${node.subject} ${node.number}${section}`;
}

function standingLabel(node: Extract<PrereqNode, { kind: "standing" }>): string {
  return `${node.level} standing${node.orAbove ? "+" : ""}`;
}

function levelWildcardLabel(node: Extract<PrereqNode, { kind: "level-wildcard" }>): string {
  const subjects = node.subjects.length > 0 ? node.subjects.join("/") : "any subject";
  const levels = node.levels.map((n) => `${n}xx`).join("/");
  const orHigher = node.orHigher ? "+" : "";
  const count = node.count && node.count > 1 ? `${node.count}× ` : "";
  return `${count}${subjects} ${levels}${orHigher}`;
}

function whenCondition(condition: PrereqNode): string {
  switch (condition.kind) {
    case "program":
      return condition.name;
    case "program-membership":
      return condition.negated ? `not ${condition.program}` : condition.program;
    case "standing":
      return standingLabel(condition);
    default:
      return "condition";
  }
}
