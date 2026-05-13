import { maxWidth } from "../../../design/breakpoints";

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
       value font-size so the pill still fits on ~140px wide columns. */
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
      container-type: inline-size;
    }
    /* Drop the band on narrow cards instead of letting it overflow the
       right edge. 165px clears the longest band+label pairs. */
    @container (max-width: 165px) {
      .bc-paper-ctec-modal-kpi-band {
        display: none;
      }
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
      align-items: baseline;
      gap: 8px;
    }
    .bc-paper-ctec-modal-kpi-label {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-semibold);
      letter-spacing: var(--bc-ls-caps);
      text-transform: uppercase;
      white-space: nowrap;
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
    .bc-paper-ctec-modal-info-icon {
      margin-left: 8px;
    }
    .bc-paper-ctec-modal-kpi-info:hover,
    .bc-paper-ctec-modal-kpi-info:focus-visible,
    .bc-tooltip-host:hover .bc-paper-ctec-modal-info-icon,
    .bc-tooltip-host:focus-visible .bc-paper-ctec-modal-info-icon {
      opacity: 1;
      outline: none;
    }
    .bc-paper-ctec-modal-kpi-value {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    /* Value pill — mirrors the schedule-card chip style (see styles/cards.ts
       .bc-paper-ctec-chip + .bc-paper-ctec-chip-value): pill border-radius,
       same hue-driven bg/border/fg vars set per-card in kpiPillTemplate. The
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
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-kpi-band {
      flex-shrink: 0;
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-semibold);
      letter-spacing: 0.2px;
      color: var(--bc-color-text-muted);
      white-space: nowrap;
      pointer-events: none;
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
    /* Make the averages card fill the global grid row's full height so it
       lines up with the distribution card on the right. The grid already
       stretches its row, but we need the wrapper → card → body chain to
       all be flex columns with flex:1 so the bars list actually receives
       that height and distributes its rows into it. */
    .bc-paper-ctec-modal-global-section {
      margin-bottom: 0;
      display: flex;
      flex-direction: column;
    }
    .bc-paper-ctec-modal-global-section > .bc-paper-ctec-modal-card-section {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .bc-paper-ctec-modal-global-section .bc-paper-ctec-modal-card-body {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    /* Side-by-side layout for the Global view: averages bars on the left,
       workload distribution on the right. Falls back to a single column on
       narrow screens (matching the rest of the modal's xxl breakpoint). */
    .bc-paper-ctec-modal-global-grid {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
      align-items: stretch;
    }
    .bc-paper-ctec-modal-global-grid > * { min-width: 0; }
    @media ${maxWidth("xxl")} {
      .bc-paper-ctec-modal-global-grid {
        grid-template-columns: 1fr;
      }
    }
    /* Per-metric horizontal bar list shown in the Global view in place of
       the old Term × Metric heatmap. Each row: [label] [grey track w/
       primary-color fill, dotted gridlines at every integer, terminator
       arrow above the fill end] [value / scale]. */
    .bc-paper-ctec-modal-global-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }
    /* The six component-metric bars distribute themselves over whatever
       vertical space is left in the card after the global headline row.
       space-between pins the first/last bars to the edges and spreads the
       others evenly between, which scales nicely with the matching card's
       (workload distribution) height. */
    .bc-paper-ctec-modal-global-bars-rest {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding-top: 8px;
      border-top: 1px solid var(--bc-color-border);
      flex: 1;
      justify-content: space-between;
    }
    .bc-paper-ctec-modal-global-bar {
      display: grid;
      grid-template-columns: 132px 1fr 60px;
      align-items: center;
      gap: 10px;
    }
    .bc-paper-ctec-modal-global-bar.is-global {
      grid-template-columns: 132px 1fr 60px;
    }
    .bc-paper-ctec-modal-global-bar-label {
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--bc-ls-caps);
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-global-bar.is-global .bc-paper-ctec-modal-global-bar-label {
      color: var(--bc-color-accent);
      font-weight: var(--bc-fw-extrabold);
      font-size: var(--bc-font-13);
    }
    /* Wrapper so the terminator arrow can sit just above the track without
       being clipped by it. padding-top reserves exactly the arrow's height
       (5px) so the arrow tip lands flush against the track's top edge. */
    .bc-paper-ctec-modal-global-bar-chart {
      position: relative;
      padding-top: 5px;
    }
    /* Reserve clearance above/below the track for tick labels. The Global
       row labels above (covers the shared rating scale); the Hours row
       labels below (every 5h). */
    .bc-paper-ctec-modal-global-bar-chart.has-top-labels {
      padding-top: 18px;
    }
    .bc-paper-ctec-modal-global-bar-chart.has-bottom-labels {
      padding-bottom: 14px;
    }
    .bc-paper-ctec-modal-global-bar-track {
      position: relative;
      width: 100%;
      height: 10px;
      background: var(--bc-color-surface-hover);
      border-radius: var(--bc-radius-pill);
    }
    .bc-paper-ctec-modal-global-bar.is-global .bc-paper-ctec-modal-global-bar-track {
      height: 16px;
    }
    .bc-paper-ctec-modal-global-bar-tick {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 1px solid var(--bc-color-text-subtle);
      opacity: 0.55;
      pointer-events: none;
      z-index: 1;
    }
    .bc-paper-ctec-modal-global-bar-tick-label {
      position: absolute;
      transform: translateX(-50%);
      font-size: var(--bc-font-9);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      font-family: ui-monospace, monospace;
      line-height: 1;
      pointer-events: none;
      z-index: 2;
    }
    .bc-paper-ctec-modal-global-bar-tick-label.is-above {
      top: 2px;
    }
    .bc-paper-ctec-modal-global-bar-tick-label.is-below {
      bottom: 0;
    }
    .bc-paper-ctec-modal-global-bar-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      background: var(--bc-paper-ctec-bar-fill, var(--bc-color-accent));
      border-radius: var(--bc-radius-pill);
      z-index: 0;
    }
    .dark .bc-paper-ctec-modal-global-bar-fill {
      background: var(--bc-paper-ctec-bar-fill-dark, var(--bc-color-accent));
    }
    /* Downward-pointing triangle anchored flush against the top edge of
       the track at the fill's right edge — calls attention to where the
       bar terminates. CSS triangle so edges stay sharp at any DPR. Color
       intentionally distinct from the accent fill so the marker reads
       above the bar instead of blending into it. */
    .bc-paper-ctec-modal-global-bar-arrow {
      position: absolute;
      bottom: 100%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 5px solid var(--bc-color-text);
      pointer-events: none;
      z-index: 2;
    }
    .bc-paper-ctec-modal-global-bar-value {
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text);
      font-family: ui-monospace, monospace;
      text-align: right;
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-global-bar.is-global .bc-paper-ctec-modal-global-bar-value {
      font-size: var(--bc-font-15);
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-modal-global-bar-scale {
      margin-left: 2px;
      font-size: var(--bc-font-9);
      font-weight: var(--bc-fw-regular);
      color: var(--bc-color-text-subtle);
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
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-display);
      letter-spacing: 0;
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
    /* Horizontal-bar rating distribution. One row per rating value (6 → 1
       top to bottom): [label] [grey track w/ accent fill] [count]. Bar
       width is scaled to the row with the highest count so the shape of
       the distribution is the focus rather than the absolute response
       volume (which the footer carries instead). */
    .bc-paper-ctec-chart-horizontal {
      width: 100%;
    }
    .bc-paper-ctec-chart-horizontal-loading {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-subtle);
      padding: 24px 0;
      text-align: center;
    }
    .bc-paper-ctec-chart-horizontal-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bc-paper-ctec-chart-horizontal-row {
      display: grid;
      grid-template-columns: 22px 1fr 36px;
      align-items: center;
      gap: 10px;
    }
    .bc-paper-ctec-chart-horizontal-label {
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text-muted);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .bc-paper-ctec-chart-horizontal-track {
      position: relative;
      width: 100%;
      height: 14px;
      background: var(--bc-color-surface-hover);
      border-radius: var(--bc-radius-pill);
      overflow: hidden;
    }
    .bc-paper-ctec-chart-horizontal-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      background: var(--bc-color-accent);
      border-radius: var(--bc-radius-pill);
      min-width: 0;
    }
    .bc-paper-ctec-chart-horizontal-value {
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
      font-family: ui-monospace, monospace;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .bc-paper-ctec-chart-horizontal-fallback-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: 100%;
    }
    .bc-paper-ctec-chart-horizontal-fallback {
      max-width: 100%;
      max-height: 160px;
      width: auto;
      display: block;
    }
    .bc-paper-ctec-chart-horizontal-error {
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
    /* SVG fill/stroke colors are emitted by JS via style.fill/style.stroke
       with var(--bc-color-*) references, so they switch automatically with
       the active theme + dark-mode mirror — no per-attribute overrides
       needed here. (Chart-zone bands consume --bc-color-trend-zone-*
       which swap by theme directly, replacing the old explicit overrides.) */
    /* Distribution image fallback (raw PNG from Bluera) — inverted so the
       light-on-light chart becomes light-on-dark in the modal. */
    .dark .bc-paper-ctec-modal-dist-image img,
    .dark .bc-paper-ctec-modal-term-chart-image img {
      filter: invert(0.92) hue-rotate(180deg);
    }
  `;
}
