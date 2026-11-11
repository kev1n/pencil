// Distro / discipline filter pills + clear-filters button.
export function pillsStyles(): string {
  return `
    /* ── Filter pills ───────────────────────────────────────────────────── */
    .bc-cs-toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
      align-items: center;
    }
    .bc-cs-checkbox {
      display: inline-flex;
      gap: 5px;
      align-items: center;
      height: 26px;
      padding: 0 10px;
      font-size: 12.5px;
      color: var(--bc-color-text);
      background: var(--bc-color-surface-hover);
      border-radius: 13px;
      cursor: pointer;
      user-select: none;
      transition: background-color var(--bc-tx-fast), color var(--bc-tx-fast);
    }
    .bc-cs-checkbox:hover {
      box-shadow: inset 0 0 0 1px var(--bc-color-border-strong);
    }
    .bc-cs-checkbox input {
      accent-color: var(--bc-color-accent);
      margin: 0;
      width: 12px;
      height: 12px;
    }
    .bc-cs-checkbox:has(input:checked) {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-cs-clear {
      margin-left: auto;
      height: 28px;
      padding: 0 9px;
      background: transparent;
      border: 0;
      border-radius: 7px;
      font: inherit;
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
      cursor: pointer;
      transition: color var(--bc-tx-fast), background-color var(--bc-tx-fast);
    }
    .bc-cs-clear:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
  `;
}
