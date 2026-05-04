import { AUTH_MODAL_ID } from "../constants";
import { maxWidth } from "../../../design/breakpoints";

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
      background: var(--bc-color-overlay-auth);
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
      background: var(--bc-color-surface-translucent-98);
      color: var(--bc-color-text-mauve-deep);
      box-shadow: var(--bc-shadow-auth-card);
      text-align: left;
      animation: bc-paper-ctec-auth-pop 160ms ease-out;
    }
    @keyframes bc-paper-ctec-auth-pop {
      from { transform: translateY(8px) scale(0.98); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    .bc-paper-ctec-auth-close {
      position: absolute;
      top: 8px;
      right: 10px;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: var(--bc-radius-pill);
      background: transparent;
      color: inherit;
      font-size: var(--bc-font-22);
      line-height: 1;
      cursor: pointer;
      opacity: 0.6;
    }
    .bc-paper-ctec-auth-close:hover {
      background: var(--bc-color-overlay-on-light);
      opacity: 1;
    }
    .bc-paper-ctec-auth-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin-bottom: 14px;
      border-radius: var(--bc-radius-3xl);
      background: var(--bc-color-accent-fill-12);
      color: var(--bc-color-accent-soft);
    }
    .bc-paper-ctec-auth-icon svg {
      width: 22px;
      height: 22px;
      stroke-width: 1.8;
    }
    .bc-paper-ctec-auth-spinner {
      position: relative;
    }
    .bc-paper-ctec-auth-spinner::before {
      content: "";
      position: absolute;
      inset: 10px;
      border-radius: var(--bc-radius-pill);
      border: 2.5px solid var(--bc-color-accent-fill-18);
      border-top-color: var(--bc-color-accent-soft);
      animation: bc-paper-ctec-auth-spin 900ms linear infinite;
    }
    @keyframes bc-paper-ctec-auth-spin {
      to { transform: rotate(360deg); }
    }
    .bc-paper-ctec-auth-title {
      margin: 0 0 8px;
      font-size: var(--bc-font-18);
      font-weight: var(--bc-fw-extrabold);
      color: var(--bc-color-accent-soft);
    }
    .bc-paper-ctec-auth-body {
      margin: 0 0 12px;
      font-size: var(--bc-font-13);
      line-height: 1.5;
      color: var(--bc-color-text-body-warm);
    }
    .bc-paper-ctec-auth-note {
      margin: 0 0 12px;
      padding: 8px 10px;
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-accent-fill-06);
      font-size: var(--bc-font-12);
      line-height: 1.45;
      color: var(--bc-color-text-mauve-cool-alt);
    }
    .bc-paper-ctec-auth-trust {
      margin: 0 0 18px;
      font-size: var(--bc-font-12);
      line-height: 1.45;
      color: var(--bc-color-text-mauve-cool-alt);
    }
    .bc-paper-ctec-auth-link {
      color: var(--bc-color-accent-soft);
      font-weight: var(--bc-fw-bold);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .bc-paper-ctec-auth-link:hover {
      color: var(--bc-color-accent-soft-hover);
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
      border-radius: var(--bc-radius-xl);
      font: inherit;
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      cursor: pointer;
      text-decoration: none;
    }
    .bc-paper-ctec-auth-primary {
      flex: 1 1 auto;
      border: 1px solid var(--bc-color-accent-soft);
      background: var(--bc-color-accent-soft);
      color: var(--bc-color-accent-soft-on);
    }
    .bc-paper-ctec-auth-primary:hover {
      background: var(--bc-color-accent-soft-hover);
      border-color: var(--bc-color-accent-soft-hover);
    }
    .bc-paper-ctec-auth-secondary {
      border: 1px solid var(--bc-color-accent-border-22);
      background: transparent;
      color: inherit;
    }
    .bc-paper-ctec-auth-secondary:hover {
      background: var(--bc-color-accent-fill-08);
    }
    @media ${maxWidth("lg")} {
      .bc-paper-ctec-status-brand {
        display: none;
      }
      .bc-paper-ctec-instructor-line {
        max-width: 50%;
      }
    }
  `;
}
