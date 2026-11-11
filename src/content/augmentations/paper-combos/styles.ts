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
/* The bar lives inside paper.nu's action toolbar (the row holding
 * Custom / Export / Clear), in the same flex slot the paper-ctec status
 * line uses. It has no box of its own: the controls sit straight on the
 * page, quiet until hovered, and the selected state is ink. flex: 1 1
 * auto absorbs the slack before the action buttons. position: relative
 * so the kebab popover can anchor to the bar. flex-wrap stays off — at
 * narrow widths the secondary controls collapse into a popover instead
 * of wrapping to a second line. */
#${TOP_BAR_ID} {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 28px;
  box-sizing: border-box;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  column-gap: 6px;
  padding: 0 8px 0 0;
  font-family: var(--bc-font-body);
  font-size: 12.5px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--bc-color-text-soft);
}

#${TOP_BAR_ID} .bc-ui-icon {
  flex: 0 0 auto;
  display: block;
}

/* Hide the paper-ctec status line whenever our combos bar shares the
 * same action toolbar. Chips on each card still surface per-section CTEC
 * progress, so no signal is lost. Both directions of sibling order are
 * covered so the rule is robust to either bar mounting first. */
#bc-paper-ctec-status-bar:has(~ #${TOP_BAR_ID}),
#${TOP_BAR_ID} ~ #bc-paper-ctec-status-bar {
  display: none !important;
}

/* Every control on the bar: a 28px text button with a 7px radius and a
 * panel-coloured hover. */
#${TOP_BAR_ID} .bc-paper-combos-menu-btn,
#${TOP_BAR_ID} .bc-paper-combos-cycle button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--bc-color-text-soft);
  cursor: pointer;
  transition: background var(--bc-tx-fast) var(--bc-easing),
              color var(--bc-tx-fast) var(--bc-easing);
}

#${TOP_BAR_ID} .bc-paper-combos-menu-btn:hover,
#${TOP_BAR_ID} .bc-paper-combos-cycle button:not([disabled]):hover {
  background: var(--bc-color-surface-hover-strong);
  color: var(--bc-color-text-strong);
}

#${TOP_BAR_ID} button:focus-visible,
#${TOP_BAR_ID} input:focus-visible,
#${TOP_BAR_ID} select:focus-visible,
.${FEATURE_TOGGLE_CLASS}:focus-visible {
  outline: 2px solid var(--bc-color-accent);
  outline-offset: 1px;
}

/* Kebab menu button — hidden at wide widths, surfaces below 1450px
 * once at least one secondary control collapses into the popover. */
#${TOP_BAR_ID} .bc-paper-combos-menu-btn {
  display: none;
}

#${TOP_BAR_ID}[data-menu-open="true"] .bc-paper-combos-menu-btn {
  background: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
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
  gap: 2px;
  padding: 6px 8px 6px 12px;
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-xl);
  box-shadow: var(--bc-shadow-tooltip);
  z-index: 20;
  min-width: 232px;
}

#${TOP_BAR_ID} .bc-paper-combos-popover > * {
  width: 100%;
  justify-content: space-between;
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
 * and the rating's caption so toggle + cycle + rating + kebab still fit
 * on one line. */
@media (max-width: 700px) {
  #${TOP_BAR_ID} .bc-paper-combos-toggle-label,
  #${TOP_BAR_ID} .bc-paper-combos-rating-unit {
    display: none;
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

/* Two flex spacers centre the cycle + rating cluster between the toggle
 * and the settings on the right. */
#${TOP_BAR_ID} .bc-paper-combos-spacer {
  flex: 1 1 auto;
  min-width: 0;
}

/* Always-visible feature switch: a small track and the word. No outline
 * or tint; the track going ink is the whole "on" signal. */
.${FEATURE_TOGGLE_CLASS} {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 9px 0 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--bc-color-text-strong);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: var(--bc-fw-medium);
  line-height: 1;
  transition: background var(--bc-tx-fast) var(--bc-easing);
}

.${FEATURE_TOGGLE_CLASS}:hover {
  background: var(--bc-color-surface-hover-strong);
}

.${FEATURE_TOGGLE_CLASS} .bc-paper-combos-toggle-track {
  position: relative;
  display: inline-block;
  width: 26px;
  height: 16px;
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-border-strong);
  transition: background var(--bc-tx-fast) var(--bc-easing);
  flex-shrink: 0;
}

