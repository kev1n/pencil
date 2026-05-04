import { maxWidth } from "../../../design/breakpoints";

// Terms tab styles: heatmap (term × metric grid with cells colored by mean),
// the per-term drill-down (metrics, charts, fallback images), and the
// responsive media queries that collapse the modal layout on small viewports.
export function modalTermStyles(): string {
  return `
    .bc-paper-ctec-modal-terms {
      padding: 24px 32px 36px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .bc-paper-ctec-modal-heatmap-wrap {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-paper-ctec-modal-heatmap-toggle {
      align-self: center;
      appearance: none;
      border: 1px solid var(--bc-color-accent-border-32);
      background: var(--bc-color-accent-fill-12);
      color: var(--bc-color-accent-soft);
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      padding: 5px 12px;
      border-radius: var(--bc-radius-md);
      cursor: pointer;
    }
    .bc-paper-ctec-modal-heatmap-toggle:hover {
      background: var(--bc-color-accent-fill-22);
    }
    .bc-paper-ctec-modal-heatmap {
      display: grid;
      gap: 6px;
      align-items: center;
    }
    .bc-paper-ctec-modal-heatmap-spacer {}
    /* Group label row above the metric headers — matches the KPI strip
       categories (Overall / Quality / Character / Workload). */
    .bc-paper-ctec-modal-heatmap-group {
      padding: 4px 8px;
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-caps-widest);
      text-transform: uppercase;
      color: var(--bc-color-text-muted);
      text-align: center;
      border-radius: var(--bc-radius-md);
      background: var(--bc-color-ink-fill-04);
    }
    .bc-paper-ctec-modal-heatmap-group.is-group-overall {
      color: var(--bc-color-accent-soft);
      background: var(--bc-color-accent-fill-08);
    }
    .bc-paper-ctec-modal-heatmap-header {
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-semibold);
      text-align: center;
      letter-spacing: var(--bc-ls-caps);
      text-transform: uppercase;
    }
    .bc-paper-ctec-modal-heatmap-header.is-group-overall {
      color: var(--bc-color-accent-soft);
    }
    .bc-paper-ctec-modal-heatmap-term {
      padding: 8px 8px 8px 0;
      text-align: left;
      font-family: inherit;
    }
    .bc-paper-ctec-modal-heatmap-term-title {
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-heatmap-term-sub {
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-heatmap-cell {
      /* Cell background is set inline by JS (saturated heatmap scale color),
         so text must stay near-white in both light and dark modes. */
      color: var(--bc-color-on-saturated);
      border-radius: var(--bc-radius-md);
      padding: 10px 0;
      text-align: center;
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-modal-heatmap-cell.is-empty {
      color: var(--bc-color-text-subtle);
      background: var(--bc-color-surface-hover);
    }
    .bc-paper-ctec-modal-drill {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .bc-paper-ctec-modal-term-blocks {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }
    .bc-paper-ctec-modal-term-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: var(--bc-color-surface-hover);
      border-radius: var(--bc-radius-xl);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-term-block-head {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      column-gap: 10px;
      align-items: baseline;
    }
    .bc-paper-ctec-modal-term-block-label {
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-semibold);
      text-transform: uppercase;
      letter-spacing: var(--bc-ls-caps);
      grid-column: 1;
      grid-row: 1;
    }
    .bc-paper-ctec-modal-term-block-value {
      grid-column: 2;
      grid-row: 1 / span 2;
      align-self: center;
      display: flex;
      align-items: baseline;
      gap: 4px;
      font-size: var(--bc-font-22);
      font-weight: var(--bc-fw-semibold);
      line-height: 1;
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-term-block-unit {
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-subtle);
      font-weight: var(--bc-fw-medium);
    }
    .bc-paper-ctec-modal-term-block-delta {
      grid-column: 1;
      grid-row: 2;
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-term-block-delta.is-positive { color: var(--bc-color-success); }
    .bc-paper-ctec-modal-term-block-delta.is-negative { color: var(--bc-color-danger-rose); }
    .bc-paper-ctec-modal-term-block-delta.is-muted {
      color: var(--bc-color-text-subtle);
      font-weight: var(--bc-fw-regular);
    }
    .bc-paper-ctec-modal-term-block-delta-note {
      color: var(--bc-color-text-subtle);
      font-weight: var(--bc-fw-regular);
    }
    .bc-paper-ctec-modal-term-block-chart {
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      background: var(--bc-color-surface-hover-strong);
      border-radius: var(--bc-radius-lg);
    }
    .bc-paper-ctec-modal-term-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .bc-paper-ctec-modal-term-metric {
      padding: 12px 14px;
      background: var(--bc-color-surface-hover);
      border-radius: var(--bc-radius-lg);
    }
    .bc-paper-ctec-modal-term-metric-label {
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-semibold);
      text-transform: uppercase;
      letter-spacing: var(--bc-ls-caps);
    }
    .bc-paper-ctec-modal-term-metric-value {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-top: 2px;
      font-size: var(--bc-font-20);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-term-metric-unit {
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-modal-term-metric-delta {
      font-size: var(--bc-font-10);
      margin-top: 2px;
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-term-metric-delta.is-positive { color: var(--bc-color-success); }
    .bc-paper-ctec-modal-term-metric-delta.is-negative { color: var(--bc-color-danger-rose); }
    .bc-paper-ctec-modal-term-metric-delta.is-muted {
      color: var(--bc-color-text-subtle);
      font-weight: var(--bc-fw-regular);
    }
    .bc-paper-ctec-modal-term-metric-delta-note {
      color: var(--bc-color-text-subtle);
      font-weight: var(--bc-fw-regular);
    }
    .bc-paper-ctec-modal-term-charts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .bc-paper-ctec-modal-term-chart-card {
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-xl);
      padding: 8px 10px 10px;
      background: var(--bc-color-surface-hover);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bc-paper-ctec-modal-term-chart-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .bc-paper-ctec-modal-term-chart-label {
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      color: var(--bc-color-chart-trend-text-strong);
    }
    .bc-paper-ctec-modal-term-chart-value {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-bold);
      font-family: ui-monospace, monospace;
      color: var(--bc-color-text-mauve-deep);
    }
    .bc-paper-ctec-modal-term-chart-body {
      min-height: 110px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bc-paper-ctec-modal-term-chart-image {
      max-width: 100%;
      max-height: 160px;
      width: 100%;
      display: block;
      border-radius: var(--bc-radius-md);
      background: transparent;
    }
    .bc-paper-ctec-modal-term-chart-image img.bc-paper-ctec-chart-histogram-fallback {
      max-width: 100%;
      max-height: 160px;
      width: auto;
      margin: 0 auto;
      display: block;
    }
    .bc-paper-ctec-modal-term-chart-image .bc-paper-ctec-histogram-svg {
      max-height: 180px;
    }
    @media ${maxWidth("xxl")} {
      .bc-paper-ctec-modal-charts,
      .bc-paper-ctec-modal-drill {
        grid-template-columns: 1fr;
      }
    }
    @media ${maxWidth("md")} {
      .bc-paper-ctec-modal-comments {
        grid-template-columns: 1fr;
      }
      .bc-paper-ctec-modal-rail {
        border-right: 0;
        border-bottom: 1px solid var(--bc-color-border);
      }
    }
  `;
}
