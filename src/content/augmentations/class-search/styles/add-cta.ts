// "Add to cart" + its loading / success / error / disabled +
// persistent cart-state (in-cart / enrolled) styles.
export function addCtaStyles(): string {
  return `
    /* ── Add to cart: the row's one action. Panel-filled at rest so a long
       list stays calm; pencil yellow the moment you point at it. ──────── */
    .bc-cs-add {
      appearance: none;
      height: 28px;
      padding: 0 11px;
      border: 0;
      border-radius: 7px;
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
      font: inherit;
      font-size: 12.5px;
      font-weight: var(--bc-fw-semibold);
      white-space: nowrap;
      cursor: pointer;
      transition: color var(--bc-tx-fast), background-color var(--bc-tx-fast);
      /* Inline-flex so the spinner span (added when data-state="loading")
         sits next to the label inside the button. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .bc-cs-add:hover:not([disabled]) {
      background: var(--bc-color-cta);
      color: var(--bc-color-cta-on);
    }
    .bc-cs-add[disabled] {
      background: transparent;
      color: var(--bc-color-text-muted);
      cursor: progress;
    }
    /* Loading reads as clearly locked: no fill, muted text, and the
       inline spinner. */
    .bc-cs-add[data-state="loading"],
    .bc-cs-add[disabled][data-state="loading"] {
      background: transparent;
      color: var(--bc-color-text-muted);
      cursor: progress;
    }
    .bc-cs-add[data-state="success"] {
      background: var(--bc-color-success-bg);
      color: var(--bc-color-success-text);
    }
    .bc-cs-add[data-state="error"] {
      background: var(--bc-color-danger-bg);
      color: var(--bc-color-danger-text);
    }
    /* Persistent cart-state: plain quiet text, since it is a fact about
       the row and not an action. Both
       states arrive disabled (set by
       cart-button-registry.applyCartStateToButton) so the selector is
       duplicated with [disabled] to win over the rule above. */
    .bc-cs-add[data-state="in-cart"],
    .bc-cs-add[disabled][data-state="in-cart"] {
      background: transparent;
      color: var(--bc-color-text-soft);
      cursor: default;
    }
    .bc-cs-add[data-state="enrolled"],
    .bc-cs-add[disabled][data-state="enrolled"] {
      background: transparent;
      color: var(--bc-color-text-soft);
      cursor: default;
    }
  `;
}
