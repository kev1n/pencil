// Per-section expandable Detail panel: stats, attribute / requirement /
// notes blocks, and the refresh footer.
export function detailStyles(): string {
  return `
    /* ── Detail row (seats / notes sub-panel) ───────────────────────────── */
    .bc-cs-detail-row {
      display: block;
      padding: 0 16px 14px;
      border-top: 1px solid var(--bc-color-border-divider);
      background: var(--bc-color-bg-inset);
    }
    .bc-cs-detail {
      padding: 14px 4px 4px;
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
    /* Section wrapper that pairs the stats grid with the "Refresh seats" +
       timestamp toolbar above it, so the refresh control sits next to the
       seat info it refreshes (used to live in a detached bottom footer). */
    .bc-cs-detail-stats-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bc-cs-detail-stats-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .bc-cs-detail-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .bc-cs-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 76px;
      padding: 8px 12px;
      border-radius: var(--bc-radius-xl);
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border-divider);
    }
    .bc-cs-stat-value {
      font-size: var(--bc-font-18);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-accent);
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .bc-cs-stat-label {
      font-size: var(--bc-font-9);
      letter-spacing: var(--bc-ls-caps-wide);
      text-transform: uppercase;
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-bold);
    }
    /* Capacity availability bar — total width = capacity. Reads like a
       "seats left" counter: left segment = available seats (colored by
       the same enrollment-pressure tones the seats-notes shopping-cart
       cards use, draining as the class fills); right segment = filled
       seats (neutral grey). */
    .bc-cs-capacity {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bc-cs-capacity-bar {
      display: flex;
      width: 100%;
      height: 10px;
      border-radius: var(--bc-radius-pill);
      overflow: hidden;
      background: var(--bc-color-surface-soft);
      border: 1px solid var(--bc-color-border-divider);
    }
    .bc-cs-capacity-avail {
      flex: 0 0 auto;
      border-right: 1px solid;
      transition: width var(--bc-tx-fast), background-color var(--bc-tx-fast);
    }
    .bc-cs-capacity-used {
      /* Neutral grey — disabled-bg leans purple in the default theme and
         beige in the pencil theme; border-strong is a true neutral muted
         grey/beige in every theme and reads cleanly as "used up". */
      background: var(--bc-color-border-strong);
      flex: 0 0 auto;
      transition: width var(--bc-tx-fast);
    }
    .bc-cs-capacity-legend {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .bc-cs-detail-block-label {
      font-size: var(--bc-font-10);
      letter-spacing: var(--bc-ls-caps-wide);
      text-transform: uppercase;
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-bold);
      margin-bottom: 4px;
    }
    .bc-cs-detail-block-body {
      font-size: var(--bc-font-13);
      color: var(--bc-color-text);
      line-height: 1.5;
      white-space: pre-line;
    }
    .bc-cs-detail-error {
      font-size: var(--bc-font-12);
      color: var(--bc-color-danger);
    }
    .bc-cs-detail-note {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      font-style: italic;
    }
    .bc-cs-detail-combined-warning {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      font-size: var(--bc-font-11);
      color: var(--bc-color-seat-warn-row-text);
      background: var(--bc-color-seat-warn-bg);
      border: 1px dashed var(--bc-color-seat-warn-row-border);
      border-radius: var(--bc-radius-sm);
      padding: 6px 10px;
      line-height: 1.4;
    }
    .bc-cs-detail-per-section {
      display: grid;
      gap: 2px;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text);
      background: var(--bc-color-bg-soft, transparent);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-sm);
      padding: 8px 10px;
    }
    .bc-cs-detail-per-section-headline {
      font-weight: var(--bc-fw-bold);
    }
    .bc-cs-detail-per-section-line {
      color: var(--bc-color-text-muted);
    }
    .bc-cs-detail-per-section-source {
      font-size: var(--bc-font-10);
      font-style: italic;
      color: var(--bc-color-text-muted);
      padding-top: 2px;
    }
    .bc-cs-detail-combined-warning-icon {
      flex: 0 0 auto;
      line-height: 1;
    }
    .bc-cs-detail-combined-warning-text {
      flex: 1 1 auto;
      min-width: 0;
    }
    .bc-cs-detail-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--bc-color-border-divider);
      margin-top: 4px;
    }
    .bc-cs-detail-stamp {
      flex: 1;
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .bc-cs-detail-refresh {
      background: transparent;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-md);
      padding: 4px 10px;
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      cursor: pointer;
      transition: color var(--bc-tx-fast), border-color var(--bc-tx-fast);
    }
    .bc-cs-detail-refresh:hover:not(:disabled) {
      color: var(--bc-color-accent);
      border-color: var(--bc-color-accent);
    }
    .bc-cs-detail-refresh:disabled {
      opacity: 0.6;
      cursor: progress;
    }

    /* Toast styles live in src/shared/toast.ts (shared across augmentations). */
  `;
}
