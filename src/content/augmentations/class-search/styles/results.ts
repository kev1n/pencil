// Results column: empty state, my-classes summary cards (shown when query is
// blank), and the course-card surface (head, tags, desc).
export function resultsStyles(): string {
  return `
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
      gap: 5px;
      padding: 12px 14px;
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
      flex: 1 1 auto;
      min-width: 0;
    }
    .bc-cs-myclass-title {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
      line-height: 1.3;
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
      flex: 0 0 auto;
    }
    .bc-cs-myclass-badge[data-status="enrolled"] {
      background: var(--bc-color-success-bg);
      color: var(--bc-color-success);
    }
    .bc-cs-myclass-badge[data-status="in-cart"] {
      background: var(--bc-color-paper-soft);
      color: var(--bc-color-paper);
    }
    .bc-cs-myclass-tags {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      margin-top: 1px;
    }
    .bc-cs-myclass-tag {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      padding: 2px 7px;
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-paper-soft);
      color: var(--bc-color-paper-deep);
      letter-spacing: var(--bc-ls-wider);
      line-height: 1.4;
    }
    .bc-cs-myclass-tag[data-kind="units"]      { background: var(--bc-color-surface-soft); color: var(--bc-color-text-muted); }
    .bc-cs-myclass-tag[data-kind="distro"]     { background: var(--bc-color-success-distro-bg); color: var(--bc-color-success-distro-text); }
    .bc-cs-myclass-tag[data-kind="discipline"] { background: var(--bc-color-warn-bg); color: var(--bc-color-warn-text-discipline); }
    .bc-cs-myclass-tag[data-kind="school"]     { background: var(--bc-color-paper-soft); color: var(--bc-color-paper); }
    .bc-cs-myclass-detail {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      line-height: 1.4;
    }
    .bc-cs-myclass-detail[data-kind="instructor"] {
      color: var(--bc-color-text);
    }
    .bc-cs-myclass-facts {
      font-family: var(--bc-font-mono, monospace);
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-subtle);
      letter-spacing: var(--bc-ls-wide);
      line-height: 1.4;
    }
    .bc-cs-myclass-desc {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-top: 2px;
      padding-top: 4px;
      border-top: 1px dashed var(--bc-color-border-divider);
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

    .bc-cs-course-desc {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      padding: 6px 16px 12px;
      line-height: 1.5;
    }
  `;
}
