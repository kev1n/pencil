import { ensureStyle } from "../../framework/dom";
import { STYLE_ID } from "./constants";

// Layout-only styles for the walkthrough modal — backdrop and card
// chrome come from `injectModalStyles()` in `framework/modal.ts`, tab
// pill chrome comes from `.bc-tabs--pill` in the design system. This
// file fills the gaps: wider card, scrollable step list, footer row.
const CSS = `
.bc-export-helper-card {
  width: min(520px, 100%);
  padding: 22px 22px 18px;
}
.bc-export-helper-eyebrow {
  margin: 0 0 4px;
  font-size: var(--bc-font-11);
  font-weight: var(--bc-fw-bold);
  letter-spacing: var(--bc-ls-wider);
  text-transform: uppercase;
  color: var(--bc-color-text-muted);
}
.bc-export-helper-title {
  margin: 0 0 4px;
  font-size: var(--bc-font-18);
  font-weight: var(--bc-fw-extrabold);
  color: var(--bc-color-accent-soft);
}
.bc-export-helper-lede {
  margin: 0 0 14px;
  font-size: var(--bc-font-13);
  line-height: 1.5;
  color: var(--bc-color-text-body-warm);
}
.bc-export-helper-tabs {
  margin: 4px 0 14px;
}
.bc-export-helper-body {
  margin: 0 0 16px;
  font-size: var(--bc-font-13);
  line-height: 1.5;
  color: var(--bc-color-text-body-warm);
}
.bc-export-helper-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
`;

export function injectExportHelperStyles(doc: Document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}

export function removeExportHelperStyles(doc: Document): void {
  doc.getElementById(STYLE_ID)?.remove();
}
