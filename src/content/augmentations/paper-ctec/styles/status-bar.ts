import { PAPER_CTEC_CONFIG } from "../config";
import { STATUS_BAR_ID } from "../constants";

const STATUS_STACK_CLASS = "bc-paper-ctec-status-stack";
const STATUS_LEGEND_ID = "bc-paper-ctec-status-legend";

// Persistent paper.nu status bar styles: the pill that announces auth state,
// loading progress, and CTEC readiness; plus the legend strip beneath it.
export function statusBarStyles(): string {
  return `
    #${STATUS_BAR_ID} {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      width: auto;
      max-width: none;
      min-height: ${PAPER_CTEC_CONFIG.ui.statusBarMinHeightPx}px;
      padding: 4px 10px;
      border: 1px solid rgba(102, 2, 60, 0.18);
      border-radius: 8px;
      background: rgba(102, 2, 60, 0.08);
      color: #66023c;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      flex: 1 1 auto;
      box-sizing: border-box;
      overflow: hidden;
    }
    #${STATUS_BAR_ID}.is-loading {
      background: rgba(102, 2, 60, 0.08);
    }
    #${STATUS_BAR_ID}.is-auth {
      border-color: rgba(102, 2, 60, 0.28);
      background: rgba(102, 2, 60, 0.12);
    }
    #${STATUS_BAR_ID}.is-ready {
      border-color: rgba(102, 2, 60, 0.14);
      background: rgba(102, 2, 60, 0.05);
    }
    #${STATUS_BAR_ID} svg {
      width: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      flex: 0 0 auto;
      stroke-width: ${PAPER_CTEC_CONFIG.ui.statusIconStrokeWidth};
    }
    .dark #${STATUS_BAR_ID} {
      border-color: rgba(252, 165, 207, 0.2);
      background: rgba(157, 23, 77, 0.18);
      color: #fbcfe8;
    }
    .dark #${STATUS_BAR_ID}.is-auth {
      border-color: rgba(252, 165, 207, 0.34);
      background: rgba(157, 23, 77, 0.26);
    }
    .${STATUS_STACK_CLASS} {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .bc-paper-ctec-status-mark {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex-shrink: 0;
    }
    .bc-paper-ctec-status-brand {
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-copy {
      min-width: 0;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.95;
    }
    .bc-paper-ctec-status-action {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      margin-left: auto;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(102, 2, 60, 0.24);
      background: rgba(255, 255, 255, 0.72);
      color: inherit;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-decoration: none;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-action:hover {
      background: rgba(255, 255, 255, 0.92);
    }
    .dark .bc-paper-ctec-status-action {
      border-color: rgba(252, 165, 207, 0.26);
      background: rgba(17, 24, 39, 0.28);
    }
    .dark .bc-paper-ctec-status-action:hover {
      background: rgba(17, 24, 39, 0.4);
    }
    #${STATUS_LEGEND_ID} {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
      font-size: 10px;
      line-height: 1.2;
      color: #6b5a65;
    }
    .dark #${STATUS_LEGEND_ID} {
      color: #d8c7d0;
    }
    .bc-paper-ctec-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(102, 2, 60, 0.06);
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-legend-item {
      background: rgba(252, 165, 207, 0.08);
    }
    .bc-paper-ctec-legend-key {
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #66023c;
    }
    .dark .bc-paper-ctec-legend-key {
      color: #fbcfe8;
    }
  `;
}
