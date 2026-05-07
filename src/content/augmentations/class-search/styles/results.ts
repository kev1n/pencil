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
    /* Cart cards reuse the .bc-cs-course shell and section-row internals
       for maximum visual + code reuse with search results. The grid is
       a single column — these cards include a description + a section
       row + an inline detail panel, and side-by-side they get tall
       enough to read awkwardly. */
    .bc-cs-myclasses-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    /* Cart cards have a 4th head cell for the status pill, sitting right
       of the units. The base course-head grid is three columns
       (id / title / units); we extend it to four only when a cart
       status is present so untouched search-result cards keep their
       three-column layout. */
    .bc-cs-course[data-cart-status] .bc-cs-course-head {
      grid-template-columns: auto 1fr auto auto;
    }
    .bc-cs-cart-badge {
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
      /* Pin to the last grid column so the badge sits flush right of
         units in the rich card AND right of the course id in the
         fallback card (which has fewer head children). */
      justify-self: end;
      grid-column: -1;
    }
    .bc-cs-cart-badge[data-status="enrolled"] {
      background: var(--bc-color-success-bg);
      color: var(--bc-color-success);
    }
    .bc-cs-cart-badge[data-status="in-cart"] {
      background: var(--bc-color-paper-soft);
      color: var(--bc-color-paper);
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

    .bc-cs-course-desc {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      padding: 6px 16px 12px;
      line-height: 1.5;
    }
  `;
}
