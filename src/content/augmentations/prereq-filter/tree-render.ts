// HTML renderer for parsed prereq trees. Pure function — no DOM globals,
// no chrome.*. Tooltip caller owns the returned element.
//
// The tree reads LEFT TO RIGHT: the target course sits on the left, and
// each requirement group hangs off a bracket to its right. A solid
// bracket means every item is needed ("all"); a dashed bracket means one
// of them is enough ("one of"). Growing sideways by depth and downward
// by breadth keeps the width bounded by how deep the chain goes, not by
// how many alternatives a course lists.
//
// When a `parsedMap` is provided, course pills expand into their own
// prereqs, with three rules that keep the tree small: only one
// alternative of an unmet OR is expanded, a course is expanded once per
// tree, and nothing is drawn under a course already taken.
//
// Colors flow exclusively through design-system gate tokens (styles.ts).

import {
  evaluateEligibility,
  type EligibilityHistoryEntry,
  type EligibilityState,
  type ParsedPrereqMap,
  type PrereqNode
} from "../../prereqs";
import { el } from "../../framework/dom";

// Recursive expansion ceiling. Cycle detection handles A→B→A; depth caps
// pathological chains so the tooltip stays bounded. Two levels under the
// target course = the target, its prereqs, and their prereqs.
const MAX_RECURSION_DEPTH = 2;

const NULL_LABEL = "No prerequisites";

type Variant = "ok" | "warn" | "lock" | "neutral";
type CourseNode = Extract<PrereqNode, { kind: "course" }>;

export type TreeRenderResult = {
  el: HTMLElement;
};

export type RenderPrereqTreeOptions = {
  /** When provided, course pills expand into their own prereqs
   * (cycle/depth-guarded). */
  parsedMap?: ParsedPrereqMap;
  /** When provided, a pill for the target course leads the tree. The
   * state colors the pill; pass the same EligibilityResult.state the
   * caller used for the badge. */
  target?: {
    subject: string;
    number: string;
    state: EligibilityState;
  };
};

type Ctx = {
  doc: Document;
  history: ReadonlyMap<string, EligibilityHistoryEntry>;
  parsedMap: ParsedPrereqMap | null;
  depth: number;
  /** Courses on the current ancestor path (cycle guard). */
  seen: ReadonlySet<string>;
  /** Courses already drawn with their own prereqs somewhere in this tree.
   * Shared across the whole render so a repeated course expands once. */
  expanded: Set<string>;
  /** Set under the OR alternatives we chose not to expand. */
  collapsed: boolean;
};

export function renderPrereqTree(
  doc: Document,
  node: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>,
  options: RenderPrereqTreeOptions = {}
): TreeRenderResult {
  // null / absent prereq record = "this course has no prereqs". Surface as
  // an unconditional ready pill so the user doesn't see a vague "no data"
  // state.
  const effective: PrereqNode = node ?? { kind: "none" };
  const ctx: Ctx = {
    doc,
    history,
    parsedMap: options.parsedMap ?? null,
    depth: 0,
    seen: new Set(options.target ? [targetKey(options.target)] : []),
    expanded: new Set(),
    collapsed: false
  };

  const root = el(doc, "div", { class: "bc-prereq-tree" });
  if (options.target) {
    const name = `${options.target.subject} ${options.target.number.replace(/-0$/, "")}`;
    const row = nodeRow(doc);
    row.appendChild(
      pill(doc, name, stateToVariant(options.target.state), { target: true })
    );
    attachRequirement(row, effective, ctx);
    root.appendChild(row);
  } else {
    root.appendChild(renderNode(effective, ctx));
  }
  return { el: root };
}

// === Nodes =================================================================

function nodeRow(doc: Document): HTMLElement {
  return el(doc, "div", { class: "bc-prereq-tree__node" });
}

type PillOpts = { glyph?: string; soft?: boolean; target?: boolean };