.${FEATURE_TOGGLE_CLASS} .bc-paper-combos-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: var(--bc-radius-circle);
  background: var(--bc-color-bg);
  transition: transform var(--bc-tx-base) var(--bc-easing);
}

.${FEATURE_TOGGLE_CLASS}[data-on="true"] .bc-paper-combos-toggle-track {
  background: var(--bc-color-accent);
}

.${FEATURE_TOGGLE_CLASS}[data-on="true"] .bc-paper-combos-toggle-thumb {
  transform: translateX(10px);
}

#${TOP_BAR_ID} .bc-paper-combos-toggle-hint {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--bc-color-text-muted);
  font-size: var(--bc-font-12);
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
 * Visual: a 26px panel-coloured pill with no border (informational, not
 * a control). The number leads, in ink; the caption follows. */
.bc-paper-combos-hours {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  height: 26px;
  box-sizing: border-box;
  margin-right: auto;
  padding: 0 11px;
  background: var(--bc-color-surface-hover);
  border-radius: 13px;
  font-family: var(--bc-font-body);
  font-size: 12.5px;
  line-height: 1;
  color: var(--bc-color-text-muted);
  white-space: nowrap;
  cursor: default;
}

.bc-paper-combos-hours-label {
  color: var(--bc-color-text-muted);
}

.bc-paper-combos-hours-value {
  font-weight: var(--bc-fw-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--bc-color-text-strong);
}

/* Coverage states — DO NOT use the opacity property here. The popup
 * (.bc-paper-combos-hours-tip-card) is a descendant of the chip, and
 * CSS opacity propagates to descendants, so dimming the chip would
 * also dim the popup card. Use color tokens instead. */
.bc-paper-combos-hours[data-coverage="none"] .bc-paper-combos-hours-value {
  font-weight: var(--bc-fw-regular);
  color: var(--bc-color-text-muted);
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
 *   .bc-paper-combos-hours-tip-card — the visible surface. */
.bc-paper-combos-hours-tip,
.bc-paper-combos-rating-tip {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 50;
  padding-top: 6px;
  cursor: default;
}

.bc-paper-combos-hours:hover .bc-paper-combos-hours-tip,
.bc-paper-combos-hours:focus-within .bc-paper-combos-hours-tip {
  display: block;
}

/* Keep the popup open while the user is highlighting text inside it.
 * Without this rule, dragging across a row boundary briefly leaves the
 * chip's :hover surface and the popup snaps closed, killing the
 * selection. :has(::selection) holds the popup open for the lifetime of
 * the selection. */
.bc-paper-combos-hours:has(.bc-paper-combos-hours-tip-card ::selection)
  .bc-paper-combos-hours-tip {
  display: block;
}

/* One popup surface for both hover cards: white, hairline edge, soft
 * shadow. Sections inside are split by hairlines, never boxed.
 * paper.nu's header carries user-select:none on its button cluster and
 * the property inherits into the chip's subtree, so force selection
 * back on for the card's contents. */
.bc-paper-combos-hours-tip-card,
.bc-paper-combos-rating-tip-card {
  box-sizing: border-box;
  padding: 12px 14px;
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-xl);
  box-shadow: var(--bc-shadow-tooltip);
  color: var(--bc-color-text);
  font-family: var(--bc-font-body);
  font-size: var(--bc-font-13);
  font-weight: var(--bc-fw-regular);
  line-height: 1.45;
  white-space: normal;
  text-align: left;
  user-select: text;
  -webkit-user-select: text;
}

.bc-paper-combos-hours-tip-card {
  width: 288px;
}

.bc-paper-combos-rating-tip-card {
  width: 264px;
}

.bc-paper-combos-hours-tip-card ::selection,
.bc-paper-combos-rating-tip-card ::selection {
  background: var(--bc-color-highlight);
  color: var(--bc-color-highlight-text);
}

.bc-paper-combos-hours-tip-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.bc-paper-combos-hours-tip-title,
.bc-paper-combos-rating-tip-title {
  display: block;
  font-size: var(--bc-font-13);
  font-weight: var(--bc-fw-semibold);
  color: var(--bc-color-text-strong);
}

.bc-paper-combos-hours-tip-headline {
  font-size: var(--bc-font-13);
  font-weight: var(--bc-fw-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--bc-color-text-strong);
}

