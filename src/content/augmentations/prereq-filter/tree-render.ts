// Inline-SVG renderer for parsed prereq trees. Pure function — no DOM
// globals, no chrome.*. Tooltip caller owns the returned <svg>.
//
// Layout flows BOTTOM-UP: leaves sit at the bottom and edges fan upward
// into composite convergence points; the optional target course pill caps
// the tree at the top. Reading top-to-bottom traces "to take this course
// (top), satisfy these prereqs (below)".
//
// When a `parsedMap` is provided, every interior course leaf expands
// recursively into its own pill + subtree, so the rendered tree extends
// downward until every branch ends at a course with no prereqs (or hits a
// cycle / depth cap).
//
// Pill widths come from real text-metrics (canvas 2D), so labels never
// stretch via SVG textLength.
//
// Colors flow exclusively through design-system gate tokens.

import {
  evaluateEligibility,
  type EligibilityHistoryEntry,
  type EligibilityState,
  type ParsedPrereqMap,
  type PrereqNode
} from "../../prereqs";

const SVG_NS = "http://www.w3.org/2000/svg";

// Layout constants. Trees can get tall + wide quickly (4+ level prereq
// chains are common), so every gap is tight; PILL_H stays comfortably
// above LABEL_FONT for legibility.
const PILL_PAD_X = 7;
const PILL_PAD_Y = 4;
const PILL_MIN_W = 56;
const PILL_MAX_W = 130; // soft cap — pills wrap to new lines past this
const LABEL_FONT = 11;
const LABEL_LINE_HEIGHT = 13;
const PILL_H = LABEL_FONT + PILL_PAD_Y * 2 + 4;
const COMP_LABEL_FONT = 9;
const COMP_GLYPH = " ";
const X_GAP = 4;
const CONVERGE_GAP = 12; // y-distance between a convergence point and the children below it
const TAIL = 3; // tiny gap at the top so the convergence dot doesn't kiss the bbox edge
const PADDING = 6;
const FRAME_HEADER = 18;
const FRAME_PAD_X = 8;
// Hard ceiling on SVG natural width — recursive trees can balloon past
// 2000px on upper-division courses, escape the tooltip's viewport-bounded
// box, and read as broken. viewBox-based downscaling kicks in past this
// limit so the tree always fits a typical laptop screen.
const MAX_WIDTH = 1200;
const MIN_SCALE = 0.55;
// Target course pill (top of tree) is rendered larger than interior
// course pills so the user sees the course they're inspecting at a
// glance.
const TARGET_PILL_H = 36;
const TARGET_LABEL_FONT = 14;
const TARGET_PILL_PAD_X = 14;
const TARGET_PILL_MIN_W = 100;

// Recursive expansion ceiling. Cycle detection handles A→B→A; depth caps
// pathological chains so the rendered tooltip stays bounded. Two levels
// under the target course = three visual rows total (target + direct
// prereqs + prereqs' prereqs). Past that, pills render as leaves so the
// tree stays compact and every node remains legibly sized.
const MAX_RECURSION_DEPTH = 2;

const NULL_LABEL = "No prerequisites";

type Variant = "ok" | "warn" | "lock" | "neutral";

type LaidOut = {
  width: number;
  height: number;
  /** Top-center connection point in the layout's local bbox. Parent edges
   * descend FROM their convergence point TO this anchor. For leaves this is
   * the pill's top-center; for composites it's the convergence point near
   * the top of the bbox. */
  topAnchor: { x: number; y: number };
  draw(svg: SVGSVGElement, originX: number, originY: number): void;
};

export type TreeRenderResult = {
  svg: SVGSVGElement;
  width: number;
  height: number;
};

export type RenderPrereqTreeOptions = {
  /** When provided, every interior course leaf recursively expands into
   * its own pill + prereq subtree below it (cycle/depth-guarded). */
  parsedMap?: ParsedPrereqMap;
  /** When provided, a pill for the target course is drawn at the very top
   * of the tree with the prereq subtree below. The state colors the pill;
   * pass the same EligibilityResult.state the caller used for the badge. */
  target?: {
    subject: string;
    number: string;
    state: EligibilityState;
  };
};

