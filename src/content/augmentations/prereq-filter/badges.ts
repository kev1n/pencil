import { el } from "../../framework/dom";
import type {
  EligibilityHistoryEntry,
  EligibilityResult,
  PrereqNode
} from "../../prereqs";
import { PREREQ_BADGE_CLASS, STATE_ATTR } from "./constants";
import {
  attachTooltip,
  buildPrereqTooltipBody,
  type TooltipTreeContext
} from "./tooltip";

const BADGE_GLYPH: Record<EligibilityResult["state"], string> = {
  ready: "✓",
  "needs-consent": "✋",
  "in-progress": "⏳",
  blocked: "⊘",
  unknown: "?",
  // No registered prereqs == nothing blocking you from taking it.
  "no-data": "✓"
};

const BADGE_LABEL: Record<EligibilityResult["state"], string> = {
  ready: "Eligible",
  "needs-consent": "Eligible (needs consent)",
  "in-progress": "Eligible (prereq in progress)",
  blocked: "Missing prerequisites",
  unknown: "Eligibility unknown",
  "no-data": "Eligible (no prereqs)"
};

// Single factory used by every prereq surface (search panel + schedule
// grid). Identical glyph, label, color, and tooltip — the only thing
// callers vary is where the badge mounts in the DOM.
export function makeBadge(
  doc: Document,
  result: EligibilityResult,
  raw: string | null,
  parsed: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>,
  treeCtx: TooltipTreeContext = {}
): HTMLElement {
  const badge = el(doc, "span", {
    class: PREREQ_BADGE_CLASS,
    text: BADGE_GLYPH[result.state],
    attrs: {
      role: "img",
      "aria-label": BADGE_LABEL[result.state],
      [STATE_ATTR]: result.state
    },
    dataset: { state: result.state }
  });
  attachTooltip(doc, badge, () => buildPrereqTooltipBody(doc, result, raw, parsed, history, treeCtx));
  return badge;
}
