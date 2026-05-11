import { ensureStyle } from "../../framework/dom";
import {
  HIDDEN_CARD_ATTR,
  PREREQ_BADGE_CLASS,
  SEARCH_FILTER_BTN_ID,
  SEARCH_ROW_ID,
  SEARCH_SWITCH_ID,
  STYLE_ID,
  TOOLTIP_ID
} from "./constants";

const CSS = `
.${PREREQ_BADGE_CLASS} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 9px;
  border: 1.5px solid var(--bc-color-border-strong);
  background: var(--bc-color-bg);
  color: var(--bc-color-text-strong);
  font-family: var(--bc-font-display);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  user-select: none;
  flex-shrink: 0;
}

.${PREREQ_BADGE_CLASS}[data-state="ready"],
.${PREREQ_BADGE_CLASS}[data-state="no-data"] {
  color: var(--bc-color-gate-ok-text);
  background: var(--bc-color-gate-ok-bg);
  border-color: var(--bc-color-gate-ok-border);
}

.${PREREQ_BADGE_CLASS}[data-state="needs-consent"],
.${PREREQ_BADGE_CLASS}[data-state="in-progress"] {
  color: var(--bc-color-gate-warn-text);
  background: var(--bc-color-gate-warn-bg);
  border-color: var(--bc-color-gate-warn-border);
}

.${PREREQ_BADGE_CLASS}[data-state="blocked"] {
  color: var(--bc-color-gate-lock-text);
  background: var(--bc-color-gate-lock-bg);
  border-color: var(--bc-color-gate-lock-border);
}

.${PREREQ_BADGE_CLASS}[data-state="unknown"] {
  color: var(--bc-color-text-muted);
  background: var(--bc-color-bg-app);
  border-color: var(--bc-color-border-strong);
  border-style: dashed;
}

/* Grid surface: paper.nu's schedule cards use bg-opacity-60, and several
   gate-*-bg tokens are intentionally translucent in dark mode (rgba alpha
   ~0.3). Stacked, the badge bleeds through and reads as transparent. On
   the grid surface, force a solid background so the badge stays legible
   on top of the card — state color survives via the border + glyph text. */
.${PREREQ_BADGE_CLASS}[data-bc-prereq-surface="grid"] {
  background: var(--bc-color-bg);
}

[${HIDDEN_CARD_ATTR}="1"] {
  display: none !important;
}

/* Row that mounts above the search results list — holds two switches
   side by side: feature on/off (left) and the "Meets prereqs" filter
   (right). Both share the same knob+label visual so the strip reads
   as one cohesive control. */
#${SEARCH_ROW_ID} {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 12px 6px;
  font-family: var(--bc-font-body);
  font-size: 12px;
  color: var(--bc-color-text-strong);
}

/* Shared switch styling — applies to BOTH the feature toggle and the
   filter toggle. Mirrors the popup's .toggle visual (36×20 pill +
   sliding knob). */
#${SEARCH_SWITCH_ID},
#${SEARCH_FILTER_BTN_ID} {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  user-select: none;
}

#${SEARCH_SWITCH_ID} .bc-switch-label,
#${SEARCH_FILTER_BTN_ID} .bc-switch-label {
  font-weight: 600;
  letter-spacing: 0.01em;
}

#${SEARCH_SWITCH_ID} .bc-switch-knob,
#${SEARCH_FILTER_BTN_ID} .bc-switch-knob {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  flex-shrink: 0;
  background: var(--bc-color-border-strong);
  transition: background var(--bc-tx-base) var(--bc-easing);
}

#${SEARCH_SWITCH_ID} .bc-switch-knob::after,
#${SEARCH_FILTER_BTN_ID} .bc-switch-knob::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--bc-color-bg);
  box-shadow: var(--bc-shadow-toggle-knob);
  transition: left var(--bc-tx-base) var(--bc-easing);
}

#${SEARCH_SWITCH_ID}[data-on="1"] .bc-switch-knob,
#${SEARCH_FILTER_BTN_ID}[data-on="1"] .bc-switch-knob {
  background: var(--bc-color-accent);
}

#${SEARCH_SWITCH_ID}[data-on="1"] .bc-switch-knob::after,
#${SEARCH_FILTER_BTN_ID}[data-on="1"] .bc-switch-knob::after {
  left: 19px;
}

/* Filter switch carries the visible-count chip after its label. */
#${SEARCH_FILTER_BTN_ID} .bc-switch-count {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--bc-color-text-muted);
}

/* Info icon next to the feature switch — surfaces the experiment
   disclosure on hover. Same shape + size as the badge chips so the
   strip reads as a single typography rhythm. */
#${SEARCH_SWITCH_ID} .bc-prereq-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 2px;
  border-radius: 50%;
  border: 1px solid var(--bc-color-border-strong);
  background: var(--bc-color-bg);
  color: var(--bc-color-text-muted);
  font-family: var(--bc-font-display, serif);
  font-style: italic;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  user-select: none;
  flex-shrink: 0;
  transition: background var(--bc-tx-base) var(--bc-easing),
              color var(--bc-tx-base) var(--bc-easing);
}

#${SEARCH_SWITCH_ID} .bc-prereq-info:hover {
  background: var(--bc-color-accent);
  color: var(--bc-color-bg);
}

/* Info-tooltip body styles — same column layout as the prereq tooltip
   but no SVG, just stacked lines. */
#${TOOLTIP_ID} .bc-prereq-info-tip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 320px;
}

#${TOOLTIP_ID} {
  position: fixed;
  z-index: 2147483646;
  /* Tree renderer caps SVG natural width at MAX_WIDTH (~1200px) via
     viewBox scaling, so the tooltip wraps content tightly without ever
     escaping the viewport. max-width is a safety net for absurdly wide
     viewports + height stays bounded so very deep trees scroll
     vertically instead of pushing the box off-screen. */
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  width: max-content;
  overflow: auto;
  padding: 8px 10px;
  background: var(--bc-color-bg);
  color: var(--bc-color-text-strong);
  border: 1.5px solid var(--bc-color-text);
  border-radius: var(--bc-radius-lg);
  box-shadow: 2px 2px 0 var(--bc-color-text);
  font-family: var(--bc-font-body);
  font-size: 12px;
  line-height: 1.4;
  display: none;
}

#${TOOLTIP_ID} svg {
  display: block;
  margin: 6px 0 2px;
  /* Final safety net — even if a tree somehow survives MAX_WIDTH it
     can't exceed its container. Height auto preserves the aspect ratio
     so the visual layout doesn't squash. */
  max-width: 100%;
  height: auto;
}

#${TOOLTIP_ID}[data-visible="1"] {
  display: block;
}

#${TOOLTIP_ID} .bc-tip-raw {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--bc-color-text-muted);
  margin-bottom: 6px;
  display: block;
  /* Cap the raw enrl_req string so a long single line wraps even when
     the SVG below makes the tooltip very wide. Without this, the raw
     text stretches the full tooltip width and reads as one giant line
     across the entire viewport. */
  max-width: 520px;
  white-space: normal;
  overflow-wrap: anywhere;
}

#${TOOLTIP_ID} .bc-tip-line {
  display: block;
  margin: 2px 0;
}

#${TOOLTIP_ID} .bc-tip-line strong {
  font-weight: 700;
}
`;

export function injectPrereqFilterStyles(doc: Document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}

export function removePrereqFilterStyles(doc: Document): void {
  doc.getElementById(STYLE_ID)?.remove();
}
