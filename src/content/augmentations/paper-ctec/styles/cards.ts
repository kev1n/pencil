import { maxWidth } from "../../../design/breakpoints";
import { PAPER_CTEC_CONFIG } from "../config";
import { NO_HOVER_LIFT_CLASS, WIDGET_CLASS } from "../constants";

// Schedule-card widget styles: dense card layout, course/title/instructor
// lines, the one-line CTEC summary (rating, hours, stars, state text), and
// the two small action buttons that hang off the card's corner. Hover-lift
// suppression for paper.nu's default card animation.
export function cardStyles(): string {
  return `
    ${PAPER_CTEC_CONFIG.selectors.scheduleGrid} div.absolute.z-\\[31\\].-translate-y-1\\/2.whitespace-nowrap.rounded-md.bg-emerald-500.px-1\\.5.py-0\\.5.text-\\[10px\\].font-medium.text-white {
      display: none !important;
    }
    .${NO_HOVER_LIFT_CLASS} div.absolute.z-10.rounded-lg:hover {
      transform: none !important;
      box-shadow: none !important;
      outline: 2px solid var(--bc-color-card-outline);
      outline-offset: -1px;
    }
    .${NO_HOVER_LIFT_CLASS} div.absolute.z-10.rounded-lg.-translate-y-2 {
      transform: none !important;
      box-shadow: none !important;
    }
    .${WIDGET_CLASS} {
      margin-top: 3px;
      padding-top: 3px;
      border-top: 1px solid var(--bc-color-card-divider-soft);
      min-height: 16px;
      color: inherit;
      pointer-events: auto;
    }
    .bc-paper-ctec-dense-card {
      display: flex;
      flex-direction: column;
      gap: 2px;
      /* Clip horizontally so long titles/instructor pills stay inside the
         card, but allow vertical overflow so the Load CTEC button at the
         bottom of the widget isn't cut off on 50-min timeslots (the chip
         button extends a few pixels below the card into the gap before the
         next slot). overflow-x:clip + overflow-y:visible is the one
         combination CSS allows without forcing the visible axis to auto. */
      overflow-x: clip !important;
      overflow-y: visible !important;
      min-height: 0;
    }
    .bc-paper-ctec-dense-card > .${WIDGET_CLASS} {
      margin-top: auto;
    }
    .bc-paper-ctec-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-width: 0;
    }
    .bc-paper-ctec-course-line {
      flex: 0 1 auto;
      min-width: 0;
      font-size: var(--bc-font-11) !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bc-paper-ctec-title-line {
      font-size: var(--bc-font-11) !important;
      line-height: 1.2 !important;
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
      display: -webkit-box;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
    /* Instructor sits at the right of the course line as plain quiet text.
       No pill: the card is already a coloured box. */
    .bc-paper-ctec-instructor-line {
      flex: 0 0 auto;
      max-width: 44%;
      margin-left: auto !important;
      font-size: var(--bc-font-11) !important;
      font-weight: var(--bc-fw-regular) !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.72 !important;
    }
    /* One line of facts under a hairline: the rating in its colour, then
       hours as plain text. Nothing here is boxed or uppercase. */
    .${WIDGET_CLASS}-summary {
      display: flex;
      align-items: center;
      column-gap: 8px;
      row-gap: 2px;
      flex-wrap: wrap;
      min-width: 0;
      font-family: var(--bc-font-body);
      font-size: var(--bc-font-11);
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }
    .${WIDGET_CLASS}-spinner {
      width: 10px;
      height: 10px;
      flex: 0 0 auto;
      border-radius: var(--bc-radius-circle);
      border: 1.5px solid var(--bc-color-ink-fill-08);
      border-top-color: currentColor;
      animation: bc-paper-ctec-widget-spin 900ms linear infinite;
    }
    @keyframes bc-paper-ctec-widget-spin {
      to { transform: rotate(360deg); }
    }
    .${WIDGET_CLASS}-chip {
      display: inline-flex;
      align-items: baseline;
      gap: 3px;
      min-width: 0;
      max-width: 100%;
      white-space: nowrap;
      color: inherit;
    }
    .${WIDGET_CLASS}-chip-label {
      font-size: var(--bc-font-11);
      opacity: 0.72;
    }
    .${WIDGET_CLASS}-chip-value {
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
    }
    /* The rating number is the one coloured thing: red through amber to
       green, same scale as the CTEC sheet. */
    .${WIDGET_CLASS}-chip.is-rating .${WIDGET_CLASS}-chip-value {
      padding: 0 5px;
      border-radius: 5px;
      background: var(--bc-paper-ctec-chip-bg, var(--bc-color-ink-fill-06));
      color: var(--bc-paper-ctec-chip-fg, inherit);
    }
    [data-bc-mode="dark"] .${WIDGET_CLASS}-chip.is-rating .${WIDGET_CLASS}-chip-value {
      background: var(--bc-paper-ctec-chip-bg-dark, var(--bc-color-ink-fill-06));
      color: var(--bc-paper-ctec-chip-fg-dark, inherit);
    }
    .${WIDGET_CLASS}-chip-scale {
      font-size: var(--bc-font-11);
      opacity: 0.6;
    }
    .${WIDGET_CLASS}-chip-stars {
      display: inline-flex;
      align-items: center;
      align-self: center;
    }
    .${WIDGET_CLASS}-chip-stars .bc-paper-ctec-stars {
      gap: ${PAPER_CTEC_CONFIG.ui.summaryChipStarGapPx}px;
    }
    .${WIDGET_CLASS}-chip-stars .bc-paper-ctec-star {
      width: ${PAPER_CTEC_CONFIG.ui.summaryChipStarSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.summaryChipStarSizePx}px;
    }
    .${WIDGET_CLASS}-chip svg {
      width: ${PAPER_CTEC_CONFIG.ui.summaryChipIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.summaryChipIconSizePx}px;
      flex: 0 0 auto;
      align-self: center;
      stroke-width: ${PAPER_CTEC_CONFIG.ui.summaryChipStrokeWidth};
    }
    .${WIDGET_CLASS}-chip.is-muted {
      opacity: 0.72;
    }
    .${WIDGET_CLASS}-chip.is-warn {
      color: var(--bc-color-warn-rose-text);
    }
    /* "Load CTEC": a quiet pill on the card's own colour. */
    button.${WIDGET_CLASS}-chip-button {
      appearance: none;
      align-items: center;
      height: 18px;
      padding: 0 7px;
      border: 0;
      border-radius: 5px;
      background: var(--bc-color-ink-fill-06);
      color: inherit;
      font: inherit;
      font-weight: var(--bc-fw-medium);
      opacity: 1;
      cursor: pointer;
      transition: background var(--bc-tx-base) var(--bc-easing);
    }
    button.${WIDGET_CLASS}-chip-button:hover {
      background: var(--bc-color-ink-border-12);
    }
    button.${WIDGET_CLASS}-chip-button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 1px;
    }
    /* Wrapped label so the text can truncate with an ellipsis when two
       classes share a timeslot and each card collapses to ~half width —
       without the wrapper, white-space:nowrap on the chip lets "Load CTEC"
       spill past the card's right edge. */
    .${WIDGET_CLASS}-chip-button-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* Actions wrapper: hangs from the bottom-right corner of the schedule
       card so its position never depends on the card's own width — using
       a fixed pixel offset for each button caused the cart pill to land
       mid-card on narrow timeslots and to overlap the analytics pill once
       its label expanded. Mounted as a direct child of the outer .absolute
       card host so it escapes the dense-card overflow:hidden. Pinned at
       one Y position with no hover-translate — animating Y on hover caused
       a flicker loop where the wrapper would jump up out from under the
       cursor, drop back, and re-trigger hover. */
    .${WIDGET_CLASS}-actions-anchor {
      position: absolute;
      bottom: -13px;
      right: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      z-index: 12;
      pointer-events: auto;
    }
    /* The buttons share the card's bottom edge with the rating line, so on
       a narrow card (a small window, or two classes side by side) the
       Analytics label collapses to its icon, then the hours go, then the
       "/6", leaving the rating readable beside the buttons. */
    ${PAPER_CTEC_CONFIG.selectors.scheduleCard}:has(> .${WIDGET_CLASS}-actions-anchor) {
      container-type: inline-size;
    }
    /* Both action buttons are the same small white control with a hairline
       edge. The cart button is icon-only until hover/focus or until it has
       something to say; the label animates via max-width while the icon
       stays at a fixed size. */
    button.${WIDGET_CLASS}-analytics-btn,
    button.${WIDGET_CLASS}-cart-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 22px;
      min-width: 22px;
      padding: 0 6px;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: 7px;
      background: var(--bc-color-bg);
      color: var(--bc-color-text-strong);
      cursor: pointer;
      font-family: var(--bc-font-body);
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-medium);
      letter-spacing: 0;
      text-transform: none;
      line-height: 1;
      box-shadow: var(--bc-shadow-elev-1);
      transition: background var(--bc-tx-base) var(--bc-easing),
                  border-color var(--bc-tx-base) var(--bc-easing),
                  color var(--bc-tx-base) var(--bc-easing);
    }
    button.${WIDGET_CLASS}-analytics-btn svg,
    button.${WIDGET_CLASS}-cart-btn svg {
      width: 12px;
      height: 12px;
      stroke-width: 2;
      flex: 0 0 auto;
    }
    .${WIDGET_CLASS}-analytics-btn-label,
    .${WIDGET_CLASS}-cart-btn-label {
      display: inline-block;
      max-width: 0;
      overflow: hidden;
      white-space: nowrap;
      opacity: 0;
      margin-left: 0;
      transition: max-width var(--bc-tx-base) var(--bc-easing),
                  opacity var(--bc-tx-base) var(--bc-easing),
                  margin-left var(--bc-tx-base) var(--bc-easing);
    }
    .${WIDGET_CLASS}-analytics-btn-label {
      max-width: 220px;
      opacity: 1;
      margin-left: 4px;
    }
    @container (max-width: 240px) {
      .${WIDGET_CLASS}-analytics-btn-label {
        max-width: 0;
        opacity: 0;
        margin-left: 0;
      }
    }
    @container (max-width: 155px) {
      .${WIDGET_CLASS}-chip.is-hours {
        display: none;
      }
    }
    @container (max-width: 130px) {
      .${WIDGET_CLASS}-chip.is-rating .${WIDGET_CLASS}-chip-scale {
        display: none;
      }
    }
    button.${WIDGET_CLASS}-cart-btn:hover .${WIDGET_CLASS}-cart-btn-label,
    button.${WIDGET_CLASS}-cart-btn:focus-visible .${WIDGET_CLASS}-cart-btn-label {
      max-width: 220px;
      opacity: 1;
      margin-left: 4px;
    }
    /* Mid-flight and one-shot finish states stay expanded so the user can
       read the status (Added, Retry, Adding…) without hovering.
       Persistent badges (in-cart, enrolled) collapse to icon-only and
       expand on hover. */
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="success"] .${WIDGET_CLASS}-cart-btn-label,
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="error"] .${WIDGET_CLASS}-cart-btn-label,
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="loading"] .${WIDGET_CLASS}-cart-btn-label {
      max-width: 220px;
      opacity: 1;
      margin-left: 4px;
    }
    button.${WIDGET_CLASS}-analytics-btn:hover,
    button.${WIDGET_CLASS}-cart-btn:hover:not(:disabled) {
      background: var(--bc-color-surface-hover);
      border-color: var(--bc-color-text-muted);
    }
    button.${WIDGET_CLASS}-analytics-btn:focus-visible,
    button.${WIDGET_CLASS}-cart-btn:focus-visible {
      outline: 2px solid var(--bc-color-accent);
      outline-offset: 1px;
    }
    /* Cart states keep the white control and change only the ink, so a
       green tick means "yours" and red means "try again". */
    button.${WIDGET_CLASS}-cart-btn:disabled {
      cursor: default;
    }
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="success"],
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="in-cart"],
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="enrolled"] {
      color: var(--bc-color-success);
    }
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="enrolled"] {
      background: var(--bc-color-success-bg);
      border-color: var(--bc-color-success-border);
      color: var(--bc-color-success-text);
    }
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="error"] {
      border-color: var(--bc-color-danger-border);
      color: var(--bc-color-danger);
    }
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="loading"] {
      color: var(--bc-color-text-muted);
      cursor: progress;
    }
    /* Suppress paper.nu's card-hover effect while the cursor is on the
       actions wrapper — the wrapper visually overlaps the card so users
       are aiming at the pills, not the card itself. */
    ${PAPER_CTEC_CONFIG.selectors.scheduleCard}:has(> .${WIDGET_CLASS}-actions-anchor:hover) {
      transform: none !important;
      box-shadow: none !important;
    }
    .${NO_HOVER_LIFT_CLASS} ${PAPER_CTEC_CONFIG.selectors.scheduleCard}:has(> .${WIDGET_CLASS}-actions-anchor:hover) {
      outline-color: transparent !important;
    }
    /* Hover preview popup. Anchors below the schedule card outer host
       (sibling to the analytics anchor) so it escapes the dense card's
       overflow:hidden. Hidden by default and toggled via .is-visible
       from the per-card preview controller. */
    .${WIDGET_CLASS}-preview-trigger {
      cursor: pointer;
    }
    .${WIDGET_CLASS}-preview {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 6px;
      width: 640px;
      max-width: 92vw;
      padding: 16px 18px 14px;
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-2xl);
      font-family: var(--bc-font-body);
      background: var(--bc-color-bg);
      box-shadow: var(--bc-shadow-tooltip);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      cursor: pointer;
      transition: opacity 80ms var(--bc-easing), visibility 80ms var(--bc-easing);
      z-index: 30;
    }
    .${WIDGET_CLASS}-preview.is-above {
      top: auto;
      bottom: 100%;
      margin-top: 0;
      margin-bottom: 6px;
    }
    /* Invisible hover bridge over the 6px gap so the cursor never enters
       dead space between the chip and the popup. Without this, the
       popup's mouseenter only fires after the cursor crosses the gap,
       and a slow hand can lose the trigger before reaching it. Bridge
       flips with the popup when it's positioned above the card. */
    .${WIDGET_CLASS}-preview::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 100%;
      height: 12px;
    }
    .${WIDGET_CLASS}-preview.is-above::before {
      bottom: auto;
      top: 100%;
    }
    .${WIDGET_CLASS}-preview.is-visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .${WIDGET_CLASS}-preview-inner {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .${WIDGET_CLASS}-preview-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .${WIDGET_CLASS}-preview-section-title {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
    }
    .${WIDGET_CLASS}-preview-methodology {
      font-size: var(--bc-font-12);
      line-height: 1.4;
      color: var(--bc-color-text-soft);
      margin: -2px 0 2px;
    }
    .${WIDGET_CLASS}-preview-trend-svg {
      width: 100%;
      height: auto;
      display: block;
    }
    /* SVG fill/stroke colors are emitted by JS via style.* with
       var(--bc-color-*) references, so they switch with the active theme
       automatically — no per-attribute dark overrides needed here.
       (Chart-zone bands previously needed explicit dark-mode CSS rules;
       they now consume --bc-color-trend-zone-* vars that swap by theme.) */
    .${WIDGET_CLASS}-preview-empty {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      padding: 4px 0;
    }
    /* Keep the schedule card's own hover-lift effect from kicking in while
       the preview is open — same pattern as the analytics anchor. */
    ${PAPER_CTEC_CONFIG.selectors.scheduleCard}:has(> .${WIDGET_CLASS}-preview.is-visible) {
      transform: none !important;
      box-shadow: none !important;
      z-index: 30;
    }
    @media ${maxWidth("lg")} {
      .bc-paper-ctec-instructor-line {
        max-width: 50%;
      }
    }
  `;
}