type Ctx = {
  history: ReadonlyMap<string, EligibilityHistoryEntry>;
  parsedMap: ParsedPrereqMap | null;
  measure: Measure;
  depth: number;
  seen: ReadonlySet<string>;
};

export function renderPrereqTree(
  doc: Document,
  node: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>,
  options: RenderPrereqTreeOptions = {}
): TreeRenderResult {
  const measure = makeMeasurer(doc);
  // null / absent prereq record = "this course has no prereqs". Surface as
  // an unconditional ready pill so the user doesn't see a vague "no data"
  // state.
  const effective: PrereqNode = node ?? { kind: "none" };

  const initialSeen = new Set<string>();
  if (options.target) initialSeen.add(targetKey(options.target));

  const ctx: Ctx = {
    history,
    parsedMap: options.parsedMap ?? null,
    measure,
    depth: 0,
    seen: initialSeen
  };

  const subtree = layoutFor(effective, ctx);
  const layout = options.target ? wrapWithTarget(options.target, subtree, ctx) : subtree;

  const innerW = layout.width;
  const innerH = layout.height;
  const totalW = innerW + PADDING * 2;
  const totalH = innerH + PADDING * 2;
  // Cap rendered dimensions so the tree never escapes the viewport.
  // viewBox stays at the natural totalW/totalH; only width/height
  // attrs shrink — the browser scales the whole drawing uniformly,
  // text + pill spacing + stroke widths included.
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

function layoutFor(node: PrereqNode, ctx: Ctx): LaidOut {
  switch (node.kind) {
    case "none":
      return leaf(NULL_LABEL, { variant: "ok", glyph: "✓" }, ctx.measure);
    case "course":
      return courseSubtree(node, ctx);
    case "consent":
      return leaf(`${node.source} consent`, { variant: "warn", glyph: "\u{1F511}" }, ctx.measure);
    case "standing":
      return leaf(standingLabel(node), { variant: "neutral", dashed: true, italic: true }, ctx.measure);
    case "topic":
      return leaf(node.topic, { variant: "neutral", glyph: "?", dashed: true, italic: true }, ctx.measure);
    case "raw":
      return leaf(node.text, { variant: "neutral", glyph: "?", dashed: true, italic: true }, ctx.measure);
    case "level-wildcard":
      return leaf(levelWildcardLabel(node), { variant: "neutral", glyph: "?", dashed: true, italic: true }, ctx.measure);
    case "program":
      return leaf(`${node.relation.replace(/-/g, " ")} ${node.name}`, { variant: "neutral", glyph: "?", dashed: true, italic: true }, ctx.measure);
    case "program-membership":
      return leaf(`${node.negated ? "not " : ""}${node.program}`, { variant: "neutral", glyph: "?", dashed: true, italic: true }, ctx.measure);
    case "placement":
      return leaf(`${node.exam} placement`, { variant: "neutral", glyph: "?", dashed: true, italic: true }, ctx.measure);
    case "gpa":
      return leaf(`GPA ≥ ${node.min}${node.scope ? ` (${node.scope})` : ""}`, { variant: "neutral", glyph: "?", dashed: true, italic: true }, ctx.measure);
    case "all":
      return composite("AND", node.of, ctx, /* dashed */ false);
    case "any":
      return composite("OR", node.of, ctx, /* dashed */ true);
    case "when":
      return frame(node, ctx);
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
  const italic = opts.italic ?? false;
  // Wrap long labels onto multiple lines so a pill never balloons past
  // PILL_MAX_W. Word-greedy: pack as many words as fit, break to next
  // line, repeat. Each line measured independently so the pill width is
  // the widest line + padding.
  const lines = wrapLabel(display, PILL_MAX_W - PILL_PAD_X * 2, LABEL_FONT, italic, measure);
  const widestLine = lines.reduce(
    (m, line) => Math.max(m, measure(line, LABEL_FONT, italic)),
    0
  );
  const width = Math.max(
    PILL_MIN_W,
    Math.min(PILL_MAX_W, Math.round(widestLine + PILL_PAD_X * 2))
  );
  const height =
    lines.length === 1
      ? PILL_H
      : lines.length * LABEL_LINE_HEIGHT + PILL_PAD_Y * 2;
  return {
    width,
    height,
    topAnchor: { x: width / 2, y: 0 },
    draw(svg, x, y) {
      drawPill(svg, x, y, width, height, opts.variant, lines, opts.dashed === true, italic);
    }
  };
}

// Word-greedy wrapper. Falls back to character-level break if a single
// word exceeds maxWidth (very long single-word labels like a topic node
// would otherwise overflow).
function wrapLabel(
  text: string,
  maxWidth: number,
  fontSize: number,
  italic: boolean,
  measure: Measure
): string[] {
  if (measure(text, fontSize, italic) <= maxWidth) return [text];
  const tokens = text.split(/(\s+)/);
  const lines: string[] = [];
  let current = "";
  for (const tok of tokens) {
    if (tok.length === 0) continue;
    const next = current + tok;
    if (measure(next, fontSize, italic) <= maxWidth || /^\s+$/.test(tok) && current.length > 0) {
      current = next;
    } else if (current.length === 0) {
      // First word in the line is itself too long — keep adding, accept
      // that this line will overflow the soft cap a bit. Better than
      // looping forever on a single oversized token.
      lines.push(tok);
      current = "";
    } else {
      lines.push(current.replace(/\s+$/, ""));
      current = tok.replace(/^\s+/, "");
    }
  }
  if (current.length > 0) lines.push(current.replace(/\s+$/, ""));
  return lines.length > 0 ? lines : [text];
}

// A course node. When parsedMap is available and this course has its own
// non-empty prereqs (and we haven't seen this course on the current
// ancestor path / aren't past MAX_RECURSION_DEPTH / aren't a `recommended`
// soft-suggestion), expand into a pill + its prereq subtree below.
function courseSubtree(
  node: Extract<PrereqNode, { kind: "course" }>,
  ctx: Ctx
): LaidOut {
  const pill = courseLeaf(node, ctx);

  if (
    !ctx.parsedMap ||
    ctx.depth >= MAX_RECURSION_DEPTH ||
    node.recommended === true
  ) {
    return pill;
  }

  const key = courseDisplayKey(node);
  if (ctx.seen.has(key)) return pill;

  const childParsed = lookupParsedFor(ctx.parsedMap, node);
  if (!childParsed || childParsed.kind === "none") {
    return pill;
  }

  const childCtx: Ctx = {
    ...ctx,
    depth: ctx.depth + 1,
    seen: new Set([...ctx.seen, key])
  };
  const childLayout = layoutFor(childParsed, childCtx);

  return stackPillAboveChild(pill, childLayout);
}

function courseLeaf(
  node: Extract<PrereqNode, { kind: "course" }>,
  ctx: Ctx
): LaidOut {
  const label = node.minGrade
    ? `${node.subject} ${node.number} (≥ ${node.minGrade})`
    : `${node.subject} ${node.number}`;

  if (node.recommended === true) {
    // Recommended = soft suggestion — paints green but dashed + italic,
    // with "(rec.)" suffix so it's visually distinct from a hard prereq.
    return leaf(`${label} (rec.)`, { variant: "ok", glyph: "✓", dashed: true, italic: true }, ctx.measure);
  }

  const entry = ctx.history.get(courseHistoryKey(node));
  if (entry && entry.status === "In Progress") {
    return leaf(label, { variant: "warn", glyph: "⏳" }, ctx.measure);
  }

  const result = evaluateEligibility(node, ctx.history);
  const variant = stateToVariant(result.state);
  const glyph = variant === "ok" ? "✓" : variant === "warn" ? "⏳" : "⊘";
  return leaf(label, { variant, glyph }, ctx.measure);
}

// AND / OR composite. Children laid out left-to-right at the BOTTOM; their
// top-anchors fan UP to a single convergence point near the top of the
// bbox, with the AND/OR text label adjacent. The composite's own topAnchor
// IS that convergence point, so nested composites cascade upward into a
// single trunk reaching the target pill.
function composite(
  label: "AND" | "OR",
  children: PrereqNode[],
  ctx: Ctx,
  dashed: boolean
): LaidOut {
  if (children.length === 0) {
    return leaf("Trivially satisfied", { variant: "ok", glyph: "✓" }, ctx.measure);
  }
  if (children.length === 1) {
    // A single-child all/any is degenerate — render the child as-is.
    return layoutFor(children[0], ctx);
  }

  const laid = children.map((c) => layoutFor(c, ctx));
  const childOffsets: number[] = [];
  let cursor = 0;
  for (const child of laid) {
    childOffsets.push(cursor);
    cursor += child.width + X_GAP;
  }
  const innerW = cursor - X_GAP;
  const convergeY = TAIL;
  const childTop = convergeY + CONVERGE_GAP;
  const maxChildH = laid.reduce((m, c) => Math.max(m, c.height), 0);
  const convergeX = innerW / 2;

  // The AND/OR label sits to the right of the convergence point. Measure
  // it so the bbox includes the label width.
  const labelW = ctx.measure(label, COMP_LABEL_FONT, false, "700");
  const labelGap = 6;
  const widthForLabel = convergeX + labelGap + Math.ceil(labelW) + 4;
  const width = Math.max(innerW, widthForLabel);
  const height = childTop + maxChildH;

  return {
    width,
    height,
    topAnchor: { x: convergeX, y: convergeY },
    draw(svg, originX, originY) {
      // Center children if the label widened the bbox past the children row.
      const childOffset = (width - innerW) / 2;
      const absConvX = originX + childOffset + convergeX;
      const absConvY = originY + convergeY;

      for (let i = 0; i < laid.length; i += 1) {
        const child = laid[i];
        const cx = originX + childOffset + childOffsets[i];
        const cy = originY + childTop;
        child.draw(svg, cx, cy);

        // Edge from the convergence point DOWN to this child's top anchor.
        drawEdge(
          svg,
          absConvX,
          absConvY,
          cx + child.topAnchor.x,
          cy + child.topAnchor.y,
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

function frame(node: Extract<PrereqNode, { kind: "when" }>, ctx: Ctx): LaidOut {
  const inner = layoutFor(node.then, ctx);
  const titleText = `if ${whenCondition(node.condition)}`;
  const titleW = ctx.measure(titleText, COMP_LABEL_FONT, true);
  const width = Math.max(inner.width + FRAME_PAD_X * 2, Math.ceil(titleW) + FRAME_PAD_X * 2);
  const innerX = (width - inner.width) / 2;
  const innerY = FRAME_HEADER;
  const height = innerY + inner.height + 6;
  return {
    width,
    height,
    topAnchor: { x: innerX + inner.topAnchor.x, y: innerY + inner.topAnchor.y },
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

// Stack a course pill at the top and its prereq subtree below it, joined
// by a solid edge from pill bottom to the subtree's topAnchor. Returned
// layout's topAnchor is the pill's top-center, so further parents above
// connect into the pill itself, not into the children below it.
function stackPillAboveChild(pill: LaidOut, child: LaidOut): LaidOut {
  const childTop = pill.height + CONVERGE_GAP;
  const width = Math.max(pill.width, child.width);
  const pillX = (width - pill.width) / 2;
  const childX = (width - child.width) / 2;
  const height = childTop + child.height;

  return {
    width,
    height,
    topAnchor: { x: pillX + pill.topAnchor.x, y: pill.topAnchor.y },
    draw(svg, ox, oy) {
      pill.draw(svg, ox + pillX, oy);
      child.draw(svg, ox + childX, oy + childTop);
      const fromX = ox + pillX + pill.width / 2;
      const fromY = oy + pill.height;
      const toX = ox + childX + child.topAnchor.x;
      const toY = oy + childTop + child.topAnchor.y;
      drawEdge(svg, fromX, fromY, toX, toY, false);
    }
  };
}

function wrapWithTarget(
  target: NonNullable<RenderPrereqTreeOptions["target"]>,
  subtree: LaidOut,
  ctx: Ctx
): LaidOut {
  const label = `${target.subject} ${target.number.replace(/-0$/, "")}`;
  const variant = stateToVariant(target.state);
  // Target pill carries no glyph — it's the course you're inspecting, not
  // a prereq to satisfy. Rendered at TARGET_* dimensions so it visually
  // dominates the prereq subtree below.
  const pill = bigLeaf(label, variant, ctx.measure);
  return stackPillAboveChild(pill, subtree);
}

function bigLeaf(label: string, variant: Variant, measure: Measure): LaidOut {
  const measuredW = measure(label, TARGET_LABEL_FONT, false, "700");
  const width = Math.max(TARGET_PILL_MIN_W, Math.round(measuredW + TARGET_PILL_PAD_X * 2));
  const height = TARGET_PILL_H;
  return {
    width,
    height,
    topAnchor: { x: width / 2, y: 0 },
    draw(svg, x, y) {
      const doc = svg.ownerDocument;
      const tokens = variantTokens(variant);
      const rect = doc.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", String(height));
      rect.setAttribute("rx", "10");
      rect.setAttribute("ry", "10");
      rect.setAttribute("fill", tokens.bg);
      rect.setAttribute("stroke", tokens.border);
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("class", `bc-prereq-tree__leaf bc-prereq-tree__leaf--target bc-prereq-tree__leaf--${variant}`);
      svg.appendChild(rect);

      const text = doc.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(x + width / 2));
      text.setAttribute("y", String(y + height / 2 + 6));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", String(TARGET_LABEL_FONT));
      text.setAttribute("font-weight", "700");
      text.setAttribute("fill", tokens.text);
      text.setAttribute("class", "bc-prereq-tree__label bc-prereq-tree__label--target");
      text.textContent = label;
      svg.appendChild(text);
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
  lines: readonly string[],
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

  // Vertically center the line block inside the pill. For a single line
  // we reproduce the pre-wrap baseline placement; multi-line groups
  // are spread across LABEL_LINE_HEIGHT increments.
  const centerY = y + height / 2;
  const blockHeight = (lines.length - 1) * LABEL_LINE_HEIGHT;
  const firstBaseline = centerY - blockHeight / 2 + LABEL_FONT / 2 - 1;
  const centerX = x + width / 2;

  const text = doc.createElementNS(SVG_NS, "text");
  // x/y on the parent are used by some test helpers + by accessibility
  // tooling; they point at the first line's baseline. The actual line
  // placement is set per-tspan below.
  text.setAttribute("x", String(centerX));
  text.setAttribute("y", String(firstBaseline));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-size", String(LABEL_FONT));
  text.setAttribute("font-weight", "500");
  text.setAttribute("fill", tokens.text);
  if (italic) text.setAttribute("font-style", "italic");
  text.setAttribute("class", "bc-prereq-tree__label");

  for (let i = 0; i < lines.length; i += 1) {
    const tspan = doc.createElementNS(SVG_NS, "tspan");
    tspan.setAttribute("x", String(centerX));
    tspan.setAttribute("y", String(firstBaseline + i * LABEL_LINE_HEIGHT));
    // Space prefix on continuation lines so DOM textContent reads back
    // as a single word-separated string (tests + a11y rely on this).
    tspan.textContent = i === 0 ? lines[i] : ` ${lines[i]}`;
    text.appendChild(tspan);
  }
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
  // the curve along the y axis between endpoints.
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

function stateToVariant(state: EligibilityState | string): Variant {
  switch (state) {
    case "ready":
    case "no-data":
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

// Cycle-detection key. Same canonicalization as the history key: collapse
// the "-0" no-section suffix so "COMP_SCI 211" and "COMP_SCI 211-0" share
// an ancestor slot. Sequence suffixes ("MATH 220-1") stay distinct.
function courseDisplayKey(node: Extract<PrereqNode, { kind: "course" }>): string {
  return courseHistoryKey(node);
}

function targetKey(target: NonNullable<RenderPrereqTreeOptions["target"]>): string {
  const num = target.number.replace(/-0$/, "");
  return `${target.subject} ${num}`;
}

// Look up a course's own parsed prereq node from the parsedMap. paper.nu's
// keys carry the "-0" suffix when the course has no section subdivision;
// fall back to the bare form so parser-id quirks don't sink the lookup.
function lookupParsedFor(
  parsedMap: ParsedPrereqMap,
  node: Extract<PrereqNode, { kind: "course" }>
): PrereqNode | null {
  const number = node.number.includes("-") ? node.number : `${node.number}-0`;
  const id = `${node.subject} ${number}`;
  const record = parsedMap.get(id) ?? (id.endsWith("-0") ? parsedMap.get(id.slice(0, -2)) : undefined);
  return record?.parsed ?? null;
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
