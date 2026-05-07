// Primary "Add to cart" CTA + its loading / success / error / disabled +
// persistent cart-state (in-cart / enrolled) styles.
export function addCtaStyles(): string {
  return `
    /* ── Add-to-cart: secondary CAESAR action (Details is the primary) ──── */
    .bc-cs-add {
      background: transparent;
      color: var(--bc-color-text-muted);
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-lg);
      padding: 5px 10px;
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      cursor: pointer;
      transition: color var(--bc-tx-fast), background-color var(--bc-tx-fast),
                  border-color var(--bc-tx-fast), box-shadow var(--bc-tx-fast),
                  transform var(--bc-tx-fast);
      /* Inline-flex so the spinner span (added when data-state="loading")
         sits next to the label inside the button. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .bc-cs-add:hover {
      color: var(--bc-color-text);
      background: var(--bc-color-surface-hover);
      border-color: var(--bc-color-border-strong);
    }
    .bc-cs-add:active { transform: translateY(1px); box-shadow: none; }
    .bc-cs-add[disabled] {
      background: var(--bc-color-disabled-bg);
      border-color: var(--bc-color-disabled-bg);
      color: var(--bc-color-text-muted);
      cursor: progress;
      box-shadow: none;
    }
    /* Loading state must read as clearly disabled — drop to the shared
       disabled-bg + muted text so the locked state is obvious even before
       the inline spinner spins up. */
    .bc-cs-add[data-state="loading"],
    .bc-cs-add[disabled][data-state="loading"] {
      background: var(--bc-color-disabled-bg);
      border-color: var(--bc-color-disabled-bg);
      color: var(--bc-color-text-muted);
      cursor: progress;
      box-shadow: none;
    }
    .bc-cs-add[data-state="success"] {
      background: var(--bc-color-success);
      border-color: var(--bc-color-success);
      color: var(--bc-color-accent-on);
    }
    .bc-cs-add[data-state="error"] {
      background: var(--bc-color-danger);
      border-color: var(--bc-color-danger);
      color: var(--bc-color-accent-on);
    }
    /* Persistent cart-state badges — match the canonical "mini viewer"
       (.bc-cs-myclass-badge in styles/results.ts) so the section-row Add
       button reads as the same status pill the user already sees in the
       "Your classes" overview: subtle paper tint for in-cart, success
       tint for enrolled. Both states arrive disabled (set by
       cart-button-registry.applyCartStateToButton) so we have to win over
       the gray [disabled] background above; selector is duplicated with
       [disabled] for safe specificity. */
    .bc-cs-add[data-state="in-cart"],
    .bc-cs-add[disabled][data-state="in-cart"] {
      background: var(--bc-color-paper-soft);
      border-color: var(--bc-color-paper-soft);
      color: var(--bc-color-paper);
      cursor: default;
      box-shadow: none;
    }
    .bc-cs-add[data-state="enrolled"],
    .bc-cs-add[disabled][data-state="enrolled"] {
      background: var(--bc-color-success-bg);
      border-color: var(--bc-color-success-bg);
      color: var(--bc-color-success);
      cursor: default;
      box-shadow: none;
    }
  `;
}
