// Modal chart styles: KPI strip, trend chart, distribution charts
// (extracted-counts histogram + image fallback), hours density / bar /
// labels, and the multi-line ratings chart with its legend.
export function modalChartStyles(): string {
  return `
    .bc-paper-ctec-modal-kpi-strip {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 14px;
      margin-bottom: 20px;
    }
    .bc-paper-ctec-modal-kpi {
      border: 1px solid #e6e6ea;
      background: white;
      padding: 14px 16px;
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-family: inherit;
    }
    .bc-paper-ctec-modal-kpi.is-active {
      border-color: #66023c;
      box-shadow: 0 0 0 3px rgba(102, 2, 60, 0.08);
    }
    .bc-paper-ctec-modal-kpi-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .bc-paper-ctec-modal-kpi-label {
      font-size: 11px;
      color: #6b7280;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .bc-paper-ctec-modal-kpi-value {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .bc-paper-ctec-modal-kpi-mean {
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .bc-paper-ctec-modal-kpi-scale {
      font-size: 11px;
      color: #9ca3af;
    }
    .bc-paper-ctec-modal-kpi-delta {
      font-size: 11px;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-kpi-delta.is-positive { color: #15803d; }
    .bc-paper-ctec-modal-kpi-delta.is-negative { color: #9f1239; }
    .bc-paper-ctec-modal-kpi-delta.is-muted {
      color: #9ca3af;
      font-weight: 400;
    }
    .bc-paper-ctec-modal-kpi-delta-note {
      color: #9ca3af;
      font-weight: 400;
    }
    .bc-paper-ctec-modal-charts {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }
    .bc-paper-ctec-modal-card-section {
      border: 1px solid #e6e6ea;
      border-radius: 12px;
      padding: 16px 20px 18px;
      background: white;
    }
    .bc-paper-ctec-modal-card-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 14px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-modal-card-title {
      font-size: 13px;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-card-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 11px;
      color: #6b7280;
    }
    .bc-paper-ctec-modal-card-cta {
      font-size: 11px;
      color: #1f2937;
      text-decoration: none;
      border: 1px solid #e6e6ea;
      padding: 4px 9px;
      border-radius: 6px;
    }
    .bc-paper-ctec-modal-trend-empty {
      height: 200px;
      display: grid;
      place-items: center;
      color: #6b7280;
      font-size: 13px;
      background: #f7f7f8;
      border-radius: 8px;
    }
    .bc-paper-ctec-modal-trend {
      width: 100%;
    }
    .bc-paper-ctec-modal-trend-svg {
      width: 100%;
      height: 220px;
      display: block;
    }
    .bc-paper-ctec-modal-dist-rating,
    .bc-paper-ctec-modal-dist-hours {
      display: grid;
      gap: 6px;
      height: 160px;
      align-items: end;
    }
    .bc-paper-ctec-modal-dist-rating {
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
    }
    .bc-paper-ctec-modal-dist-image {
      max-width: 100%;
      max-height: 220px;
      width: 100%;
      display: block;
      margin: 0 auto;
      border-radius: 6px;
      background: #fff;
    }
    .bc-paper-ctec-modal-dist-image img.bc-paper-ctec-chart-histogram-fallback {
      max-width: 100%;
      max-height: 220px;
      width: auto;
      display: block;
      margin: 0 auto;
    }
    .bc-paper-ctec-chart-histogram {
      width: 100%;
      min-height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bc-paper-ctec-chart-histogram-loading {
      font-size: 11px;
      color: #9ca3af;
      padding: 24px 0;
    }
    .bc-paper-ctec-histogram-svg {
      display: block;
      width: 100%;
      height: auto;
    }
    .bc-paper-ctec-chart-histogram-fallback-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: 100%;
    }
    .bc-paper-ctec-chart-histogram-error {
      font-size: 11px;
      color: #b03d3d;
      background: #fdecec;
      padding: 4px 8px;
      border-radius: 4px;
      text-align: center;
      max-width: 100%;
      word-break: break-word;
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-modal-dist-empty {
      padding: 22px 18px;
      border-radius: 8px;
      background: #f7f7f8;
      color: #6b7280;
      font-size: 12px;
      text-align: center;
    }
    .bc-paper-ctec-modal-dist-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      height: 100%;
    }
    .bc-paper-ctec-modal-dist-num {
      font-size: 10px;
      color: #9ca3af;
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-modal-dist-track {
      flex: 1;
      display: flex;
      align-items: end;
      width: 100%;
    }
    .bc-paper-ctec-modal-dist-bar {
      width: 100%;
      background: #66023c;
      border-radius: 3px 3px 0 0;
      min-height: 2px;
    }
    .bc-paper-ctec-modal-dist-label {
      font-size: 10px;
      color: #9ca3af;
    }
    .bc-paper-ctec-modal-hours-strip {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bc-paper-ctec-modal-hours-density {
      width: 100%;
    }
    .bc-paper-ctec-modal-hours-density-svg {
      display: block;
      width: 100%;
      height: auto;
      max-height: 220px;
    }
    .bc-paper-ctec-modal-multibar {
      width: 100%;
    }
    .bc-paper-ctec-modal-multibar-svg {
      display: block;
      width: 100%;
      height: auto;
      max-height: 280px;
    }
    .bc-paper-ctec-modal-multibar-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
      margin-top: 12px;
      font-size: 11px;
      color: #6b7280;
    }
    .bc-paper-ctec-modal-multibar-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bc-paper-ctec-modal-multibar-legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      display: inline-block;
    }
    .bc-paper-ctec-modal-hours-bar {
      display: flex;
      height: 28px;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e6e6ea;
    }
    .bc-paper-ctec-modal-hours-seg {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 600;
    }
    .bc-paper-ctec-modal-hours-labels {
      display: grid;
      gap: 6px;
    }
    .bc-paper-ctec-modal-hours-labels > div {
      font-size: 9px;
      color: #9ca3af;
      text-align: center;
    }
    .bc-paper-ctec-modal-hours-summary {
      margin-top: 4px;
      font-size: 12px;
      color: #6b7280;
    }
    .bc-paper-ctec-modal-hours-summary strong {
      color: #1f2937;
    }
  `;
}
