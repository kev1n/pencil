export const STYLE_ID = "bc-course-history-view-style";

// Kept deliberately plain so it reads as part of CAESAR's own page: the
// filters take over the grid header bar (CAESAR's status-only Filter button
// is hidden while they're there), and class rows are indented under quiet
// term headings.
export const styles = `
  .ps_header-grid-custom:has(> #bc-course-history-toolbar) {
    display: block;
    width: 100%;
  }

  .ps_header-grid-custom:has(> #bc-course-history-toolbar) > :not(#bc-course-history-toolbar) {
    display: none !important;
  }

  #bc-course-history-toolbar {
    /* CAESAR floats every child of its grid header bar, which would
       shrink-wrap the toolbar. */
    float: none !important;
    box-sizing: border-box;
    width: 100%;
    display: grid;
    gap: 8px;
    padding: 4px 4px 6px;
    color: var(--bc-color-text);
    font: 13px/1.3 var(--bc-font-body);
  }

  #bc-course-history-toolbar .bc-ch-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  #bc-course-history-toolbar .bc-ch-label {
    flex: none;
    width: 52px;
    color: var(--bc-color-text-muted);
    font-size: 12px;
  }

  /* The chips don't stretch: the grid can be wider than the window, and
     a stretched row would push Download CSV off-screen. */
  #bc-course-history-toolbar .bc-ch-chips {
    display: flex;
    flex: 0 1 auto;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }

  #bc-course-history-toolbar .bc-ch-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px;
    border: 1px solid var(--bc-color-border-strong);
    border-radius: var(--bc-radius-pill);
    background: var(--bc-color-bg);
    color: var(--bc-color-text-soft);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  #bc-course-history-toolbar .bc-ch-chip:hover {
    border-color: var(--bc-color-accent);
  }

  #bc-course-history-toolbar .bc-ch-chip[aria-pressed="true"] {
    border-color: var(--bc-color-accent);
    background: var(--bc-color-accent-surface-tile);
    color: var(--bc-color-accent);
    font-weight: var(--bc-fw-semibold);
  }

  #bc-course-history-toolbar .bc-ch-count {
    color: var(--bc-color-text-muted);
    font-weight: var(--bc-fw-regular);
  }

  #bc-course-history-toolbar .bc-ch-more,
  #bc-course-history-toolbar .bc-ch-download {
    flex: none;
    padding: 0;
    border: 0;
    background: none;
    color: var(--bc-color-accent);
    font: inherit;
    font-size: 12px;
    font-weight: var(--bc-fw-semibold);
    cursor: pointer;
  }

  #bc-course-history-toolbar .bc-ch-download {
    display: inline-flex;
    align-items: center;
    align-self: center;
    gap: 5px;
  }

  #bc-course-history-toolbar .bc-ch-download svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  #bc-course-history-toolbar .bc-ch-more {
    height: 26px;
    padding: 0 4px;
  }

  #bc-course-history-toolbar .bc-ch-more:hover,
  #bc-course-history-toolbar .bc-ch-download:hover {
    text-decoration: underline;
  }

  tr[data-bc-ch-hidden="1"] {
    display: none !important;
  }

  tr.bc-ch-term-row > th {
    padding: 14px 8px 6px;
    border-bottom: 1px solid var(--bc-color-border-strong);
    color: var(--bc-color-text);
    text-align: left;
    font: var(--bc-fw-bold) 14px/1.3 var(--bc-font-body);
  }

  tr.bc-ch-term-row .bc-ch-term-meta {
    margin-inline-start: 8px;
    color: var(--bc-color-text-muted);
    font-weight: var(--bc-fw-regular);
  }

  /* Indent each class under its term heading. */
  tbody:has(> tr.bc-ch-term-row) > tr.ps_grid-row > td:first-child {
    padding-inline-start: 32px !important;
  }
`;
