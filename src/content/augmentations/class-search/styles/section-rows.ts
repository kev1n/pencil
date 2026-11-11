// Per-section rows (id, component, time, instructor, room, CTEC, live
// status, and the per-section actions).
export function sectionRowsStyles(): string {
  return `
    /* ── Section rows ───────────────────────────────────────────────────── */
    .bc-cs-section-list {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
    }
    .bc-cs-sections-disclosure {
      margin-top: 4px;
    }
    .bc-cs-sections-summary {
      display: inline-flex;
      align-items: center;
      height: 28px;
      margin-left: -9px;
      padding: 0 9px;
      border-radius: 7px;
      color: var(--bc-color-text-soft);
      font-size: 12.5px;
      cursor: pointer;
      user-select: none;
      transition: background-color var(--bc-tx-fast), color var(--bc-tx-fast);
    }
    .bc-cs-sections-summary:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-sections-summary:focus-visible {
      outline: 2px solid var(--bc-color-accent);
      outline-offset: 2px;
    }
    .bc-cs-section {
      position: relative;
      display: grid;
      grid-template-columns: 28px 36px minmax(0, 1.5fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.5fr) 68px auto;
      column-gap: 12px;
      align-items: center;
      min-height: 44px;
      padding: 6px 0;
      border-top: 1px solid var(--bc-color-border-divider);
      font-size: var(--bc-font-13);
    }
    .bc-cs-section-topic {
      grid-column: 1 / -1;
      padding-bottom: 2px;
      color: var(--bc-color-text-strong);
      font-weight: var(--bc-fw-semibold);
      overflow-wrap: anywhere;
    }
    .bc-cs-section-id {
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-section-component { color: var(--bc-color-text-muted); font-size: var(--bc-font-12); }
    .bc-cs-section-time { line-height: 1.35; }
    .bc-cs-section-time-dates {
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-12);
    }
    .bc-cs-section-time-pattern {
      color: var(--bc-color-text-strong);
      font-size: var(--bc-font-13);
    }
    .bc-cs-section-instructor {
      color: var(--bc-color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-section-room {
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-12);
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .bc-cs-section-live {
      font-size: var(--bc-font-12);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      color: var(--bc-color-text-muted);
    }
    .bc-cs-section-live[data-tone="muted"] {
      color: var(--bc-color-text-subtle);
    }
    /* Open / Wait List / Closed: a plain word with a small status dot, so
       a long list is not a column of coloured text. */
    .bc-cs-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
      white-space: nowrap;
    }
    .bc-cs-status-pill[data-status]::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: var(--bc-radius-circle);
      background: var(--bc-color-text-subtle);
    }
    .bc-cs-status-pill[data-status="Open"]::before      { background: var(--bc-color-success); }
    .bc-cs-status-pill[data-status="Closed"]::before    { background: var(--bc-color-danger); }
    .bc-cs-status-pill[data-status="Wait List"]::before { background: var(--bc-color-warn); }
    .bc-cs-section-actions {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: flex-end;
      /* Each .bc-cs-section is its own grid (the auto last column sizes
         to content) — a min-width here reserves the actions column even
         on rows that hide buttons (DIS / LAB under a LEC), so the row
         stays aligned with its LEC sibling. Width covers the natural
         "Add to cart" + "Details" cluster. */
      min-width: 172px;
    }
    /* Details: a quiet text button. Open, it is ink-filled. */
    .bc-cs-details-btn {
      appearance: none;
      height: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--bc-color-text-soft);
      font: inherit;
      font-size: 12.5px;
      cursor: pointer;
      transition: background-color 100ms, color 100ms;
      /* Inline-flex so a spinner span sits next to the label text inside
         the button when data-state="loading". min-width keeps the button
         a stable size across "Details" / "Loading…" / "Hide" so the row's
         actions cluster never reflows mid-click. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 68px;
    }
    .bc-cs-details-btn:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-details-btn[data-expanded="true"] {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-cs-details-btn[disabled],
    .bc-cs-details-btn[data-state="loading"] {
      cursor: progress;
    }
    .bc-cs-details-btn[data-state="loading"] {
      background: transparent;
      color: var(--bc-color-text-muted);
    }
    .bc-cs-details-btn:focus-visible,
    .bc-cs-add:focus-visible,
    .bc-cs-ctec-load-btn:focus-visible,
    .bc-cs-ctec-analytics-btn:focus-visible {
      outline: 2px solid var(--bc-color-accent);
      outline-offset: 2px;
    }
    /* Inline button spinner — used inside .bc-cs-details-btn and
       .bc-cs-add when data-state="loading". Inherits color from the
       host button via currentColor. */
    .bc-cs-btn-spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 1.5px solid currentColor;
      border-top-color: transparent;
      border-radius: var(--bc-radius-circle);
      opacity: 0.75;
      animation: bc-cs-spin 0.7s linear infinite;
      flex: 0 0 auto;
    }

    /* ── Per-section CTEC cell ──────────────────────────────────────────
       Rendered by ctec/view.ts. The chip sub-elements (.bc-paper-ctec-chip
       and friends) come from paper-ctec's stylesheet, which class-search
       injects on mount so a rating reads the same here as on a paper.nu
       schedule card. */
    .bc-cs-section-ctec {
      display: flex;
      align-items: center;
      min-width: 0;
      font-size: var(--bc-font-12);
    }
    .bc-cs-ctec-summary {
      display: inline-flex;
      align-items: center;
      column-gap: 8px;
      row-gap: 2px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .bc-cs-ctec-summary .bc-paper-ctec-chip,
    .bc-cs-ctec-summary .bc-paper-ctec-chip-value,
    .bc-cs-ctec-summary .bc-paper-ctec-chip-scale,
    .bc-cs-ctec-summary .bc-paper-ctec-chip-label {
      font-size: 12.5px;
      line-height: 18px;
    }
    .bc-cs-ctec-summary .bc-paper-ctec-chip.is-hours .bc-paper-ctec-chip-value {
      color: var(--bc-color-text-strong);
    }
    /* Spinner + message stay glued together as a single inline-flex unit
       on one line. The message truncates with ellipsis when the column
       is too narrow, so the spinner can never end up above the message. */
    .bc-cs-ctec-loading {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;
      min-width: 0;
      max-width: 100%;
    }
    .bc-cs-ctec-message {
      min-width: 0;
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-12);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bc-cs-ctec-spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: var(--bc-radius-circle);
      border: 1.5px solid var(--bc-color-border-strong);
      border-top-color: var(--bc-color-text-strong);
      animation: bc-cs-spin 0.9s linear infinite;
      flex: 0 0 auto;
    }
    /* "Load CTEC": a 26px pill, panel background, no border. */
    .bc-cs-ctec-load-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      height: 26px;
      padding: 0 11px;
      border: 0;
      border-radius: 13px;
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text);
      font: inherit;
      font-size: 12.5px;
      cursor: pointer;
      transition: background var(--bc-tx-fast);
    }
    .bc-cs-ctec-load-btn:hover {
      background: var(--bc-color-surface-hover-strong);
      color: var(--bc-color-text-strong);
    }
    /* "Analytics": an underlined text link next to the numbers. */
    .bc-cs-ctec-analytics-btn {
      appearance: none;
      padding: 0;
      border: 0;
      background: none;
      color: var(--bc-color-text-soft);
      font: inherit;
      font-size: 12.5px;
      text-decoration: underline;
      text-decoration-color: var(--bc-color-border-strong);
      text-underline-offset: 3px;
      cursor: pointer;
    }
    .bc-cs-ctec-analytics-btn:hover {
      color: var(--bc-color-text-strong);
      text-decoration-color: var(--bc-color-text-strong);
    }
  `;
}
