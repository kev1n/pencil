import { el } from "../../framework/dom";
import type {
  EligibilityHistoryEntry,
  EligibilityResult,
  PrereqNode
} from "../../prereqs";
import {
  GRID_BADGE_CLASS,
  SEARCH_BADGE_CLASS,
  STATE_ATTR
} from "./constants";
import {
  attachTooltip,
  buildGridTooltipBody,
  buildSearchTooltipBody
} from "./tooltip";

const SEARCH_GLYPH: Record<EligibilityResult["state"], string> = {
  ready: "✓",
  "needs-consent": "✋",
  "in-progress": "⏳",
  blocked: "⊘",
  unknown: "?",
  // No registered prereqs == nothing blocking you from taking it.
  "no-data": "✓"
};

const GRID_GLYPH: Record<EligibilityResult["state"], string> = {
  ready: "✓",
  "needs-consent": "?",
  "in-progress": "?",
  blocked: "?",
  unknown: "?",
  "no-data": "✓"
};

const SEARCH_LABEL: Record<EligibilityResult["state"], string> = {
  ready: "Eligible",
  "needs-consent": "Eligible (needs consent)",
  "in-progress": "Eligible (prereq in progress)",
  blocked: "Missing prerequisites",
  unknown: "Eligibility unknown",
  "no-data": "Eligible (no prereqs)"
};

const GRID_LABEL: Record<EligibilityResult["state"], string> = {
  ready: "All prerequisites met",
  "needs-consent": "See prerequisite details",
  "in-progress": "See prerequisite details",
  blocked: "See prerequisite details",
  unknown: "See prerequisite details",
  "no-data": "All prerequisites met"
};

export function makeSearchBadge(
  doc: Document,
  result: EligibilityResult,
  raw: string | null,
  parsed: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>
): HTMLElement {
  const badge = el(doc, "span", {
    class: SEARCH_BADGE_CLASS,
    text: SEARCH_GLYPH[result.state],
    attrs: {
      role: "img",
      "aria-label": SEARCH_LABEL[result.state],
      [STATE_ATTR]: result.state
    },
    dataset: { state: result.state }
  });
  attachTooltip(doc, badge, () => buildSearchTooltipBody(doc, result, raw, parsed, history));
  return badge;
}

export function makeGridBadge(
  doc: Document,
  result: EligibilityResult,
  raw: string | null,
  parsed: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry>
): HTMLElement {
  const badge = el(doc, "span", {
    class: GRID_BADGE_CLASS,
    text: GRID_GLYPH[result.state],
    attrs: {
      role: "img",
      "aria-label": GRID_LABEL[result.state],
      [STATE_ATTR]: result.state
    },
    dataset: { state: result.state }
  });
  attachTooltip(doc, badge, () => buildGridTooltipBody(doc, result, raw, parsed, history));
  return badge;
}