function pill(doc: Document, label: string, variant: Variant, opts: PillOpts = {}): HTMLElement {
  const classes = ["bc-prereq-tree__pill", `bc-prereq-tree__pill--${variant}`];
  if (opts.soft) classes.push("bc-prereq-tree__pill--soft");
  if (opts.target) classes.push("bc-prereq-tree__pill--target");
  return el(doc, "span", {
    class: classes.join(" "),
    text: opts.glyph ? `${opts.glyph} ${label}` : label
  });
}

function softPill(doc: Document, label: string): HTMLElement {
  return pill(doc, label, "neutral", { glyph: "?", soft: true });
}

function renderNode(node: PrereqNode, ctx: Ctx): HTMLElement {
  const { doc } = ctx;
  if (node.kind === "all" || node.kind === "any") {
    if (node.of.length === 0) {
      return wrap(doc, pill(doc, "Trivially satisfied", "ok", { glyph: "✓" }));
    }
    // A single-child all/any is degenerate — render the child as-is.
    if (node.of.length === 1) return renderNode(node.of[0], ctx);
    const row = nodeRow(doc);
    appendGroup(row, node, ctx);
    return row;
  }
  if (node.kind === "course") return courseNode(node, ctx);
  if (node.kind === "when") {
    const row = wrap(doc, softPill(doc, `if ${whenCondition(node.condition)}`));
    attachRequirement(row, node.then, ctx);
    return row;
  }
  return wrap(doc, leafPill(node, doc));
}

function wrap(doc: Document, child: HTMLElement): HTMLElement {
  const row = nodeRow(doc);
  row.appendChild(child);
  return row;
}

function leafPill(
  node: Exclude<PrereqNode, { kind: "all" | "any" | "course" | "when" }>,
  doc: Document
): HTMLElement {
  switch (node.kind) {
    case "none":
      return pill(doc, NULL_LABEL, "ok", { glyph: "✓" });
    case "consent":
      return pill(doc, `${node.source} consent`, "warn");
    case "standing":
      return pill(doc, standingLabel(node), "neutral", { soft: true });
    case "topic":
      return softPill(doc, node.topic);
    case "raw":
      return softPill(doc, node.text);
    case "level-wildcard":
      return softPill(doc, levelWildcardLabel(node));
    case "program":
      return softPill(doc, `${node.relation.replace(/-/g, " ")} ${node.name}`);
    case "program-membership":
      return softPill(doc, `${node.negated ? "not " : ""}${node.program}`);
    case "placement":
      return softPill(doc, `${node.exam} placement`);
    case "gpa":
      return softPill(doc, `GPA ≥ ${node.min}${node.scope ? ` (${node.scope})` : ""}`);
  }
}

// A course pill, followed by its own prereqs when it should expand.
function courseNode(node: CourseNode, ctx: Ctx): HTMLElement {
  const row = wrap(ctx.doc, coursePill(node, ctx));
  if (
    !ctx.parsedMap ||
    ctx.collapsed ||
    ctx.depth >= MAX_RECURSION_DEPTH ||
    node.recommended === true
  ) {
    return row;
  }

  const key = courseHistoryKey(node);
  if (ctx.seen.has(key) || ctx.expanded.has(key)) return row;
  // A course already taken or under way needs no path drawn beside it.
  if (isDone(node, ctx)) return row;

  const childParsed = lookupParsedFor(ctx.parsedMap, node);
  if (!childParsed || childParsed.kind === "none") return row;

  ctx.expanded.add(key);
  attachRequirement(row, childParsed, {
    ...ctx,
    depth: ctx.depth + 1,
    seen: new Set([...ctx.seen, key])
  });
  return row;
}

function coursePill(node: CourseNode, ctx: Ctx): HTMLElement {
  // Sequence parts are distinct courses, so "MATH 220-1" keeps its
  // suffix; only the "-0" no-section default is dropped.
  const name = courseHistoryKey(node);
  const label = node.minGrade ? `${name} (≥ ${node.minGrade})` : name;

  if (node.recommended === true) {
    // Recommended = soft suggestion, visually distinct from a hard prereq.
    return pill(ctx.doc, `${label} (rec.)`, "ok", { glyph: "✓", soft: true });
  }

  const entry = ctx.history.get(name);
  if (entry && entry.status === "In Progress") {
    return pill(ctx.doc, label, "warn", { glyph: "⏳" });
  }

  const variant = stateToVariant(evaluateEligibility(node, ctx.history).state);
  const glyph = variant === "ok" ? "✓" : variant === "warn" ? "⏳" : undefined;
  return pill(ctx.doc, label, variant, { glyph });
}

