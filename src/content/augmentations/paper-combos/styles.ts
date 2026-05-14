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

const CSS = `
/* Bar layout: lives inside paper.nu's action toolbar (the row holding
 * Custom / Export / Clear), in the same flex slot the paper-ctec
 * status bar uses. flex: 1 1 auto absorbs the slack between the
 * (hidden) status bar and the action buttons, mirroring how the
 * status bar normally sizes itself. position: relative so the kebab
 * popover can anchor to the bar. flex-wrap stays off — at narrow
 * widths the secondary controls collapse into a popover instead of
 * wrapping to a second line. */
#${TOP_BAR_ID} {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  column-gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-radius: var(--bc-radius-md);
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  font-family: inherit;
  color: var(--bc-color-text);
  font-size: 0.8rem;
  line-height: 1.2;
}

/* Hide the paper-ctec status bar whenever our combos bar shares the
 * same action toolbar. Combos visually replaces "Loading CTECs into
 * Paper · X/Y…" — chips on each card still surface per-section CTEC
 * progress, so no signal is lost. Both directions of sibling order are
 * covered so the rule is robust to either bar mounting first. */
#bc-paper-ctec-status-bar:has(~ #${TOP_BAR_ID}),
#${TOP_BAR_ID} ~ #bc-paper-ctec-status-bar {
  display: none !important;
}

/* Kebab menu button — hidden at wide widths, surfaces below 1450px
 * once at least one secondary control collapses into the popover. */
#${TOP_BAR_ID} .bc-paper-combos-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  height: 1.75rem;
  width: 1.75rem;
  padding: 0;
  border: 1px solid var(--bc-color-border);
  background: var(--bc-color-bg-muted);
  color: var(--bc-color-text);
  border-radius: var(--bc-radius-sm);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color var(--bc-tx-fast) var(--bc-easing),
              background var(--bc-tx-fast) var(--bc-easing);
}

#${TOP_BAR_ID} .bc-paper-combos-menu-btn:hover {
  border-color: var(--bc-color-border-strong);
  background: var(--bc-color-surface-hover);
}

#${TOP_BAR_ID}[data-menu-open="true"] .bc-paper-combos-menu-btn {
  border-color: var(--bc-color-accent);
  background: var(--bc-color-accent-surface-soft);
  color: var(--bc-color-accent);
}

/* Two-tier collapse:
 *   wide (>1450)         — both copies inline, popover hidden
 *   medium (1151-1450)   — credits goes to popover, sort stays inline
 *   narrow (<=1150)      — both go to popover
 *
 * Each control has two copies in the DOM stamped data-bc-position=
 * "inline" / "popover". By default the inline copy displays and the
 * popover copy is hidden; the media queries flip those at the right
 * widths. */
#${TOP_BAR_ID} .bc-paper-combos-sort[data-bc-position="popover"],
#${TOP_BAR_ID} .bc-paper-combos-credits[data-bc-position="popover"] {
  display: none;
}

/* Popover container holds the popover copies; absolutely positioned
 * under the kebab. Hidden until the menu opens. */
#${TOP_BAR_ID} .bc-paper-combos-popover {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  padding: 0.65rem;
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-md);
  box-shadow: var(--bc-shadow-tooltip);
  z-index: 20;
  min-width: 14rem;
}

#${TOP_BAR_ID} .bc-paper-combos-popover > * {
  width: 100%;
  justify-content: space-between;
}

#${TOP_BAR_ID} .bc-paper-combos-popover .bc-paper-combos-sort-select {
  flex: 1 1 auto;
  min-width: 0;
}

/* Medium: credits collapses, kebab visible. */
@media (max-width: 1450px) {
  #${TOP_BAR_ID} .bc-paper-combos-menu-btn {
    display: inline-flex;
  }
  #${TOP_BAR_ID} .bc-paper-combos-credits[data-bc-position="inline"] {
    display: none;
  }
  #${TOP_BAR_ID} .bc-paper-combos-credits[data-bc-position="popover"] {
    display: inline-flex;
  }
  #${TOP_BAR_ID}[data-menu-open="true"] .bc-paper-combos-popover {
    display: flex;
  }
}

/* Narrow: also sort collapses. */
@media (max-width: 1150px) {
  #${TOP_BAR_ID} .bc-paper-combos-sort[data-bc-position="inline"] {
    display: none;
  }
  #${TOP_BAR_ID} .bc-paper-combos-sort[data-bc-position="popover"] {
    display: inline-flex;
  }
}

/* Very narrow viewports: also drop the toggle's "Combinations" label
 * so toggle + cycle + rating + kebab still fit on one line. */
@media (max-width: 700px) {
  #${TOP_BAR_ID} .bc-paper-combos-toggle-label {
    display: none;
  }
  .${FEATURE_TOGGLE_CLASS} {
    padding: 0 0.35rem;
  }
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
 * everything else in the bar so it's the first thing users see. The
 * resting state wears an accent-colored outline so it reads as a call-
 * to-action — most users arrive with the feature off, and the outline
 * draws the eye without implying any state has changed. */
.${FEATURE_TOGGLE_CLASS} {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 1.85rem;
  padding: 0 0.7rem 0 0.4rem;
  border: 1.5px solid var(--bc-color-accent);
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-accent-surface-soft);
  color: var(--bc-color-accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: var(--bc-fw-semibold);
  line-height: 1;
  transition: border-color var(--bc-tx-fast) var(--bc-easing),
              background var(--bc-tx-fast) var(--bc-easing),
              box-shadow var(--bc-tx-fast) var(--bc-easing);
}

.${FEATURE_TOGGLE_CLASS}:hover {
  border-color: var(--bc-color-accent-hover);
  box-shadow: 0 0 0 3px var(--bc-color-accent-surface-soft);
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

/* Out-of-class hours chip: lives in paper.nu's top sticky header, NOT
 * the combos bar. Mounts as the first child of the header so it anchors
 * to the left edge while paper.nu's existing About / Map / Notes /
 * Share / Settings cluster and user pill stay on the right.
 *
 * margin-right:auto is the trick that holds the left anchor across all
 * three of paper.nu's header layouts:
 *
 *   lg (≥1024px): header is flex-row with justify-end. Without the auto
 *     margin, the chip would pile up at the right with everything else.
 *     The auto margin absorbs the free space to the chip's right,
 *     pushing the rest of the items to the right edge while the chip
 *     stays at the left.
 *   md (768-1023px): header is flex-row with justify-center. The auto
 *     margin again absorbs free space and pushes the right cluster to
 *     the right edge. Chip stays anchored left.
 *   <md: header is flex-col. margin-right:auto is a no-op in vertical
 *     flex, so the chip just sits as the first stacked item above the
 *     buttons. Fine — still "at the top, prominent."
 *
 * Visual: neutral muted pill, no accent (informational, not a control).
 * Tabular numerals keep the value steady as combos cycle. data-coverage
 * dims the chip in the partial / none states so the eye isn't drawn to
 * a number that's part-imputed or absent. */
.bc-paper-combos-hours {
  position: relative;
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  max-width: 100%;
  margin-right: auto;
  padding: 0.2rem 0.65rem;
  background: var(--bc-color-bg-inset);
  border: 1px solid var(--bc-color-border-strong);
  border-radius: var(--bc-radius-pill);
  font-family: inherit;
  font-size: 0.72rem;
  line-height: 1.2;
  color: var(--bc-color-text-muted);
  white-space: nowrap;
  cursor: default;
  transition: opacity var(--bc-tx-fast) var(--bc-easing),
              border-color var(--bc-tx-fast) var(--bc-easing);
}

.bc-paper-combos-hours:hover {
  border-color: var(--bc-color-border-strong);
}

.bc-paper-combos-hours-label {
  font-size: 0.62rem;
  font-weight: var(--bc-fw-semibold);
  text-transform: uppercase;
  letter-spacing: var(--bc-ls-wide);
  color: var(--bc-color-text-subtle);
}

.bc-paper-combos-hours-value {
  font-weight: var(--bc-fw-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--bc-color-text);
}

.bc-paper-combos-hours[data-coverage="partial"] {
  opacity: 0.85;
}

.bc-paper-combos-hours[data-coverage="none"] {
  opacity: 0.6;
}

@media (max-width: 700px) {
  .bc-paper-combos-hours-label {
    display: none;
  }
}

/* Custom hover popup — instant show/hide via pure CSS, no browser
 * native-tooltip delay. Two-layer structure:
 *   .bc-paper-combos-hours-tip   — invisible positioning wrapper. Sits
 *     directly below the chip (top:100%) with no actual gap, so moving
 *     the cursor from the chip down INTO the card never crosses an
 *     unhovered zone. padding-top inside this wrapper creates the
 *     visual breathing room while keeping the hover surface continuous.
 *   .bc-paper-combos-hours-tip-card — the visible box (background,
 *     border, shadow). Lives inside the wrapper so the wrapper's
 *     transparent padding-top hover zone connects the chip and card.
 * Tokens: --bc-color-bg + --bc-color-border-strong + --bc-shadow-tooltip
 * match the popover used by the kebab menu (#${TOP_BAR_ID} .bc-paper-
 * combos-popover above), so the surface reads as one design family. */
.bc-paper-combos-hours-tip {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 50;
  padding-top: 8px;
  cursor: default;
}

.bc-paper-combos-hours:hover .bc-paper-combos-hours-tip,
.bc-paper-combos-hours:focus-within .bc-paper-combos-hours-tip {
  display: block;
}

.bc-paper-combos-hours-tip-card {
  min-width: 16rem;
  max-width: 22rem;
  padding: 0.75rem 0.85rem;
  /* Solid surface — paper.nu's page is pure white, so the default
   * Pencil cream --bc-color-bg reads as a tint rather than a distinct
   * popup. --bc-color-bg-inset is the next step up in saturation and
   * gives the card a clear edge against the page in both light/dark. */
  background: var(--bc-color-bg-inset);
  border: 2px solid var(--bc-color-text);
  border-radius: var(--bc-radius-md);
  box-shadow: var(--bc-shadow-tooltip);
  color: var(--bc-color-text);
  font-size: 0.78rem;
  line-height: 1.35;
  white-space: normal;
}

.bc-paper-combos-hours-tip-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.2rem;
}

.bc-paper-combos-hours-tip-title {
  font-size: 0.66rem;
  font-weight: var(--bc-fw-semibold);
  text-transform: uppercase;
  letter-spacing: var(--bc-ls-wide);
  color: var(--bc-color-text-subtle);
}

.bc-paper-combos-hours-tip-headline {
  font-size: 0.95rem;
  font-weight: var(--bc-fw-bold);
  font-variant-numeric: tabular-nums;
  color: var(--bc-color-accent);
}

.bc-paper-combos-hours-tip-sub {
  color: var(--bc-color-text-muted);
  font-size: 0.72rem;
  margin-bottom: 0.55rem;
}

.bc-paper-combos-hours-tip-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.bc-paper-combos-hours-tip-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: 0.75rem;
}

.bc-paper-combos-hours-tip-row-label {
  color: var(--bc-color-text);
  font-weight: var(--bc-fw-medium);
}

.bc-paper-combos-hours-tip-row-value {
  color: var(--bc-color-text-muted);
  font-variant-numeric: tabular-nums;
}

.bc-paper-combos-hours-tip-divider {
  height: 1px;
  background: var(--bc-color-border-divider);
  margin: 0.6rem 0;
}

.bc-paper-combos-hours-tip-formula-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: 0.75rem;
  font-weight: var(--bc-fw-medium);
}

.bc-paper-combos-hours-tip-formula-value {
  color: var(--bc-color-accent);
  font-variant-numeric: tabular-nums;
  font-weight: var(--bc-fw-semibold);
}

.bc-paper-combos-hours-tip-formula-note {
  color: var(--bc-color-text-subtle);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  margin-top: 0.15rem;
}

/* Cycle cluster: wrap prev/counter/next in a single bordered pill so
 * the centered "X / Y" reads as the bar's primary readout. Sits in
 * the visual middle of the bar (flex spacers on both sides push it
 * there) so the user's eye lands on the current-combo count before
 * anything else. */
#${TOP_BAR_ID} .bc-paper-combos-cycle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.3rem;
  border: 1px solid var(--bc-color-border-strong);
  background: var(--bc-color-bg);
  border-radius: var(--bc-radius-pill);
  box-shadow: var(--bc-shadow-button);
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button {
  cursor: pointer;
  border: none;
  background: transparent;
  border-radius: var(--bc-radius-circle);
  width: 1.6rem;
  height: 1.6rem;
  font-size: 0.95rem;
  font-weight: var(--bc-fw-semibold);
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--bc-color-accent);
  transition: background var(--bc-tx-fast) var(--bc-easing),
              color var(--bc-tx-fast) var(--bc-easing);
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button:not([disabled]):hover {
  background: var(--bc-color-accent-surface-soft);
}

#${TOP_BAR_ID} .bc-paper-combos-counter {
  font-variant-numeric: tabular-nums;
  font-weight: var(--bc-fw-bold);
  min-width: 4.5rem;
  text-align: center;
  font-size: 1rem;
  color: var(--bc-color-accent);
  padding: 0 0.35rem;
  letter-spacing: 0.01em;
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

#${TOP_BAR_ID} .bc-paper-combos-credits-heading {
  font-size: 0.7rem;
  font-weight: var(--bc-fw-semibold);
  color: var(--bc-color-text);
  text-transform: uppercase;
  letter-spacing: var(--bc-ls-wide);
  user-select: none;
  margin-right: 0.15rem;
}

#${TOP_BAR_ID} .bc-paper-combos-credits-pair {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
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
 * overlay across the whole zone (synced across segments of the same
 * multi-day zone — see [data-zone-hover] rule below). */
.bc-paper-combos-zone {
  position: relative;
  background-color: var(--bc-color-accent-surface-soft);
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0,
    transparent 6px,
    var(--bc-color-accent-surface-tile) 6px,
    var(--bc-color-accent-surface-tile) 12px
  );
  /* Anchor the stripe pattern to the viewport so adjacent segments of
   * a multi-day zone show stripes from the same global pattern — the
   * diagonal lines flow continuously across the day-column seam
   * instead of restarting at each segment's own origin. */
  background-attachment: fixed;
  border: 1px solid var(--bc-color-accent);
  border-radius: var(--bc-radius-sm);
  z-index: 11;
  cursor: pointer;
  padding: 4px 4px 4px 6px;
  font-size: 0.65rem;
  color: var(--bc-color-accent);
  font-weight: var(--bc-fw-semibold);
  overflow: hidden;
  transition: background var(--bc-tx-fast) var(--bc-easing),
              border-color var(--bc-tx-fast) var(--bc-easing);
}

/* Cursor override: paper.nu's day columns get cursor:crosshair (for
 * drawing new zones), and that rule has higher specificity than
 * .bc-paper-combos-zone alone. Re-assert pointer at matching
 * specificity so hovering an existing zone reads as "this is
 * clickable to remove" instead of "draw another one here". */
[${ROOT_ATTR}] .schedule-grid-cols .bc-paper-combos-zone {
  cursor: pointer;
}

/* Hover state — two parallel triggers:
 *   :hover         — single-segment zones, no JS coordination needed.
 *   [data-zone-hover="true"] — JS-driven, synced across every segment
 *                              of a multi-day zone (mouseover handler
 *                              in attachZoneDragHandlers), so hovering
 *                              Tu lights up We too.
 *
 * Visual: stripes get replaced with a solid accent fill, border bumps
 * to accent-hover, and the time label inverts color. Solid fill is
 * the simplest unmistakable signal that a click here will do
 * something — no pseudo-element overlays (which kept failing to
 * render against the fixed-attachment striped parent). */
.bc-paper-combos-zone:hover,
.bc-paper-combos-zone[data-zone-hover="true"] {
  background-image: none;
  background-color: var(--bc-color-accent);
  border-color: var(--bc-color-accent-hover);
  color: var(--bc-color-accent-on);
}

.bc-paper-combos-zone:hover .bc-paper-combos-zone-label,
.bc-paper-combos-zone[data-zone-hover="true"] .bc-paper-combos-zone-label {
  color: var(--bc-color-accent-on);
}

/* X button keeps its accent bg, but on hover the zone bg now matches
 * (both are accent), so the button visually disappears. Flip its
 * fill to accent-on so it stays distinct against the solid hover
 * surface. */
.bc-paper-combos-zone:hover .bc-paper-combos-zone-remove,
.bc-paper-combos-zone[data-zone-hover="true"] .bc-paper-combos-zone-remove {
  background: var(--bc-color-accent-on);
  color: var(--bc-color-accent);
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
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}

.bc-paper-combos-zone[data-rightmost="true"] .bc-paper-combos-zone-label {
  /* Reserve space for the X button at top-right so the label doesn't
   * collide with it. Non-rightmost segments don't render the X, so
   * they let the label fill the full width. */
  padding-right: 22px;
}

.bc-paper-combos-zone-label-primary,
.bc-paper-combos-zone-label-hint {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bc-paper-combos-zone-label-primary {
  font-size: 0.65rem;
  font-weight: var(--bc-fw-semibold);
}

.bc-paper-combos-zone-label-hint {
  font-size: 0.6rem;
  font-weight: var(--bc-fw-regular);
  font-style: italic;
  opacity: 0.7;
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

/* Unpinned hover: preview the pinned look (accent fill + inverse
 * icon) so the user gets a clear "click does this" cue. The 1.18×
 * scale plus the heavier shadow make the affordance unmistakable
 * against colorful class cards where a subtle bg shift gets lost. */
.${CARD_PIN_BUTTON_CLASS}:hover {
  background: var(--bc-color-accent);
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
  transform: scale(1.18);
  box-shadow: var(--bc-shadow-button-hover);
}

.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"] {
  background: var(--bc-color-accent);
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
}

/* Pinned hover: bump to accent-hover and add the same scale/shadow,
 * so the gesture reads as "active state, ready to unpin" rather than
 * blending in with the resting pinned look. */
.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"]:hover {
  background: var(--bc-color-accent-hover);
  border-color: var(--bc-color-accent-hover);
  transform: scale(1.18);
  box-shadow: var(--bc-shadow-button-hover);
}
`;

export function injectCombosStyles(doc: Document = document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}
