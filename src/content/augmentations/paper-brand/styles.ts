import { ensureStyle } from "../../framework/dom";
import { HOST_MARKER_ATTR, MARK_MARKER_ATTR, STYLE_ID } from "./constants";

// Paper.nu's logo button is a `flex flex-col` button containing only the
// paper.nu image. Once we graft the mark in as a sibling, flipping the
// direction to row puts "with pencil" + the icon to the right of the
// logo. `!important` is needed to override the Tailwind utility on the
// host button without restructuring its className.
//
// Font family falls back through `--bc-font-hand` (Caveat in the pencil
// theme, inherit in the default NU-purple theme) → an explicit Caveat
// stack so the handwritten look stays visible even when the default
// theme leaves `--bc-font-hand` as `inherit`.
const CSS = `
button[${HOST_MARKER_ATTR}="1"] {
  flex-direction: row !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 6px;
  flex-wrap: nowrap;
  padding-left: 6px !important;
  padding-right: 6px !important;
}

.bc-paper-brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 1 auto;
  min-width: 0;
  cursor: pointer;
  padding: 4px 6px;
  margin: -4px -6px;
  border-radius: var(--bc-radius-lg);
  background: transparent;
  transition: background-color 140ms ease, transform 140ms ease;
}
.bc-paper-brand-mark:hover,
.bc-paper-brand-mark:focus-visible {
  background: var(--bc-color-accent-fill-08);
  transform: translateY(-1px);
}
.bc-paper-brand-mark:focus-visible {
  outline: 2px solid var(--bc-color-accent);
  outline-offset: 2px;
}
.bc-paper-brand-mark:active {
  transform: translateY(0);
}

.bc-paper-brand-mark__text {
  font-family: var(--bc-font-hand, "Caveat", "Patrick Hand", ui-rounded, cursive);
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: var(--bc-color-accent);
  transform: rotate(-3deg);
  white-space: nowrap;
}

@media (max-width: 1250px) {
  .bc-paper-brand-mark__text {
    display: none;
  }
}

.bc-paper-brand-mark__icon {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  transform: rotate(-4deg);
}

[${MARK_MARKER_ATTR}="1"] svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Paper.nu's dark mode mirrors onto [data-bc-mode="dark"] (see design/index.ts).
   The graphite SVG strokes get hard to read on the dark gray sidebar, so
   lighten them via the near-white --bc-color-text-on-tooltip token (which
   is consistently light across every theme). The attribute selectors match
   the literal stroke/fill values authored into the SVG markup. */
[data-bc-mode="dark"] .bc-paper-brand-mark__icon svg [stroke="#2a2a2e"] {
  stroke: var(--bc-color-text-on-tooltip);
}
[data-bc-mode="dark"] .bc-paper-brand-mark__icon svg polygon[fill="#2a2a2e"] {
  fill: var(--bc-color-text-on-tooltip);
}

/* About modal — framework .bc-modal-card chrome plus a small header row
   (pencil mark beside the name and version). */
.bc-paper-brand-about-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.bc-paper-brand-about-icon {
  flex: none;
  width: 40px;
  height: 40px;
}
.bc-paper-brand-about-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.bc-paper-brand-about-title {
  margin: 0;
  font-size: var(--bc-font-18);
  font-weight: var(--bc-fw-semibold);
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--bc-color-text-strong);
}
.bc-paper-brand-about-version {
  margin: 2px 0 0;
  font-size: var(--bc-font-12);
  color: var(--bc-color-text-muted);
  font-variant-numeric: tabular-nums;
}
.bc-paper-brand-about-lede,
.bc-paper-brand-about-credit {
  margin: 0 0 8px;
  font-size: var(--bc-font-14);
  line-height: 1.5;
  color: var(--bc-color-text-soft);
}
.bc-paper-brand-about-credit-link {
  color: var(--bc-color-text);
  font-weight: var(--bc-fw-medium);
  text-decoration: underline;
  text-decoration-color: var(--bc-color-border-strong);
  text-underline-offset: 3px;
}
.bc-paper-brand-about-credit-link:hover {
  text-decoration-color: currentColor;
}
.bc-paper-brand-about-credit-link:focus-visible {
  outline: 2px solid var(--bc-color-accent);
  outline-offset: 2px;
  border-radius: var(--bc-radius-sm);
}
.bc-paper-brand-about-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
.bc-paper-brand-about-disclaimer {
  margin: 12px 0 0;
  font-size: var(--bc-font-12);
  line-height: 1.5;
  color: var(--bc-color-text-muted);
}
`;

export function injectPaperBrandStyles(doc: Document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}

export function removePaperBrandStyles(doc: Document): void {
  doc.getElementById(STYLE_ID)?.remove();
}
