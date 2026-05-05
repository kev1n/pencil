// Style block for the enrollment-navigation augmentation. Covers the
// in-page term-switcher dropdown and the full-screen "Switching term..."
// overlay that masks the term-page auto-Continue flow.

import { ensureStyle } from "../../framework";

export const STYLE_ID = "better-caesar-enrollment-nav-style";

const CSS = `
.better-caesar-term-wrapper {
  margin-top: 6px;
  display: grid;
  gap: 4px;
  justify-items: start;
  max-width: 320px;
}
.better-caesar-term-helper {
  font-size: var(--bc-font-10);
  font-weight: var(--bc-fw-bold);
  text-transform: uppercase;
  letter-spacing: 0.2px;
  color: var(--bc-color-accent);
}
.better-caesar-term-select {
  width: 100%;
  background: var(--bc-color-bg);
  color: var(--bc-color-accent-pressed);
  border: 1px solid var(--bc-color-accent);
  border-radius: var(--bc-radius-md);
  font-size: var(--bc-font-12);
  padding: 6px 8px;
}
.better-caesar-term-select:focus-visible {
  outline: 2px solid var(--bc-color-accent);
  outline-offset: 2px;
}
.better-caesar-term-status {
  min-height: 14px;
  font-size: var(--bc-font-10);
  color: var(--bc-color-accent);
}
.better-caesar-term-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 12px;
  background: var(--bc-color-surface-translucent-98);
}
.better-caesar-term-spinner {
  width: 28px;
  height: 28px;
  border-radius: var(--bc-radius-circle);
  border: 3px solid var(--bc-color-accent-mid-border);
  border-top-color: var(--bc-color-accent);
  animation: better-caesar-spin 0.8s linear infinite;
}
.better-caesar-term-overlay-text {
  color: var(--bc-color-accent);
  font-size: var(--bc-font-14);
  font-weight: var(--bc-fw-bold);
}
@keyframes better-caesar-spin {
  to { transform: rotate(360deg); }
}
`;

export function injectStyles(doc: Document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}
