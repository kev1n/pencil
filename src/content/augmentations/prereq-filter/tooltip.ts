import { el } from "../../framework/dom";
import type {
  EligibilityHistoryEntry,
  EligibilityResult,
  PrereqNode
} from "../../prereqs";
import { TOOLTIP_ID } from "./constants";
import { renderPrereqTree } from "./tree-render";

// One shared tooltip per document. Mounted lazily on first use.
function ensureTooltip(doc: Document): HTMLElement {
  const existing = doc.getElementById(TOOLTIP_ID);
  if (existing) return existing;
  const tip = el(doc, "div", { attrs: { id: TOOLTIP_ID } });
  doc.body.appendChild(tip);
  return tip;
}

export function attachTooltip(
  doc: Document,
  trigger: HTMLElement,
  body: () => HTMLElement
): void {
  const tip = ensureTooltip(doc);

  const show = (event: MouseEvent): void => {
    tip.replaceChildren(body());
    tip.dataset.visible = "1";
    position(tip, event.clientX, event.clientY);
  };
  const hide = (): void => {
    delete tip.dataset.visible;
    tip.replaceChildren();
  };
  const move = (event: MouseEvent): void => {
    if (tip.dataset.visible !== "1") return;
    position(tip, event.clientX, event.clientY);
  };
  trigger.addEventListener("mouseenter", show);
  trigger.addEventListener("mouseleave", hide);
  trigger.addEventListener("mousemove", move);
}

function position(tip: HTMLElement, x: number, y: number): void {
  const margin = 12;
  const w = tip.offsetWidth || 280;
  const h = tip.offsetHeight || 80;
  let left = x + margin;
  let top = y + margin;
  if (left + w > window.innerWidth - margin) left = x - w - margin;
  if (top + h > window.innerHeight - margin) top = y - h - margin;
  tip.style.left = `${Math.max(margin, left)}px`;
  tip.style.top = `${Math.max(margin, top)}px`;
}

// === Tooltip body builders ===============================================

export function buildSearchTooltipBody(
  doc: Document,
  result: EligibilityResult,
  raw: string | null,
  parsed: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>
): HTMLElement {
  const wrap = el(doc, "div");
  if (raw) {
    wrap.appendChild(el(doc, "span", { class: "bc-tip-raw", text: raw }));
  }
  wrap.appendChild(stateLine(doc, result));
  // Visual tree replaces the structured "Missing:" list — it carries the
  // same information plus AND/OR composition cues. Keep notes (consent
  // hints, concurrent annotations, "recommended:" lines) as text.
  const tree = renderPrereqTree(doc, parsed, history);
  wrap.appendChild(tree.svg);
  for (const note of result.notes) {
    wrap.appendChild(el(doc, "span", { class: "bc-tip-line", text: note }));
  }
  return wrap;
}

export function buildGridTooltipBody(
  doc: Document,
  result: EligibilityResult,
  raw: string | null,
  parsed: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>
): HTMLElement {
  // Schedule-grid view: condensed — state headline + the same tree, no
  // raw line. Hover reveals exactly what the course wants and which
  // pieces you already have.
  const wrap = el(doc, "div");
  if (result.state === "ready" || result.state === "no-data") {
    // no-data means the course isn't in the parsed map; in practice this
    // only happens for courses the registrar publishes without prereq
    // data, which we treat as "no prereqs needed".
    wrap.appendChild(el(doc, "span", { class: "bc-tip-line", text: "All prerequisites met." }));
  } else {
    wrap.appendChild(el(doc, "span", { class: "bc-tip-line", text: gridSummary(result, raw) }));
  }
  const tree = renderPrereqTree(doc, parsed, history);
  wrap.appendChild(tree.svg);
  return wrap;
}

function stateLine(doc: Document, result: EligibilityResult): HTMLElement {
  const line = el(doc, "span", { class: "bc-tip-line" });
  const label: Record<EligibilityResult["state"], string> = {
    ready: "All prerequisites met.",
    "needs-consent": "Eligible with permission.",
    "in-progress": "Prereq currently in progress.",
    blocked: "Prerequisites not met.",
    unknown: "Some requirements can't be verified automatically.",
    // Absent prereq data == no prereqs needed; talk to the user the same
    // way we do for an explicit `none` node.
    "no-data": "No prerequisites — open to take."
  };
  line.appendChild(el(doc, "strong", { text: label[result.state] }));
  return line;
}

export function formatMissing(missing: PrereqNode[]): string {
  const parts: string[] = [];
  for (const node of missing) {
    const s = describeNode(node);
    if (s && !parts.includes(s)) parts.push(s);
  }
  return parts.length > 0 ? parts.join("; ") : "—";
}

function describeNode(node: PrereqNode): string {
  switch (node.kind) {
    case "course":
      return `${node.subject} ${node.number}${node.minGrade ? ` (≥ ${node.minGrade})` : ""}`;
    case "consent":
      return `${node.source} consent`;
    case "standing":
      return `${node.level} standing${node.orAbove ? "+" : ""}`;
    case "topic":
      return node.topic;
    case "placement":
      return `${node.exam} placement`;
    case "program":
      return `${node.relation.replace(/-/g, " ")} ${node.name}`;
    case "program-membership":
      return `${node.negated ? "non-" : ""}${node.program} student`;
    case "level-wildcard":
      return `${node.levels.join("/")}-level ${node.subjects.join(" or ") || "course"}`;
    case "gpa":
      return `${node.min} GPA${node.scope ? ` (${node.scope})` : ""}`;
    case "raw":
      return node.text;
    case "none":
      return "";
    case "all":
    case "any":
    case "when":
      return "";
  }
}

function gridSummary(result: EligibilityResult, raw: string | null): string {
  if (result.state === "ready") return "All prerequisites met.";
  if (result.state === "no-data") return "No prerequisite data on file.";
  const wantsList = formatMissing(result.missing);
  const wants = wantsList === "—" ? raw ?? "(unknown requirements)" : wantsList;
  if (result.state === "needs-consent") return `Wants: ${wants}.`;
  if (result.state === "in-progress") return `Wants: ${wants}. Currently in progress for you.`;
  if (result.state === "unknown") return `Trying to match: ${wants}.`;
  return `Wants: ${wants}.`;
}
