// Sharper/Classic switch that sits above the search.
export function tabsStyles(): string {
  return `
    /* ── Tabs ───────────────────────────────────────────────────────────── */
    /* Two quiet text buttons; the active one is ink-filled. No tab strip
       or underline, so nothing boxes in the search below. */
    .bc-cs-tabs {
      display: flex;
      gap: 2px;
      max-width: 1180px;
      margin: 12px auto 0;
      padding: 0 16px;
      font-family: var(--bc-font-body);
    }
    .bc-cs-tab {
      appearance: none;
      height: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: var(--bc-fw-regular);
      letter-spacing: 0;
      color: var(--bc-color-text-soft);
      cursor: pointer;
      transition: color var(--bc-tx-fast), background-color var(--bc-tx-fast);
    }
    .bc-cs-tab:first-child { margin-left: -10px; }
    .bc-cs-tab:hover {
      color: var(--bc-color-text-strong);
      background: var(--bc-color-surface-hover);
    }
    .bc-cs-tab[data-active="true"],
    .bc-cs-tab[data-active="true"]:hover {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-cs-tab:focus-visible {
      outline: 2px solid var(--bc-color-accent);
      outline-offset: 2px;
    }
    #better-caesar-class-search-panel { margin-top: 24px; }
  `;
}
