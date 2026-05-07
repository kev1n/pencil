import { ensureStyle } from "../../framework";
import {
  CARD_PIN_BUTTON_CLASS,
  REAL_CARD_HIDE_ATTR,
  ROOT_ATTR,
  STYLE_ID,
  TOP_BAR_ID
} from "./constants";

const REAL_CARD_HIDE_SELECTOR =
  "div.absolute.z-10.rounded-lg" + `[${REAL_CARD_HIDE_ATTR}="1"]`;

// margin-top clears paper-ctec's floating status bar (which is anchored
// at top: 1rem inside the absolute-positioned action toolbar). 3.25rem
// is enough to land below the status text without being so tall it eats
// canvas space.
const CSS = `
#${TOP_BAR_ID} {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.6rem 0.8rem;
  margin: 3.25rem 0 0.6rem 0;
  border-radius: var(--bc-radius-lg);
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  font-family: inherit;
  color: var(--bc-color-text);
  font-size: 0.875rem;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button {
  cursor: pointer;
  border: 1px solid var(--bc-color-border);
  background: transparent;
  border-radius: var(--bc-radius-md);
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.95rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button:not([disabled]):hover {
  background: var(--bc-color-surface-hover);
}

#${TOP_BAR_ID} .bc-paper-combos-counter {
  font-variant-numeric: tabular-nums;
  font-weight: var(--bc-fw-semibold);
  min-width: 4.5rem;
  text-align: center;
}

#${TOP_BAR_ID} .bc-paper-combos-rating {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  background: var(--bc-color-bg-muted);
  border-radius: var(--bc-radius-md);
  font-weight: var(--bc-fw-medium);
}

#${TOP_BAR_ID} .bc-paper-combos-rating[data-rated="0"] {
  opacity: 0.55;
}

#${TOP_BAR_ID} .bc-paper-combos-max {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

#${TOP_BAR_ID} .bc-paper-combos-max input {
  width: 3rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: center;
}

#${TOP_BAR_ID} .bc-paper-combos-status {
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.4rem 0.55rem;
  border-radius: var(--bc-radius-md);
  background: var(--bc-color-bg-muted);
  color: var(--bc-color-text-muted);
  font-size: 0.8rem;
}

[${ROOT_ATTR}] .schedule-grid-cols ${REAL_CARD_HIDE_SELECTOR} {
  display: none !important;
}

/* Pin button mounted inside paper.nu's schedule cards. Positioned
 * top-left to mirror paper.nu's trash button (top-right). The card's
 * inner .relative wrapper is the positioning context. */
.${CARD_PIN_BUTTON_CLASS} {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  z-index: 20;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-bg);
  color: var(--bc-color-text-muted);
  font-size: 0.7rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.45;
  transition: opacity var(--bc-tx-fast) var(--bc-easing),
              background var(--bc-tx-fast) var(--bc-easing),
              border-color var(--bc-tx-fast) var(--bc-easing);
}

.${CARD_PIN_BUTTON_CLASS}:hover {
  opacity: 1;
  background: var(--bc-color-surface-hover);
  border-color: var(--bc-color-border);
}

.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"] {
  opacity: 1;
  background: var(--bc-color-accent-surface-soft);
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent);
}
`;

export function injectCombosStyles(doc: Document = document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}
