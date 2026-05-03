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
    .${SIDECARD_TABS_CLASS} {
      display: flex;
      gap: 8px;
      margin: 0 0 14px;
      padding: 4px;
      border-radius: 12px;
      background: rgba(102, 2, 60, 0.06);
      position: relative;
      z-index: 2;
      pointer-events: auto;
    }
    .dark .${SIDECARD_TABS_CLASS} {
      background: rgba(252, 165, 207, 0.08);
    }
    .bc-paper-ctec-side-tab {
      flex: 1 1 0;
      min-width: 0;
      padding: 8px 10px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #6b5a65;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
      position: relative;
      z-index: 1;
      pointer-events: auto;
    }
    .bc-paper-ctec-side-tab:hover {
      background: rgba(102, 2, 60, 0.08);
    }
    .bc-paper-ctec-side-tab.is-active {
      background: rgba(102, 2, 60, 0.15);
      color: #66023c;
    }
    .dark .bc-paper-ctec-side-tab {
      color: #d8c7d0;
    }
    .dark .bc-paper-ctec-side-tab:hover {
      background: rgba(252, 165, 207, 0.08);
    }
    .dark .bc-paper-ctec-side-tab.is-active {
      background: rgba(252, 165, 207, 0.16);
      color: #fbcfe8;
    }
    .${SIDECARD_ANALYTICS_PANEL_CLASS} {
      margin: 0 0 12px;
      border: 1px solid rgba(102, 2, 60, 0.12);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255, 250, 252, 0.98), rgba(255, 255, 255, 0.98));
      color: #3f3340;
      overflow: hidden;
      box-shadow: 0 10px 28px rgba(102, 2, 60, 0.08);
    }
    .dark .${SIDECARD_ANALYTICS_PANEL_CLASS} {
      border-color: rgba(252, 165, 207, 0.14);
      background: linear-gradient(180deg, rgba(31, 24, 29, 0.98), rgba(23, 18, 22, 0.98));
      color: #f5e7ee;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    }
    .bc-paper-ctec-analytics-body {
      padding: 14px;
    }
    .bc-paper-ctec-analytics-head {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      margin-bottom: 12px;
    }
    .bc-paper-ctec-analytics-title {
      font-size: 15px;
      font-weight: 800;
      color: #66023c;
    }
    .dark .bc-paper-ctec-analytics-title {
      color: #fbcfe8;
    }
    .bc-paper-ctec-analytics-subtitle {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.4;
      color: #6b5a65;
    }
    .dark .bc-paper-ctec-analytics-subtitle {
      color: #d8c7d0;
    }
    .bc-paper-ctec-analytics-callout {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(102, 2, 60, 0.06);
      font-size: 12px;
      line-height: 1.45;
    }
    .bc-paper-ctec-analytics-callout.is-warn {
      background: rgba(190, 24, 93, 0.1);
      color: #881337;
    }
    .bc-paper-ctec-analytics-callout.is-muted {
      color: #6b7280;
    }
    .dark .bc-paper-ctec-analytics-callout {
      background: rgba(252, 165, 207, 0.08);
    }
    .dark .bc-paper-ctec-analytics-callout.is-warn {
      background: rgba(251, 113, 133, 0.12);
      color: #fecdd3;
    }
    .dark .bc-paper-ctec-analytics-callout.is-muted {
      color: #d1d5db;
    }
    .bc-paper-ctec-analytics-callout a {
      flex-shrink: 0;
      color: inherit;
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .bc-paper-ctec-analytics-launcher {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 14px 0 0;
      padding: 12px;
      border-radius: 12px;
      background: rgba(102, 2, 60, 0.06);
    }
    .dark .bc-paper-ctec-analytics-launcher {
      background: rgba(252, 165, 207, 0.08);
    }
    .bc-paper-ctec-analytics-launcher-copy {
      font-size: 12px;
      line-height: 1.45;
      color: #5b4451;
    }
    .dark .bc-paper-ctec-analytics-launcher-copy {
      color: #f3e5ed;
    }
    .bc-paper-ctec-analytics-launcher-btn {
      align-self: flex-start;
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid #66023c;
      background: #66023c;
      color: #ffffff;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-launcher-btn:hover {
      background: #500030;
    }
    .dark .bc-paper-ctec-analytics-launcher-btn {
      background: #fbcfe8;
      border-color: #fbcfe8;
      color: #500030;
    }
    .dark .bc-paper-ctec-analytics-launcher-btn:hover {
      background: #f9a8d4;
    }
  `;
}
