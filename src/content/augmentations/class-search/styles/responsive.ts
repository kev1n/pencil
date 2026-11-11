import { maxWidth } from "../../../design/breakpoints";

// Responsive overrides — at narrower viewports the form collapses to one
// column and the section grid reflows to 4 columns (then 2 columns on mobile).
export function responsiveStyles(): string {
  return `
    /* ── Responsive ─────────────────────────────────────────────────────── */
    @media ${maxWidth("xl")} {
      .bc-cs-section {
        grid-template-columns: 28px 36px 1fr 1fr;
        row-gap: 6px;
      }
      /* Number and type stay in the gutter; everything else stacks in two
         columns beside them. */
      .bc-cs-section-time { grid-column: 3 / -1; }
      .bc-cs-section-instructor,
      .bc-cs-section-ctec { grid-column: 3; }
      .bc-cs-section-room,
      .bc-cs-section-live { grid-column: 4; }
      .bc-cs-section-actions { grid-column: 3 / -1; justify-self: start; justify-content: flex-start; }
      .bc-cs-detail-row,
      .bc-cs-related { padding-left: 76px; }
    }
    @media ${maxWidth("sm")} {
      .bc-cs-root { padding: 0 10px; }
      .bc-cs-tabs { padding: 0 10px; }
      .bc-cs-form { grid-template-columns: 1fr; }
      .bc-cs-course-head { grid-template-columns: 1fr; gap: 4px; }
      .bc-cs-course-units { justify-self: start; }
      .bc-cs-section { grid-template-columns: 1fr 1fr; }
    }
  `;
}
