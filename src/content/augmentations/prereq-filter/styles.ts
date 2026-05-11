import { ensureStyle } from "../../framework/dom";
import {
  GRID_BADGE_CLASS,
  HIDDEN_CARD_ATTR,
  SEARCH_BADGE_CLASS,
  SEARCH_SWITCH_ID,
  STYLE_ID,
  TOOLTIP_ID
} from "./constants";

const CSS = `
.${SEARCH_BADGE_CLASS},
.${GRID_BADGE_CLASS} {
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

.${GRID_BADGE_CLASS} {
  width: 14px;
  height: 14px;
  border-radius: 7px;
  font-size: 10px;
  border-width: 1px;
}

.${SEARCH_BADGE_CLASS}[data-state="ready"],
.${SEARCH_BADGE_CLASS}[data-state="no-data"],
.${GRID_BADGE_CLASS}[data-state="ready"],
.${GRID_BADGE_CLASS}[data-state="no-data"] {
  color: var(--bc-color-gate-ok-text);
  background: var(--bc-color-gate-ok-bg);
  border-color: var(--bc-color-gate-ok-border);
}

.${SEARCH_BADGE_CLASS}[data-state="needs-consent"] {
  color: var(--bc-color-gate-warn-text);
  background: var(--bc-color-gate-warn-bg);
  border-color: var(--bc-color-gate-warn-border);
}

.${SEARCH_BADGE_CLASS}[data-state="in-progress"] {
  color: var(--bc-color-gate-warn-text);
  background: var(--bc-color-gate-warn-bg);
  border-color: var(--bc-color-gate-warn-border);
}

.${SEARCH_BADGE_CLASS}[data-state="blocked"] {
  color: var(--bc-color-gate-lock-text);
  background: var(--bc-color-gate-lock-bg);
  border-color: var(--bc-color-gate-lock-border);
}

.${SEARCH_BADGE_CLASS}[data-state="unknown"],
.${GRID_BADGE_CLASS}[data-state="unknown"],
.${GRID_BADGE_CLASS}[data-state="needs-consent"],
.${GRID_BADGE_CLASS}[data-state="in-progress"],
.${GRID_BADGE_CLASS}[data-state="blocked"] {
  color: var(--bc-color-text-muted);
  background: var(--bc-color-bg-app);
  border-color: var(--bc-color-border-strong);
  border-style: dashed;
}

[${HIDDEN_CARD_ATTR}="1"] {
  display: none !important;
}

/* Switch row — mirrors the popup's .toggle visual (36×20 pill + sliding
   knob) so the surface feels native to the rest of the extension. */
#${SEARCH_SWITCH_ID} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin: 6px 0;
  font-family: var(--bc-font-body);
  font-size: 12px;
  color: var(--bc-color-text-strong);
  background: transparent;
  border: none;
  cursor: pointer;
  user-select: none;
}

#${SEARCH_SWITCH_ID} .bc-switch-label {
  font-weight: 600;
  letter-spacing: 0.01em;
}

#${SEARCH_SWITCH_ID} .bc-switch-count {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--bc-color-text-muted);
  margin-left: auto;
}

#${SEARCH_SWITCH_ID} .bc-switch-knob {
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

#${SEARCH_SWITCH_ID} .bc-switch-knob::after {
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

#${SEARCH_SWITCH_ID}[data-on="1"] .bc-switch-knob {
  background: var(--bc-color-accent);
}

#${SEARCH_SWITCH_ID}[data-on="1"] .bc-switch-knob::after {
  left: 19px;
}

#${TOOLTIP_ID} {
  position: fixed;
  z-index: 2147483646;
  max-width: 600px;
  padding: 8px 10px;
  background: var(--bc-color-bg);
  color: var(--bc-color-text-strong);
  border: 1.5px solid var(--bc-color-text);
  border-radius: var(--bc-radius-lg);
  box-shadow: 2px 2px 0 var(--bc-color-text);
  font-family: var(--bc-font-body);
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
  display: none;
}

#${TOOLTIP_ID} svg {
  display: block;
  margin: 6px 0 2px;
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
