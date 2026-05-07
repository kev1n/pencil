// =============================================================================
// Component classes. Higher-level reusable patterns built entirely from the
// tokens in tokens.ts. The DOM should reach for these `.bc-*` classes
// instead of writing bespoke CSS or inlining colors.
//
// Naming: `.bc-foo` for the base, `.bc-foo--variant` for size/style variants
// (BEM-ish), `.bc-foo[data-state="x"]` for interactive states. Subparts use
// `.bc-foo__part`.
//
// Sections (in order):
//   1. Surfaces      — cards, modals, panels, dividers
//   2. Buttons       — primary / secondary / ghost / icon
//   3. Pills & chips — small label/value pills, interactive chips, tags
//   4. Inputs        — text, select, search
//   5. Tabs          — underline + pill styles
//   6. Feedback      — spinner, flash banner, status pill, disclaimer, tooltip
//   7. Stars & rating
//   8. Stat tile     — KPI mini card
//   9. Pencil accents — sketchbook-flavored utilities (paper card, pencil
//                       button, marker highlight, scribble text, stamp)
// =============================================================================

export function componentsCss(): string {
  return [
    surfaces(),
    buttons(),
    chips(),
    inputs(),
    tabs(),
    feedback(),
    rating(),
    stats(),
    pencilAccents()
  ].join("\n");
}

// -----------------------------------------------------------------------------
// 1. Surfaces — cards, modals, panels, dividers
// -----------------------------------------------------------------------------
function surfaces(): string {
  return `
/* Generic elevated card (white surface, hairline border, soft shadow). */
.bc-card {
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border-divider);
  border-radius: var(--bc-radius-2xl);
  box-shadow: var(--bc-shadow-elev-2);
  color: var(--bc-color-text);
}
.bc-card--flat {
  box-shadow: none;
}
.bc-card--inset {
  background: var(--bc-color-bg-inset);
  box-shadow: none;
}

/* Translucent gradient panel — paper.nu side-card frame style. */
.bc-card-soft {
  background: linear-gradient(
    180deg,
    var(--bc-color-panel-grad-top),
    var(--bc-color-panel-grad-bottom)
  );
  border: 1px solid var(--bc-color-accent-border-12);
  border-radius: var(--bc-radius-3xl);
  box-shadow: var(--bc-shadow-side-panel);
  color: var(--bc-color-text-mauve-panel);
}

/* Status surface for inline empty/loading/error states inside a modal body. */
.bc-modal-status-card {
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-3xl);
  box-shadow: var(--bc-shadow-modal-status);
  color: var(--bc-color-text);
}

/* Disclaimer / info notice (neutral surface with icon + body). */
.bc-disclaimer {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bc-color-surface-hover);
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-lg);
  color: var(--bc-color-text-soft);
  font-size: var(--bc-font-11);
  line-height: 1.45;
}
.bc-disclaimer strong {
  color: var(--bc-color-text);
}

/* Section divider — horizontal hairline. */
.bc-divider {
  border: 0;
  border-top: 1px solid var(--bc-color-border-divider);
  margin: 0;
}
`;
}

