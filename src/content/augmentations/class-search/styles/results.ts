// Results column: empty state, my-classes summary (shown when the query is
// blank), and the course block (head, description).
export function resultsStyles(): string {
  return `
    /* ── Results ────────────────────────────────────────────────────────── */
    /* One list on one surface. Courses are separated by a hairline, not
       wrapped in cards. */
    .bc-cs-results {
      display: flex;
      flex-direction: column;
    }
    .bc-cs-empty {
      padding: 40px 20px;
      text-align: center;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text-muted);
    }
    /* "Your classes": shown only when the search box is empty so the user
       lands on a useful at-a-glance summary of cart + enrolled. The
       search-results path (renderResults) reuses .bc-cs-results, so these
       elements are removed automatically as soon as a query types. */
    .bc-cs-myclasses { display: flex; flex-direction: column; padding-top: 16px; }
    .bc-cs-myclasses-heading {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .bc-cs-myclasses-label {
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-14);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-myclasses-count {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-cs-myclasses-grid {
      display: grid;
      grid-template-columns: 1fr;
    }
    /* Cart cards have a 4th head cell for the status word, sitting right
       of the units. The base course-head grid is three columns
       (id / title / units); we extend it to four only when a cart
       status is present so untouched search-result cards keep their
       three-column layout. */
    .bc-cs-course[data-cart-status] .bc-cs-course-head {
      grid-template-columns: auto 1fr auto auto;
    }
    /* Status as a word in its colour, not a pill. */
    .bc-cs-cart-badge {
      font-size: 12.5px;
      font-weight: var(--bc-fw-semibold);
      white-space: nowrap;
      /* Pin to the last grid column so the badge sits flush right of
         units in the rich card AND right of the course id in the
         fallback card (which has fewer head children). */
      justify-self: end;
      grid-column: -1;
    }
    .bc-cs-cart-badge[data-status="enrolled"] {
      color: var(--bc-color-success);
    }
    .bc-cs-cart-badge[data-status="in-cart"] {
      color: var(--bc-color-text-strong);
    }
    .bc-cs-course {
      padding: 14px 0 6px;
      border-bottom: 1px solid var(--bc-color-border);
    }
    .bc-cs-course-head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      column-gap: 10px;
      align-items: baseline;
    }
    .bc-cs-course-id {
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
      white-space: nowrap;
    }
    .bc-cs-course-title {
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-regular);
      color: var(--bc-color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-course-units {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      white-space: nowrap;
    }
    .bc-cs-course-meta {
      display: flex;
      align-items: center;
      align-self: center;
      gap: 10px;
    }
    .bc-cs-course-fds {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--bc-color-text-muted);
    }
    .bc-cs-course-fds .bc-cs-fd-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }
    /* Anchor FD tooltips to the icon's right edge so they open
       leftward/downward into the block body, and lift the z-index so
       they sit above section rows. */
    .bc-cs-course-fds .bc-tooltip {
      bottom: auto;
      top: calc(100% + 6px);
      left: auto;
      right: 0;
      transform: none;
      z-index: 50;
    }
    .bc-cs-course-desc {
      max-width: 860px;
      margin-top: 3px;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text-soft);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .bc-cs-course-desc:hover {
      -webkit-line-clamp: unset;
    }
  `;
}
