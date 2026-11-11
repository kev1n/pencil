// Status row (result count, loading spinner, error text) + FD filter pills.
export function statusStyles(): string {
  return `
    /* ── Status row ─────────────────────────────────────────────────────── */
    .bc-cs-status-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .bc-cs-status {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 26px;
      flex: 1 1 auto;
      min-width: 0;
    }
    .bc-cs-status[data-state="error"] { color: var(--bc-color-danger); }
    .bc-cs-spinner {
      width: 12px;
      height: 12px;
      border: 1.5px solid var(--bc-color-border-strong);
      border-top-color: var(--bc-color-text-strong);
      border-radius: var(--bc-radius-circle);
      animation: bc-cs-spin 0.7s linear infinite;
    }
    @keyframes bc-cs-spin { to { transform: rotate(360deg); } }
    .bc-cs-meta { font-size: var(--bc-font-12); color: var(--bc-color-text-muted); }

    /* ── Foundational Discipline pills ───────────────────────────────────── */
    /* 26px, panel background, no border; the chosen ones are ink-filled. */
    .bc-cs-fd-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-left: auto;
    }
    .bc-cs-fd-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 26px;
      padding: 0 10px 0 8px;
      border-radius: 13px;
      background: var(--bc-color-surface-hover);
      font-size: 12.5px;
      color: var(--bc-color-text);
      cursor: pointer;
      user-select: none;
      transition: background-color var(--bc-tx-fast), color var(--bc-tx-fast);
    }
    /* Checkbox is hidden visually — the icon + active-state background
       are the affordance — but stays clickable via the surrounding label
       and focusable for keyboard / screen-reader users. */
    .bc-cs-fd-chip input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }
    /* Keyboard-only focus ring — :has(input:focus-visible) keeps mouse
       clicks from drawing the extra outline around the chip. */
    .bc-cs-fd-chip:has(input:focus-visible) {
      outline: 2px solid var(--bc-color-accent);
      outline-offset: 2px;
    }
    .bc-cs-fd-chip .bc-cs-fd-icon {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
      color: var(--bc-color-text-muted);
    }
    /* Common wrapper around every FD icon — gives the tooltip a full
       bounding-box hit area instead of just the stroked pixels. */
    .bc-cs-fd-icon-wrap {
      display: inline-flex;
      align-items: center;
    }
    .bc-cs-fd-chip:hover {
      box-shadow: inset 0 0 0 1px var(--bc-color-border-strong);
    }
    .bc-cs-fd-chip:has(input:checked) {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      box-shadow: none;
    }
    .bc-cs-fd-chip:has(input:checked) .bc-cs-fd-icon {
      color: inherit;
    }
  `;
}
