// Modal chart styles: KPI strip, trend chart, distribution charts
// (extracted-counts histogram + image fallback), hours density / bar /
// labels, and the multi-line ratings chart with its legend.
export function modalChartStyles(): string {
  return `
    .bc-paper-ctec-modal-kpi-strip {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 14px;
      margin-bottom: 20px;
    }
    .bc-paper-ctec-modal-kpi {
      position: relative;
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
    /* Gestalt grouping: a thin vertical line in the middle of the grid
       gap before cards that start a new conceptual section. */
    .bc-paper-ctec-modal-kpi.is-section-start::before {
      content: "";
      position: absolute;
      left: -8px;
      top: 14%;
      bottom: 14%;
      width: 1px;
      background: #d1d5db;
      pointer-events: none;
    }
    /* Global card stands out: tinted background, bigger maroon number,
       still clickable / activatable like the others. */
    .bc-paper-ctec-modal-kpi.is-global {
      background: linear-gradient(135deg, #fff7fb 0%, #fdeef5 100%);
      border-color: rgba(102, 2, 60, 0.18);
    }
    .bc-paper-ctec-modal-kpi.is-global.is-active {
      border-color: #66023c;
    }
    .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-label {
      color: #66023c;
      font-weight: 800;
    }
    .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-mean {
      font-size: 36px;
      font-weight: 800;
      color: #66023c;
      letter-spacing: -0.03em;
    }
    .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-scale {
      color: #9b6b81;
      font-weight: 600;
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
    .dark .bc-paper-ctec-modal-kpi {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(17, 24, 39, 0.4);
      color: #f5e7ee;
    }
    .dark .bc-paper-ctec-modal-kpi.is-active {
      border-color: #fbcfe8;
      box-shadow: 0 0 0 3px rgba(252, 165, 207, 0.18);
    }
    .dark .bc-paper-ctec-modal-kpi.is-section-start::before {
      background: rgba(252, 165, 207, 0.24);
    }
    .dark .bc-paper-ctec-modal-kpi.is-global {
      background: linear-gradient(135deg, rgba(102, 2, 60, 0.4) 0%, rgba(190, 24, 93, 0.32) 100%);
      border-color: rgba(252, 165, 207, 0.32);
    }
    .dark .bc-paper-ctec-modal-kpi.is-global.is-active {
      border-color: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-label {
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-mean {
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-scale {
      color: #f9a8d4;
    }
    .dark .bc-paper-ctec-modal-kpi-label {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-kpi-mean {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-kpi-scale {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-kpi-delta.is-positive { color: #6ee7b7; }
    .dark .bc-paper-ctec-modal-kpi-delta.is-negative { color: #fda4af; }
    .dark .bc-paper-ctec-modal-kpi-delta.is-muted {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-kpi-delta-note {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-kpi .bc-paper-ctec-modal-sparkline polyline {
      stroke: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-kpi .bc-paper-ctec-modal-sparkline circle {
      fill: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-card-section {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(17, 24, 39, 0.4);
      color: #f5e7ee;
    }
    .dark .bc-paper-ctec-modal-card-title {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-card-meta {
      color: #cbd5e1;
    }
    .dark .bc-paper-ctec-modal-card-cta {
      color: #f5e7ee;
      border-color: rgba(252, 165, 207, 0.18);
      background: rgba(17, 24, 39, 0.3);
    }
    .dark .bc-paper-ctec-modal-card-body {
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.92);
      color: #1f2937;
      padding: 10px 12px;
    }
  `;
}