// === Groups ================================================================

// Hang `requirement` off the right side of `row`'s pill.
function attachRequirement(row: HTMLElement, requirement: PrereqNode, ctx: Ctx): void {
  if (requirement.kind === "all" || requirement.kind === "any") {
    if (requirement.of.length === 1) {
      attachRequirement(row, requirement.of[0], ctx);
      return;
    }
    if (requirement.of.length > 1) {
      appendGroup(row, requirement, ctx);
      return;
    }
  }
  row.appendChild(link(ctx.doc, null, false));
  row.appendChild(renderNode(requirement, ctx));
}

function appendGroup(
  row: HTMLElement,
  group: Extract<PrereqNode, { kind: "all" | "any" }>,
  ctx: Ctx
): void {
  const any = group.kind === "any";
  // Only one alternative of an OR has to be met, so only one is drawn
  // with its own prereqs; the rest stay as pills.
  const open = any ? alternativeToExpand(group.of, ctx) : -1;
  const kids = el(ctx.doc, "div", {
    class: `bc-prereq-tree__kids${any ? " bc-prereq-tree__kids--any" : ""}`
  });
  group.of.forEach((child, i) => {
    kids.appendChild(renderNode(child, any && i !== open ? { ...ctx, collapsed: true } : ctx));
  });
  row.appendChild(link(ctx.doc, any ? "one of" : "all", any));
  row.appendChild(kids);
}

function link(doc: Document, label: string | null, any: boolean): HTMLElement {
  const node = el(doc, "span", {
    class: `bc-prereq-tree__link${any ? " bc-prereq-tree__link--any" : ""}`
  });
  if (label) node.appendChild(el(doc, "span", { class: "bc-prereq-tree__op", text: label }));
  return node;
}

function isDone(node: PrereqNode, ctx: Ctx): boolean {
  const state = evaluateEligibility(node, ctx.history).state;
  return state === "ready" || state === "in-progress";
}

function hasCourse(node: PrereqNode): boolean {
  if (node.kind === "course") return true;
  return (node.kind === "all" || node.kind === "any") && node.of.some(hasCourse);
}

// Which OR alternative gets its prereqs drawn: none once the OR is met,
// otherwise the first one that names a course.
function alternativeToExpand(children: readonly PrereqNode[], ctx: Ctx): number {
  if (children.some((child) => isDone(child, ctx))) return -1;
  return children.findIndex(hasCourse);
}

// === Labels ================================================================

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
// Doubles as the cycle-detection key.
function courseHistoryKey(node: CourseNode): string {
  const section = node.section && node.section !== "0" ? `-${node.section}` : "";
  return `${node.subject} ${node.number}${section}`;
}

function targetKey(target: NonNullable<RenderPrereqTreeOptions["target"]>): string {
  return `${target.subject} ${target.number.replace(/-0$/, "")}`;
}

// Look up a course's own parsed prereq node from the parsedMap. Parser
// nodes carry the sequence part separately ("220" + "1"), so the plan id
// is number-section; "-0" is the no-section default.
function lookupParsedFor(parsedMap: ParsedPrereqMap, node: CourseNode): PrereqNode | null {
  const id = `${node.subject} ${node.number}-${node.section || "0"}`;
  return parsedMap.get(id)?.parsed ?? null;
}

function standingLabel(node: Extract<PrereqNode, { kind: "standing" }>): string {
  // "BME graduate standing": a named program is part of the requirement.
  const program = node.scope && "names" in node.scope ? `${node.scope.names.join("/")} ` : "";
  return `${program}${node.level} standing${node.orAbove ? "+" : ""}`;
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