// -----------------------------------------------------------------------------
// 2. Buttons — primary / secondary / ghost / icon
// -----------------------------------------------------------------------------
function buttons(): string {
  return `
/* Base button. Inherit type, no chrome by default — variants supply visuals.
   Defaults match the modal/dialog action shape (the de-facto standard across
   features); use --xs/--sm/--lg modifiers below to scale. */
.bc-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--bc-font-13);
  font-weight: var(--bc-fw-bold);
  letter-spacing: var(--bc-ls-wide);
  line-height: 1;
  padding: 9px 14px;
  border-radius: var(--bc-radius-xl);
  cursor: pointer;
  text-decoration: none;
  transition:
    background var(--bc-tx-base) var(--bc-easing),
    border-color var(--bc-tx-base) var(--bc-easing),
    color var(--bc-tx-base) var(--bc-easing),
    box-shadow var(--bc-tx-base) var(--bc-easing);
}
.bc-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

/* Variant rules below are chained with .bc-btn to bump specificity to (0,2,0).
   Paper.nu's Tailwind preflight resets [type='button'] background-color to
   transparent at (0,1,0) and loads after our design-system style — without
   the chain, that reset defeats the variant fills (white text on the white
   modal card became invisible). */

/* Primary: solid accent fill. */
.bc-btn.bc-btn--primary {
  background: var(--bc-color-accent);
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
}
.bc-btn.bc-btn--primary:hover:not(:disabled) {
  background: var(--bc-color-accent-hover);
  border-color: var(--bc-color-accent-hover);
}

/* Soft modifier — swaps a primary button's hard accent for the softer accent
   ladder (used by modal/dialog action rows where the harder accent reads as
   too loud). Stack with --primary: bc-btn bc-btn--primary bc-btn--soft. */
.bc-btn.bc-btn--soft {
  background: var(--bc-color-accent-soft);
  border-color: var(--bc-color-accent-soft);
  color: var(--bc-color-accent-soft-on);
}
.bc-btn.bc-btn--soft:hover:not(:disabled) {
  background: var(--bc-color-accent-soft-hover);
  border-color: var(--bc-color-accent-soft-hover);
}

/* Secondary: outline with surface bg. */
.bc-btn.bc-btn--secondary {
  background: var(--bc-color-bg);
  border-color: var(--bc-color-border);
  color: var(--bc-color-text);
}
.bc-btn.bc-btn--secondary:hover:not(:disabled) {
  background: var(--bc-color-surface-hover);
}

/* Accent-outline secondary — transparent bg, accent-tinted border, inherits
   text color. Used in modal/dialog action rows alongside --primary --soft. */
.bc-btn.bc-btn--secondary-accent {
  background: transparent;
  border-color: var(--bc-color-accent-border-22);
  color: inherit;
}
.bc-btn.bc-btn--secondary-accent:hover:not(:disabled) {
  background: var(--bc-color-accent-fill-08);
}

/* Fill modifier — expands the button along the main axis of a flex actions
   row (e.g. modal action rows where the primary stretches and the secondary
   stays compact). */
.bc-btn--fill {
  flex: 1 1 auto;
}

/* Ghost: transparent, text only. */
.bc-btn.bc-btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--bc-color-text-muted);
}
.bc-btn.bc-btn--ghost:hover:not(:disabled) {
  background: var(--bc-color-surface-hover);
  color: var(--bc-color-text);
}

/* Outline-accent: outlined accent (used for "Refresh" style secondary CTAs). */
.bc-btn.bc-btn--outline-accent {
  background: var(--bc-color-surface-translucent-72);
  border-color: var(--bc-color-accent-border-32);
  color: var(--bc-color-accent);
}
.bc-btn.bc-btn--outline-accent:hover:not(:disabled) {
  background: var(--bc-color-accent-fill-12);
}

/* Icon-only square button. */
.bc-btn.bc-btn--icon {
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--bc-radius-lg);
  color: var(--bc-color-text-muted);
}
.bc-btn.bc-btn--icon:hover:not(:disabled) {
  background: var(--bc-color-surface-hover);
  color: var(--bc-color-text);
}

/* Pill modifier — fully-rounded edge. */
.bc-btn--pill {
  border-radius: var(--bc-radius-pill);
  padding-left: 16px;
  padding-right: 16px;
}

/* Size modifiers. */
.bc-btn--xs {
  font-size: var(--bc-font-10);
  padding: 2px 8px;
}
.bc-btn--sm {
  font-size: var(--bc-font-11);
  padding: 4px 10px;
}
.bc-btn--lg {
  font-size: var(--bc-font-13);
  padding: 8px 16px;
}

/* Uppercase label modifier for badge-like buttons. */
.bc-btn--label {
  text-transform: uppercase;
  letter-spacing: var(--bc-ls-widest);
  font-weight: var(--bc-fw-bold);
}
`;
}

