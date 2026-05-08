import { ensureStyle } from "../../framework";
import {
  CARD_PIN_BUTTON_CLASS,
  FEATURE_TOGGLE_CLASS,
  REAL_CARD_HIDE_ATTR,
  ROOT_ATTR,
  STYLE_ID,
  TOP_BAR_ID
} from "./constants";

const REAL_CARD_HIDE_SELECTOR =
  "div.absolute.z-10.rounded-lg" + `[${REAL_CARD_HIDE_ATTR}="1"]`;

// margin-top clears paper-ctec's floating status bar (which is anchored
// at top: 1rem inside the absolute-positioned action toolbar). 3.25rem
// is enough to land below the status text without being so tall it eats
// canvas space.
const CSS = `
/* Bar layout: two groups separated by an auto-margin spacer. Left is
 * status (toggle + cycle + rating), right is settings (sort + credits +
 * clear). On narrow widths the bar wraps but each group stays clustered
 * so it never feels like a random pile of controls.
 *
 * Heights: every interactive control is sized to 28px so they line up
 * on the same baseline. Doesn't matter how many or what kind — they
 * all read as one toolbar row. */
#${TOP_BAR_ID} {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 0.5rem;
  row-gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  margin: 3.25rem 0 0.6rem 0;
  border-radius: var(--bc-radius-lg);
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  font-family: inherit;
  color: var(--bc-color-text);
  font-size: 0.85rem;
  line-height: 1.2;
}

/* Hide native number-input spinner arrows on the bar's number inputs.
 * Combo of WebKit pseudo-elements + appearance:textfield covers Chrome,
 * Safari, and Firefox. */
#${TOP_BAR_ID} input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}

#${TOP_BAR_ID} input[type="number"]::-webkit-inner-spin-button,
#${TOP_BAR_ID} input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

/* Shared interactive surface: every input/select on the bar uses these
 * styles so they read as a coherent set in both light and dark modes.
 * Background uses --bc-color-bg-muted (always one tone darker than the
 * bar surface in either mode), so the controls feel inset. */
#${TOP_BAR_ID} .bc-paper-combos-input,
#${TOP_BAR_ID} .bc-paper-combos-sort-select {
  height: 1.75rem;
  padding: 0 0.45rem;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-sm);
  background: var(--bc-color-bg-muted);
  color: var(--bc-color-text);
  font: inherit;
  font-size: 0.8rem;
  line-height: 1;
  transition: border-color var(--bc-tx-fast) var(--bc-easing);
}

#${TOP_BAR_ID} .bc-paper-combos-input:hover,
#${TOP_BAR_ID} .bc-paper-combos-sort-select:hover {
  border-color: var(--bc-color-border-strong);
}

#${TOP_BAR_ID} .bc-paper-combos-input:focus-visible,
#${TOP_BAR_ID} .bc-paper-combos-sort-select:focus-visible {
  outline: none;
  border-color: var(--bc-color-accent);
  box-shadow: 0 0 0 2px var(--bc-color-accent-surface-soft);
}

/* Spacer pushes the right-side cluster (sort, credits, clear) to the
 * end of the bar — visually separates "what's showing" from "settings". */
#${TOP_BAR_ID} .bc-paper-combos-spacer {
  flex: 1 1 auto;
  min-width: 0;
}

/* Always-visible feature toggle pill. Its iOS-style track + thumb makes
 * the on/off state obvious from a glance, and it sits to the left of
 * everything else in the bar so it's the first thing users see. */
.${FEATURE_TOGGLE_CLASS} {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 1.75rem;
  padding: 0 0.65rem 0 0.35rem;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-bg-muted);
  color: var(--bc-color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: var(--bc-fw-medium);
  line-height: 1;
  transition: border-color var(--bc-tx-fast) var(--bc-easing),
              background var(--bc-tx-fast) var(--bc-easing);
}

.${FEATURE_TOGGLE_CLASS}:hover {
  border-color: var(--bc-color-border-strong);
  background: var(--bc-color-surface-hover);
}

.${FEATURE_TOGGLE_CLASS} .bc-paper-combos-toggle-track {
  position: relative;
  display: inline-block;
  width: 1.85rem;
  height: 1rem;
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-border);
  transition: background var(--bc-tx-fast) var(--bc-easing);
  flex-shrink: 0;
}

.${FEATURE_TOGGLE_CLASS} .bc-paper-combos-toggle-thumb {
  position: absolute;
  top: 0.1rem;
  left: 0.1rem;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: var(--bc-radius-circle);
  background: var(--bc-color-bg);
  box-shadow: var(--bc-shadow-button);
  transition: transform var(--bc-tx-base) var(--bc-easing);
}

.${FEATURE_TOGGLE_CLASS}[data-on="true"] .bc-paper-combos-toggle-track {
  background: var(--bc-color-accent);
}

.${FEATURE_TOGGLE_CLASS}[data-on="true"] .bc-paper-combos-toggle-thumb {
  transform: translateX(0.85rem);
}

.${FEATURE_TOGGLE_CLASS}[data-on="true"] {
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent);
}

#${TOP_BAR_ID} .bc-paper-combos-toggle-hint {
  color: var(--bc-color-text-muted);
  font-size: 0.78rem;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button {
  cursor: pointer;
  border: 1px solid var(--bc-color-border);
  background: var(--bc-color-bg-muted);
  border-radius: var(--bc-radius-sm);
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.85rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--bc-color-text);
  transition: border-color var(--bc-tx-fast) var(--bc-easing),
              background var(--bc-tx-fast) var(--bc-easing);
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button:not([disabled]):hover {
  border-color: var(--bc-color-border-strong);
  background: var(--bc-color-surface-hover);
}

#${TOP_BAR_ID} .bc-paper-combos-counter {
  font-variant-numeric: tabular-nums;
  font-weight: var(--bc-fw-semibold);
  min-width: 4rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--bc-color-text);
}

#${TOP_BAR_ID} .bc-paper-combos-rating {
  display: inline-flex;
  align-items: center;
  height: 1.75rem;
  padding: 0 0.5rem;
  background: var(--bc-color-bg-muted);
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-sm);
  font-weight: var(--bc-fw-semibold);
  font-size: 0.78rem;
  color: var(--bc-color-text-muted);
  font-variant-numeric: tabular-nums;
}

#${TOP_BAR_ID} .bc-paper-combos-rating[data-rated="0"] {
  opacity: 0.55;
}

/* Combined Credits range: a single pill with [min] – [max] inputs.
 * Reads as one logical control instead of two unrelated number boxes. */
#${TOP_BAR_ID} .bc-paper-combos-credits {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 1.75rem;
  padding: 0 0.5rem 0 0.55rem;
  background: var(--bc-color-bg-muted);
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-sm);
  transition: border-color var(--bc-tx-fast) var(--bc-easing);
}

#${TOP_BAR_ID} .bc-paper-combos-credits:hover {
  border-color: var(--bc-color-border-strong);
}

#${TOP_BAR_ID} .bc-paper-combos-credits:focus-within {
  border-color: var(--bc-color-accent);
  box-shadow: 0 0 0 2px var(--bc-color-accent-surface-soft);
}

#${TOP_BAR_ID} .bc-paper-combos-credits-pair {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: text;
}

#${TOP_BAR_ID} .bc-paper-combos-credits-label {
  font-size: 0.7rem;
  font-weight: var(--bc-fw-medium);
  color: var(--bc-color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--bc-ls-wide);
  user-select: none;
}

#${TOP_BAR_ID} .bc-paper-combos-credits input[type="number"] {
  width: 2.25rem;
  height: 1.25rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--bc-color-text);
  font: inherit;
  font-size: 0.82rem;
  font-weight: var(--bc-fw-semibold);
  font-variant-numeric: tabular-nums;
  text-align: center;
  outline: none;
}

#${TOP_BAR_ID} .bc-paper-combos-credits-sep {
  color: var(--bc-color-text-subtle);
  font-size: 0.85rem;
  user-select: none;
}

#${TOP_BAR_ID} .bc-paper-combos-sort {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

#${TOP_BAR_ID} .bc-paper-combos-sort > span:first-child,
#${TOP_BAR_ID} .bc-paper-combos-sort::before {
  font-size: 0.74rem;
  font-weight: var(--bc-fw-medium);
  color: var(--bc-color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--bc-ls-wide);
}

#${TOP_BAR_ID} .bc-paper-combos-sort-select {
  padding-right: 1.5rem;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position:
    calc(100% - 0.65rem) 50%,
    calc(100% - 0.4rem) 50%;
  background-size: 0.25rem 0.25rem, 0.25rem 0.25rem;
  background-repeat: no-repeat;
  background-color: var(--bc-color-bg-muted);
}

/* Native option dropdown: enforce token-based bg/text for browsers that
 * leak the bar's background (Firefox in particular). */
#${TOP_BAR_ID} .bc-paper-combos-sort-select option {
  background: var(--bc-color-bg);
  color: var(--bc-color-text);
}

#${TOP_BAR_ID} .bc-paper-combos-status {
  flex-basis: 100%;
  margin-top: 0.35rem;
  padding: 0.4rem 0.55rem;
  border-radius: var(--bc-radius-sm);
  background: var(--bc-color-bg-muted);
  border: 1px solid var(--bc-color-border-divider);
  color: var(--bc-color-text-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

[${ROOT_ATTR}] .schedule-grid-cols ${REAL_CARD_HIDE_SELECTOR} {
  display: none !important;
}

/* Drag preview while the user is creating a zone — semi-transparent
 * accent fill with a dashed border so it reads as "in progress" until
 * mouseup commits it. pointer-events:none so the mousemove handler
 * still gets coordinates from the underlying day column. Multi-day
 * previews stitch the same way committed zones do (no interior seams). */
.bc-paper-combos-zone-preview {
  background: var(--bc-color-accent-surface-soft);
  border: 1px dashed var(--bc-color-accent);
  border-radius: var(--bc-radius-sm);
  pointer-events: none;
  z-index: 11;
}

.bc-paper-combos-zone-preview[data-leftmost="false"] {
  border-left: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.bc-paper-combos-zone-preview[data-rightmost="false"] {
  border-right: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

/* Persisted zones: dimmer fill + diagonal stripes so they read as
 * "this time slot is off-limits" without competing with paper.nu's
 * actual class cards. Hover signals "click to remove" via a fade
 * overlay across the whole zone. */
.bc-paper-combos-zone {
  position: relative;
  background: var(--bc-color-accent-surface-soft);
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0,
    transparent 6px,
    var(--bc-color-accent-surface-tile) 6px,
    var(--bc-color-accent-surface-tile) 12px
  );
  border: 1px solid var(--bc-color-accent);
  border-radius: var(--bc-radius-sm);
  z-index: 11;
  cursor: pointer;
  padding: 4px 4px 4px 6px;
  font-size: 0.65rem;
  color: var(--bc-color-accent);
  font-weight: var(--bc-fw-semibold);
  overflow: hidden;
  transition: background var(--bc-tx-fast) var(--bc-easing);
}

/* Click-to-remove affordance: full-zone overlay that fades in on hover
 * with a "Click to remove" label. pointer-events:none so the click
 * still hits the underlying zone (which the drag handler already
 * routes to onZoneRemove). */
.bc-paper-combos-zone::after {
  content: "Click to remove";
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
  font-size: 0.7rem;
  font-weight: var(--bc-fw-bold);
  text-transform: uppercase;
  letter-spacing: var(--bc-ls-wide);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--bc-tx-fast) var(--bc-easing);
}

.bc-paper-combos-zone:hover::after {
  opacity: 0.92;
}

/* Multi-day zones render as one segment per day. The leftmost/rightmost
 * data attrs let us drop the seam borders + radii so a 3-day zone reads
 * as a single rounded rectangle spanning Mon-Wed. */
.bc-paper-combos-zone[data-leftmost="false"] {
  border-left: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.bc-paper-combos-zone[data-rightmost="false"] {
  border-right: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.bc-paper-combos-zone-label {
  pointer-events: none;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 22px; /* leave room for the X button at top-right */
}

/* X button: two crossed pseudo-element bars instead of the × glyph.
 * The glyph version had visible vertical drift in most fonts (× sits
 * slightly above the baseline) and looked off-center in a 16px circle.
 * Pseudo-bars are pixel-precise: each is a 1.5px-tall rod centered on
 * the button's geometric middle and rotated ±45°. */
.bc-paper-combos-zone-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 12;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: var(--bc-radius-circle);
  background: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
  cursor: pointer;
  font-size: 0;
  line-height: 0;
}

.bc-paper-combos-zone-remove::before,
.bc-paper-combos-zone-remove::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 1.5px;
  background: currentColor;
  border-radius: 1px;
}

.bc-paper-combos-zone-remove::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.bc-paper-combos-zone-remove::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.bc-paper-combos-zone-remove:hover {
  background: var(--bc-color-accent-hover);
}

/* Empty space inside a day column is dragable — show a crosshair so the
 * affordance reads. Off the schedule cards themselves, the cursor stays
 * pointer (paper.nu's existing behavior). Only takes effect while the
 * feature is active so the off-state is undisturbed. */
[${ROOT_ATTR}] .schedule-grid-cols > div:not(:first-child) {
  cursor: crosshair;
}

[${ROOT_ATTR}] .schedule-grid-cols > div:not(:first-child) div.absolute.z-10.rounded-lg {
  cursor: pointer;
}

#${TOP_BAR_ID} .bc-paper-combos-clear-zones {
  cursor: pointer;
  height: 1.75rem;
  padding: 0 0.6rem;
  border: 1px solid var(--bc-color-accent);
  background: var(--bc-color-accent-surface-soft);
  color: var(--bc-color-accent);
  border-radius: var(--bc-radius-sm);
  font: inherit;
  font-size: 0.78rem;
  font-weight: var(--bc-fw-semibold);
  line-height: 1;
}

#${TOP_BAR_ID} .bc-paper-combos-clear-zones:hover {
  background: var(--bc-color-accent-surface-tile);
}

#${TOP_BAR_ID} .bc-paper-combos-status {
  flex-basis: 100%;
}

/* Pin button: direct child of the card, sibling of paper-ctec's
 * analytics-anchor. Sits just above the analytics pill in the bottom
 * right so the user always finds it in the same spot relative to the
 * other action affordance. Always full opacity so it's discoverable
 * without hovering — pin state is visually obvious from the bg + border. */
.${CARD_PIN_BUTTON_CLASS} {
  position: absolute;
  bottom: 14px;
  right: 6px;
  z-index: 13;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-bg);
  color: var(--bc-color-text);
  font-size: 11px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--bc-shadow-button);
  pointer-events: auto;
  transition: background var(--bc-tx-fast) var(--bc-easing),
              border-color var(--bc-tx-fast) var(--bc-easing),
              transform var(--bc-tx-fast) var(--bc-easing);
}

.${CARD_PIN_BUTTON_CLASS}:hover {
  background: var(--bc-color-surface-hover);
  border-color: var(--bc-color-border-strong);
  transform: scale(1.08);
}

.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"] {
  background: var(--bc-color-accent);
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
}

.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"]:hover {
  background: var(--bc-color-accent-hover);
  border-color: var(--bc-color-accent-hover);
}
`;

export function injectCombosStyles(doc: Document = document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}
