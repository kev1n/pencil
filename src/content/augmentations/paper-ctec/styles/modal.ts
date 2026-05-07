import { ANALYTICS_MODAL_ID } from "../constants";

// Modal frame styles: backdrop, card, close button, header (identity, title,
// meta strip, report link, action buttons), refresh-flash banners, status
// body (loading + error states), and the tab strip.
export function modalStyles(): string {
  return `
    #${ANALYTICS_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bc-color-overlay-modal);
      backdrop-filter: blur(2px);
      animation: bc-paper-ctec-modal-fade 140ms ease-out;
      padding: 12px;
    }
    @keyframes bc-paper-ctec-modal-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .bc-paper-ctec-modal-card {
      width: min(1800px, 98vw);
      height: 96vh;
      background: var(--bc-color-bg);
      color: var(--bc-color-text);
      border-radius: var(--bc-radius-3xl);
      box-shadow: var(--bc-shadow-modal);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--bc-font-body);
    }
    .bc-paper-ctec-modal-card *,
    .bc-paper-ctec-modal-card *::before,
    .bc-paper-ctec-modal-card *::after {
      box-sizing: border-box;
    }
    .bc-paper-ctec-modal-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 32px;
      height: 32px;
      border-radius: var(--bc-radius-lg);
      display: grid;
      place-items: center;
      border: 1px solid var(--bc-color-border);
      background: var(--bc-color-bg);
      color: var(--bc-color-text-muted);
      cursor: pointer;
      font-size: var(--bc-font-16);
      z-index: 2;
    }
    .bc-paper-ctec-modal-close:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-header {
      position: relative;
      padding: 22px 32px 0;
      border-bottom: 1px solid var(--bc-color-border);
      flex-shrink: 0;
    }
    .bc-paper-ctec-modal-identity {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: end;
    }
    .bc-paper-ctec-modal-code {
      font-family: ui-monospace, monospace;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text-muted);
      letter-spacing: var(--bc-ls-wide);
    }
    .bc-paper-ctec-modal-title {
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-28);
      font-weight: var(--bc-fw-display);
      letter-spacing: var(--bc-ls-tight);
      margin: 0;
      line-height: 1.1;
    }
    .bc-paper-ctec-modal-meta {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 0;
      row-gap: 6px;
      flex-wrap: wrap;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-meta > * + *::before {
      content: "";
      display: inline-block;
      width: 1px;
      height: 11px;
      background: var(--bc-color-border-strong);
      margin: 0 14px;
      vertical-align: -1px;
    }
    .bc-paper-ctec-modal-meta strong {
      color: var(--bc-color-text);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-report-link {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text);
      text-decoration: none;
      border: 1px solid var(--bc-color-border);
      padding: 7px 12px;
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-bg);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-report-link:hover {
      background: var(--bc-color-surface-hover);
    }
    .bc-paper-ctec-modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .bc-paper-ctec-modal-action-btn {
      font: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      letter-spacing: var(--bc-ls-snug);
      padding: 7px 12px;
      border-radius: var(--bc-radius-lg);
      border: 1px solid var(--bc-color-border);
      background: var(--bc-color-bg);
      color: var(--bc-color-text);
      cursor: pointer;
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-action-btn:hover:not(:disabled) {
      background: var(--bc-color-surface-hover);
    }
    .bc-paper-ctec-modal-action-btn.is-primary {
      border-color: var(--bc-color-accent);
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-paper-ctec-modal-action-btn.is-primary:hover:not(:disabled) {
      background: var(--bc-color-accent-hover);
    }
    .bc-paper-ctec-modal-action-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .bc-paper-ctec-modal-action-loadmore {
      font-weight: var(--bc-fw-medium);
      font-size: 11.5px;
      padding: 6px 10px;
      color: var(--bc-color-text-muted);
      background: transparent;
      border-color: transparent;
    }
    .bc-paper-ctec-modal-action-loadmore:hover:not(:disabled) {
      background: var(--bc-color-surface-hover-strong);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-action-refresh:disabled {
      opacity: 1;
      color: var(--bc-color-text-muted);
      background: var(--bc-color-surface-hover);
      animation: bc-paper-ctec-refresh-pulse 1.6s ease-in-out infinite;
    }
    @keyframes bc-paper-ctec-refresh-pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    .bc-paper-ctec-modal-flash {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: var(--bc-radius-xl);
      border: 1px solid;
      animation: bc-paper-ctec-flash-in 220ms ease-out;
    }
    @keyframes bc-paper-ctec-flash-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .bc-paper-ctec-modal-flash-success {
      background: var(--bc-color-success-bg-soft);
      border-color: var(--bc-color-success-border);
      color: var(--bc-color-success-text);
    }
    .bc-paper-ctec-modal-flash-auth {
      background: var(--bc-color-warn-bg-soft);
      border-color: var(--bc-color-warn-border);
      color: var(--bc-color-warn-text);
    }
    .bc-paper-ctec-modal-flash-error {
      background: var(--bc-color-danger-bg-soft);
      border-color: var(--bc-color-danger-border);
      color: var(--bc-color-danger-text);
    }
    .bc-paper-ctec-modal-flash-icon {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      border-radius: var(--bc-radius-circle);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      background: var(--bc-color-flash-pill-bg);
    }
    .bc-paper-ctec-modal-flash-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .bc-paper-ctec-modal-flash-title {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-flash-body {
      font-size: var(--bc-font-12);
      opacity: 0.85;
    }
    .bc-paper-ctec-modal-flash-action {
      font: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      padding: 6px 10px;
      border-radius: var(--bc-radius-md);
      border: 1px solid currentColor;
      background: var(--bc-color-flash-action-bg);
      color: inherit;
      cursor: pointer;
      white-space: nowrap;
      align-self: center;
    }
    .bc-paper-ctec-modal-flash-action:hover {
      background: var(--bc-color-flash-action-bg-hover);
    }
    .bc-paper-ctec-modal-flash-dismiss {
      font: inherit;
      font-size: var(--bc-font-14);
      line-height: 1;
      width: 22px;
      height: 22px;
      border-radius: var(--bc-radius-md);
      border: none;
      background: transparent;
      color: inherit;
      opacity: 0.55;
      cursor: pointer;
      align-self: center;
    }
    .bc-paper-ctec-modal-flash-dismiss:hover {
      opacity: 1;
      background: var(--bc-color-overlay-on-light);
    }
    .bc-paper-ctec-modal-status-body {
      flex: 1;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 32px;
      background: var(--bc-color-bg-muted);
    }
    .bc-paper-ctec-modal-status-card {
      max-width: 440px;
      padding: 28px 30px;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-3xl);
      text-align: center;
      box-shadow: var(--bc-shadow-modal-status);
    }
    .bc-paper-ctec-modal-status-card.is-warn {
      border-color: var(--bc-color-accent-border-28);
      background: var(--bc-color-accent-surface-faint);
    }
    .bc-paper-ctec-modal-status-title {
      font-size: var(--bc-font-18);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text);
      margin: 0 0 8px;
    }
    .bc-paper-ctec-modal-status-card.is-warn .bc-paper-ctec-modal-status-title {
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-modal-status-text {
      font-size: var(--bc-font-13);
      line-height: 1.5;
      color: var(--bc-color-text-soft);
      margin: 0 0 16px;
    }
    .bc-paper-ctec-modal-status-spinner {
      width: 32px;
      height: 32px;
      margin: 0 auto 14px;
      border-radius: var(--bc-radius-circle);
      border: 3px solid var(--bc-color-accent-fill-18);
      border-top-color: var(--bc-color-accent);
      animation: bc-paper-ctec-modal-spin 900ms linear infinite;
    }
    @keyframes bc-paper-ctec-modal-spin {
      to { transform: rotate(360deg); }
    }
    .bc-paper-ctec-modal-disclaimer {
      display: flex;
      align-items: flex-start;
      margin-top: 12px;
      padding: 10px 12px;
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-md);
      background: var(--bc-color-ink-fill-04);
      font-size: var(--bc-font-12);
      line-height: 1.45;
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-disclaimer-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bc-paper-ctec-modal-disclaimer-headline {
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-regular);
      color: var(--bc-color-text-muted);
      letter-spacing: var(--bc-ls-snug);
    }
    .bc-paper-ctec-modal-disclaimer-name {
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-medium);
    }
    .bc-paper-ctec-modal-disclaimer-count {
      font-family: ui-monospace, monospace;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-regular);
      color: var(--bc-color-text-muted);
      letter-spacing: var(--bc-ls-wide);
    }
    .bc-paper-ctec-modal-disclaimer-detail {
      font-size: 11.5px;
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-tabs {
      display: flex;
      gap: 6px;
      margin-top: 16px;
    }
    .bc-paper-ctec-modal-tab {
      position: relative;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-md) var(--bc-radius-md) 0 0;
      padding: 8px 14px;
      margin-bottom: -1px;
      cursor: pointer;
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bc-paper-ctec-modal-tab:hover {
      border-color: var(--bc-color-border-strong);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-tab.is-active {
      background: var(--bc-color-bg-muted);
      border-color: var(--bc-color-accent);
      border-bottom-color: var(--bc-color-bg-muted);
      color: var(--bc-color-accent);
      z-index: 1;
    }
    .bc-paper-ctec-modal-tab-count {
      font-size: var(--bc-font-10);
      font-family: ui-monospace, monospace;
      color: var(--bc-color-text-subtle);
      background: var(--bc-color-surface-hover);
      padding: 2px 6px;
      border-radius: var(--bc-radius-lg);
    }
    .bc-paper-ctec-modal-tab.is-active .bc-paper-ctec-modal-tab-count {
      color: var(--bc-color-accent);
      background: var(--bc-color-accent-surface-tile);
    }
    .bc-paper-ctec-modal-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: var(--bc-color-bg-muted);
    }
    .bc-paper-ctec-modal-overview {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 24px 32px 36px;
    }
  `;
}
