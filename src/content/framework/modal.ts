// Generic modal chrome — backdrop, card, close button, icon/spinner slot,
// title/body/note/trust copy, primary/secondary actions. Lifted out of
// paper-ctec so any feature (paper-ctec auth, future prompts) can render
// a centered dialog with the same look-and-feel.
//
// CSS tokens are pulled from the design system (`--bc-color-overlay-auth`,
// `--bc-shadow-auth-card`, accent fills, mauve text, radii, type scale).
// The "auth" in the token names is historical — the values are shared
// across every overlay surface in the app.
//
// Class contract (consumers render whatever DOM they want using these):
//   .bc-modal              — fixed full-viewport overlay; click target for
//                            backdrop dismiss (host element itself).
//   .bc-modal-card         — the centered card; stop propagation here so
//                            clicks inside don't bubble to the backdrop.
//   .bc-modal-close        — round × button anchored top-right.
//   .bc-modal-icon         — 44×44 icon tile (accent fill).
//   .bc-modal-spinner      — adds the spinning ring (combine with -icon).
//   .bc-modal-title        — heading.
//   .bc-modal-body         — paragraph.
//   .bc-modal-note         — soft accent-tinted callout.
//   .bc-modal-trust        — quiet meta line.
//   .bc-modal-link         — accent-colored link inside body/trust copy.
//   .bc-modal-actions      — flex row of action buttons.
//
// Action buttons: use the design-system button family directly.
// Primary fills the row, secondary stays compact:
//   class="bc-btn bc-btn--primary bc-btn--soft bc-btn--fill"
//   class="bc-btn bc-btn--secondary-accent"

import { ensureStyle } from "./dom";

export const MODAL_STYLE_ID = "bc-modal-styles";

export function injectModalStyles(doc: Document = document): void {
  ensureStyle(doc, MODAL_STYLE_ID, MODAL_CSS);
}

export const MODAL_CSS = `
  .bc-modal {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--bc-color-overlay-auth);
    backdrop-filter: blur(2px);
    animation: bc-modal-fade 140ms ease-out;
  }
  @keyframes bc-modal-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .bc-modal-card {
    position: relative;
    width: min(420px, 100%);
    padding: 28px 26px 22px;
    border-radius: 18px;
    background: var(--bc-color-surface-translucent-98);
    color: var(--bc-color-text-mauve-deep);
    box-shadow: var(--bc-shadow-auth-card);
    text-align: left;
    animation: bc-modal-pop 160ms ease-out;
  }
  @keyframes bc-modal-pop {
    from { transform: translateY(8px) scale(0.98); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }
  .bc-modal-close {
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
  .bc-modal-close:hover {
    background: var(--bc-color-overlay-on-light);
    opacity: 1;
  }
  .bc-modal-icon {
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
  .bc-modal-icon svg {
    width: 22px;
    height: 22px;
    stroke-width: 1.8;
  }
  .bc-modal-spinner {
    position: relative;
  }
  .bc-modal-spinner::before {
    content: "";
    position: absolute;
    inset: 10px;
    border-radius: var(--bc-radius-pill);
    border: 2.5px solid var(--bc-color-accent-fill-18);
    border-top-color: var(--bc-color-accent-soft);
    animation: bc-modal-spin 900ms linear infinite;
  }
  @keyframes bc-modal-spin {
    to { transform: rotate(360deg); }
  }
  .bc-modal-title {
    margin: 0 0 8px;
    font-size: var(--bc-font-18);
    font-weight: var(--bc-fw-extrabold);
    color: var(--bc-color-accent-soft);
  }
  .bc-modal-body {
    margin: 0 0 12px;
    font-size: var(--bc-font-13);
    line-height: 1.5;
    color: var(--bc-color-text-body-warm);
  }
  .bc-modal-note {
    margin: 0 0 12px;
    padding: 8px 10px;
    border-radius: var(--bc-radius-lg);
    background: var(--bc-color-accent-fill-06);
    font-size: var(--bc-font-12);
    line-height: 1.45;
    color: var(--bc-color-text-mauve-cool-alt);
  }
  .bc-modal-trust {
    margin: 0 0 18px;
    font-size: var(--bc-font-12);
    line-height: 1.45;
    color: var(--bc-color-text-mauve-cool-alt);
  }
  .bc-modal-link {
    color: var(--bc-color-accent-soft);
    font-weight: var(--bc-fw-bold);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .bc-modal-link:hover {
    color: var(--bc-color-accent-soft-hover);
  }
  .bc-modal-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
`;