// -----------------------------------------------------------------------------
// 3. Pills & chips — small labels, interactive chips, generic tags
// -----------------------------------------------------------------------------
function chips(): string {
  return `
/* Static label pill (read-only badge). */
.bc-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-accent-fill-08);
  color: var(--bc-color-accent);
  font-size: var(--bc-font-11);
  font-weight: var(--bc-fw-semibold);
  line-height: 1.2;
  white-space: nowrap;
}
.bc-pill--muted {
  background: var(--bc-color-surface-hover);
  color: var(--bc-color-text-muted);
}
.bc-pill--success {
  background: var(--bc-color-success-bg);
  color: var(--bc-color-success);
}
.bc-pill--warn {
  background: var(--bc-color-warn-bg);
  color: var(--bc-color-warn);
}
.bc-pill--danger {
  background: var(--bc-color-danger-bg);
  color: var(--bc-color-danger);
}
.bc-pill--rose {
  background: var(--bc-color-warn-rose-fill-12);
  color: var(--bc-color-warn-rose-text);
}

/* Interactive chip — used as a removable filter token or active selector. */
.bc-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-accent-surface-tile);
  color: var(--bc-color-accent);
  border: 1px solid transparent;
  font-size: var(--bc-font-11);
  font-weight: var(--bc-fw-semibold);
  line-height: 1.2;
  cursor: pointer;
}
.bc-chip:hover {
  background: var(--bc-color-accent-fill-12);
}

/* Active state for a chip (filter row). */
.bc-chip.is-active,
.bc-chip[aria-pressed="true"] {
  background: var(--bc-color-accent-surface-tile);
  color: var(--bc-color-accent);
  border-color: var(--bc-color-accent-border-18);
}

/* Status pill — Open / Closed / Wait List style. */
.bc-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: var(--bc-radius-pill);
  border: 1px solid var(--bc-color-border);
  background: var(--bc-color-surface-soft);
  color: var(--bc-color-text-muted);
  font-size: var(--bc-font-10);
  font-weight: var(--bc-fw-bold);
  letter-spacing: var(--bc-ls-widest);
  text-transform: uppercase;
  line-height: 1.4;
}
.bc-status-pill[data-status="Open"] {
  background: var(--bc-color-success-bg);
  color: var(--bc-color-success);
  border-color: var(--bc-color-success-bg);
}
.bc-status-pill[data-status="Closed"] {
  background: var(--bc-color-danger-bg);
  color: var(--bc-color-danger);
  border-color: var(--bc-color-danger-bg);
}
.bc-status-pill[data-status="Wait List"] {
  background: var(--bc-color-warn-bg);
  color: var(--bc-color-warn);
  border-color: var(--bc-color-warn-bg);
}

/* Generic kind-tagged tag (used by class-search course header). */
.bc-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--bc-radius-md);
  background: var(--bc-color-paper-soft);
  color: var(--bc-color-paper-deep);
  font-size: var(--bc-font-10);
  font-weight: var(--bc-fw-bold);
  letter-spacing: var(--bc-ls-widest);
  text-transform: uppercase;
  line-height: 1.4;
}
.bc-tag[data-kind="distro"] {
  background: var(--bc-color-success-distro-bg);
  color: var(--bc-color-success-distro-text);
}
.bc-tag[data-kind="discipline"] {
  background: var(--bc-color-warn-bg);
  color: var(--bc-color-warn-text-discipline);
}
.bc-tag[data-kind="school"] {
  background: var(--bc-color-paper-soft);
  color: var(--bc-color-paper);
}
.bc-tag[data-kind="open"] {
  background: var(--bc-color-success-bg);
  color: var(--bc-color-success);
}
.bc-tag[data-kind="closed"] {
  background: var(--bc-color-danger-bg);
  color: var(--bc-color-danger);
}
.bc-tag[data-kind="wait"] {
  background: var(--bc-color-warn-bg);
  color: var(--bc-color-warn);
}
`;
}

// -----------------------------------------------------------------------------
// 4. Inputs — text, select, search
// -----------------------------------------------------------------------------
function inputs(): string {
  return `
/* Base text input. */
.bc-input,
.bc-select {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--bc-color-border-strong);
  border-radius: var(--bc-radius-lg);
  background: var(--bc-color-bg);
  color: var(--bc-color-text);
  font: inherit;
  font-size: var(--bc-font-13);
  line-height: 1.4;
  transition:
    border-color var(--bc-tx-base) var(--bc-easing),
    box-shadow var(--bc-tx-base) var(--bc-easing);
}
.bc-input:focus,
.bc-select:focus {
  outline: none;
  border-color: var(--bc-color-accent);
  box-shadow: var(--bc-shadow-input-focus-ring);
}
.bc-input::placeholder {
  color: var(--bc-color-text-subtle);
}
.bc-input--lg {
  font-size: var(--bc-font-15);
  padding: 10px 14px;
}
.bc-input--sm {
  font-size: var(--bc-font-12);
  padding: 6px 10px;
}

/* Search input — pill wrapper with icon + borderless input. */
.bc-search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-bg);
  color: var(--bc-color-text);
}
.bc-search:focus-within {
  border-color: var(--bc-color-accent);
  box-shadow: var(--bc-shadow-input-focus-ring);
}
.bc-search__icon {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--bc-color-text-subtle);
}
.bc-search__input {
  border: none;
  background: transparent;
  color: var(--bc-color-text);
  flex: 1 1 auto;
  min-width: 0;
  font: inherit;
  font-size: var(--bc-font-13);
  line-height: 1.4;
}
.bc-search__input:focus {
  outline: none;
}
.bc-search__input::placeholder {
  color: var(--bc-color-text-subtle);
}
`;
}

