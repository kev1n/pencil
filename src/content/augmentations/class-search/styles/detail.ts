// Per-section expandable Detail panel: seat numbers, attribute /
// requirement / notes blocks, and the refresh control.
export function detailStyles(): string {
  return `
    /* ── Detail row (seats / notes sub-panel) ───────────────────────────── */
    /* Same surface as the row above it, indented to the time column. No
       tint and no boxes: numbers in a row split by hairlines, then text. */
    .bc-cs-detail-row {
      display: block;
      padding: 0 0 16px 88px;
    }
    .bc-cs-detail {
      max-width: 760px;
      padding-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bc-cs-detail-loading-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-cs-detail-loading-label {
      line-height: 1.3;
    }
    /* Seat numbers first, then "Loaded 4m ago · Refresh"
       as the quiet last line of the block. */
    .bc-cs-detail-stats-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bc-cs-detail-stats-bar {
      order: 3;
      display: flex;
      align-items: center;
      flex-direction: row-reverse;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 4px;
    }
    .bc-cs-detail-stats {
      display: flex;
      flex-wrap: wrap;
    }
    .bc-cs-stat {
      display: flex;
      flex-direction: column;
      min-width: 92px;
      padding: 0 20px;
      border-left: 1px solid var(--bc-color-border);
    }
    .bc-cs-stat:first-child {
      padding-left: 0;
      border-left: 0;
    }
    .bc-cs-stat-value {
      font-size: var(--bc-font-20);
      font-weight: var(--bc-fw-semibold);
      letter-spacing: var(--bc-ls-snug);
      color: var(--bc-color-text-strong);
      line-height: 1.3;
      font-variant-numeric: tabular-nums;
    }
    .bc-cs-stat-label {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    /* Open seats sit on a chip coloured by how full the class is. */
    .bc-cs-stat-value[data-bc-seat-tone] {
      align-self: flex-start;
      padding: 0 8px;
      border-radius: var(--bc-radius-sm, 6px);
    }
    .bc-cs-stat-value[data-bc-seat-tone="full"] {
      background: var(--bc-color-seat-full-bg);
      color: var(--bc-color-seat-full-ink);
    }
    .bc-cs-stat-value[data-bc-seat-tone="warn"] {
      background: var(--bc-color-seat-warn-bg);
      color: var(--bc-color-seat-warn-ink);
    }
    .bc-cs-stat-value[data-bc-seat-tone="tight"] {
      background: var(--bc-color-seat-tight-bg);
      color: var(--bc-color-seat-tight-ink);
    }
    .bc-cs-stat-value[data-bc-seat-tone="room"] {
      background: var(--bc-color-seat-room-bg);
      color: var(--bc-color-seat-room-ink);
    }
    .bc-cs-stat-value[data-bc-seat-tone="open"] {
      background: var(--bc-color-seat-open-bg);
      color: var(--bc-color-seat-open-ink);
    }
    .bc-cs-detail-block {
      padding-top: 10px;
      border-top: 1px solid var(--bc-color-border-divider);
    }
    .bc-cs-detail-block-label {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      margin-bottom: 2px;
    }
    .bc-cs-detail-block-body {
      font-size: var(--bc-font-13);
      color: var(--bc-color-text);
      line-height: 1.5;
      white-space: pre-line;
    }
    .bc-cs-detail-error {
      font-size: var(--bc-font-13);
      color: var(--bc-color-danger);
    }
    .bc-cs-detail-note {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    /* Combined-section caveat: a line of text in the warning colour with
       a small drawn mark. Not a callout box. */
    .bc-cs-detail-combined-warning {
      display: flex;
      gap: 7px;
      align-items: flex-start;
      font-size: var(--bc-font-13);
      color: var(--bc-color-warn);
      line-height: 1.45;
    }
    .bc-cs-detail-per-section {
      display: grid;
      gap: 1px;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text);
    }
    .bc-cs-detail-per-section-headline {
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-detail-per-section-line {
      color: var(--bc-color-text-soft);
    }
    .bc-cs-detail-per-section-source {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-cs-detail-combined-warning-icon {
      flex: 0 0 auto;
      margin-top: 2px;
    }
    .bc-cs-detail-combined-warning-text {
      flex: 1 1 auto;
      min-width: 0;
    }
    .bc-cs-detail-footer {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .bc-cs-detail-stamp {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .bc-cs-detail-refresh {
      appearance: none;
      height: 26px;
      padding: 0 8px;
      background: transparent;
      border: 0;
      border-radius: 7px;
      font: inherit;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-soft);
      text-decoration: underline;
      text-decoration-color: var(--bc-color-border-strong);
      text-underline-offset: 3px;
      cursor: pointer;
      transition: color var(--bc-tx-fast), background-color var(--bc-tx-fast);
    }
    .bc-cs-detail-refresh:hover:not(:disabled) {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-detail-refresh:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    /* Toast styles live in src/shared/toast.ts (shared across augmentations). */
  `;
}
