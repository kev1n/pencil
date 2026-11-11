import { maxWidth } from "../../../design/breakpoints";

// Responsive overrides — at narrower viewports the form collapses to one
// column and each section row stacks its facts beside right-aligned actions.
export function responsiveStyles(): string {
  return `
    /* ── Responsive ─────────────────────────────────────────────────────── */
    @media ${maxWidth("lg")} {
      /* Number and type stay in the gutter. Time, professor and room
         stack in one column beside them; the three controls stay together
         at the right edge with the status under them. */
      .bc-cs-section {
        grid-template-columns: 28px 36px minmax(0, 1fr) auto auto;
        row-gap: 4px;
        align-items: start;
        padding: 10px 0;
      }
      .bc-cs-section-ctec { order: 1; grid-column: 4; min-height: 28px; }
      .bc-cs-section-actions { order: 2; grid-column: 5; min-width: 0; }
      .bc-cs-section-instructor { order: 3; grid-column: 3; }
      .bc-cs-section-live { order: 4; grid-column: 4 / -1; justify-content: flex-end; padding-right: 11px; }
      .bc-cs-section-room { order: 5; grid-column: 3; }
    }
    @media ${maxWidth("sm")} {
      .bc-cs-root { padding: 0 10px; }
      .bc-cs-tabs { padding: 0 10px; }
      .bc-cs-form { grid-template-columns: 1fr; }
      .bc-cs-course-head { grid-template-columns: 1fr; gap: 4px; }
      .bc-cs-course-units { justify-self: start; }
    }
  `;
}
