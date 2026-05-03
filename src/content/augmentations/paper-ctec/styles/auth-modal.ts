import { AUTH_MODAL_ID } from "../constants";

// Auth modal styles: backdrop + card + close button + icon/spinner +
// title/body/note/trust copy + primary/secondary action buttons.
// Plus the small-viewport media query that hides the status-bar brand and
// trims the instructor pill on the schedule card.
export function authModalStyles(): string {
  return `
    #${AUTH_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(2px);
      animation: bc-paper-ctec-auth-fade 140ms ease-out;
    }
    @keyframes bc-paper-ctec-auth-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .bc-paper-ctec-auth-card {
      position: relative;
      width: min(420px, 100%);
      padding: 28px 26px 22px;
      border-radius: 18px;
      background: #ffffff;
      color: #2f1f29;
      box-shadow: 0 28px 60px rgba(15, 23, 42, 0.32);
      text-align: left;
      animation: bc-paper-ctec-auth-pop 160ms ease-out;
    }
    @keyframes bc-paper-ctec-auth-pop {
      from { transform: translateY(8px) scale(0.98); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    .dark .bc-paper-ctec-auth-card {
      background: #1f1318;
      color: #fbeaf2;
      box-shadow: 0 28px 60px rgba(0, 0, 0, 0.6);
    }
    .bc-paper-ctec-auth-close {
      position: absolute;
      top: 8px;
      right: 10px;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      opacity: 0.6;
    }
    .bc-paper-ctec-auth-close:hover {
      background: rgba(15, 23, 42, 0.08);
      opacity: 1;
    }
    .dark .bc-paper-ctec-auth-close:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .bc-paper-ctec-auth-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin-bottom: 14px;
      border-radius: 14px;
      background: rgba(102, 2, 60, 0.12);
      color: #66023c;
    }
    .bc-paper-ctec-auth-icon svg {
      width: 22px;
      height: 22px;
      stroke-width: 1.8;
    }
    .dark .bc-paper-ctec-auth-icon {
      background: rgba(252, 165, 207, 0.16);
      color: #fbcfe8;
    }
    .bc-paper-ctec-auth-spinner {
      position: relative;
    }
    .bc-paper-ctec-auth-spinner::before {
      content: "";
      position: absolute;
      inset: 10px;
      border-radius: 999px;
      border: 2.5px solid rgba(102, 2, 60, 0.18);
      border-top-color: #66023c;
      animation: bc-paper-ctec-auth-spin 900ms linear infinite;
    }
    .dark .bc-paper-ctec-auth-spinner::before {
      border-color: rgba(252, 165, 207, 0.22);
      border-top-color: #fbcfe8;
    }
    @keyframes bc-paper-ctec-auth-spin {
      to { transform: rotate(360deg); }
    }
    .bc-paper-ctec-auth-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 800;
      color: #66023c;
    }
    .dark .bc-paper-ctec-auth-title {
      color: #fbcfe8;
    }
    .bc-paper-ctec-auth-body {
      margin: 0 0 12px;
      font-size: 13px;
      line-height: 1.5;
      color: #4b3a44;
    }
    .dark .bc-paper-ctec-auth-body {
      color: #e8d3dc;
    }
    .bc-paper-ctec-auth-note {
      margin: 0 0 12px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(102, 2, 60, 0.06);
      font-size: 12px;
      line-height: 1.45;
      color: #6b5a65;
    }
    .dark .bc-paper-ctec-auth-note {
      background: rgba(252, 165, 207, 0.08);
      color: #d8c7d0;
    }
    .bc-paper-ctec-auth-trust {
      margin: 0 0 18px;
      font-size: 12px;
      line-height: 1.45;
      color: #6b5a65;
    }
    .dark .bc-paper-ctec-auth-trust {
      color: #d8c7d0;
    }
    .bc-paper-ctec-auth-link {
      color: #66023c;
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .bc-paper-ctec-auth-link:hover {
      color: #500030;
    }
    .dark .bc-paper-ctec-auth-link {
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-auth-link:hover {
      color: #ffe4f0;
    }
    .bc-paper-ctec-auth-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .bc-paper-ctec-auth-primary,
    .bc-paper-ctec-auth-secondary {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 9px 14px;
      border-radius: 10px;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      text-decoration: none;
    }
    .bc-paper-ctec-auth-primary {
      flex: 1 1 auto;
      border: 1px solid #66023c;
      background: #66023c;
      color: #ffffff;
    }
    .bc-paper-ctec-auth-primary:hover {
      background: #500030;
    }
    .bc-paper-ctec-auth-secondary {
      border: 1px solid rgba(102, 2, 60, 0.2);
      background: transparent;
      color: inherit;
    }
    .bc-paper-ctec-auth-secondary:hover {
      background: rgba(102, 2, 60, 0.08);
    }
    .dark .bc-paper-ctec-auth-secondary {
      border-color: rgba(252, 165, 207, 0.3);
    }
    .dark .bc-paper-ctec-auth-secondary:hover {
      background: rgba(252, 165, 207, 0.12);
    }
    @media (max-width: 900px) {
      .bc-paper-ctec-status-brand {
        display: none;
      }
      .bc-paper-ctec-instructor-line {
        max-width: 50%;
      }
    }
  `;
}
