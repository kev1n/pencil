// Per-section rows (id, component, time, instructor, room, live status,
// status pills, and the per-section actions cluster including Details).
export function sectionRowsStyles(): string {
  return `
    /* ── Section rows ───────────────────────────────────────────────────── */
    .bc-cs-section-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .bc-cs-sections-disclosure {
      border-top: 1px solid var(--bc-color-border-divider);
    }
    .bc-cs-sections-summary {
      padding: 10px 16px;
      color: var(--bc-color-accent);
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      cursor: pointer;
      user-select: none;
      transition: background-color var(--bc-tx-fast), color var(--bc-tx-fast);
    }
    .bc-cs-sections-summary:hover {
      background: var(--bc-color-surface-soft);
      color: var(--bc-color-accent-hover);
    }
    .bc-cs-sections-summary:focus-visible {
      outline: 2px solid var(--bc-color-accent);
      outline-offset: -2px;
    }
    .bc-cs-section {
      position: relative;
      display: grid;
      grid-template-columns: 80px 64px minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 16px;
      border-top: 1px solid var(--bc-color-border-divider);
      font-size: var(--bc-font-13);
      transition: background-color var(--bc-tx-fast);
    }
    .bc-cs-section:hover { background: var(--bc-color-surface-soft); }
    .bc-cs-section-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
    }
    .bc-cs-section-component { color: var(--bc-color-text-muted); font-size: var(--bc-font-12); }
    .bc-cs-section-time { color: var(--bc-color-text); font-size: var(--bc-font-12); line-height: 1.4; }
    .bc-cs-section-time-dates {
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-11);
    }
    .bc-cs-section-time-pattern {
      color: var(--bc-color-text);
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-cs-section-instructor {
      color: var(--bc-color-text);
      font-size: var(--bc-font-12);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-section-room {
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-11);
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .bc-cs-section-live {
      font-size: var(--bc-font-11);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      color: var(--bc-color-text-muted);
    }
    .bc-cs-section-live[data-tone="muted"] {
      color: var(--bc-color-text-subtle);
      font-style: italic;
    }

    .bc-cs-status-pill {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-surface-soft);
      color: var(--bc-color-text-muted);
      border: 1px solid var(--bc-color-border-divider);
      line-height: 1.4;
    }
    .bc-cs-status-pill[data-status="Open"]      { background: var(--bc-color-success-bg); color: var(--bc-color-success); border-color: transparent; }
    .bc-cs-status-pill[data-status="Closed"]    { background: var(--bc-color-danger-bg);  color: var(--bc-color-danger);  border-color: transparent; }
    .bc-cs-status-pill[data-status="Wait List"] { background: var(--bc-color-warn-bg);    color: var(--bc-color-warn);    border-color: transparent; }

    .bc-cs-section-actions {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: flex-end;
      /* Each .bc-cs-section is its own grid (the auto last column sizes
         to content) — a min-width here reserves the actions column even
         on rows that hide buttons (DIS / LAB under a LEC), so the row
         stays aligned with its LEC sibling. Width covers the natural
         "Details" + "Add to cart" cluster. */
      min-width: 188px;
    }
    .bc-cs-details-btn {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      border: 1px solid var(--bc-color-accent);
      border-radius: var(--bc-radius-lg);
      /* Match .bc-cs-add (the secondary sibling) on padding, font size,
         and weight — the two should read as a paired button cluster, with
         primary/secondary distinction carried only by fill vs outline. */
      padding: 5px 10px;
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      cursor: pointer;
      transition: background-color 100ms, transform var(--bc-tx-fast), box-shadow 100ms, border-color var(--bc-tx-fast);
      /* Inline-flex so a spinner span sits next to the label text inside
         the button when data-state="loading". min-width keeps the button
         a stable size across "Details" / "Loading…" / "Hide" so the row's
         actions cluster never reflows mid-click — important at narrow
         viewports where a few extra pixels can push Add-to-cart to wrap. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 76px;
    }
    .bc-cs-details-btn:hover {
      background: var(--bc-color-accent-hover);
      border-color: var(--bc-color-accent-hover);
      box-shadow: var(--bc-shadow-add-cta);
    }
    .bc-cs-details-btn:active { transform: translateY(1px); box-shadow: none; }
    .bc-cs-details-btn[data-expanded="true"] {
      background: var(--bc-color-accent-hover);
      border-color: var(--bc-color-accent-hover);
      box-shadow: none;
    }
    .bc-cs-details-btn[disabled],
    .bc-cs-details-btn[data-state="loading"] {
      cursor: progress;
    }
    .bc-cs-details-btn[data-state="loading"] {
      background: var(--bc-color-disabled-bg);
      border-color: var(--bc-color-disabled-bg);
      color: var(--bc-color-text-muted);
      box-shadow: none;
    }

    /* Inline button spinner — used inside .bc-cs-details-btn and
       .bc-cs-add when data-state="loading". Inherits color from the
       host button via currentColor so it reads on both transparent and
       filled backgrounds without per-button overrides. */
    .bc-cs-btn-spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: var(--bc-radius-circle);
      opacity: 0.75;
      animation: bc-cs-spin 0.7s linear infinite;
      flex: 0 0 auto;
    }

    /* ── Per-section CTEC chip cell ─────────────────────────────────────
       Rendered by ctec/view.ts. The chip sub-elements (.bc-paper-ctec-chip,
       .bc-paper-ctec-chip-label, etc.) come from paper-ctec's stylesheet,
       which class-search injects on mount so the visual language matches
       the paper.nu schedule-card chips exactly. */
    .bc-cs-section-ctec {
      display: flex;
      align-items: center;
      min-width: 0;
      font-size: var(--bc-font-11);
    }
    .bc-cs-ctec-summary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
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
      font-size: var(--bc-font-11);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bc-cs-ctec-spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: var(--bc-radius-circle);
      border: 1.5px solid var(--bc-color-accent-fill-24);
      border-top-color: var(--bc-color-accent-soft);
      animation: bc-cs-spin 0.9s linear infinite;
      flex: 0 0 auto;
    }
    .bc-cs-ctec-load-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 9px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-color-accent-border-45);
      background: var(--bc-color-accent-surface-soft);
      color: var(--bc-color-accent);
      font: inherit;
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: var(--bc-shadow-button);
      transition: background var(--bc-tx-fast), border-color var(--bc-tx-fast),
                  box-shadow var(--bc-tx-fast), transform var(--bc-tx-fast);
    }
    .bc-cs-ctec-load-btn:hover {
      background: var(--bc-color-accent-surface-tile);
      border-color: var(--bc-color-accent);
      box-shadow: var(--bc-shadow-button-hover);
      transform: translateY(-1px);
    }
    .bc-cs-ctec-load-btn:active {
      transform: translateY(0);
      box-shadow: var(--bc-shadow-button);
    }
    .bc-cs-ctec-load-btn svg {
      width: 11px;
      height: 11px;
      stroke-width: 1.8;
      flex: 0 0 auto;
    }
    .bc-cs-ctec-analytics-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-color-accent-border-45);
      background: var(--bc-color-accent-soft);
      color: var(--bc-color-accent-soft-on);
      font: inherit;
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: var(--bc-shadow-button);
      transition: background var(--bc-tx-fast), border-color var(--bc-tx-fast),
                  box-shadow var(--bc-tx-fast);
    }
    .bc-cs-ctec-analytics-btn:hover {
      background: var(--bc-color-accent-soft-hover);
      box-shadow: var(--bc-shadow-button-hover);
    }
  `;
}
