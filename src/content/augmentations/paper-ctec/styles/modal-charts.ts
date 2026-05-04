import { maxWidth } from "../../../design/breakpoints";
import { trendZoneDarkRules } from "../chart-zones";

// Modal chart styles: KPI strip, trend chart, distribution charts
// (extracted-counts histogram + image fallback), hours density / bar /
// labels, and the multi-line ratings chart with its legend.
export function modalChartStyles(): string {
  return `
    /* Outer strip is one column per gestalt group; each group's column
       width is set via the --bc-paper-ctec-kpi-cols custom property
       (set on the element by overview.ts based on card count) so cards
       end up roughly the same visual width across groups. Using a
       custom property — instead of inline grid-template-columns — lets
       the responsive media queries below override the layout at narrow
       widths. */
    .bc-paper-ctec-modal-kpi-strip {
      display: grid;
      grid-template-columns: var(--bc-paper-ctec-kpi-cols, 1fr);
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
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-caps-widest);
      text-transform: uppercase;
      color: var(--bc-color-text-muted);
    }
    /* The labeled rectangle. Holds the group's KPI cards in an even grid
       and gives the gestalt grouping an actual visible boundary. */
    .bc-paper-ctec-modal-kpi-group-cards {
      display: grid;
      grid-template-columns: var(--bc-paper-ctec-kpi-card-cols, 1fr);
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-2xl);
      background: var(--bc-color-ink-fill-025);
      min-width: 0;
    }
    /* Tablet: stack groups vertically so each gets full width. The
       inner card grid stays as-is (e.g. Quality keeps 3 cards side by
       side) since the row now has the whole modal width to spend. */
    @media ${maxWidth("xxl")} {
      .bc-paper-ctec-modal-kpi-strip {
        grid-template-columns: 1fr;
      }
    }
    /* Phone: let the inner card grids wrap so 3-card groups (Quality)
       break to two rows instead of cramming. Tighten card padding and
       value font-size so the pill + sparkline still fit on ~140px wide
       columns. */
    @media ${maxWidth("sm")} {
      .bc-paper-ctec-modal-kpi-group-cards {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      }
      .bc-paper-ctec-modal-kpi {
        padding: 10px 12px;
      }
      .bc-paper-ctec-modal-kpi-mean {
        font-size: var(--bc-font-20);
      }
      .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-mean {
        font-size: var(--bc-font-28);
      }
    }
    .bc-paper-ctec-modal-kpi {
      position: relative;
      border: 1px solid var(--bc-color-border);
      background: var(--bc-color-bg);
      padding: 14px 16px;
      border-radius: var(--bc-radius-xl);
      cursor: pointer;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-family: inherit;
    }
    .bc-paper-ctec-modal-kpi.is-active {
      border-color: var(--bc-color-accent);
      box-shadow: var(--bc-shadow-kpi-active-ring);
    }
    /* Global card stands out: tinted background, bigger maroon number,
       still clickable / activatable like the others. */
    .bc-paper-ctec-modal-kpi.is-global {
      background: linear-gradient(135deg, var(--bc-color-accent-surface-faint) 0%, var(--bc-color-accent-surface-soft) 100%);
      border-color: var(--bc-color-accent-border-18);
    }
    .bc-paper-ctec-modal-kpi.is-global.is-active {
      border-color: var(--bc-color-accent);
    }
    .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-label {
      color: var(--bc-color-accent);
      font-weight: var(--bc-fw-extrabold);
    }
    .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-mean {
      font-size: var(--bc-font-36);
      letter-spacing: -0.03em;
    }
    .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-mean.is-empty {
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-modal-kpi.is-global .bc-paper-ctec-modal-kpi-scale {
      color: var(--bc-color-text-mauve-cool);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-kpi-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .bc-paper-ctec-modal-kpi-label {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-semibold);
      letter-spacing: var(--bc-ls-caps);
      text-transform: uppercase;
    }
    .bc-paper-ctec-modal-kpi-label-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bc-paper-ctec-modal-kpi-info,
    .bc-paper-ctec-modal-info-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: var(--bc-radius-circle);
      border: 1px solid currentColor;
      font-family: ui-serif, Georgia, "Times New Roman", serif;
      font-style: italic;
      font-weight: var(--bc-fw-bold);
      font-size: var(--bc-font-10);
      line-height: 1;
      letter-spacing: 0;
      text-transform: none;
      opacity: 0.55;
      cursor: help;
      vertical-align: middle;
    }
    .bc-paper-ctec-modal-kpi-info:hover,
    .bc-paper-ctec-modal-kpi-info:focus-visible,
    .bc-paper-ctec-modal-tip-host:hover .bc-paper-ctec-modal-info-icon,
    .bc-paper-ctec-modal-tip-host:focus-visible .bc-paper-ctec-modal-info-icon {
      opacity: 1;
      outline: none;
    }
    /* Generic tooltip component. Apply .bc-paper-ctec-modal-tip-host to the
       trigger element and append a child <span class="bc-paper-ctec-modal-tip">.
       Add .is-right when the host sits near the right edge of its container
       so the popup hugs the right side instead of overflowing. */
    .bc-paper-ctec-modal-tip-host {
      position: relative;
    }
    .bc-paper-ctec-modal-tip {
      position: absolute;
      top: calc(100% + 8px);
      left: -8px;
      width: min(260px, calc(100vw - 32px));
      padding: 10px 12px;
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-text);
      color: var(--bc-color-text-on-tooltip);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-medium);
      font-style: normal;
      line-height: 1.45;
      letter-spacing: 0;
      text-transform: none;
      text-align: left;
      white-space: normal;
      word-break: normal;
      overflow-wrap: anywhere;
      box-shadow: var(--bc-shadow-tooltip);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity var(--bc-tx-base) var(--bc-easing), visibility var(--bc-tx-base) var(--bc-easing);
      z-index: 2147483647;
    }
    .bc-paper-ctec-modal-tip.is-right {
      left: auto;
      right: 0;
    }
    .bc-paper-ctec-modal-tip::before {
      content: "";
      position: absolute;
      bottom: 100%;
      left: 14px;
      border: 6px solid transparent;
      border-bottom-color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-tip.is-right::before {
      left: auto;
      right: 14px;
    }
    .bc-paper-ctec-modal-tip-host:hover .bc-paper-ctec-modal-tip,
    .bc-paper-ctec-modal-tip-host:focus-visible .bc-paper-ctec-modal-tip,
    .bc-paper-ctec-modal-tip-host:focus-within .bc-paper-ctec-modal-tip {
      opacity: 1;
      visibility: visible;
    }
    .bc-paper-ctec-modal-kpi-value {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    /* Value pill — mirrors the schedule-card chip style (see styles/cards.ts
       .bc-paper-ctec-chip + .bc-paper-ctec-chip-value): pill border-radius,
       same hue-driven bg/border/fg vars set per-card in renderKpiPill. The
       font-size is the only intentional departure: the chip uses 10px, but
       this is a KPI strip so we keep it ~24px (36px for Global). */
    .bc-paper-ctec-modal-kpi-mean {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-paper-ctec-kpi-border, transparent);
      background: var(--bc-paper-ctec-kpi-bg, transparent);
      color: var(--bc-paper-ctec-kpi-fg, inherit);
      font-size: var(--bc-font-24);
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-tight);
      line-height: 1.1;
    }
    .bc-paper-ctec-modal-kpi-mean.is-empty {
      background: transparent;
      border-color: transparent;
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-modal-kpi-mean.is-stars {
      padding: 4px 6px;
      background: transparent;
      border-color: transparent;
    }
    .bc-paper-ctec-modal-kpi-scope {
      margin: -8px 0 12px;
      padding: 6px 10px;
      border-radius: var(--bc-radius-md);
      background: var(--bc-color-ink-fill-04);
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-11);
      line-height: 1.4;
    }
    .bc-paper-ctec-modal-kpi-scale {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-modal-kpi-delta {
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-kpi-delta.is-positive { color: var(--bc-color-success); }
    .bc-paper-ctec-modal-kpi-delta.is-negative { color: var(--bc-color-danger-rose); }
    .bc-paper-ctec-modal-kpi-delta.is-muted {
      color: var(--bc-color-text-subtle);
      font-weight: var(--bc-fw-regular);
    }
    .bc-paper-ctec-modal-kpi-delta-note {
      color: var(--bc-color-text-subtle);
      font-weight: var(--bc-fw-regular);
    }
    .bc-paper-ctec-modal-charts {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }
    .bc-paper-ctec-modal-card-section {
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-2xl);
      padding: 16px 20px 18px;
      background: var(--bc-color-bg);
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
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-card-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-card-cta {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text);
      text-decoration: none;
      border: 1px solid var(--bc-color-border);
      padding: 4px 9px;
      border-radius: var(--bc-radius-md);
    }
    .bc-paper-ctec-modal-trend-empty {
      height: 200px;
      display: grid;
      place-items: center;
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-13);
      background: var(--bc-color-surface-hover);
      border-radius: var(--bc-radius-lg);
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
      border-radius: var(--bc-radius-md);
      background: var(--bc-color-bg);
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
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-subtle);
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
      font-size: var(--bc-font-11);
      color: var(--bc-color-danger-text-pill);
      background: var(--bc-color-danger-bg-pill);
      padding: 4px 8px;
      border-radius: var(--bc-radius-sm);
      text-align: center;
      max-width: 100%;
      word-break: break-word;
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-modal-dist-empty {
      padding: 22px 18px;
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-12);
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
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-subtle);
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
      background: var(--bc-color-accent);
      border-radius: 3px 3px 0 0;
      min-height: 2px;
    }
    .bc-paper-ctec-modal-dist-label {
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-subtle);
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
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-multibar-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bc-paper-ctec-modal-multibar-legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: var(--bc-radius-xs);
      display: inline-block;
    }
    .bc-paper-ctec-modal-hours-bar {
      display: flex;
      height: 28px;
      border-radius: var(--bc-radius-md);
      overflow: hidden;
      border: 1px solid var(--bc-color-border);
    }
    .bc-paper-ctec-modal-hours-seg {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-hours-labels {
      display: grid;
      gap: 6px;
    }
    .bc-paper-ctec-modal-hours-labels > div {
      font-size: var(--bc-font-9);
      color: var(--bc-color-text-subtle);
      text-align: center;
    }
    .bc-paper-ctec-modal-hours-summary {
      margin-top: 4px;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-hours-summary strong {
      color: var(--bc-color-text);
    }
    .dark .bc-paper-ctec-modal-kpi-mean {
      border-color: var(--bc-paper-ctec-kpi-border-dark, transparent);
      background: var(--bc-paper-ctec-kpi-bg-dark, transparent);
      color: var(--bc-paper-ctec-kpi-fg-dark, var(--bc-color-text));
    }
    /* Override SVG inline fill/stroke on chart elements via CSS attribute
       selectors. CSS fill/stroke takes precedence over SVG presentation
       attributes, so [stroke="#xxx"] { stroke: ... } actually flips them.
       These selectors target literal hex/rgba values emitted by the JS
       SVG generation, so they must match the hardcoded source strings —
       we cannot replace them with design tokens. */
    .dark .bc-paper-ctec-modal-trend-svg [stroke="#f1ebef"] { stroke: #525252; }
    .dark .bc-paper-ctec-modal-trend-svg [fill="#9b8290"] { fill: #a3a3a3; }
    ${trendZoneDarkRules(".bc-paper-ctec-modal-trend-svg")}
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
    .dark .bc-paper-ctec-histogram-svg [stroke="#475569"] { stroke: #a3a3a3; }
    .dark .bc-paper-ctec-histogram-svg [fill="#475569"] { fill: #a3a3a3; }
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
