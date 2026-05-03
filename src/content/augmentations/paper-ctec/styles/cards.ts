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
      outline: 2px solid rgba(17, 24, 39, 0.7);
      outline-offset: -1px;
    }
    .${NO_HOVER_LIFT_CLASS} div.absolute.z-10.rounded-lg.-translate-y-2 {
      transform: none !important;
      box-shadow: none !important;
    }
    .dark .${NO_HOVER_LIFT_CLASS} div.absolute.z-10.rounded-lg:hover {
      outline-color: rgba(248, 250, 252, 0.7);
    }
    .${WIDGET_CLASS} {
      margin-top: 3px;
      padding-top: 3px;
      border-top: 1px solid rgba(17, 24, 39, 0.12);
      min-height: 14px;
      color: #4b5563;
      pointer-events: auto;
    }
    .dark .${WIDGET_CLASS} {
      border-top-color: rgba(255, 255, 255, 0.14);
      color: #d1d5db;
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
      font-size: 11px !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bc-paper-ctec-title-line {
      font-size: 11px !important;
      line-height: 1.2 !important;
      font-weight: 600;
      color: #111827;
      display: -webkit-box;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
    .dark .bc-paper-ctec-title-line {
      color: #f9fafb;
    }
    .bc-paper-ctec-instructor-line {
      flex: 0 0 auto;
      max-width: 44%;
      margin-left: auto !important;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.06);
      font-size: 10px !important;
      font-weight: 600 !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 1 !important;
      color: #4b5563 !important;
    }
    .dark .bc-paper-ctec-instructor-line {
      background: rgba(255, 255, 255, 0.08);
      color: #e5e7eb !important;
    }
    .${WIDGET_CLASS}-summary {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      min-width: 0;
      font-size: 10px;
      line-height: 1.1;
    }
    .${WIDGET_CLASS}-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-width: 0;
      max-width: 100%;
      padding: 1px 4px;
      border-radius: 999px;
      border: 1px solid var(--bc-paper-ctec-chip-border, transparent);
      background: var(--bc-paper-ctec-chip-bg, rgba(255, 255, 255, 0.56));
      color: var(--bc-paper-ctec-chip-fg, #374151);
      white-space: nowrap;
      font-weight: 600;
    }
    .${WIDGET_CLASS}-chip-label {
      opacity: 0.72;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .${WIDGET_CLASS}-chip-value {
      font-size: 10px;
      font-weight: 800;
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
    .dark .${WIDGET_CLASS}-chip {
      border-color: var(--bc-paper-ctec-chip-border-dark, transparent);
      background: var(--bc-paper-ctec-chip-bg-dark, rgba(17, 24, 39, 0.54));
      color: var(--bc-paper-ctec-chip-fg-dark, #e5e7eb);
    }
    .${WIDGET_CLASS}-chip svg {
      width: ${PAPER_CTEC_CONFIG.ui.summaryChipIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.summaryChipIconSizePx}px;
      flex: 0 0 auto;
      stroke-width: ${PAPER_CTEC_CONFIG.ui.summaryChipStrokeWidth};
    }
    .${WIDGET_CLASS}-chip.is-muted {
      font-weight: 500;
      color: #6b7280;
    }
    .dark .${WIDGET_CLASS}-chip.is-muted {
      color: #cbd5e1;
    }
    .${WIDGET_CLASS}-chip.is-warn {
      background: rgba(190, 24, 93, 0.12);
      color: #9f1239;
    }
    .dark .${WIDGET_CLASS}-chip.is-warn {
      background: rgba(251, 113, 133, 0.14);
      color: #fecdd3;
    }
    button.${WIDGET_CLASS}-chip-button {
      appearance: none;
      border: 1px solid rgba(190, 24, 93, 0.32);
      cursor: pointer;
      font: inherit;
      padding: 1px 6px;
    }
    /* Analytics anchor: hangs from the bottom edge of the schedule card.
       Mounted as a direct child of the outer .absolute card host so it
       escapes the dense-card .overflow:hidden, and translateY(50%) pushes
       half the pill below the card edge. The card is position:absolute
       (paper.nu's own layout) so this is positioned relative to it. */
    button.${WIDGET_CLASS}-analytics-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 18px;
      padding: 0 9px;
      border: 1px solid rgba(102, 2, 60, 0.45);
      border-radius: 999px;
      background: #66023c;
      color: #fdf2f8;
      cursor: pointer;
      font: inherit;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
    }
    button.${WIDGET_CLASS}-analytics-anchor {
      position: absolute;
      bottom: 0;
      right: 12px;
      transform: translateY(80%);
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
      z-index: 12;
    }
    button.${WIDGET_CLASS}-analytics-anchor:hover {
      transform: translateY(70%);
    }
    /* Suppress paper.nu's card-hover effect while the cursor is on the
       analytics anchor — the anchor visually overlaps the card so users
       are aiming at the pill, not the card itself. Uses :has() (Chrome
       105+; we target current Chromium) to scope the override. */
    ${PAPER_CTEC_CONFIG.selectors.scheduleCard}:has(> .${WIDGET_CLASS}-analytics-anchor:hover) {
      transform: none !important;
      box-shadow: none !important;
    }
    .${NO_HOVER_LIFT_CLASS} ${PAPER_CTEC_CONFIG.selectors.scheduleCard}:has(> .${WIDGET_CLASS}-analytics-anchor:hover) {
      outline-color: transparent !important;
    }
    button.${WIDGET_CLASS}-analytics-btn svg {
      width: 10px;
      height: 10px;
      stroke-width: 1.9;
    }
    .${WIDGET_CLASS}-analytics-btn-label {
      white-space: nowrap;
    }
    button.${WIDGET_CLASS}-analytics-btn:hover {
      background: #4d0230;
      border-color: rgba(102, 2, 60, 0.7);
      box-shadow: 0 3px 8px rgba(15, 23, 42, 0.22);
    }
    button.${WIDGET_CLASS}-chip-button:hover {
      background: rgba(190, 24, 93, 0.2);
    }
    .dark button.${WIDGET_CLASS}-chip-button {
      border-color: rgba(251, 113, 133, 0.4);
    }
    .dark button.${WIDGET_CLASS}-chip-button:hover {
      background: rgba(251, 113, 133, 0.22);
    }
  `;
}