.bc-paper-combos-hours-tip-sub {
  margin-top: 2px;
  color: var(--bc-color-text-muted);
  font-size: var(--bc-font-12);
}

.bc-paper-combos-hours-tip-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.bc-paper-combos-hours-tip-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: var(--bc-font-13);
}

.bc-paper-combos-hours-tip-row-label {
  color: var(--bc-color-text);
}

.bc-paper-combos-hours-tip-row-value {
  color: var(--bc-color-text-strong);
  font-variant-numeric: tabular-nums;
}

/* Estimated rows: same layout as the known rows, in quieter ink, to
 * flag "this isn't a CTEC number, it's the average". */
.bc-paper-combos-hours-tip-row--estimated .bc-paper-combos-hours-tip-row-label,
.bc-paper-combos-hours-tip-row--estimated .bc-paper-combos-hours-tip-row-value {
  color: var(--bc-color-text-muted);
}

.bc-paper-combos-hours-tip-subhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
  font-size: var(--bc-font-12);
  color: var(--bc-color-text-muted);
}

.bc-paper-combos-hours-tip-divider {
  height: 1px;
  background: var(--bc-color-border-divider);
  margin: 10px 0;
}

.bc-paper-combos-hours-tip-formula-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: var(--bc-font-13);
}

.bc-paper-combos-hours-tip-formula-value {
  color: var(--bc-color-text-strong);
  font-variant-numeric: tabular-nums;
}

.bc-paper-combos-hours-tip-formula-note {
  color: var(--bc-color-text-muted);
  font-size: var(--bc-font-12);
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}

.bc-paper-combos-rating-tip-body {
  margin-top: 2px;
  color: var(--bc-color-text-soft);
  font-variant-numeric: normal;
}

/* Cycle cluster: previous, "3 of 16", next. Sits in the visual middle
 * of the bar (flex spacers on both sides push it there). */
#${TOP_BAR_ID} .bc-paper-combos-cycle {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

#${TOP_BAR_ID} .bc-paper-combos-counter {
  min-width: 58px;
  padding: 0 2px;
  text-align: center;
  font-size: var(--bc-font-13);
  font-weight: var(--bc-fw-semibold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--bc-color-text-strong);
  /* The counter text is padded with leading spaces in renderTopBar so
   * "1 of 100" and "100 of 100" line up to the same character count.
   * white-space:pre preserves those spaces; without it the browser
   * collapses them and the counter shrinks/grows as the user cycles. */
  white-space: pre;
}

/* Rating readout: the number in its rating colour, then a caption.
 * nowrap keeps it on one line at narrow widths. */
#${TOP_BAR_ID} .bc-paper-combos-rating {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  margin-left: 6px;
  color: var(--bc-color-text-muted);
  font-size: 12.5px;
  white-space: nowrap;
  cursor: default;
}

/* Fixed width so the readout never resizes between a number and the
 * "no data" dash, which would shift the centred cluster sideways. */
#${TOP_BAR_ID} .bc-paper-combos-rating-value {
  display: inline-block;
  width: 40px;
  height: 20px;
  border-radius: 6px;
  line-height: 20px;
  text-align: center;
  font-weight: var(--bc-fw-semibold);
  font-variant-numeric: tabular-nums;
  background: var(--bc-combos-rating-bg, var(--bc-color-surface-hover-strong));
  color: var(--bc-combos-rating-fg, var(--bc-color-text-muted));
}

[data-bc-mode="dark"] #${TOP_BAR_ID} .bc-paper-combos-rating-value {
  background: var(--bc-combos-rating-bg-dark, var(--bc-color-surface-hover-strong));
  color: var(--bc-combos-rating-fg-dark, var(--bc-color-text-muted));
}

#${TOP_BAR_ID} .bc-paper-combos-rating:hover .bc-paper-combos-rating-tip,
#${TOP_BAR_ID} .bc-paper-combos-rating:focus-within .bc-paper-combos-rating-tip {
  display: block;
}

/* Split into its own rule: regular selector lists aren't forgiving,
 * so if the browser refuses ::selection inside :has() the entire
 * comma list above would be dropped — including the basic :hover
 * trigger. Keep them apart so hover always works even if the
 * keep-open-while-selecting rule turns out to be unsupported. */
#${TOP_BAR_ID} .bc-paper-combos-rating:has(.bc-paper-combos-rating-tip-card ::selection)
  .bc-paper-combos-rating-tip {
  display: block;
}

