// Status row (loading spinner, error text) + meta footer + FD filter chips.
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
      min-height: 16px;
      flex: 1 1 auto;
      min-width: 0;
    }
    .bc-cs-status[data-state="error"] { color: var(--bc-color-danger); }
    .bc-cs-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid var(--bc-color-accent-fill-18);
      border-top-color: var(--bc-color-accent);
      border-radius: var(--bc-radius-circle);
      animation: bc-cs-spin 0.7s linear infinite;
    }
    @keyframes bc-cs-spin { to { transform: rotate(360deg); } }

    .bc-cs-meta { font-size: var(--bc-font-11); color: var(--bc-color-text-muted); }

    /* ── Foundational Discipline chips ───────────────────────────────────── */
    .bc-cs-fd-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-left: auto;
    }
    .bc-cs-fd-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      padding: 3px 9px 3px 7px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-color-border-divider);
      background: var(--bc-color-surface-soft);
      color: var(--bc-color-text-muted);
      cursor: pointer;
      user-select: none;
      transition: background-color var(--bc-tx-fast), border-color var(--bc-tx-fast), color var(--bc-tx-fast);
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
    .bc-cs-fd-chip:focus-within {
      outline: 2px solid var(--bc-color-accent);
      outline-offset: 1px;
    }
    .bc-cs-fd-chip .bc-cs-fd-icon {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }

    /* Common wrapper around every FD icon — gives the tooltip a full
       bounding-box hit area instead of just the stroked pixels. */
    .bc-cs-fd-icon-wrap {
      display: inline-flex;
      align-items: center;
      cursor: help;
    }
    .bc-cs-fd-chip:hover {
      border-color: var(--bc-color-border-strong);
      color: var(--bc-color-text);
    }
    .bc-cs-fd-chip:has(input:checked) {
      background: var(--bc-color-accent-surface-tile);
      border-color: var(--bc-color-accent-border-18);
      color: var(--bc-color-accent-pressed);
    }
  `;
}