// -----------------------------------------------------------------------------
// 5. Tabs — underline + pill styles
// -----------------------------------------------------------------------------
function tabs(): string {
  return `
/* Underline tabs (modal-style). */
.bc-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--bc-color-border);
}
.bc-tab {
  appearance: none;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 10px 14px;
  margin-bottom: -1px;
  color: var(--bc-color-text-muted);
  font: inherit;
  font-size: var(--bc-font-13);
  font-weight: var(--bc-fw-medium);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bc-tab:hover {
  color: var(--bc-color-text);
}
.bc-tab.is-active {
  color: var(--bc-color-accent);
  border-bottom-color: var(--bc-color-accent);
  font-weight: var(--bc-fw-semibold);
}

/* Pill tabs (side-card-style segmented control). */
.bc-tabs--pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 0;
  padding: 2px;
  border-radius: var(--bc-radius-2xl);
  background: var(--bc-color-accent-fill-06);
}
.bc-tabs--pill .bc-tab {
  border: 0;
  margin-bottom: 0;
  padding: 6px 12px;
  border-radius: var(--bc-radius-xl);
  font-size: var(--bc-font-12);
  text-transform: uppercase;
  letter-spacing: var(--bc-ls-wider);
  font-weight: var(--bc-fw-bold);
  color: var(--bc-color-text-mauve-soft);
}
.bc-tabs--pill .bc-tab:hover {
  background: var(--bc-color-accent-fill-08);
}
.bc-tabs--pill .bc-tab.is-active {
  background: var(--bc-color-accent-fill-15);
  color: var(--bc-color-accent);
  border: 0;
}
`;
}

// -----------------------------------------------------------------------------
// 6. Feedback — spinner, flash banner, tooltip
// -----------------------------------------------------------------------------
function feedback(): string {
  return `
/* Circular loading spinner. */
@keyframes bc-spin {
  to { transform: rotate(360deg); }
}
.bc-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: var(--bc-radius-circle);
  border: 1.5px solid var(--bc-color-accent-fill-24);
  border-top-color: var(--bc-color-accent);
  animation: bc-spin 900ms linear infinite;
}
.bc-spinner--xs {
  width: 10px;
  height: 10px;
}
.bc-spinner--lg {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

/* Flash banner — full-width inline alert. */
.bc-flash {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--bc-radius-xl);
}
.bc-flash--success {
  background: var(--bc-color-success-bg-soft);
  border-color: var(--bc-color-success-border);
  color: var(--bc-color-success-text);
}
.bc-flash--warn {
  background: var(--bc-color-warn-bg-soft);
  border-color: var(--bc-color-warn-border);
  color: var(--bc-color-warn-text);
}
.bc-flash--danger {
  background: var(--bc-color-danger-bg-soft);
  border-color: var(--bc-color-danger-border);
  color: var(--bc-color-danger-text);
}

/* Tooltip — host + popup; show on hover/focus of host.
   Default: single-line, anchored above the host, centered.
   Modifiers (added when paper-ctec migrated off its private tooltip):
     .bc-tooltip--rich  — multi-line wrapping popup anchored below the
                          host with a CSS arrow; high z-index so it
                          renders above modals.
     .bc-tooltip--right — right-edge anchored; pair with --rich when the
                          host sits near the right side of its container
                          so the popup hugs the right instead of
                          overflowing. */
.bc-tooltip-host {
  position: relative;
  display: inline-flex;
}
.bc-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bc-color-bg);
  color: var(--bc-color-text);
  border: 1px solid var(--bc-color-border);
  padding: 6px 10px;
  border-radius: var(--bc-radius-lg);
  font-size: var(--bc-font-11);
  line-height: 1.45;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--bc-tx-base) var(--bc-easing), visibility var(--bc-tx-base) var(--bc-easing);
  box-shadow: var(--bc-shadow-tooltip);
  z-index: 10;
}
.bc-tooltip--rich {
  bottom: auto;
  top: calc(100% + 8px);
  left: -8px;
  transform: none;
  width: min(260px, calc(100vw - 32px));
  padding: 10px 12px;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-weight: var(--bc-fw-medium);
  font-style: normal;
  letter-spacing: 0;
  text-transform: none;
  text-align: left;
  white-space: normal;
  word-break: normal;
  overflow-wrap: anywhere;
  z-index: 2147483647;
}
.bc-tooltip--rich.bc-tooltip--right {
  left: auto;
  right: 0;
}
.bc-tooltip--rich::before {
  content: "";
  position: absolute;
  bottom: 100%;
  left: 14px;
  border: 6px solid transparent;
  border-bottom-color: var(--bc-color-bg);
}
.bc-tooltip--rich.bc-tooltip--right::before {
  left: auto;
  right: 14px;
}
.bc-tooltip-host:hover .bc-tooltip,
.bc-tooltip-host:focus-within .bc-tooltip {
  opacity: 1;
  visibility: visible;
}
`;
}

