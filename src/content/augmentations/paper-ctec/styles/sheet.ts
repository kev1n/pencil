// CTEC analytics side sheet (modal/view.ts and friends).
//
// Every rule is scoped under .bc-sheet, which also lifts specificity above
// the host pages' resets (paper.nu's Tailwind preflight, CAESAR's globals).
// Flat by design: hairlines between sections, no cards, no tinted boxes.
export function sheetStyles(): string {
  return `
    .bc-sheet {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483640;
      width: 464px;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      background: var(--bc-color-bg);
      border-left: 1px solid var(--bc-color-border);
      box-shadow: var(--bc-shadow-sheet);
      color: var(--bc-color-text);
      font: 14px/1.5 var(--bc-font-body);
      font-variant-numeric: tabular-nums;
      letter-spacing: normal;
      text-align: left;
      -webkit-font-smoothing: antialiased;
      animation: bc-sheet-in 140ms ease-out;
    }
    /* Inside Paper.nu's Section Info panel: no frame of its own, and the
       panel does the scrolling. */
    .bc-sheet.bc-sheet--inline {
      position: static;
      z-index: auto;
      width: auto;
      max-width: none;
      margin: 0 -16px;
      border: 0;
      background: transparent;
      box-shadow: none;
      animation: none;
    }
    .bc-sheet.bc-sheet--inline .bc-sheet-body {
      overflow: visible;
      padding-bottom: 8px;
    }
    .bc-sheet.bc-sheet--inline .bc-sheet-close {
      display: none;
    }
    @keyframes bc-sheet-in {
      from { transform: translateX(16px); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .bc-sheet { animation: none; }
    }
    .bc-sheet *,
    .bc-sheet *::before,
    .bc-sheet *::after {
      box-sizing: border-box;
    }
    .bc-sheet :where(h2, h3, p, figure) {
      margin: 0;
      padding: 0;
      font: inherit;
      color: inherit;
    }
    .bc-sheet :where(button:not(.bc-btn)) {
      appearance: none;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: none;
      box-shadow: none;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-align: inherit;
      text-transform: none;
      cursor: pointer;
    }
    .bc-sheet :where(button, a):focus-visible {
      outline: 2px solid var(--bc-color-border-strong);
      outline-offset: 1px;
    }
    .bc-sheet .bc-icon {
      flex: none;
      display: block;
    }

    /* ---------- header ---------- */
    .bc-sheet .bc-sheet-top {
      position: relative;
      z-index: 3;
      padding: 16px 24px 12px;
      background: var(--bc-color-bg);
      border-bottom: 1px solid transparent;
      transition: border-color 150ms;
    }
    .bc-sheet .bc-sheet-top.is-raised {
      border-bottom-color: var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-top-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 20px;
    }
    .bc-sheet .bc-sheet-code {
      font-size: 12.5px;
      font-weight: 500;
      color: var(--bc-color-text-muted);
      white-space: nowrap;
    }
    .bc-sheet .bc-sheet-top-right {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    /* Registering sits at the foot of the panel, clear of the numbers. */
    .bc-sheet .bc-sheet-foot {
      position: sticky;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 24px;
      background: var(--bc-color-bg);
      border-top: 1px solid var(--bc-color-border);
      font-size: 13px;
      color: var(--bc-color-text-muted);
    }
    /* Paper.nu's panel pads its scrolling box at the foot: sit over that. */
    .bc-sheet.bc-sheet--inline .bc-sheet-foot { bottom: -16px; }
    .bc-sheet .bc-sheet-foot-info {
      min-width: 0;
      flex: 1;
    }
    .bc-sheet .bc-sheet-foot small {
      display: block;
      margin-top: 3px;
      font-size: 12px;
      color: var(--bc-color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Seats: a meter of how full the class is, in the colour of how
       pressing that is. */
    .bc-sheet .bc-seat {
      --seat: var(--bc-color-success);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--bc-color-text);
    }
    .bc-sheet .bc-seat[data-tone="filling"] { --seat: var(--bc-color-warn); }
    .bc-sheet .bc-seat[data-tone="last"],
    .bc-sheet .bc-seat[data-tone="full"] { --seat: var(--bc-color-danger); }
    .bc-sheet .bc-seat b { font-weight: 600; white-space: nowrap; }
    .bc-sheet .bc-seat[data-tone="last"] b,
    .bc-sheet .bc-seat[data-tone="full"] b { color: var(--bc-color-danger); }
    .bc-sheet .bc-seat-bar {
      flex: 0 0 56px;
      height: 6px;
      border-radius: 3px;
      background: var(--bc-color-border);
      overflow: hidden;
    }
    .bc-sheet .bc-seat-bar i {
      display: block;
      height: 100%;
      min-width: 3px;
      border-radius: 3px;
      background: var(--seat);
    }
    .bc-sheet .bc-sheet-caesar {
      padding: 16px 0;
      border-bottom: 1px solid var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-caesar:last-child { border-bottom: 0; }
    .bc-sheet .bc-sheet-from-caesar .bc-sheet-caesar:first-of-type { padding-top: 4px; }
    .bc-sheet .bc-sheet-caesar .bc-seat { font-size: 16px; }
    .bc-sheet .bc-sheet-caesar .bc-seat-bar { flex-basis: 96px; height: 8px; border-radius: 4px; }
    .bc-sheet .bc-sheet-caesar-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .bc-sheet .bc-sheet-caesar-note {
      margin-top: 8px;
      font-size: 13px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-caesar-refresh {
      margin-left: 6px;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      color: var(--bc-color-text-strong);
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
    }
    .bc-sheet .bc-sheet-caesar-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 20px;
      margin: 0;
    }
    .bc-sheet .bc-sheet-caesar-grid dt {
      font-size: 12px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-caesar-grid dd {
      margin: 1px 0 0;
      font-size: 14px;
      color: var(--bc-color-text);
    }
    .bc-sheet .bc-sheet-caesar-block {
      font-size: 13.5px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      white-space: pre-line;
    }
    .bc-sheet .bc-sheet-register {
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 18px;
      border: 0;
      border-radius: var(--bc-radius-pill, 999px);
      background: var(--bc-color-cta);
      color: var(--bc-color-cta-on);
      cursor: pointer;
      white-space: nowrap;
    }
    .bc-sheet .bc-sheet-register[disabled] { opacity: 0.7; cursor: progress; }
    .bc-sheet .bc-sheet-icon-btn {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border-radius: 7px;
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-icon-btn:hover:not(:disabled) {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-icon-btn:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .bc-sheet .bc-sheet-close {
      margin-right: -6px;
    }
    .bc-sheet .bc-sheet-title {
      font-family: var(--bc-font-display);
      font-size: 20px;
      line-height: 1.25;
      font-weight: var(--bc-fw-display);
      letter-spacing: -0.01em;
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-meta {
      margin-top: 3px;
      font-size: 13px;
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-meta-sep {
      margin: 0 6px;
      color: var(--bc-color-text-subtle);
    }
    .bc-sheet .bc-sheet-link {
      color: var(--bc-color-text-strong);
      text-decoration: underline;
      text-decoration-color: var(--bc-color-border-strong);
      text-underline-offset: 3px;
    }
    .bc-sheet .bc-sheet-link:hover {
      text-decoration-color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-notice {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      font-size: 12.5px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-notice.is-error {
      color: var(--bc-color-sentiment-neg-fg);
    }
    .bc-sheet .bc-sheet-notice-x {
      flex: none;
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border-radius: 5px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-notice-x svg {
      width: 10px;
      height: 10px;
    }
    .bc-sheet .bc-sheet-notice-x:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }

    /* view menu: quiet, top right */
    .bc-sheet .bc-sheet-lens {
      position: relative;
    }
    .bc-sheet .bc-sheet-lens-btn {
      height: 28px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
      border-radius: 7px;
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
      white-space: nowrap;
    }
    .bc-sheet .bc-sheet-lens-btn:hover,
    .bc-sheet .bc-sheet-lens.is-open .bc-sheet-lens-btn {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-lens-btn svg {
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-lens-list {
      position: absolute;
      top: 32px;
      right: 0;
      min-width: 230px;
      padding: 4px;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      border-radius: 10px;
      box-shadow: var(--bc-shadow-tooltip);
    }
    .bc-sheet .bc-sheet-lens-opt {
      display: block;
      width: 100%;
      padding: 7px 10px;
      border-radius: 7px;
      font-size: 13px;
      color: var(--bc-color-text);
    }
    .bc-sheet .bc-sheet-lens-opt:hover {
      background: var(--bc-color-surface-hover);
    }
    .bc-sheet .bc-sheet-lens-opt.is-on {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-sheet .bc-sheet-lens-note {
      display: block;
      font-size: 11.5px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-lens-opt.is-on .bc-sheet-lens-note {
      color: inherit;
      opacity: 0.7;
    }
    .bc-sheet .bc-sheet-lens-adjust {
      color: var(--bc-color-text-soft);
    }

    /* term switch */
    .bc-sheet .bc-sheet-terms {
      display: flex;
      gap: 2px;
      margin: 12px -24px 0;
      padding: 0 24px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .bc-sheet .bc-sheet-terms::-webkit-scrollbar {
      display: none;
    }
    .bc-sheet .bc-sheet-term {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 9px 0 7px;
      border-radius: 7px;
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
      white-space: nowrap;
    }
    .bc-sheet .bc-sheet-term:first-child {
      margin-left: -8px;
      padding: 0 9px;
    }
    .bc-sheet .bc-sheet-term:hover:not(:disabled) {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-term.is-on {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      --bc-icon-hole: var(--bc-color-accent);
      --bc-icon-wash: var(--bc-color-accent-on);
      --bc-icon-strength: 50%;
    }
    .bc-sheet .bc-sheet-term-more {
      padding: 0 9px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-term-more:disabled {
      cursor: default;
    }
    .bc-sheet .bc-sheet-termlabel {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      vertical-align: -2px;
    }
    .bc-sheet .bc-sheet-ctx-to {
      margin: 0 6px;
    }

    /* ---------- body ---------- */
    .bc-sheet .bc-sheet-body {
      position: relative;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0 24px 40px;
      scrollbar-width: thin;
    }

    /* overall + hours pair */
    .bc-sheet .bc-sheet-sum {
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 6px 0 14px;
      border-bottom: 1px solid var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-sum-cell + .bc-sheet-sum-cell {
      padding-left: 20px;
      border-left: 1px solid var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-sum-big {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .bc-sheet .bc-sheet-sum-chip,
    .bc-sheet .bc-sheet-sum-num {
      font-size: 26px;
      line-height: 36px;
      font-weight: 650;
      letter-spacing: -0.02em;
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-sum-chip {
      padding: 0 9px;
      border-radius: 9px;
      background: var(--bc-sheet-chip-bg);
      color: var(--bc-sheet-chip-fg);
    }
    [data-bc-mode="dark"] .bc-sheet .bc-sheet-sum-chip {
      background: var(--bc-sheet-chip-bg-dark);
      color: var(--bc-sheet-chip-fg-dark);
    }
    .bc-sheet .bc-sheet-sum-chip.is-empty {
      padding: 0;
      background: none;
      color: var(--bc-color-text-subtle);
    }
    .bc-sheet .bc-sheet-sum-unit {
      font-size: 13px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-sum-label {
      margin-top: 2px;
      font-size: 13px;
      color: var(--bc-color-text-soft);
    }

    /* sections */
    .bc-sheet .bc-sheet-sec {
      position: relative;
      padding: 13px 0 14px;
      border-bottom: 1px solid var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-sec-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .bc-sheet .bc-sheet-sec-title {
      font-size: 14px;
      line-height: 1.5;
      font-weight: 600;
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-sec-ctx {
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-empty {
      padding: 14px 0 4px;
      font-size: 13px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-empty .bc-sheet-termlabel {
      color: var(--bc-color-text-soft);
    }

    /* rating rows */
    .bc-sheet .bc-sheet-rate {
      display: grid;
      grid-template-columns: 84px 1fr 30px 80px;
      align-items: center;
      column-gap: 12px;
      height: 26px;
    }
    .bc-sheet .bc-sheet-rate-label {
      font-size: 13px;
      color: var(--bc-color-text);
    }
    .bc-sheet .bc-sheet-rate-bar {
      position: relative;
      height: 6px;
      border-radius: 3px;
      background: var(--bc-color-surface-hover);
      overflow: hidden;
    }
    .bc-sheet .bc-sheet-rate-fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      border-radius: 3px;
      background: var(--bc-sheet-fill);
      transition: width 120ms;
    }
    [data-bc-mode="dark"] .bc-sheet .bc-sheet-rate-fill {
      background: var(--bc-sheet-fill-dark);
    }
    .bc-sheet .bc-sheet-rate-val {
      font-size: 13px;
      font-weight: 600;
      color: var(--bc-color-text-strong);
      text-align: right;
    }
    .bc-sheet .bc-sheet-rate-val.is-empty {
      font-weight: 400;
      color: var(--bc-color-text-subtle);
    }
    .bc-sheet .bc-sheet-rate-note {
      font-size: 11.5px;
      color: var(--bc-color-text-muted);
      text-align: right;
      white-space: nowrap;
    }
    .bc-sheet .bc-sheet-spark {
      display: block;
      overflow: visible;
      cursor: crosshair;
    }
    .bc-sheet .bc-sheet-spark-line {
      fill: none;
      stroke: var(--bc-color-text-soft);
      stroke-width: 1.4;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .bc-sheet .bc-sheet-spark-dot {
      fill: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-rates.is-scrub .bc-sheet-spark-line {
      stroke: var(--bc-color-text-subtle);
    }
    .bc-sheet .bc-sheet-rates.is-scrub .bc-sheet-rate-val {
      color: var(--bc-color-chart);
    }
    .bc-sheet .bc-sheet-spark-guide {
      position: absolute;
      top: 42px;
      bottom: 14px;
      width: 1px;
      background: var(--bc-color-border-strong);
      pointer-events: none;
    }
    .bc-sheet .bc-sheet-dist {
      display: block;
    }
    .bc-sheet .bc-sheet-dist-hit {
      fill: transparent;
    }
    .bc-sheet .bc-sheet-dist-bar.is-zero {
      opacity: 0.35;
    }
    .bc-sheet .bc-sheet-dist:hover .bc-sheet-dist-k:not(:hover) .bc-sheet-dist-bar {
      opacity: 0.4;
    }

    /* a chart we couldn't read into bars: the report's own picture */
    .bc-sheet .bc-sheet-original {
      margin-top: 10px;
    }
    .bc-sheet .bc-sheet-original figcaption {
      margin-bottom: 4px;
      font-size: 12px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-original img {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }

    /* hours histogram */
    .bc-sheet .bc-sheet-hist {
      display: grid;
      gap: 6px;
    }
    .bc-sheet .bc-sheet-hist-col {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      text-align: center;
    }
    .bc-sheet .bc-sheet-hist-pct {
      height: 16px;
      font-size: 11.5px;
      line-height: 16px;
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-hist-track {
      position: relative;
      height: 40px;
      border-bottom: 1px solid var(--bc-color-border-strong);
    }
    .bc-sheet .bc-sheet-hist-bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 3px 3px 0 0;
      background: var(--bc-color-chart);
      opacity: 0.85;
    }
    .bc-sheet .bc-sheet-hist-bar.is-zero {
      background: none;
    }
    .bc-sheet .bc-sheet-hist-col:hover .bc-sheet-hist-bar {
      opacity: 1;
    }
    .bc-sheet .bc-sheet-hist-col:hover .bc-sheet-hist-pct {
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-hist-lab {
      margin-top: 5px;
      font-size: 11.5px;
      color: var(--bc-color-text-muted);
      white-space: nowrap;
    }

    /* ---------- comments ---------- */
    .bc-sheet .bc-sheet-com {
      padding-top: 4px;
    }
    .bc-sheet .bc-sheet-com-head {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      column-gap: 12px;
      row-gap: 8px;
      margin: 0 -24px;
      padding: 10px 24px;
      background: var(--bc-color-bg);
      border-bottom: 1px solid var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-tones {
      display: flex;
    }
    .bc-sheet .bc-sheet-tone {
      height: 26px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0 6px;
      border-radius: 7px;
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-tone:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-tone-n {
      color: var(--bc-color-text-subtle);
    }
    .bc-sheet .bc-sheet-tone[data-tone="pos"] .bc-sheet-tone-name {
      color: var(--bc-color-sentiment-pos-fg);
    }
    .bc-sheet .bc-sheet-tone[data-tone="mix"] .bc-sheet-tone-name {
      color: var(--bc-color-sentiment-mix-fg);
    }
    .bc-sheet .bc-sheet-tone[data-tone="neu"] .bc-sheet-tone-name {
      color: var(--bc-color-sentiment-neu-fg);
    }
    .bc-sheet .bc-sheet-tone[data-tone="neg"] .bc-sheet-tone-name {
      color: var(--bc-color-sentiment-neg-fg);
    }
    .bc-sheet .bc-sheet-tone.is-on {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-sheet .bc-sheet-tone.is-on .bc-sheet-tone-name {
      color: var(--bc-color-accent-on);
    }
    .bc-sheet .bc-sheet-tone.is-empty:not(.is-on) {
      opacity: 0.45;
    }

    .bc-sheet .bc-sheet-search {
      flex: 1 0 100%;
      height: 30px;
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 0;
      padding: 0 10px;
      border-radius: 8px;
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-muted);
      cursor: text;
    }
    .bc-sheet .bc-sheet-search:focus-within {
      background: var(--bc-color-bg);
      box-shadow: inset 0 0 0 1px var(--bc-color-border-strong);
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-search svg {
      flex: none;
    }
    .bc-sheet .bc-sheet-search input {
      appearance: none;
      flex: 1;
      min-width: 0;
      height: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      outline: 0;
      box-shadow: none;
      background: none;
      font: inherit;
      font-size: 13px;
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-search input::placeholder {
      color: var(--bc-color-text-muted);
      opacity: 1;
    }
    .bc-sheet .bc-sheet-search input::-webkit-search-cancel-button {
      display: none;
    }
    .bc-sheet .bc-sheet-search-clear {
      display: none;
      flex: none;
      width: 20px;
      height: 20px;
      margin-right: -4px;
      place-items: center;
      border-radius: 5px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-search.has-value .bc-sheet-search-clear {
      display: grid;
    }
    .bc-sheet .bc-sheet-search-clear:hover {
      color: var(--bc-color-text-strong);
    }

    /* phrases that keep coming up; clicking one searches for it */
    .bc-sheet .bc-sheet-topics {
      padding: 12px 0 10px;
      border-bottom: 1px solid var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-topics-title {
      margin-bottom: 7px;
      font-size: 12px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-topic-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .bc-sheet .bc-sheet-topic {
      height: 26px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0 10px 0 6px;
      border-radius: 13px;
      background: var(--bc-color-surface-hover);
      font-size: 12.5px;
      color: var(--bc-color-text);
      --bc-icon-hole: var(--bc-color-surface-hover);
    }
    .bc-sheet .bc-sheet-topic-n {
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-topic:hover {
      color: var(--bc-color-text-strong);
      box-shadow: inset 0 0 0 1px var(--bc-color-border-strong);
    }
    .bc-sheet .bc-sheet-topic.is-on {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      box-shadow: none;
      --bc-icon-hole: var(--bc-color-accent);
      --bc-icon-wash: var(--bc-color-accent-on);
      --bc-icon-strength: 45%;
      --bc-icon-tint: 0%;
    }
    .bc-sheet .bc-sheet-topic.is-on .bc-sheet-topic-n {
      color: inherit;
      opacity: 0.6;
    }

    .bc-sheet .bc-sheet-com-list {
      padding-top: 4px;
    }
    .bc-sheet .bc-sheet-c {
      display: grid;
      grid-template-columns: 16px 1fr;
      column-gap: 11px;
      padding: 9px 0;
    }
    .bc-sheet .bc-sheet-c > .bc-icon {
      margin-top: 2px;
    }
    .bc-sheet .bc-sheet-c-main {
      min-width: 0;
    }
    .bc-sheet .bc-sheet-c-prompt {
      margin-bottom: 1px;
      font-size: 12px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-c-text {
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--bc-color-text);
      overflow-wrap: anywhere;
    }
    .bc-sheet .bc-sheet-c-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 3px;
      font-size: 12px;
      color: var(--bc-color-text-muted);
    }
    /* search matches: ink underline, never a tint */
    .bc-sheet mark.bc-sheet-q {
      background: none;
      color: var(--bc-color-text-strong);
      font-weight: 600;
      text-decoration: underline 2px var(--bc-color-text-strong);
      text-underline-offset: 3px;
    }
    .bc-sheet .bc-sheet-more {
      margin-top: 8px;
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
      text-decoration: underline;
      text-decoration-color: var(--bc-color-border-strong);
      text-underline-offset: 3px;
    }
    .bc-sheet .bc-sheet-more:hover {
      color: var(--bc-color-text-strong);
      text-decoration-color: var(--bc-color-text-strong);
    }

    /* ---------- nothing to show yet ---------- */
    .bc-sheet .bc-sheet-status,
    .bc-sheet .bc-sheet-wiz {
      padding: 10px 0 0;
      border-top: 1px solid var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-status-title,
    .bc-sheet .bc-sheet-wiz-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      line-height: 1.5;
      font-weight: 600;
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-status-text,
    .bc-sheet .bc-sheet-wiz-text,
    .bc-sheet .bc-sheet-wiz-status {
      margin: 2px 0 12px;
      font-size: 13px;
      color: var(--bc-color-text-soft);
      overflow-wrap: anywhere;
    }

    /* ---------- "pick a broader view" ---------- */
    .bc-sheet .bc-sheet-wiz-back {
      margin-bottom: 4px;
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
      text-decoration: underline;
      text-decoration-color: var(--bc-color-border-strong);
      text-underline-offset: 3px;
    }
    .bc-sheet .bc-sheet-wiz-back:hover {
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-wiz-head {
      margin: 18px 0 6px;
      font-size: 12.5px;
      font-weight: var(--bc-fw-regular);
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-wiz-terms {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-wiz-term {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .bc-sheet .bc-sheet-wiz-row--all .bc-sheet-wiz-row-title {
      font-weight: var(--bc-fw-regular);
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-wiz-list {
      border-bottom: 1px solid var(--bc-color-border);
    }
    .bc-sheet .bc-sheet-wiz-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: calc(100% + 16px);
      margin: 0 -8px;
      padding: 10px 8px;
      border-top: 1px solid var(--bc-color-border);
      cursor: pointer;
    }
    .bc-sheet .bc-sheet-wiz-row:hover:not(:disabled) {
      background: var(--bc-color-surface-hover);
    }
    .bc-sheet .bc-sheet-wiz-row:disabled {
      cursor: default;
    }
    .bc-sheet .bc-sheet-wiz-row:disabled .bc-sheet-wiz-row-title {
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-wiz-row-body {
      display: flex;
      flex-direction: column;
      min-width: 0;
      text-align: left;
    }
    .bc-sheet .bc-sheet-wiz-row-title {
      font-size: 13.5px;
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
    }
    .bc-sheet .bc-sheet-wiz-row-about {
      font-size: 12.5px;
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-wiz-row-meta {
      flex: none;
      font-size: 12.5px;
      color: var(--bc-color-text-muted);
    }
    .bc-sheet .bc-sheet-wiz-preset {
      justify-content: flex-start;
      gap: 10px;
    }
    .bc-sheet .bc-sheet-wiz-preset input {
      flex: none;
      margin: 0;
      accent-color: var(--bc-color-accent);
    }
    .bc-sheet .bc-sheet-wiz-preset-body {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .bc-sheet .bc-sheet-wiz-preset-body > .bc-sheet-wiz-row-meta {
      margin-bottom: 4px;
    }
    .bc-sheet .bc-sheet-wiz-preview {
      display: grid;
      grid-template-columns: 104px 1fr;
      column-gap: 8px;
      align-items: center;
      min-height: 22px;
      font-size: 12.5px;
      color: var(--bc-color-text);
    }
    .bc-sheet .bc-sheet-wiz-preview-what {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--bc-color-text-soft);
    }
    .bc-sheet .bc-sheet-wiz-foot {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }
    .bc-sheet .bc-sheet-wiz-foot > span {
      flex: 1;
      font-size: 12.5px;
      color: var(--bc-color-text-muted);
    }

    /* Hours curve in the chip hover preview (hours-density.ts). */
    .bc-paper-ctec-modal-dist-empty {
      padding: 22px 18px;
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-12);
      text-align: center;
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
  `;
}
