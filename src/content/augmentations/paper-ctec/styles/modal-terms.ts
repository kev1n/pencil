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
    .bc-paper-ctec-modal-heatmap {
      display: grid;
      grid-template-columns: 0.9fr repeat(6, 1fr);
      gap: 6px;
      align-items: center;
    }
    .bc-paper-ctec-modal-heatmap-spacer {}
    .bc-paper-ctec-modal-heatmap-header {
      font-size: 10px;
      color: #6b7280;
      font-weight: 600;
      text-align: center;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .bc-paper-ctec-modal-heatmap-term {
      padding: 8px 8px 8px 0;
      text-align: left;
      font-family: inherit;
    }
    .bc-paper-ctec-modal-heatmap-term-title {
      font-size: 12px;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-heatmap-term-sub {
      font-size: 10px;
      color: #6b7280;
    }
    .bc-paper-ctec-modal-heatmap-cell {
      color: white;
      border-radius: 6px;
      padding: 10px 0;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-modal-heatmap-cell.is-empty {
      color: #9ca3af;
      background: #f7f7f8;
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
      background: #f7f7f8;
      border-radius: 10px;
    }
    .bc-paper-ctec-modal-term-block-head {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      column-gap: 10px;
      align-items: baseline;
    }
    .bc-paper-ctec-modal-term-block-label {
      font-size: 10px;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
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
      font-size: 22px;
      font-weight: 600;
      line-height: 1;
    }
    .bc-paper-ctec-modal-term-block-unit {
      font-size: 10px;
      color: #9ca3af;
      font-weight: 500;
    }
    .bc-paper-ctec-modal-term-block-delta {
      grid-column: 1;
      grid-row: 2;
      font-size: 10px;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-term-block-delta.is-positive { color: #15803d; }
    .bc-paper-ctec-modal-term-block-delta.is-negative { color: #9f1239; }
    .bc-paper-ctec-modal-term-block-delta.is-muted {
      color: #9ca3af;
      font-weight: 400;
    }
    .bc-paper-ctec-modal-term-block-delta-note {
      color: #9ca3af;
      font-weight: 400;
    }
    .bc-paper-ctec-modal-term-block-chart {
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      background: white;
      border-radius: 8px;
    }
    .bc-paper-ctec-modal-term-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .bc-paper-ctec-modal-term-metric {
      padding: 12px 14px;
      background: #f7f7f8;
      border-radius: 8px;
    }
    .bc-paper-ctec-modal-term-metric-label {
      font-size: 10px;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .bc-paper-ctec-modal-term-metric-value {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-top: 2px;
      font-size: 20px;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-term-metric-unit {
      font-size: 10px;
      color: #9ca3af;
    }
    .bc-paper-ctec-modal-term-metric-delta {
      font-size: 10px;
      margin-top: 2px;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-term-metric-delta.is-positive { color: #15803d; }
    .bc-paper-ctec-modal-term-metric-delta.is-negative { color: #9f1239; }
    .bc-paper-ctec-modal-term-metric-delta.is-muted {
      color: #9ca3af;
      font-weight: 400;
    }
    .bc-paper-ctec-modal-term-metric-delta-note {
      color: #9ca3af;
      font-weight: 400;
    }
    .bc-paper-ctec-modal-term-charts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .bc-paper-ctec-modal-term-chart-card {
      border: 1px solid #e6e6ea;
      border-radius: 10px;
      padding: 8px 10px 10px;
      background: white;
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
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7a596a;
    }
    .bc-paper-ctec-modal-term-chart-value {
      font-size: 13px;
      font-weight: 700;
      font-family: ui-monospace, monospace;
      color: #2f1f29;
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
      border-radius: 6px;
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
    @media (max-width: 1100px) {
      .bc-paper-ctec-modal-charts,
      .bc-paper-ctec-modal-drill {
        grid-template-columns: 1fr;
      }
      .bc-paper-ctec-modal-kpi-strip {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    @media (max-width: 720px) {
      .bc-paper-ctec-modal-comments {
        grid-template-columns: 1fr;
      }
      .bc-paper-ctec-modal-rail {
        border-right: 0;
        border-bottom: 1px solid #e6e6ea;
      }
    }
    .dark .bc-paper-ctec-modal-heatmap-header {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-heatmap-term-title {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-heatmap-term-sub {
      color: #cbd5e1;
    }
    .dark .bc-paper-ctec-modal-heatmap-cell.is-empty {
      color: #d4b9c5;
      background: rgba(17, 24, 39, 0.5);
    }
    .dark .bc-paper-ctec-modal-term-block {
      background: rgba(17, 24, 39, 0.4);
      color: #f5e7ee;
    }
    .dark .bc-paper-ctec-modal-term-block-label {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-block-value {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-term-block-unit {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-block-delta.is-positive { color: #6ee7b7; }
    .dark .bc-paper-ctec-modal-term-block-delta.is-negative { color: #fda4af; }
    .dark .bc-paper-ctec-modal-term-block-delta.is-muted {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-block-delta-note {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-block-chart {
      background: rgba(255, 255, 255, 0.92);
    }
    .dark .bc-paper-ctec-modal-term-metric {
      background: rgba(17, 24, 39, 0.4);
    }
    .dark .bc-paper-ctec-modal-term-metric-label {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-metric-value {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-term-metric-unit {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-metric-delta.is-positive { color: #6ee7b7; }
    .dark .bc-paper-ctec-modal-term-metric-delta.is-negative { color: #fda4af; }
    .dark .bc-paper-ctec-modal-term-metric-delta.is-muted {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-metric-delta-note {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-chart-card {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(17, 24, 39, 0.4);
    }
    .dark .bc-paper-ctec-modal-term-chart-label {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-term-chart-value {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-term-chart-image {
      background: rgba(255, 255, 255, 0.92);
    }
    @media (max-width: 720px) {
      .dark .bc-paper-ctec-modal-rail {
        border-bottom-color: rgba(252, 165, 207, 0.14);
      }
    }
  `;
}
