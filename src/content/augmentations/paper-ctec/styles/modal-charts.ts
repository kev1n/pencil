// Modal chart styles: KPI strip, trend chart, distribution charts
// (extracted-counts histogram + image fallback), hours density / bar /
// labels, and the multi-line ratings chart with its legend.
export function modalChartStyles(): string {
  return `
    /* Outer strip is one column per gestalt group; each group's column
       width is set inline by the renderer based on card count so cards
       end up roughly the same visual width across groups. */
    .bc-paper-ctec-modal-kpi-strip {
      display: grid;
      gap: 14px;
      margin-bottom: 20px;
    }
    .bc-paper-ctec-modal-kpi-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .bc-paper-ctec-modal-kpi-group-label {
      padding-left: 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #6b7280;
    }
    /* The labeled rectangle. Holds the group's KPI cards in an even grid
       and gives the gestalt grouping an actual visible boundary. */
    .bc-paper-ctec-modal-kpi-group-cards {
      display: grid;
      gap: 8px;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.025);
      min-width: 0;
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
    .bc-paper-ctec-modal-kpi-label-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bc-paper-ctec-modal-kpi-info {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid currentColor;
      font-family: ui-serif, Georgia, "Times New Roman", serif;
      font-style: italic;
      font-weight: 700;
      font-size: 10px;
      line-height: 1;
      letter-spacing: 0;
      text-transform: none;
      opacity: 0.55;
      cursor: help;
    }
    .bc-paper-ctec-modal-kpi-info:hover,
    .bc-paper-ctec-modal-kpi-info:focus-visible {
      opacity: 1;
      outline: none;
    }
    .bc-paper-ctec-modal-kpi-tooltip {
      position: absolute;
      top: calc(100% + 8px);
      left: -8px;
      width: 260px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #1f2937;
      color: #f9fafb;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.45;
      letter-spacing: 0;
      text-transform: none;
      text-align: left;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 120ms ease, visibility 120ms ease;
      z-index: 2147483647;
    }
    .bc-paper-ctec-modal-kpi-tooltip::before {
      content: "";
      position: absolute;
      bottom: 100%;
      left: 14px;
      border: 6px solid transparent;
      border-bottom-color: #1f2937;
    }
    .bc-paper-ctec-modal-kpi-info:hover .bc-paper-ctec-modal-kpi-tooltip,
    .bc-paper-ctec-modal-kpi-info:focus-visible .bc-paper-ctec-modal-kpi-tooltip {
      opacity: 1;
      visibility: visible;
    }
    .dark .bc-paper-ctec-modal-kpi-tooltip {
      background: #525252;
      color: #fafafa;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }
    .dark .bc-paper-ctec-modal-kpi-tooltip::before {
      border-bottom-color: #525252;
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
    .bc-paper-ctec-modal-global-section {
      margin-bottom: 28px;
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
      border-color: #404040;
      background: #404040;
      color: #fafafa;
    }
    .dark .bc-paper-ctec-modal-kpi.is-active {
      border-color: #d8b4fe;
      box-shadow: 0 0 0 3px rgba(216, 180, 254, 0.18);
    }
    .dark .bc-paper-ctec-modal-kpi-group-label {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-kpi-group-cards {
      border-color: rgba(248, 250, 252, 0.18);
      background: rgba(248, 250, 252, 0.05);
    }
    .dark .bc-paper-ctec-modal-kpi.is-global {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.18) 0%, rgba(168, 85, 247, 0.08) 100%);
      border-color: rgba(216, 180, 254, 0.32);
    }
    .dark .bc-paper-ctec-modal-kpi.is-global.is-active {
      border-color: #d8b4fe;
    }
    .dark .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-label {
      color: #d8b4fe;
    }
    .dark .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-mean {
      color: #d8b4fe;
    }
    .dark .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-scale {
      color: #c4b5fd;
    }
    .dark .bc-paper-ctec-modal-kpi-label {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-kpi-mean {
      color: #fafafa;
    }
    .dark .bc-paper-ctec-modal-kpi-scale {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-kpi-delta.is-positive { color: #6ee7b7; }
    .dark .bc-paper-ctec-modal-kpi-delta.is-negative { color: #fda4af; }
    .dark .bc-paper-ctec-modal-kpi-delta.is-muted {
      color: #737373;
    }
    .dark .bc-paper-ctec-modal-kpi-delta-note {
      color: #737373;
    }
    .dark .bc-paper-ctec-modal-card-section {
      border-color: #404040;
      background: #404040;
      color: #fafafa;
    }
    .dark .bc-paper-ctec-modal-card-title {
      color: #fafafa;
    }
    .dark .bc-paper-ctec-modal-card-meta {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-card-cta {
      color: #fafafa;
      border-color: #525252;
      background: #525252;
    }
    .dark .bc-paper-ctec-modal-trend-empty {
      color: #a3a3a3;
      background: #262626;
    }
    .dark .bc-paper-ctec-chart-histogram-loading {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-chart-histogram-error {
      color: #fda4af;
      background: rgba(127, 29, 29, 0.32);
    }
    .dark .bc-paper-ctec-modal-dist-image {
      background: transparent;
    }
    .dark .bc-paper-ctec-modal-dist-empty {
      background: #262626;
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-dist-num {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-dist-bar {
      background: #d8b4fe;
    }
    .dark .bc-paper-ctec-modal-dist-label {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-multibar-legend {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-hours-bar {
      border-color: #525252;
    }
    .dark .bc-paper-ctec-modal-hours-labels > div {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-hours-summary {
      color: #a3a3a3;
    }
    .dark .bc-paper-ctec-modal-hours-summary strong {
      color: #fafafa;
    }
    /* Override SVG inline fill/stroke on chart elements via CSS attribute
       selectors. CSS fill/stroke takes precedence over SVG presentation
       attributes, so [stroke="#xxx"] { stroke: ... } actually flips them. */
    .dark .bc-paper-ctec-modal-trend-svg [stroke="#f1ebef"] { stroke: #525252; }
    .dark .bc-paper-ctec-modal-trend-svg [fill="#9b8290"] { fill: #a3a3a3; }
    .dark .bc-paper-ctec-modal-trend-svg [fill="rgba(102,2,60,0.08)"] { fill: rgba(216, 180, 254, 0.12); }
    .dark .bc-paper-ctec-modal-trend-svg [stroke="#66023c"] { stroke: #d8b4fe; }
    .dark .bc-paper-ctec-modal-trend-svg [fill="#66023c"] { fill: #d8b4fe; }
    .dark .bc-paper-ctec-modal-trend-svg [fill="white"] { fill: #262626; }
    .dark .bc-paper-ctec-modal-trend-svg [fill="#7a596a"] { fill: #a3a3a3; }
    .dark .bc-paper-ctec-modal-sparkline [stroke="#66023c"] { stroke: #d8b4fe; }
    .dark .bc-paper-ctec-modal-sparkline [fill="#66023c"] { fill: #d8b4fe; }
    .dark .bc-paper-ctec-histogram-svg [stroke="#e6e6ea"] { stroke: #525252; }
    .dark .bc-paper-ctec-histogram-svg [fill="#6b7280"] { fill: #a3a3a3; }
    .dark .bc-paper-ctec-histogram-svg [fill="#9ca3af"] { fill: #a3a3a3; }
    .dark .bc-paper-ctec-histogram-svg [fill="#3a2730"] { fill: #fafafa; }
    .dark .bc-paper-ctec-histogram-svg [stroke="#66023c"] { stroke: #d8b4fe; }
    .dark .bc-paper-ctec-histogram-svg [fill="#66023c"] { fill: #d8b4fe; }
    .dark .bc-paper-ctec-histogram-svg [fill="white"] { fill: #1f1147; }
    .dark .bc-paper-ctec-modal-hours-density-svg [stroke="#e6e6ea"] { stroke: #525252; }
    .dark .bc-paper-ctec-modal-hours-density-svg [fill="#6b7280"] { fill: #a3a3a3; }
    .dark .bc-paper-ctec-modal-hours-density-svg [fill="#9ca3af"] { fill: #a3a3a3; }
    .dark .bc-paper-ctec-modal-hours-density-svg [stroke="#66023c"] { stroke: #d8b4fe; }
    .dark .bc-paper-ctec-modal-hours-density-svg [fill="#66023c"] { fill: #d8b4fe; }
    .dark .bc-paper-ctec-modal-hours-density-svg [stroke="#475569"] { stroke: #a3a3a3; }
    .dark .bc-paper-ctec-modal-hours-density-svg [fill="#475569"] { fill: #a3a3a3; }
    .dark .bc-paper-ctec-modal-hours-density-svg [fill="white"] { fill: #1f1147; }
    .dark .bc-paper-ctec-histogram-svg stop[stop-color="rgba(102,2,60,0.45)"] { stop-color: rgba(216, 180, 254, 0.5); }
    .dark .bc-paper-ctec-histogram-svg stop[stop-color="rgba(102,2,60,0.05)"] { stop-color: rgba(216, 180, 254, 0.05); }
    .dark .bc-paper-ctec-modal-hours-density-svg stop[stop-color="rgba(102,2,60,0.45)"] { stop-color: rgba(216, 180, 254, 0.5); }
    .dark .bc-paper-ctec-modal-hours-density-svg stop[stop-color="rgba(102,2,60,0.05)"] { stop-color: rgba(216, 180, 254, 0.05); }
    /* Distribution image fallback (raw PNG from Bluera) — inverted so the
       light-on-light chart becomes light-on-dark in the modal. */
    .dark .bc-paper-ctec-modal-dist-image img,
    .dark .bc-paper-ctec-modal-term-chart-image img {
      filter: invert(0.92) hue-rotate(180deg);
    }
  `;
}
