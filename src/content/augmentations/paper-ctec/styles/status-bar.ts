import { PAPER_CTEC_CONFIG } from "../config";
import { STATUS_BAR_ID } from "../constants";

// Persistent paper.nu status bar styles: the pill that announces auth state,
// loading progress, and CTEC readiness.
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
      border: 1px solid var(--bc-color-accent-border-18);
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-accent-fill-08);
      color: var(--bc-color-accent-soft);
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      line-height: 1;
      flex: 1 1 auto;
      box-sizing: border-box;
      overflow: hidden;
    }
    #${STATUS_BAR_ID}.is-loading {
      background: var(--bc-color-accent-fill-08);
    }
    #${STATUS_BAR_ID}.is-auth {
      border-color: var(--bc-color-accent-border-28);
      background: var(--bc-color-accent-fill-12);
    }
    #${STATUS_BAR_ID}.is-ready {
      border-color: var(--bc-color-accent-border-14);
      background: var(--bc-color-accent-fill-05);
    }
    #${STATUS_BAR_ID} svg {
      width: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      flex: 0 0 auto;
      stroke-width: ${PAPER_CTEC_CONFIG.ui.statusIconStrokeWidth};
    }
    .bc-paper-ctec-status-mark {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex-shrink: 0;
    }
    .bc-paper-ctec-status-brand {
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-wider);
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-copy {
      min-width: 0;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--bc-color-text-mauve-soft);
    }
    .bc-paper-ctec-status-action {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      margin-left: auto;
      padding: 3px 8px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-color-accent-border-22);
      background: var(--bc-color-surface-translucent-72);
      color: inherit;
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-wider);
      text-decoration: none;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-action:hover {
      background: var(--bc-color-surface-translucent-92);
    }
  `;
}
