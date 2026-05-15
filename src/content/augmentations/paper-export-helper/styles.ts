import { ensureStyle } from "../../framework/dom";
import { HIGHLIGHT_ATTR, STYLE_ID } from "./constants";

// Layout-only styles for the walkthrough modal — backdrop and card
// chrome come from `injectModalStyles()` in `framework/modal.ts`, tab
// pill chrome comes from `.bc-tabs--pill` in the design system. This
// file fills the gaps: wider card, scrollable step list, footer row.
//
// Also defines the purple-gradient highlight applied to paper.nu's
// top-level EXPORT button via the [data-bc-export-highlight] marker.
// Purple is derived from `--bc-color-paper` (the Northwestern brand
// purple, defined identically in every theme) via color-mix() so the
// effect stays purple regardless of which theme the user is on.
const CSS = `
[${HIGHLIGHT_ATTR}="1"] {
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--bc-color-paper) 22%, transparent) 0%,
    color-mix(in srgb, var(--bc-color-paper) 6%, transparent) 100%
  ) !important;
  box-shadow:
    0 0 0 1.5px color-mix(in srgb, var(--bc-color-paper) 38%, transparent),
    0 4px 12px color-mix(in srgb, var(--bc-color-paper) 28%, transparent) !important;
  color: var(--bc-color-paper-deep) !important;
  border-radius: 8px !important;
  transition:
    background 200ms ease,
    box-shadow 200ms ease,
    transform 200ms ease;
}
[${HIGHLIGHT_ATTR}="1"]:hover {
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--bc-color-paper) 32%, transparent) 0%,
    color-mix(in srgb, var(--bc-color-paper) 12%, transparent) 100%
  ) !important;
  box-shadow:
    0 0 0 1.5px color-mix(in srgb, var(--bc-color-paper) 50%, transparent),
    0 6px 16px color-mix(in srgb, var(--bc-color-paper) 38%, transparent) !important;
  transform: translateY(-1px);
}
[${HIGHLIGHT_ATTR}="1"]:active {
  transform: translateY(0);
}

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
.bc-export-helper-intro {
  margin: 0 0 10px;
}
.bc-export-helper-steps {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  counter-reset: bc-export-step;
}
.bc-export-helper-steps li {
  position: relative;
  margin: 0 0 8px;
  padding: 0 0 0 28px;
  counter-increment: bc-export-step;
}
.bc-export-helper-steps li::before {
  content: counter(bc-export-step);
  position: absolute;
  left: 0;
  top: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bc-color-accent-fill-12);
  color: var(--bc-color-accent-soft);
  font-size: var(--bc-font-11);
  font-weight: var(--bc-fw-bold);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.bc-export-helper-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  margin: 0 0 4px;
  border-radius: var(--bc-radius-lg);
  background: var(--bc-color-accent-fill-06);
  font-size: var(--bc-font-12);
  line-height: 1.45;
  color: var(--bc-color-text-mauve-cool-alt);
}
.bc-export-helper-warning::before {
  content: "⚠";
  flex: 0 0 auto;
  color: var(--bc-color-accent-soft);
  font-weight: var(--bc-fw-bold);
}
.bc-export-helper-help {
  margin: 10px 0 0;
  font-size: var(--bc-font-11);
  color: var(--bc-color-text-muted);
}
.bc-export-helper-help a {
  color: var(--bc-color-accent-soft);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.bc-export-helper-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
/* Inline slot for the per-tab "Open <calendar>" link. Renders nothing
   when the active tab has no deep link (Apple). display:contents keeps
   the anchor it eventually wraps acting as a direct flex child of the
   row, so its margins and ordering match the other action buttons. */
.bc-export-helper-deeplink-slot {
  display: contents;
}
/* Download button state machine. Idle = primary soft fill (from the
   design system). Success = swap to the green success token so the
   user sees the confirmation without leaving the row. Loading dims
   the label. */
.bc-export-helper-download[data-state="success"] {
  background: var(--bc-color-success);
  border-color: var(--bc-color-success);
  color: var(--bc-color-success-text);
}
.bc-export-helper-download[data-state="success"]:hover:not(:disabled) {
  background: var(--bc-color-success-deep);
  border-color: var(--bc-color-success-deep);
}
.bc-export-helper-download[data-state="loading"] {
  opacity: 0.75;
}
.bc-export-helper-download[data-state="error"] {
  background: var(--bc-color-accent-soft);
  border-color: var(--bc-color-accent-soft);
}
`;

export function injectExportHelperStyles(doc: Document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}

export function removeExportHelperStyles(doc: Document): void {
  doc.getElementById(STYLE_ID)?.remove();
}
