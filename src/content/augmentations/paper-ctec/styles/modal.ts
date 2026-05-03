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
      background: rgba(15, 23, 42, 0.55);
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
      background: #ffffff;
      color: #1f2937;
      border-radius: 14px;
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.06),
        0 30px 60px -10px rgba(0, 0, 0, 0.35),
        0 0 0 1px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
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
      border-radius: 8px;
      display: grid;
      place-items: center;
      border: 1px solid #e6e6ea;
      background: white;
      color: #6b7280;
      cursor: pointer;
      font-size: 16px;
      z-index: 2;
    }
    .bc-paper-ctec-modal-close:hover {
      background: #f7f7f8;
      color: #1f2937;
    }
    .bc-paper-ctec-modal-header {
      position: relative;
      padding: 22px 32px 0;
      border-bottom: 1px solid #e6e6ea;
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
      font-size: 13px;
      color: #6b7280;
      letter-spacing: 0.02em;
    }
    .bc-paper-ctec-modal-title {
      font-size: 26px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin: 0;
      line-height: 1.15;
    }
    .bc-paper-ctec-modal-meta {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 0;
      row-gap: 6px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #6b7280;
    }
    .bc-paper-ctec-modal-meta > * + *::before {
      content: "";
      display: inline-block;
      width: 1px;
      height: 11px;
      background: #d1d5db;
      margin: 0 14px;
      vertical-align: -1px;
    }
    .bc-paper-ctec-modal-meta strong {
      color: #1f2937;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-report-link {
      font-size: 12px;
      color: #1f2937;
      text-decoration: none;
      border: 1px solid #e6e6ea;
      padding: 7px 12px;
      border-radius: 8px;
      background: white;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-report-link:hover {
      background: #f7f7f8;
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
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.01em;
      padding: 7px 12px;
      border-radius: 8px;
      border: 1px solid #e6e6ea;
      background: white;
      color: #1f2937;
      cursor: pointer;
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-action-btn:hover:not(:disabled) {
      background: #f7f7f8;
    }
    .bc-paper-ctec-modal-action-btn.is-primary {
      border-color: #66023c;
      background: #66023c;
      color: #ffffff;
    }
    .bc-paper-ctec-modal-action-btn.is-primary:hover:not(:disabled) {
      background: #500030;
    }
    .bc-paper-ctec-modal-action-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .bc-paper-ctec-modal-action-loadmore {
      font-weight: 500;
      font-size: 11.5px;
      padding: 6px 10px;
      color: #6b7280;
      background: transparent;
      border-color: transparent;
    }
    .bc-paper-ctec-modal-action-loadmore:hover:not(:disabled) {
      background: #f3f3f5;
      color: #1f2937;
    }
    .bc-paper-ctec-modal-action-refresh:disabled {
      opacity: 1;
      color: #6b7280;
      background: #f7f7f8;
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
      border-radius: 10px;
      border: 1px solid;
      animation: bc-paper-ctec-flash-in 220ms ease-out;
    }
    @keyframes bc-paper-ctec-flash-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .bc-paper-ctec-modal-flash-success {
      background: #ecfdf3;
      border-color: #abefc6;
      color: #054f31;
    }
    .bc-paper-ctec-modal-flash-auth {
      background: #fffaeb;
      border-color: #fedf89;
      color: #93370d;
    }
    .bc-paper-ctec-modal-flash-error {
      background: #fef3f2;
      border-color: #fecdca;
      color: #912018;
    }
    .bc-paper-ctec-modal-flash-icon {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.65);
    }
    .bc-paper-ctec-modal-flash-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .bc-paper-ctec-modal-flash-title {
      font-size: 13px;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-flash-body {
      font-size: 12px;
      opacity: 0.85;
    }
    .bc-paper-ctec-modal-flash-action {
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid currentColor;
      background: rgba(255, 255, 255, 0.7);
      color: inherit;
      cursor: pointer;
      white-space: nowrap;
      align-self: center;
    }
    .bc-paper-ctec-modal-flash-action:hover {
      background: rgba(255, 255, 255, 1);
    }
    .bc-paper-ctec-modal-flash-dismiss {
      font: inherit;
      font-size: 14px;
      line-height: 1;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: inherit;
      opacity: 0.55;
      cursor: pointer;
      align-self: center;
    }
    .bc-paper-ctec-modal-flash-dismiss:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.06);
    }
    .bc-paper-ctec-modal-status-body {
      flex: 1;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 32px;
      background: #fafafa;
    }
    .bc-paper-ctec-modal-status-card {
      max-width: 440px;
      padding: 28px 30px;
      background: white;
      border: 1px solid #e6e6ea;
      border-radius: 14px;
      text-align: center;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    .bc-paper-ctec-modal-status-card.is-warn {
      border-color: rgba(190, 24, 93, 0.28);
      background: #fff7fb;
    }
    .bc-paper-ctec-modal-status-title {
      font-size: 18px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px;
    }
    .bc-paper-ctec-modal-status-card.is-warn .bc-paper-ctec-modal-status-title {
      color: #66023c;
    }
    .bc-paper-ctec-modal-status-text {
      font-size: 13px;
      line-height: 1.5;
      color: #4b5563;
      margin: 0 0 16px;
    }
    .bc-paper-ctec-modal-status-primary {
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 9px 16px;
      border-radius: 999px;
      border: 1px solid #66023c;
      background: #66023c;
      color: #ffffff;
      cursor: pointer;
    }
    .bc-paper-ctec-modal-status-primary:hover {
      background: #500030;
    }
    .bc-paper-ctec-modal-status-spinner {
      width: 32px;
      height: 32px;
      margin: 0 auto 14px;
      border-radius: 50%;
      border: 3px solid rgba(102, 2, 60, 0.18);
      border-top-color: #66023c;
      animation: bc-paper-ctec-modal-spin 900ms linear infinite;
    }
    @keyframes bc-paper-ctec-modal-spin {
      to { transform: rotate(360deg); }
    }
    .bc-paper-ctec-modal-tabs {
      display: flex;
      gap: 2px;
      margin-top: 16px;
    }
    .bc-paper-ctec-modal-tab {
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
      font-family: inherit;
      margin-bottom: -1px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bc-paper-ctec-modal-tab.is-active {
      border-bottom-color: #66023c;
      color: #66023c;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-tab-count {
      font-size: 10px;
      font-family: ui-monospace, monospace;
      color: #9ca3af;
      background: #f7f7f8;
      padding: 2px 6px;
      border-radius: 8px;
    }
    .bc-paper-ctec-modal-tab.is-active .bc-paper-ctec-modal-tab-count {
      color: #66023c;
      background: #f6ecf2;
    }
    .bc-paper-ctec-modal-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: #fafafa;
    }
    .bc-paper-ctec-modal-overview {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 24px 32px 36px;
    }
  `;
}