/* Credits range: the word, then two small fields. The fields are the
 * only filled things, so they read as editable. */
#${TOP_BAR_ID} .bc-paper-combos-credits {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  margin-left: 6px;
}

#${TOP_BAR_ID} .bc-paper-combos-credits-heading,
#${TOP_BAR_ID} .bc-paper-combos-sort > span:first-child {
  color: var(--bc-color-text-muted);
  font-size: 12.5px;
  user-select: none;
}

#${TOP_BAR_ID} .bc-paper-combos-credits input[type="number"] {
  width: 34px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: var(--bc-color-surface-hover-strong);
  color: var(--bc-color-text-strong);
  font: inherit;
  font-size: 12.5px;
  font-weight: var(--bc-fw-semibold);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

#${TOP_BAR_ID} .bc-paper-combos-credits-sep {
  color: var(--bc-color-text-muted);
  user-select: none;
}

#${TOP_BAR_ID} .bc-paper-combos-sort {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* Sort select wraps a span overlay so the closed-state display can use
 * the short label (parenthetical stripped) while the open dropdown
 * still shows the full label on each option. The native select is
 * stretched invisibly over the overlay, so the control sizes to the
 * short label and still opens the OS menu on click. */
#${TOP_BAR_ID} .bc-paper-combos-sort-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 7px 0 8px;
  border-radius: 7px;
  color: var(--bc-color-text-strong);
  transition: background var(--bc-tx-fast) var(--bc-easing);
}

#${TOP_BAR_ID} .bc-paper-combos-sort-wrap:hover,
#${TOP_BAR_ID} .bc-paper-combos-sort-wrap:focus-within {
  background: var(--bc-color-surface-hover-strong);
}

#${TOP_BAR_ID} .bc-paper-combos-sort-wrap .bc-ui-icon {
  color: var(--bc-color-text-muted);
  pointer-events: none;
}

#${TOP_BAR_ID} .bc-paper-combos-sort-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  color: transparent;
  font: inherit;
  cursor: pointer;
}

#${TOP_BAR_ID} .bc-paper-combos-sort-display {
  pointer-events: none;
  font-size: 12.5px;
  font-weight: var(--bc-fw-medium);
  line-height: 1;
  white-space: nowrap;
}

/* Native option dropdown: enforce token-based bg/text for browsers that
 * leak the bar's background (Firefox in particular). */
#${TOP_BAR_ID} .bc-paper-combos-sort-select option {
  background: var(--bc-color-bg);
  color: var(--bc-color-text);
}

/* Status: one plain line right after the switch, in the slot the left
 * spacer normally fills. It truncates; the full sentence is its title. */
.${FEATURE_TOGGLE_CLASS} {
  order: -2;
}

#${TOP_BAR_ID}:has(.bc-paper-combos-status) .${FEATURE_TOGGLE_CLASS} + .bc-paper-combos-spacer {
  display: none;
}

#${TOP_BAR_ID} .bc-paper-combos-status {
  order: -1;
  flex: 1 1 0;
  min-width: 0;
  color: var(--bc-color-text-muted);
  font-size: var(--bc-font-12);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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


/* Pin button: direct child of the card, sibling of paper-ctec's
 * actions anchor. Sits just above the Analytics button in the bottom
 * right so the user always finds it in the same spot. Same small white
 * control as the card's other buttons; pinned is ink-filled. */
.${CARD_PIN_BUTTON_CLASS} {
  position: absolute;
  bottom: 14px;
  right: 6px;
  z-index: 13;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--bc-color-border-strong);
  border-radius: 7px;
  background: var(--bc-color-bg);
  color: var(--bc-color-text-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--bc-shadow-elev-1);
  pointer-events: auto;
  transition: background var(--bc-tx-fast) var(--bc-easing),
              border-color var(--bc-tx-fast) var(--bc-easing),
              color var(--bc-tx-fast) var(--bc-easing);
}

.${CARD_PIN_BUTTON_CLASS}:hover {
  background: var(--bc-color-surface-hover);
  border-color: var(--bc-color-text-muted);
  color: var(--bc-color-text-strong);
}

.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"] {
  background: var(--bc-color-accent);
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
}

.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"]:hover {
  background: var(--bc-color-accent-hover);
  border-color: var(--bc-color-accent-hover);
  color: var(--bc-color-accent-on);
}
`;

export function injectCombosStyles(doc: Document = document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}
