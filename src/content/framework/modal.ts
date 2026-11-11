// Generic modal chrome — backdrop, card, close button, title/body/note
// copy and an actions row. Any feature can render a centered dialog with
// the same look-and-feel.
//
// The look is deliberately plain: neutral text on a solid surface, one
// filled button. No icon tiles, tinted callouts or accent-colored copy —
// the primary button is the only thing that should draw the eye.
//
// Class contract (consumers render whatever DOM they want using these):
//   .bc-modal              — fixed full-viewport overlay; click target for
//                            backdrop dismiss (host element itself).
//   .bc-modal-card         — the centered card; stop propagation here so
//                            clicks inside don't bubble to the backdrop.
//   .bc-modal-close        — × button anchored top-right.
//   .bc-modal-title        — heading.
//   .bc-modal-body         — paragraph.
//   .bc-modal-note         — quieter secondary paragraph.
//   .bc-modal-link         — underlined link inside body/note copy.
//   .bc-modal-actions      — row of action buttons; the primary comes
//                            first and fills the row.
//
// Action buttons use the design-system button family directly:
//   class="bc-btn bc-btn--primary bc-btn--soft"
//   class="bc-btn bc-btn--secondary"

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
    animation: bc-modal-fade 140ms ease-out;
  }
  @keyframes bc-modal-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  /* Card, close button and title match the CTEC analytics modal so every
     Pencil dialog reads as the same product. */
  .bc-modal-card {
    position: relative;
    width: min(440px, 100%);
    padding: 28px 28px 24px;
    border-radius: var(--bc-radius-3xl);
    background: var(--bc-color-bg);
    color: var(--bc-color-text);
    box-shadow: var(--bc-shadow-modal);
    font-family: var(--bc-font-body);
    text-align: left;
  }
  .bc-modal-close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-lg);
    background: var(--bc-color-bg);
    color: var(--bc-color-text-muted);
    font-size: var(--bc-font-18);
    line-height: 1;
    cursor: pointer;
  }
  .bc-modal-close:hover {
    background: var(--bc-color-surface-hover);
    color: var(--bc-color-text);
  }
  .bc-modal-title {
    margin: 0 44px 10px 0;
    font-family: var(--bc-font-display);
    font-size: var(--bc-font-22);
    font-weight: var(--bc-fw-display);
    line-height: 1.15;
    letter-spacing: var(--bc-ls-tight);
    color: var(--bc-color-text-strong);
  }
  .bc-modal-body {
    margin: 0;
    font-size: var(--bc-font-14);
    line-height: 1.55;
    color: var(--bc-color-text-soft);
  }
  .bc-modal-note {
    margin: 16px 0 0;
    padding-top: 14px;
    border-top: 1px solid var(--bc-color-border-divider);
    font-size: var(--bc-font-13);
    line-height: 1.55;
    color: var(--bc-color-text-muted);
  }
  .bc-modal-link {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }
  .bc-modal-link:hover {
    color: var(--bc-color-text);
  }
  /* Primary first in the DOM; it fills the row and the secondary stays
     compact beside it. */
  .bc-modal-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 22px;
  }
  .bc-modal-actions .bc-btn {
    padding: 11px 16px;
    font-size: var(--bc-font-14);
  }
  .bc-modal-actions .bc-btn--primary {
    flex: 1 1 auto;
  }
`;