// -----------------------------------------------------------------------------
// 7. Stars & rating
// -----------------------------------------------------------------------------
function rating(): string {
  return `
.bc-stars {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}
.bc-star {
  position: relative;
  display: inline-block;
  width: 12px;
  height: 12px;
}
.bc-star__base {
  color: var(--bc-color-star-base);
}
.bc-star__fill {
  color: var(--bc-color-star-fill);
  position: absolute;
  inset: 0;
  overflow: hidden;
}
`;
}

// -----------------------------------------------------------------------------
// 8. Stat tile — small KPI mini card (used in class-search detail panel)
// -----------------------------------------------------------------------------
function stats(): string {
  return `
.bc-stat {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-lg);
  min-width: 56px;
}
.bc-stat__value {
  color: var(--bc-color-accent);
  font-size: var(--bc-font-15);
  font-weight: var(--bc-fw-bold);
  line-height: 1.1;
}
.bc-stat__label {
  color: var(--bc-color-text-muted);
  font-size: var(--bc-font-10);
  font-weight: var(--bc-fw-semibold);
  letter-spacing: var(--bc-ls-widest);
  text-transform: uppercase;
  line-height: 1.4;
}
`;
}

// -----------------------------------------------------------------------------
// 9. Pencil accents — sketchbook-flavored utilities. Most callers only see
// these when the active theme is "pencil"; on the legacy default theme they
// still render but use the NU-purple palette via the same tokens.
// -----------------------------------------------------------------------------
function pencilAccents(): string {
  return `
/* Paper card — cream surface, dashed warm border, offset solid shadow.
   Use for popup-internal callouts that should feel like notebook scraps. */
.bc-card--paper {
  background: var(--bc-color-bg);
  border: 2px solid var(--bc-color-text);
  border-radius: var(--bc-radius-lg);
  box-shadow: 2px 2px 0 var(--bc-color-text);
  color: var(--bc-color-text);
  padding: 16px;
}
.bc-card--paper.bc-card--accent-shadow {
  box-shadow: 2px 2px 0 var(--bc-color-accent);
}
/* Slight rotational jitter for popup-only "stack of pages" feel. Avoid
   applying these inside content-script surfaces — Paper.nu's tight grids
   look broken with rotated children. */
.bc-card--rotate-l { transform: rotate(-0.5deg); }
.bc-card--rotate-r { transform: rotate(0.7deg); }

/* Pencil button — ink fill, pencil-font label, offset solid accent shadow. */
.bc-btn.bc-btn--pencil {
  background: var(--bc-color-text);
  border-color: var(--bc-color-text);
  color: var(--bc-color-bg);
  font-family: var(--bc-font-display);
  font-weight: var(--bc-fw-regular);
  letter-spacing: 0.02em;
  box-shadow: 2px 2px 0 var(--bc-color-accent);
  border-radius: var(--bc-radius-sm);
  padding: 10px 16px;
}
.bc-btn.bc-btn--pencil:hover:not(:disabled) {
  background: var(--bc-color-text-strong);
  box-shadow: 3px 3px 0 var(--bc-color-accent);
  transform: translate(-1px, -1px);
}

/* Yellow marker highlight under inline text (landing's .marker). */
.bc-mark {
  background: linear-gradient(transparent 58%, var(--bc-color-highlight-mark) 58%);
  padding: 0 4px;
}

/* Hand-drawn scribble — handwriting font, accent color, tilted. Used for
   section taglines, small annotations, footer asides. */
.bc-scribble {
  font-family: var(--bc-font-hand);
  color: var(--bc-color-accent);
  display: inline-block;
  transform: rotate(-2deg);
  font-size: var(--bc-font-18);
  line-height: 1.2;
}

/* Pencil-font stamp — uppercase boxed label, lightly rotated. */
.bc-stamp {
  display: inline-flex;
  align-items: center;
  font-family: var(--bc-font-display);
  font-size: var(--bc-font-11);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 3px 8px;
  border: 1.5px solid currentColor;
  border-radius: var(--bc-radius-sm);
  transform: rotate(3deg);
  color: var(--bc-color-text-muted);
  background: transparent;
}
.bc-stamp--live { color: var(--bc-color-success); }
.bc-stamp--next { color: var(--bc-color-text); }
.bc-stamp--queued { color: var(--bc-color-text-muted); }

/* Dashed divider — pencil-line dash on warm border tone. */
.bc-divider--dashed {
  border: 0;
  border-top: 2px dashed var(--bc-color-border-strong);
  margin: 0;
}
`;
}
