import {
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_TABS_CLASS
} from "../constants";

// Side-card shell styles: the tab strip that toggles the analytics view, the
// panel frame around it, the small launcher block that the panel mostly
// reduces to now (the rich rendering moved into the modal). Content rendered
// *inside* the panel (cards, charts, comments preview, refresh controls)
// lives in side-card-panel.ts.
export function sideCardStyles(): string {
  return `
    /* Two quiet text tabs under Paper.nu's own header; the selected one
       is ink-filled. */
    .${SIDECARD_TABS_CLASS} {
      display: flex;
      gap: 2px;
      margin: 0 0 12px;
      font-family: var(--bc-font-body);
      position: relative;
      z-index: 2;
      pointer-events: auto;
    }
    .bc-paper-ctec-side-tab {
      height: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--bc-color-text-soft);
      font-family: inherit;
      font-size: 12.5px;
      cursor: pointer;
      transition: background var(--bc-tx-base) var(--bc-easing), color var(--bc-tx-base) var(--bc-easing);
      position: relative;
      z-index: 1;
      pointer-events: auto;
    }
    .bc-paper-ctec-side-tab:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-paper-ctec-side-tab.is-active,
    .bc-paper-ctec-side-tab.is-active:hover {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    /* The panel is not a card: it sits on Paper.nu's panel surface. */
    .${SIDECARD_ANALYTICS_PANEL_CLASS} {
      margin: 0 0 12px;
      font-family: var(--bc-font-body);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-analytics-body {
      padding: 2px 0 0;
    }
    .bc-paper-ctec-analytics-title {
      font-size: var(--bc-font-14);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
    }
    .bc-paper-ctec-analytics-subtitle {
      margin-top: 4px;
      font-size: var(--bc-font-12);
      line-height: 1.4;
      color: var(--bc-color-text-mauve-soft);
    }
    .bc-paper-ctec-analytics-callout {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
      padding: 10px 0 0;
      border-top: 1px solid var(--bc-color-border-divider);
      font-size: var(--bc-font-12);
      line-height: 1.45;
    }
    .bc-paper-ctec-analytics-callout.is-warn {
      color: var(--bc-color-warn-rose-text-deep);
    }
    .bc-paper-ctec-analytics-callout.is-muted {
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-analytics-callout a {
      flex-shrink: 0;
      color: inherit;
      font-weight: var(--bc-fw-semibold);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    /* The CTECs tab needs more room than Paper.nu's 448px panel. Paper.nu
       caps the panel's wrapper with md:max-w-md; lift that while our tab
       is showing. */
    [data-bc-ctec-wide] {
      max-width: min(100vw, 520px) !important;
    }
  `;
}
