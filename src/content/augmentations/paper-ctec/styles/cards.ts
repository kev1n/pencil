import { maxWidth } from "../../../design/breakpoints";
import { PAPER_CTEC_CONFIG } from "../config";
import { NO_HOVER_LIFT_CLASS, WIDGET_CLASS } from "../constants";

// Schedule-card widget styles: dense card layout, course/title/instructor
// lines, summary chips (incl. star ratings, value chips, auth chip, analytics
// button). Hover-lift suppression for paper.nu's default card animation.
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
      min-height: 14px;
      color: var(--bc-color-text-soft);
      pointer-events: auto;
    }
    .bc-paper-ctec-dense-card {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden !important;
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
    .bc-paper-ctec-instructor-line {
      flex: 0 0 auto;
      max-width: 44%;
      margin-left: auto !important;
      padding: 1px 6px;
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-ink-instructor-pill-bg);
      font-size: var(--bc-font-10) !important;
      font-weight: var(--bc-fw-semibold) !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 1 !important;
      color: var(--bc-color-text-soft) !important;
    }
    .${WIDGET_CLASS}-summary {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      min-width: 0;
      font-size: var(--bc-font-10);
      line-height: 1.1;
    }
    .${WIDGET_CLASS}-spinner {
      width: 10px;
      height: 10px;
      flex: 0 0 auto;
      border-radius: var(--bc-radius-circle);
      border: 1.5px solid var(--bc-color-accent-fill-24);
      border-top-color: var(--bc-color-accent-soft);
      animation: bc-paper-ctec-widget-spin 900ms linear infinite;
    }
    @keyframes bc-paper-ctec-widget-spin {
      to { transform: rotate(360deg); }
    }
    .${WIDGET_CLASS}-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-width: 0;
      max-width: 100%;
      padding: 1px 4px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-paper-ctec-chip-border, transparent);
      background: var(--bc-paper-ctec-chip-bg, var(--bc-color-surface-translucent-56));
      color: var(--bc-paper-ctec-chip-fg, var(--bc-color-text));
      white-space: nowrap;
      font-weight: var(--bc-fw-semibold);
    }
    .${WIDGET_CLASS}-chip-label {
      opacity: 0.72;
      font-size: var(--bc-font-9);
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
    }
    .${WIDGET_CLASS}-chip-value {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-extrabold);
    }
    .${WIDGET_CLASS}-chip-scale {
      margin-left: 1px;
      font-size: var(--bc-font-9);
      font-weight: var(--bc-fw-semibold);
      opacity: 0.55;
    }
    .${WIDGET_CLASS}-chip-stars {
      display: inline-flex;
      align-items: center;
      margin-left: 1px;
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
      stroke-width: ${PAPER_CTEC_CONFIG.ui.summaryChipStrokeWidth};
    }
    .${WIDGET_CLASS}-chip.is-muted {
      font-weight: var(--bc-fw-medium);
      color: var(--bc-color-text-muted);
    }
    .${WIDGET_CLASS}-chip.is-warn {
      background: var(--bc-color-warn-rose-fill-12);
      color: var(--bc-color-warn-rose-text);
    }
    button.${WIDGET_CLASS}-chip-button {
      appearance: none;
      cursor: pointer;
      font: inherit;
      padding: 2px 9px;
      transition: transform var(--bc-tx-base) var(--bc-easing),
                  background var(--bc-tx-base) var(--bc-easing),
                  box-shadow var(--bc-tx-base) var(--bc-easing);
    }
    button.${WIDGET_CLASS}-chip-button.is-muted {
      background: var(--bc-color-accent-surface-soft);
      border: 1px solid var(--bc-color-accent-border-45);
      color: var(--bc-color-accent);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      box-shadow: var(--bc-shadow-button);
    }
    button.${WIDGET_CLASS}-chip-button.is-muted:hover {
      background: var(--bc-color-accent-surface-tile);
      border-color: var(--bc-color-accent);
      box-shadow: var(--bc-shadow-button-hover);
      transform: translateY(-1px);
    }
    button.${WIDGET_CLASS}-chip-button.is-muted:active {
      transform: translateY(0);
      box-shadow: var(--bc-shadow-button);
    }
    button.${WIDGET_CLASS}-chip-button.is-warn {
      border: 1px solid var(--bc-color-warn-rose-border-32);
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
      bottom: -15px;
      right: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      z-index: 12;
      pointer-events: auto;
    }
    /* Both action buttons share a single base style so they collapse to
       the same icon-only pill by default and expand to icon + label on
       hover/focus. The label animates via max-width while the icon stays
       at a fixed size. */
    button.${WIDGET_CLASS}-analytics-btn,
    button.${WIDGET_CLASS}-cart-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 22px;
      padding: 0 6px;
      border-radius: var(--bc-radius-pill);
      cursor: pointer;
      font: inherit;
      font-size: var(--bc-font-9);
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      line-height: 1;
      box-shadow: var(--bc-shadow-button);
      transition: background var(--bc-tx-base) var(--bc-easing),
                  border-color var(--bc-tx-base) var(--bc-easing),
                  box-shadow var(--bc-tx-base) var(--bc-easing);
    }
    button.${WIDGET_CLASS}-analytics-btn {
      border: 1px solid var(--bc-color-accent-border-45);
      background: var(--bc-color-accent-soft);
      color: var(--bc-color-accent-soft-on);
    }
    button.${WIDGET_CLASS}-cart-btn {
      border: 1px solid var(--bc-color-cart-border);
      background: var(--bc-color-cart-bg);
      color: var(--bc-color-cart-text);
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
    button.${WIDGET_CLASS}-cart-btn:hover .${WIDGET_CLASS}-cart-btn-label,
    button.${WIDGET_CLASS}-cart-btn:focus-visible .${WIDGET_CLASS}-cart-btn-label {
      max-width: 220px;
      opacity: 1;
      margin-left: 4px;
    }
    /* Mid-flight and one-shot finish states stay expanded so the user can
       read the status (Added #1234, Retry, Adding…) without hovering.
       Persistent badges (in-cart, enrolled) collapse to icon-only and
       expand on hover, matching the analytics button's pattern. */
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="success"] .${WIDGET_CLASS}-cart-btn-label,
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="error"] .${WIDGET_CLASS}-cart-btn-label,
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="loading"] .${WIDGET_CLASS}-cart-btn-label {
      max-width: 220px;
      opacity: 1;
      margin-left: 4px;
    }
    button.${WIDGET_CLASS}-cart-btn:hover:not(:disabled) {
      background: var(--bc-color-cart-bg-hover);
      border-color: var(--bc-color-cart-border-hover);
      box-shadow: var(--bc-shadow-button-hover);
    }
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="success"],
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="in-cart"],
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="enrolled"] {
      background: var(--bc-color-cart-success-bg);
      border-color: var(--bc-color-cart-success-border);
      color: var(--bc-color-cart-success-text);
    }
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="error"] {
      background: var(--bc-color-cart-error-bg);
      border-color: var(--bc-color-cart-error-border);
      color: var(--bc-color-cart-error-text);
    }
    button.${WIDGET_CLASS}-cart-btn[data-cart-state="loading"] {
      background: var(--bc-color-cart-loading-bg);
      border-color: var(--bc-color-cart-loading-border);
      color: var(--bc-color-cart-loading-text);
      cursor: progress;
      animation: bc-paper-ctec-cart-pulse 1.6s ease-in-out infinite;
    }
    @keyframes bc-paper-ctec-cart-pulse {
      0%, 100% { opacity: 0.85; }
      50% { opacity: 1; }
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
    button.${WIDGET_CLASS}-analytics-btn:hover {
      background: var(--bc-color-accent-soft-hover);
      border-color: var(--bc-color-accent-border-45);
      box-shadow: var(--bc-shadow-button-hover);
    }
    button.${WIDGET_CLASS}-chip-button:hover {
      background: var(--bc-color-warn-rose-fill-20);
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
      border-radius: var(--bc-radius-lg);
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
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      color: var(--bc-color-text-muted);
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
