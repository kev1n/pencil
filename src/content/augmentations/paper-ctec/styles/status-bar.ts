import { PAPER_CTEC_CONFIG } from "../config";
import { STATUS_BAR_ID } from "../constants";

// Persistent paper.nu status line: loading progress, then what was found.
// Plain text in the toolbar, not a tinted box.
export function statusBarStyles(): string {
  return `
    #${STATUS_BAR_ID} {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      width: auto;
      max-width: none;
      min-height: ${PAPER_CTEC_CONFIG.ui.statusBarMinHeightPx}px;
      padding: 0 8px 0 2px;
      color: var(--bc-color-text-soft);
      font-family: var(--bc-font-body);
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-regular);
      font-variant-numeric: tabular-nums;
      line-height: 1;
      flex: 1 1 auto;
      box-sizing: border-box;
      overflow: hidden;
    }
    #${STATUS_BAR_ID} svg {
      width: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      flex: 0 0 auto;
      stroke-width: 2.2;
    }
    .bc-paper-ctec-status-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      flex-shrink: 0;
      color: var(--bc-color-text-muted);
    }
    #${STATUS_BAR_ID}.is-ready .bc-paper-ctec-status-mark {
      color: var(--bc-color-success);
    }
    .bc-paper-ctec-status-spinner {
      width: 11px;
      height: 11px;
      box-sizing: border-box;
      border-radius: var(--bc-radius-circle);
      border: 1.5px solid var(--bc-color-border-strong);
      border-top-color: var(--bc-color-text-strong);
      animation: bc-paper-ctec-widget-spin 900ms linear infinite;
    }
    .bc-paper-ctec-status-copy {
      min-width: 0;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
}
