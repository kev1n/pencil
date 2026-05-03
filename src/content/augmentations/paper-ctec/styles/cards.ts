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
      padding-bottom: 18px;
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
    button.${WIDGET_CLASS}-analytics-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      border: 1px solid rgba(102, 2, 60, 0.32);
      border-radius: 4px;
      background: rgba(102, 2, 60, 0.08);
      color: #66023c;
      cursor: pointer;
      flex: 0 0 auto;
      margin-left: 2px;
    }
    button.${WIDGET_CLASS}-analytics-btn svg {
      width: 10px;
      height: 10px;
      stroke-width: 1.9;
    }
    button.${WIDGET_CLASS}-analytics-btn:hover {
      background: rgba(102, 2, 60, 0.18);
    }
    .dark button.${WIDGET_CLASS}-analytics-btn {
      border-color: rgba(252, 165, 207, 0.36);
      background: rgba(252, 165, 207, 0.12);
      color: #fbcfe8;
    }
    .dark button.${WIDGET_CLASS}-analytics-btn:hover {
      background: rgba(252, 165, 207, 0.22);
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
