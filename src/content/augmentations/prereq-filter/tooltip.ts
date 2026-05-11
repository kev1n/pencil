import { el } from "../../framework/dom";
import type {
  EligibilityHistoryEntry,
  EligibilityResult,
  ParsedPrereqMap,
  PrereqNode
} from "../../prereqs";
import { TOOLTIP_ID } from "./constants";
import { renderPrereqTree, type RenderPrereqTreeOptions } from "./tree-render";

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

// === Tooltip body builder ================================================
// Single body used by every prereq surface. Stays identical between the
// search panel and the schedule grid so the two never drift.

export type TooltipTreeContext = {
  parsedMap?: ParsedPrereqMap;
  target?: RenderPrereqTreeOptions["target"];
};

export function buildPrereqTooltipBody(
  doc: Document,
  result: EligibilityResult,
  raw: string | null,
  parsed: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>,
  treeCtx: TooltipTreeContext = {}
): HTMLElement {
  const wrap = el(doc, "div");
  if (raw) {
    wrap.appendChild(el(doc, "span", { class: "bc-tip-raw", text: raw }));
  }
  wrap.appendChild(stateLine(doc, result));
  // Visual tree replaces the structured "Missing:" list — it carries the
  // same information plus AND/OR composition cues. Keep notes (consent
  // hints, concurrent annotations, "recommended:" lines) as text.
  const tree = renderPrereqTree(doc, parsed, history, treeCtx);
  wrap.appendChild(tree.svg);
  for (const note of result.notes) {
    wrap.appendChild(el(doc, "span", { class: "bc-tip-line", text: note }));
  }
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
