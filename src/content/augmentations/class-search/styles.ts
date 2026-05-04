import { maxWidth } from "../../design/breakpoints";

export const STYLE_ID = "better-caesar-class-search-styles";

export function classSearchStyles(): string {
  return `
    .bc-cs-root {
      position: relative;
      margin: 12px auto 32px;
      max-width: 1180px;
      padding: 0 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      color: var(--bc-color-text);
      box-sizing: border-box;
    }
    .bc-cs-root *, .bc-cs-root *::before, .bc-cs-root *::after { box-sizing: border-box; }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .bc-cs-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .bc-cs-title {
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-22);
      font-weight: var(--bc-fw-regular);
      letter-spacing: 0;
      color: var(--bc-color-text);
      margin: 0;
    }
    .bc-cs-subtitle {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      line-height: 1.4;
    }
    .bc-cs-subtitle a { color: var(--bc-color-text); text-decoration: underline; text-decoration-color: var(--bc-color-border-strong); }
    .bc-cs-subtitle a:hover { text-decoration-color: var(--bc-color-text); }

    /* ── Tabs ───────────────────────────────────────────────────────────── */
    /* Sit flush with the top edge of the card below: only the active tab
       is "lifted" into the surface; inactive tabs are flat with muted
       text. The negative margin pulls the active tab over the card border. */
    .bc-cs-tabs {
      display: flex;
      gap: 2px;
      max-width: 1180px;
      margin: 12px auto 0;
      padding: 0 16px;
      border-bottom: 1px solid var(--bc-color-border-divider);
    }
    .bc-cs-tab {
      position: relative;
      bottom: -1px;
      background: transparent;
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: var(--bc-radius-lg) var(--bc-radius-lg) 0 0;
      padding: 8px 14px;
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-regular);
      letter-spacing: 0;
      color: var(--bc-color-text-muted);
      cursor: pointer;
      transition: color var(--bc-tx-fast), background-color var(--bc-tx-fast);
    }
    .bc-cs-tab:hover {
      color: var(--bc-color-text);
      background: var(--bc-color-surface-hover);
    }
    .bc-cs-tab[data-active="true"] {
      background: var(--bc-color-bg);
      border-color: var(--bc-color-border-divider);
      color: var(--bc-color-text);
      box-shadow: var(--bc-shadow-card-soft);
    }
    .bc-cs-tab[data-active="true"]:hover {
      background: var(--bc-color-bg);
    }
    #better-caesar-class-search-panel { margin-top: 24px; }

    /* ── Card / form ────────────────────────────────────────────────────── */
    .bc-cs-card {
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-2xl);
      padding: 14px;
      box-shadow: var(--bc-shadow-elev-1);
    }
    .bc-cs-form {
      display: grid;
      grid-template-columns: minmax(280px, 3fr) minmax(180px, 1fr);
      gap: 12px;
      align-items: end;
    }
    .bc-cs-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .bc-cs-field label {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-caps);
      color: var(--bc-color-text-muted);
      text-transform: uppercase;
    }
    .bc-cs-input, .bc-cs-select {
      width: 100%;
      font: inherit;
      font-size: var(--bc-font-14);
      padding: 8px 10px;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-bg);
      color: var(--bc-color-text);
      transition: border-color 100ms, box-shadow 100ms;
    }
    .bc-cs-input:focus, .bc-cs-select:focus {
      outline: none;
      border-color: var(--bc-color-accent);
      box-shadow:
        var(--bc-shadow-input-focus-ring),
        var(--bc-shadow-input-focus-inner);
    }
    .bc-cs-input-query {
      font-size: var(--bc-font-16);
      padding: 12px 14px;
      letter-spacing: 0.005em;
    }
    .bc-cs-input::placeholder { color: var(--bc-color-text-subtle); }

    /* ── Filter pills ───────────────────────────────────────────────────── */
    .bc-cs-toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--bc-color-border-divider);
      align-items: center;
    }
    .bc-cs-checkbox {
      display: inline-flex;
      gap: 5px;
      align-items: center;
      padding: 4px 10px;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
      background: var(--bc-color-surface-soft);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-pill);
      cursor: pointer;
      user-select: none;
      transition: background-color var(--bc-tx-fast), border-color var(--bc-tx-fast);
    }
    .bc-cs-checkbox:hover {
      border-color: var(--bc-color-border-strong);
      background: var(--bc-color-bg);
    }
    .bc-cs-checkbox input {
      accent-color: var(--bc-color-accent);
      margin: 0;
      width: 12px;
      height: 12px;
    }
    .bc-cs-checkbox:has(input:checked) {
      background: var(--bc-color-accent-surface-tile);
      border-color: var(--bc-color-accent-border-18);
      color: var(--bc-color-accent-pressed);
    }
    .bc-cs-clear {
      margin-left: auto;
      background: transparent;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-lg);
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      padding: 5px 10px;
      cursor: pointer;
      transition: color var(--bc-tx-fast), border-color var(--bc-tx-fast);
    }
    .bc-cs-clear:hover {
      color: var(--bc-color-accent);
      border-color: var(--bc-color-accent);
    }

    /* ── Status row ─────────────────────────────────────────────────────── */
    .bc-cs-status {
      margin-top: 10px;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 16px;
    }
    .bc-cs-status[data-state="error"] { color: var(--bc-color-danger); }
    .bc-cs-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid var(--bc-color-accent-fill-18);
      border-top-color: var(--bc-color-accent);
      border-radius: var(--bc-radius-circle);
      animation: bc-cs-spin 0.7s linear infinite;
    }
    @keyframes bc-cs-spin { to { transform: rotate(360deg); } }

    .bc-cs-meta { font-size: var(--bc-font-11); color: var(--bc-color-text-muted); }

    /* ── Results ────────────────────────────────────────────────────────── */
    .bc-cs-results {
      margin-top: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-cs-empty {
      padding: 32px 20px;
      text-align: center;
      color: var(--bc-color-text-muted);
      border: 1px dashed var(--bc-color-border-divider);
      border-radius: var(--bc-radius-2xl);
      background: var(--bc-color-surface-soft);
    }

    /* "Your classes" cards: shown only when the search box is empty so
       the user lands on a useful at-a-glance summary of cart + enrolled.
       The search-results path (renderResults) reuses .bc-cs-results, so
       these elements are removed automatically as soon as a query types. */
    .bc-cs-myclasses { display: flex; flex-direction: column; gap: 8px; }
    .bc-cs-myclasses-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      padding: 0 4px;
    }
    .bc-cs-myclasses-label {
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-regular);
      color: var(--bc-color-text);
    }
    .bc-cs-myclasses-count {
      font-size: var(--bc-font-11);
      letter-spacing: var(--bc-ls-wide);
      color: var(--bc-color-text-muted);
    }
    .bc-cs-myclasses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 8px;
    }
    .bc-cs-myclass-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-lg);
      box-shadow: var(--bc-shadow-card-soft);
    }
    .bc-cs-myclass-card[data-status="enrolled"] {
      border-left: 3px solid var(--bc-color-success, var(--bc-color-border-strong));
    }
    .bc-cs-myclass-card[data-status="in-cart"] {
      border-left: 3px solid var(--bc-color-paper, var(--bc-color-border-strong));
    }
    .bc-cs-myclass-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .bc-cs-myclass-id {
      font-family: var(--bc-font-mono, monospace);
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text);
    }
    .bc-cs-myclass-section {
      font-size: var(--bc-font-11);
      letter-spacing: var(--bc-ls-wide);
      color: var(--bc-color-text-muted);
    }
    .bc-cs-myclass-title {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text);
      line-height: 1.35;
    }
    .bc-cs-myclass-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bc-cs-myclass-badge {
      display: inline-flex;
      align-items: center;
      height: 20px;
      padding: 0 8px;
      border-radius: var(--bc-radius-pill);
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wider);
      box-sizing: border-box;
      line-height: 1;
    }
    .bc-cs-myclass-badge[data-status="enrolled"] {
      background: var(--bc-color-success-bg);
      color: var(--bc-color-success);
    }
    .bc-cs-myclass-badge[data-status="in-cart"] {
      background: var(--bc-color-paper-soft);
      color: var(--bc-color-paper);
    }
    .bc-cs-myclass-detail {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      line-height: 1.4;
    }

    .bc-cs-course {
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-2xl);
      overflow: hidden;
      transition: border-color 100ms, box-shadow 100ms;
    }
    .bc-cs-course:hover {
      border-color: var(--bc-color-border-strong);
      box-shadow: var(--bc-shadow-elev-2);
    }

    .bc-cs-course-head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      padding: 12px 16px;
      align-items: baseline;
      cursor: pointer;
      background: var(--bc-color-bg-app);
      border-bottom: 1px solid var(--bc-color-border-strong);
    }
    .bc-cs-course-id {
      font-family: var(--bc-font-mono);
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text);
      letter-spacing: var(--bc-ls-wide);
    }
    .bc-cs-course-title {
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-regular);
      letter-spacing: 0;
      color: var(--bc-color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-course-units {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .bc-cs-course-tags {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
    }
    .bc-cs-tag {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      padding: 3px 8px;
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-paper-soft);
      color: var(--bc-color-paper-deep);
      letter-spacing: var(--bc-ls-wider);
      line-height: 1.4;
      text-transform: none;
    }
    /* paper.nu-sourced tags keep their purple tint to read as
       "from paper.nu". */
    .bc-cs-tag[data-kind="distro"]     { background: var(--bc-color-success-distro-bg); color: var(--bc-color-success-distro-text); }
    .bc-cs-tag[data-kind="discipline"] { background: var(--bc-color-warn-bg); color: var(--bc-color-warn-text-discipline); }
    .bc-cs-tag[data-kind="school"]     { background: var(--bc-color-paper-soft); color: var(--bc-color-paper); }
    .bc-cs-tag[data-kind="open"]       { background: var(--bc-color-success-bg); color: var(--bc-color-success); }
    .bc-cs-tag[data-kind="closed"]     { background: var(--bc-color-danger-bg); color: var(--bc-color-danger); }
    .bc-cs-tag[data-kind="wait"]       { background: var(--bc-color-warn-bg); color: var(--bc-color-warn); }

    /* Refresh button: small icon-only at the right end of the tags row.
       Hidden by inline display:none until live data first paints, so a
       cold card stays uncluttered. */
    .bc-cs-refresh-btn {
      margin-left: auto;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid var(--bc-color-border-divider);
      border-radius: 50%;
      background: transparent;
      color: var(--bc-color-text-muted);
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color var(--bc-tx-fast), border-color var(--bc-tx-fast), background-color var(--bc-tx-fast), transform var(--bc-tx-fast);
    }
    .bc-cs-refresh-btn:hover {
      color: var(--bc-color-text);
      border-color: var(--bc-color-border-strong);
      background: var(--bc-color-surface-hover);
    }
    .bc-cs-refresh-btn[data-state="loading"],
    .bc-cs-refresh-btn.is-spinning {
      cursor: progress;
      animation: bc-cs-spin 0.9s linear infinite;
    }
    @keyframes bc-cs-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .bc-cs-course-desc {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      padding: 6px 16px 12px;
      line-height: 1.5;
    }

    /* ── Section rows ───────────────────────────────────────────────────── */
    .bc-cs-section-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .bc-cs-section {
      display: grid;
      grid-template-columns: 80px 64px minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 16px;
      border-top: 1px solid var(--bc-color-border-divider);
      font-size: var(--bc-font-13);
      transition: background-color var(--bc-tx-fast);
    }
    .bc-cs-section:hover { background: var(--bc-color-surface-soft); }
    .bc-cs-section-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
    }
    .bc-cs-section-component { color: var(--bc-color-text-muted); font-size: var(--bc-font-12); }
    .bc-cs-section-time { color: var(--bc-color-text); font-size: var(--bc-font-12); line-height: 1.4; }
    .bc-cs-section-time .bc-cs-mute { color: var(--bc-color-text-subtle); font-size: var(--bc-font-11); }
    .bc-cs-section-instructor {
      color: var(--bc-color-text);
      font-size: var(--bc-font-12);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-section-room {
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-11);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-section-live {
      font-size: var(--bc-font-11);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      color: var(--bc-color-text-muted);
    }
    .bc-cs-section-live[data-tone="muted"] {
      color: var(--bc-color-text-subtle);
      font-style: italic;
    }

    .bc-cs-status-pill {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-surface-soft);
      color: var(--bc-color-text-muted);
      border: 1px solid var(--bc-color-border-divider);
      line-height: 1.4;
    }
    .bc-cs-status-pill[data-status="Open"]      { background: var(--bc-color-success-bg); color: var(--bc-color-success); border-color: transparent; }
    .bc-cs-status-pill[data-status="Closed"]    { background: var(--bc-color-danger-bg);  color: var(--bc-color-danger);  border-color: transparent; }
    .bc-cs-status-pill[data-status="Wait List"] { background: var(--bc-color-warn-bg);    color: var(--bc-color-warn);    border-color: transparent; }

    .bc-cs-section-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .bc-cs-details-btn {
      background: transparent;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-lg);
      padding: 5px 10px;
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      cursor: pointer;
      transition: color var(--bc-tx-fast), border-color var(--bc-tx-fast), background-color var(--bc-tx-fast);
    }
    .bc-cs-details-btn:hover {
      color: var(--bc-color-text);
      border-color: var(--bc-color-border-strong);
      background: var(--bc-color-surface-hover);
    }
    .bc-cs-details-btn[data-expanded="true"] {
      background: var(--bc-color-surface-hover-strong);
      color: var(--bc-color-text);
      border-color: var(--bc-color-border-strong);
    }

    /* ── Add-to-cart: primary CAESAR CTA ────────────────────────────────── */
    .bc-cs-add {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      border: 1px solid var(--bc-color-accent);
      border-radius: var(--bc-radius-lg);
      padding: 6px 12px;
      font: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      cursor: pointer;
      transition: background-color 100ms, transform var(--bc-tx-fast), box-shadow 100ms;
    }
    .bc-cs-add:hover {
      background: var(--bc-color-accent-hover);
      border-color: var(--bc-color-accent-hover);
      box-shadow: var(--bc-shadow-add-cta);
    }
    .bc-cs-add:active { transform: translateY(1px); box-shadow: none; }
    .bc-cs-add[disabled] {
      background: var(--bc-color-disabled-bg);
      border-color: var(--bc-color-disabled-bg);
      cursor: progress;
      box-shadow: none;
    }
    .bc-cs-add[data-state="loading"] {
      background: var(--bc-color-accent-hover);
      border-color: var(--bc-color-accent-hover);
      cursor: progress;
    }
    .bc-cs-add[data-state="success"] {
      background: var(--bc-color-success);
      border-color: var(--bc-color-success);
    }
    .bc-cs-add[data-state="error"] {
      background: var(--bc-color-danger);
      border-color: var(--bc-color-danger);
    }

    /* ── Related-component picker (lab/discussion required) ──────────────── */
    .bc-cs-related-row {
      display: block;
      padding: 0;
      border-top: 1px solid var(--bc-color-border-divider);
      background: var(--bc-color-accent-surface-tile);
    }
    .bc-cs-related {
      padding: 12px 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-cs-related-header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .bc-cs-related-title {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-accent-pressed);
    }
    .bc-cs-related-sub {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      flex: 1;
    }
    .bc-cs-related-cancel {
      appearance: none;
      background: transparent;
      border: 1px solid var(--bc-color-border-strong);
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-12);
      padding: 4px 10px;
      border-radius: var(--bc-radius-md);
      cursor: pointer;
    }
    .bc-cs-related-cancel:hover {
      background: var(--bc-color-surface-soft);
      color: var(--bc-color-text);
    }
    .bc-cs-related-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bc-cs-related-option {
      appearance: none;
      width: 100%;
      text-align: left;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-lg);
      padding: 10px 12px;
      cursor: pointer;
      display: grid;
      grid-template-columns: minmax(80px, auto) minmax(160px, 1fr) minmax(120px, auto);
      gap: 12px;
      align-items: center;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text);
      transition: border-color 0.12s, box-shadow 0.12s, transform 0.04s;
    }
    .bc-cs-related-option:hover:not(:disabled) {
      border-color: var(--bc-color-accent);
      box-shadow: var(--bc-shadow-input-focus-ring);
    }
    .bc-cs-related-option:active:not(:disabled) {
      transform: translateY(1px);
    }
    .bc-cs-related-option:disabled {
      cursor: progress;
    }
    .bc-cs-related-option[data-status="Closed"] {
      background: var(--bc-color-surface-soft);
    }
    .bc-cs-related-option-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bc-cs-related-option-section {
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-accent);
    }
    .bc-cs-related-option-mid {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bc-cs-related-option-right {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
    }
    .bc-cs-related-option-instr {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-related-option-progress {
      margin-left: 8px;
      font-size: var(--bc-font-11);
      color: var(--bc-color-accent);
      font-weight: var(--bc-fw-semibold);
    }

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
    .bc-cs-detail-header {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-cs-detail-header strong {
      color: var(--bc-color-text);
      font-weight: var(--bc-fw-bold);
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

    /* Toast styles live in seats-notes/toast.ts (shared across augmentations). */

    /* ── Responsive ─────────────────────────────────────────────────────── */
    @media ${maxWidth("xl")} {
      .bc-cs-form { grid-template-columns: 1fr; }
      .bc-cs-section {
        grid-template-columns: 60px 60px 1fr 1fr;
        row-gap: 6px;
      }
      .bc-cs-section-room,
      .bc-cs-section-instructor { grid-column: span 2; }
      .bc-cs-section-live,
      .bc-cs-section-actions { grid-column: 1 / -1; justify-self: start; }
    }
    @media ${maxWidth("sm")} {
      .bc-cs-root { padding: 0 10px; }
      .bc-cs-tabs { padding: 0 10px; }
      .bc-cs-course-head { grid-template-columns: 1fr; gap: 4px; }
      .bc-cs-course-units { justify-self: start; }
      .bc-cs-section { grid-template-columns: 1fr 1fr; }
    }
  `;
}

export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = classSearchStyles();
  (doc.head ?? doc.documentElement).appendChild(style);
}
