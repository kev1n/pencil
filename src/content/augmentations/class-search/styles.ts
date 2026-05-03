export const STYLE_ID = "better-caesar-class-search-styles";

export function classSearchStyles(): string {
  return `
    .bc-cs-root {
      /* CAESAR-side maroon palette. */
      --bc-purple: #66023c;
      --bc-purple-dark: #500030;
      --bc-purple-darker: #3f0126;
      --bc-purple-soft: #f6ecf2;
      --bc-purple-tint: #faf3f7;
      --bc-purple-border: rgba(102, 2, 60, 0.18);
      --bc-purple-ring: rgba(102, 2, 60, 0.18);

      /* paper.nu-side accents (kept purple) for tags that signal
         "this data came from paper.nu's catalog". */
      --bc-paper: #4e2a84;
      --bc-paper-dark: #3a1f63;
      --bc-paper-soft: #f3eef9;

      --bc-text: #1f2937;
      --bc-text-muted: #6b7280;
      --bc-text-subtle: #9ca3af;
      --bc-border: #e5e7eb;
      --bc-border-strong: #d1d5db;
      --bc-bg: #ffffff;
      --bc-bg-soft: #f9fafb;
      --bc-bg-inset: #faf7f9;

      --bc-success: #15803d;
      --bc-success-bg: #dcfce7;
      --bc-warn: #b45309;
      --bc-warn-bg: #fef3c7;
      --bc-danger: #b91c1c;
      --bc-danger-bg: #fee2e2;

      position: relative;
      margin: 12px auto 32px;
      max-width: 1180px;
      padding: 0 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      color: var(--bc-text);
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
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--bc-purple);
      margin: 0;
    }
    .bc-cs-subtitle {
      font-size: 12px;
      color: var(--bc-text-muted);
      line-height: 1.4;
    }
    .bc-cs-subtitle a { color: var(--bc-purple); text-decoration: none; }
    .bc-cs-subtitle a:hover { text-decoration: underline; }

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
      border-bottom: 1px solid var(--bc-border);
    }
    .bc-cs-tab {
      position: relative;
      bottom: -1px;
      background: transparent;
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      padding: 8px 14px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--bc-text-muted);
      cursor: pointer;
      transition: color 80ms, background-color 80ms;
    }
    .bc-cs-tab:hover {
      color: var(--bc-purple);
      background: var(--bc-purple-tint);
    }
    .bc-cs-tab[data-active="true"] {
      background: var(--bc-bg);
      border-color: var(--bc-border);
      color: var(--bc-purple);
      box-shadow: 0 -1px 2px rgba(15, 23, 42, 0.04);
    }
    .bc-cs-tab[data-active="true"]:hover {
      background: var(--bc-bg);
    }

    /* ── Card / form ────────────────────────────────────────────────────── */
    .bc-cs-card {
      background: var(--bc-bg);
      border: 1px solid var(--bc-border);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .bc-cs-form {
      display: grid;
      grid-template-columns: minmax(280px, 3fr) minmax(180px, 1fr);
      gap: 12px;
      align-items: end;
    }
    .bc-cs-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .bc-cs-field label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--bc-text-muted);
      text-transform: uppercase;
    }
    .bc-cs-input, .bc-cs-select {
      width: 100%;
      font: inherit;
      font-size: 14px;
      padding: 8px 10px;
      border: 1px solid var(--bc-border-strong);
      border-radius: 8px;
      background: var(--bc-bg);
      color: var(--bc-text);
      transition: border-color 100ms, box-shadow 100ms;
    }
    .bc-cs-input:focus, .bc-cs-select:focus {
      outline: none;
      border-color: var(--bc-purple);
      box-shadow:
        0 0 0 3px var(--bc-purple-ring),
        inset 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .bc-cs-input-query {
      font-size: 16px;
      padding: 12px 14px;
      letter-spacing: 0.005em;
    }
    .bc-cs-input::placeholder { color: var(--bc-text-subtle); }

    /* ── Filter pills ───────────────────────────────────────────────────── */
    .bc-cs-toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--bc-border);
      align-items: center;
    }
    .bc-cs-checkbox {
      display: inline-flex;
      gap: 5px;
      align-items: center;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      color: var(--bc-text);
      background: var(--bc-bg-soft);
      border: 1px solid var(--bc-border);
      border-radius: 999px;
      cursor: pointer;
      user-select: none;
      transition: background-color 80ms, border-color 80ms;
    }
    .bc-cs-checkbox:hover {
      border-color: var(--bc-border-strong);
      background: var(--bc-bg);
    }
    .bc-cs-checkbox input {
      accent-color: var(--bc-purple);
      margin: 0;
      width: 12px;
      height: 12px;
    }
    .bc-cs-checkbox:has(input:checked) {
      background: var(--bc-purple-soft);
      border-color: var(--bc-purple-border);
      color: var(--bc-purple-darker);
    }
    .bc-cs-clear {
      margin-left: auto;
      background: transparent;
      border: 1px solid var(--bc-border-strong);
      border-radius: 8px;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      color: var(--bc-text-muted);
      padding: 5px 10px;
      cursor: pointer;
      transition: color 80ms, border-color 80ms;
    }
    .bc-cs-clear:hover {
      color: var(--bc-purple);
      border-color: var(--bc-purple);
    }

    /* ── Status row ─────────────────────────────────────────────────────── */
    .bc-cs-status {
      margin-top: 10px;
      font-size: 12px;
      color: var(--bc-text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 16px;
    }
    .bc-cs-status[data-state="error"] { color: var(--bc-danger); }
    .bc-cs-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid var(--bc-purple-ring);
      border-top-color: var(--bc-purple);
      border-radius: 50%;
      animation: bc-cs-spin 0.7s linear infinite;
    }
    @keyframes bc-cs-spin { to { transform: rotate(360deg); } }

    .bc-cs-meta { font-size: 11px; color: var(--bc-text-muted); }

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
      color: var(--bc-text-muted);
      border: 1px dashed var(--bc-border);
      border-radius: 12px;
      background: var(--bc-bg-soft);
    }

    .bc-cs-course {
      background: var(--bc-bg);
      border: 1px solid var(--bc-border);
      border-radius: 12px;
      overflow: hidden;
      transition: border-color 100ms, box-shadow 100ms;
    }
    .bc-cs-course:hover {
      border-color: var(--bc-border-strong);
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
    }

    .bc-cs-course-head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      padding: 12px 16px;
      align-items: baseline;
      cursor: pointer;
      background: linear-gradient(180deg, var(--bc-purple-tint) 0%, var(--bc-bg) 100%);
      border-bottom: 1px solid var(--bc-border);
    }
    .bc-cs-course-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      font-weight: 700;
      color: var(--bc-purple);
      letter-spacing: 0.02em;
    }
    .bc-cs-course-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--bc-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-course-units {
      font-size: 11px;
      color: var(--bc-text-muted);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .bc-cs-course-tags {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 10px 16px 0;
    }
    .bc-cs-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--bc-paper-soft);
      color: var(--bc-paper-dark);
      letter-spacing: 0.03em;
      line-height: 1.4;
      text-transform: none;
    }
    /* paper.nu-sourced tags keep their purple tint to read as
       "from paper.nu". */
    .bc-cs-tag[data-kind="distro"]     { background: #ecfdf5; color: #065f46; }
    .bc-cs-tag[data-kind="discipline"] { background: #fef3c7; color: #92400e; }
    .bc-cs-tag[data-kind="school"]     { background: var(--bc-paper-soft); color: var(--bc-paper); }
    .bc-cs-tag[data-kind="open"]       { background: var(--bc-success-bg); color: var(--bc-success); }
    .bc-cs-tag[data-kind="closed"]     { background: var(--bc-danger-bg); color: var(--bc-danger); }
    .bc-cs-tag[data-kind="wait"]       { background: var(--bc-warn-bg); color: var(--bc-warn); }

    .bc-cs-course-desc {
      font-size: 12px;
      color: var(--bc-text-muted);
      padding: 6px 16px 12px;
      line-height: 1.5;
      max-height: 4.5em;
      overflow: hidden;
      position: relative;
      cursor: pointer;
    }
    .bc-cs-course-desc.bc-cs-expanded { max-height: none; }

    /* "Load CAESAR data" button — secondary CAESAR-toned action */
    .bc-cs-live-btn {
      margin-left: auto;
      background: transparent;
      border: 1px solid var(--bc-border-strong);
      border-radius: 8px;
      padding: 4px 10px;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      color: var(--bc-text-muted);
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: color 80ms, border-color 80ms, background-color 80ms;
    }
    .bc-cs-live-btn:hover {
      color: var(--bc-purple);
      border-color: var(--bc-purple);
      background: var(--bc-purple-tint);
    }
    .bc-cs-live-btn[data-state="loading"] {
      color: var(--bc-purple);
      border-color: var(--bc-purple);
      background: var(--bc-purple-tint);
      cursor: progress;
    }
    .bc-cs-live-btn[data-state="ready"] {
      color: var(--bc-purple);
      border-color: var(--bc-purple);
      background: var(--bc-purple-soft);
    }
    .bc-cs-live-btn[data-state="error"] {
      color: var(--bc-danger);
      border-color: var(--bc-danger);
      background: var(--bc-danger-bg);
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
      border-top: 1px solid var(--bc-border);
      font-size: 13px;
      transition: background-color 80ms;
    }
    .bc-cs-section:hover { background: var(--bc-bg-soft); }
    .bc-cs-section-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      font-weight: 600;
      color: var(--bc-text);
    }
    .bc-cs-section-component { color: var(--bc-text-muted); font-size: 12px; }
    .bc-cs-section-time { color: var(--bc-text); font-size: 12px; line-height: 1.4; }
    .bc-cs-section-time .bc-cs-mute { color: var(--bc-text-subtle); font-size: 11px; }
    .bc-cs-section-instructor {
      color: var(--bc-text);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-section-room {
      color: var(--bc-text-muted);
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-section-live {
      font-size: 11px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      color: var(--bc-text-muted);
    }
    .bc-cs-section-live[data-tone="muted"] {
      color: var(--bc-text-subtle);
      font-style: italic;
    }

    .bc-cs-status-pill {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--bc-bg-soft);
      color: var(--bc-text-muted);
      border: 1px solid var(--bc-border);
      line-height: 1.4;
    }
    .bc-cs-status-pill[data-status="Open"]      { background: var(--bc-success-bg); color: var(--bc-success); border-color: transparent; }
    .bc-cs-status-pill[data-status="Closed"]    { background: var(--bc-danger-bg);  color: var(--bc-danger);  border-color: transparent; }
    .bc-cs-status-pill[data-status="Wait List"] { background: var(--bc-warn-bg);    color: var(--bc-warn);    border-color: transparent; }

    .bc-cs-class-num {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: var(--bc-text-muted);
      font-variant-numeric: tabular-nums;
    }

    .bc-cs-section-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .bc-cs-details-btn {
      background: transparent;
      border: 1px solid var(--bc-border-strong);
      border-radius: 8px;
      padding: 5px 10px;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      color: var(--bc-text-muted);
      cursor: pointer;
      transition: color 80ms, border-color 80ms, background-color 80ms;
    }
    .bc-cs-details-btn:hover {
      color: var(--bc-purple);
      border-color: var(--bc-purple);
    }
    .bc-cs-details-btn[data-expanded="true"] {
      background: var(--bc-purple-soft);
      color: var(--bc-purple-darker);
      border-color: var(--bc-purple-border);
    }

    /* ── Add-to-cart: primary CAESAR CTA ────────────────────────────────── */
    .bc-cs-add {
      background: var(--bc-purple);
      color: #ffffff;
      border: 1px solid var(--bc-purple);
      border-radius: 8px;
      padding: 6px 12px;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background-color 100ms, transform 80ms, box-shadow 100ms;
    }
    .bc-cs-add:hover {
      background: var(--bc-purple-dark);
      border-color: var(--bc-purple-dark);
      box-shadow: 0 2px 6px rgba(102, 2, 60, 0.22);
    }
    .bc-cs-add:active { transform: translateY(1px); box-shadow: none; }
    .bc-cs-add[disabled] {
      background: #c7c2d6;
      border-color: #c7c2d6;
      cursor: progress;
      box-shadow: none;
    }
    .bc-cs-add[data-state="loading"] {
      background: var(--bc-purple-dark);
      border-color: var(--bc-purple-dark);
      cursor: progress;
    }
    .bc-cs-add[data-state="success"] {
      background: var(--bc-success);
      border-color: var(--bc-success);
    }
    .bc-cs-add[data-state="error"] {
      background: var(--bc-danger);
      border-color: var(--bc-danger);
    }

    /* ── Detail row (seats / notes sub-panel) ───────────────────────────── */
    .bc-cs-detail-row {
      display: block;
      padding: 0 16px 14px;
      border-top: 1px solid var(--bc-border);
      background: var(--bc-bg-inset);
    }
    .bc-cs-detail {
      padding: 14px 4px 4px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bc-cs-detail-header {
      font-size: 12px;
      color: var(--bc-text-muted);
    }
    .bc-cs-detail-header strong {
      color: var(--bc-text);
      font-weight: 700;
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
      border-radius: 10px;
      background: var(--bc-bg);
      border: 1px solid var(--bc-border);
    }
    .bc-cs-stat-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--bc-purple);
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .bc-cs-stat-label {
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--bc-text-muted);
      font-weight: 700;
    }
    .bc-cs-detail-block-label {
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--bc-text-muted);
      font-weight: 700;
      margin-bottom: 4px;
    }
    .bc-cs-detail-block-body {
      font-size: 13px;
      color: var(--bc-text);
      line-height: 1.5;
      white-space: pre-line;
    }
    .bc-cs-detail-error {
      font-size: 12px;
      color: var(--bc-danger);
    }
    .bc-cs-detail-note {
      font-size: 11px;
      color: var(--bc-text-muted);
      font-style: italic;
    }
    .bc-cs-detail-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--bc-border);
      margin-top: 4px;
    }
    .bc-cs-detail-stamp {
      flex: 1;
      font-size: 11px;
      color: var(--bc-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .bc-cs-detail-refresh {
      background: transparent;
      border: 1px solid var(--bc-border-strong);
      border-radius: 6px;
      padding: 4px 10px;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      color: var(--bc-text-muted);
      cursor: pointer;
      transition: color 80ms, border-color 80ms;
    }
    .bc-cs-detail-refresh:hover:not(:disabled) {
      color: var(--bc-purple);
      border-color: var(--bc-purple);
    }
    .bc-cs-detail-refresh:disabled {
      opacity: 0.6;
      cursor: progress;
    }

    /* Toast styles live in seats-notes/toast.ts (shared across augmentations). */

    /* ── Responsive ─────────────────────────────────────────────────────── */
    @media (max-width: 1000px) {
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
    @media (max-width: 640px) {
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
