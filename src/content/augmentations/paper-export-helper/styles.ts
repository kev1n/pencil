import { ensureStyle } from "../../framework/dom";
import { BUTTON_BOUND_ATTR, HIGHLIGHT_ATTR, STYLE_ID } from "./constants";

// Layout-only styles for the walkthrough modal — backdrop and card
// chrome come from `injectModalStyles()` in `framework/modal.ts`, tab
// pill chrome comes from `.bc-tabs--pill` in the design system. This
// file fills the gaps: wider card, scrollable step list, footer row.
//
// Also defines the purple-gradient highlight applied to paper.nu's
// top-level EXPORT button and the "Export to calendar" item inside its
// dropdown via the [data-bc-export-highlight] marker — both surfaces
// get the same treatment so the user can see they're pencil.nu entry
// points. Purple is derived from `--bc-color-paper` (the Northwestern
// brand purple, defined identically in every theme) via color-mix() so
// the effect stays purple regardless of which theme the user is on.
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
/* Dark mode: paper.nu's dark surface eats the low-alpha purple wash and
   makes paper-deep text unreadable. Brighten both the gradient and the
   text so the highlight reads. Light lavender is derived from
   --bc-color-paper mixed with white so the purple identity is preserved
   regardless of which theme the user is on. */
[data-bc-mode="dark"] [${HIGHLIGHT_ATTR}="1"] {
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--bc-color-paper) 55%, transparent) 0%,
    color-mix(in srgb, var(--bc-color-paper) 28%, transparent) 100%
  ) !important;
  box-shadow:
    0 0 0 1.5px color-mix(in srgb, var(--bc-color-paper) 70%, white 10%),
    0 4px 12px color-mix(in srgb, var(--bc-color-paper) 50%, transparent) !important;
  color: color-mix(in srgb, var(--bc-color-paper) 25%, white) !important;
}
[data-bc-mode="dark"] [${HIGHLIGHT_ATTR}="1"]:hover {
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--bc-color-paper) 70%, transparent) 0%,
    color-mix(in srgb, var(--bc-color-paper) 40%, transparent) 100%
  ) !important;
  box-shadow:
    0 0 0 1.5px color-mix(in srgb, var(--bc-color-paper) 85%, white 15%),
    0 6px 16px color-mix(in srgb, var(--bc-color-paper) 60%, transparent) !important;
}
/* "Export to calendar" dropdown item — same purple wash, no ring. The
   ring reads as a hard chip on the menu item; only the top-level
   EXPORT button should carry it. Scoped by the BUTTON_BOUND_ATTR
   marker, which only the dropdown item gets. */
[${BUTTON_BOUND_ATTR}][${HIGHLIGHT_ATTR}="1"],
[${BUTTON_BOUND_ATTR}][${HIGHLIGHT_ATTR}="1"]:hover,
[data-bc-mode="dark"] [${BUTTON_BOUND_ATTR}][${HIGHLIGHT_ATTR}="1"],
[data-bc-mode="dark"] [${BUTTON_BOUND_ATTR}][${HIGHLIGHT_ATTR}="1"]:hover {
  box-shadow: none !important;
}

.bc-export-helper-card {
  width: min(480px, 100%);
}
/* Segmented control: sentence case, neutral track, the active tab lifts
   onto the card surface. Overrides the uppercase accent pill defaults. */
.bc-export-helper-tabs {
  margin: 8px 0 18px;
  display: flex;
  width: 100%;
  padding: 3px;
  border-radius: var(--bc-radius-xl);
  background: var(--bc-color-surface-hover-strong);
}
.bc-export-helper-tabs .bc-tab {
  flex: 1 1 0;
  justify-content: center;
  text-align: center;
  padding: 6px 10px;
  border-radius: var(--bc-radius-lg);
  font-size: var(--bc-font-13);
  font-weight: var(--bc-fw-medium);
  letter-spacing: 0;
  text-transform: none;
  color: var(--bc-color-text-muted);
}
.bc-export-helper-tabs .bc-tab:hover {
  background: transparent;
  color: var(--bc-color-text);
}
.bc-export-helper-tabs .bc-tab.is-active {
  background: var(--bc-color-bg);
  color: var(--bc-color-text-strong);
  box-shadow: var(--bc-shadow-elev-2);
}
.bc-export-helper-body {
  font-size: var(--bc-font-14);
  line-height: 1.5;
  color: var(--bc-color-text-soft);
}
.bc-export-helper-steps {
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
  counter-reset: bc-export-step;
}
.bc-export-helper-steps li {
  position: relative;
  margin: 0 0 8px;
  padding: 0 0 0 24px;
  counter-increment: bc-export-step;
}
.bc-export-helper-steps li::before {
  content: counter(bc-export-step) ".";
  position: absolute;
  left: 0;
  top: 0;
  color: var(--bc-color-text-muted);
  font-variant-numeric: tabular-nums;
}
.bc-export-helper-warning {
  margin: 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--bc-color-border-divider);
  font-size: var(--bc-font-13);
  line-height: 1.5;
  color: var(--bc-color-text);
}
.bc-export-helper-help {
  margin: 4px 0 0;
  font-size: var(--bc-font-13);
  color: var(--bc-color-text-muted);
}
.bc-export-helper-help a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.bc-export-helper-help a:hover {
  color: var(--bc-color-text);
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
