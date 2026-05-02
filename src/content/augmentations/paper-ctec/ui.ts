import { PAPER_CTEC_CONFIG } from "./config";
import {
  AUTH_MODAL_ID,
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_TABS_CLASS,
  STATUS_BAR_ID,
  STYLE_ID,
  WIDGET_CLASS
} from "./constants";

const STATUS_STACK_CLASS = "bc-paper-ctec-status-stack";
const STATUS_LEGEND_ID = "bc-paper-ctec-status-legend";

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    ${PAPER_CTEC_CONFIG.selectors.scheduleGrid} div.absolute.z-\\[31\\].-translate-y-1\\/2.whitespace-nowrap.rounded-md.bg-emerald-500.px-1\\.5.py-0\\.5.text-\\[10px\\].font-medium.text-white {
      display: none !important;
    }
    .${WIDGET_CLASS} {
      margin-top: 3px;
      padding-top: 3px;
      border-top: 1px solid rgba(17, 24, 39, 0.12);
      min-height: 14px;
      color: #4b5563;
      pointer-events: auto;
    }
    .dark .${WIDGET_CLASS} {
      border-top-color: rgba(255, 255, 255, 0.14);
      color: #d1d5db;
    }
    .bc-paper-ctec-dense-card {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden !important;
      min-height: 0;
      padding-bottom: 18px;
    }
    .bc-paper-ctec-dense-card > .${WIDGET_CLASS} {
      margin-top: auto;
    }
    .bc-paper-ctec-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-width: 0;
    }
    .bc-paper-ctec-course-line {
      flex: 0 1 auto;
      min-width: 0;
      font-size: 11px !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bc-paper-ctec-title-line {
      font-size: 11px !important;
      line-height: 1.2 !important;
      font-weight: 600;
      color: #111827;
      display: -webkit-box;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
    .dark .bc-paper-ctec-title-line {
      color: #f9fafb;
    }
    .bc-paper-ctec-instructor-line {
      flex: 0 0 auto;
      max-width: 44%;
      margin-left: auto !important;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.06);
      font-size: 10px !important;
      font-weight: 600 !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 1 !important;
      color: #4b5563 !important;
    }
    .dark .bc-paper-ctec-instructor-line {
      background: rgba(255, 255, 255, 0.08);
      color: #e5e7eb !important;
    }
    .${WIDGET_CLASS}-summary {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      min-width: 0;
      font-size: 10px;
      line-height: 1.1;
    }
    .${WIDGET_CLASS}-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-width: 0;
      max-width: 100%;
      padding: 1px 4px;
      border-radius: 999px;
      border: 1px solid var(--bc-paper-ctec-chip-border, transparent);
      background: var(--bc-paper-ctec-chip-bg, rgba(255, 255, 255, 0.56));
      color: var(--bc-paper-ctec-chip-fg, #374151);
      white-space: nowrap;
      font-weight: 600;
    }
    .${WIDGET_CLASS}-chip-label {
      opacity: 0.72;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .${WIDGET_CLASS}-chip-value {
      font-size: 10px;
      font-weight: 800;
    }
    .${WIDGET_CLASS}-chip-stars {
      display: inline-flex;
      align-items: center;
      margin-left: 1px;
    }
    .${WIDGET_CLASS}-chip-stars .bc-paper-ctec-stars {
      gap: ${PAPER_CTEC_CONFIG.ui.summaryChipStarGapPx}px;
    }
    .${WIDGET_CLASS}-chip-stars .bc-paper-ctec-star {
      width: ${PAPER_CTEC_CONFIG.ui.summaryChipStarSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.summaryChipStarSizePx}px;
    }
    .dark .${WIDGET_CLASS}-chip {
      border-color: var(--bc-paper-ctec-chip-border-dark, transparent);
      background: var(--bc-paper-ctec-chip-bg-dark, rgba(17, 24, 39, 0.54));
      color: var(--bc-paper-ctec-chip-fg-dark, #e5e7eb);
    }
    .${WIDGET_CLASS}-chip svg {
      width: ${PAPER_CTEC_CONFIG.ui.summaryChipIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.summaryChipIconSizePx}px;
      flex: 0 0 auto;
      stroke-width: ${PAPER_CTEC_CONFIG.ui.summaryChipStrokeWidth};
    }
    .${WIDGET_CLASS}-chip.is-muted {
      font-weight: 500;
      color: #6b7280;
    }
    .dark .${WIDGET_CLASS}-chip.is-muted {
      color: #cbd5e1;
    }
    .${WIDGET_CLASS}-chip.is-warn {
      background: rgba(190, 24, 93, 0.12);
      color: #9f1239;
    }
    .dark .${WIDGET_CLASS}-chip.is-warn {
      background: rgba(251, 113, 133, 0.14);
      color: #fecdd3;
    }
    button.${WIDGET_CLASS}-chip-button {
      appearance: none;
      border: 1px solid rgba(190, 24, 93, 0.32);
      cursor: pointer;
      font: inherit;
      padding: 1px 6px;
    }
    button.${WIDGET_CLASS}-chip-button:hover {
      background: rgba(190, 24, 93, 0.2);
    }
    .dark button.${WIDGET_CLASS}-chip-button {
      border-color: rgba(251, 113, 133, 0.4);
    }
    .dark button.${WIDGET_CLASS}-chip-button:hover {
      background: rgba(251, 113, 133, 0.22);
    }
    #${STATUS_BAR_ID} {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      width: auto;
      max-width: none;
      min-height: ${PAPER_CTEC_CONFIG.ui.statusBarMinHeightPx}px;
      padding: 4px 10px;
      border: 1px solid rgba(102, 2, 60, 0.18);
      border-radius: 8px;
      background: rgba(102, 2, 60, 0.08);
      color: #66023c;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      flex: 1 1 auto;
      box-sizing: border-box;
      overflow: hidden;
    }
    #${STATUS_BAR_ID}.is-loading {
      background: rgba(102, 2, 60, 0.08);
    }
    #${STATUS_BAR_ID}.is-auth {
      border-color: rgba(102, 2, 60, 0.28);
      background: rgba(102, 2, 60, 0.12);
    }
    #${STATUS_BAR_ID}.is-ready {
      border-color: rgba(102, 2, 60, 0.14);
      background: rgba(102, 2, 60, 0.05);
    }
    #${STATUS_BAR_ID} svg {
      width: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      flex: 0 0 auto;
      stroke-width: ${PAPER_CTEC_CONFIG.ui.statusIconStrokeWidth};
    }
    .dark #${STATUS_BAR_ID} {
      border-color: rgba(252, 165, 207, 0.2);
      background: rgba(157, 23, 77, 0.18);
      color: #fbcfe8;
    }
    .dark #${STATUS_BAR_ID}.is-auth {
      border-color: rgba(252, 165, 207, 0.34);
      background: rgba(157, 23, 77, 0.26);
    }
    .${STATUS_STACK_CLASS} {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .bc-paper-ctec-status-mark {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex-shrink: 0;
    }
    .bc-paper-ctec-status-brand {
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-copy {
      min-width: 0;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.95;
    }
    .bc-paper-ctec-status-action {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      margin-left: auto;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(102, 2, 60, 0.24);
      background: rgba(255, 255, 255, 0.72);
      color: inherit;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-decoration: none;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-action:hover {
      background: rgba(255, 255, 255, 0.92);
    }
    .dark .bc-paper-ctec-status-action {
      border-color: rgba(252, 165, 207, 0.26);
      background: rgba(17, 24, 39, 0.28);
    }
    .dark .bc-paper-ctec-status-action:hover {
      background: rgba(17, 24, 39, 0.4);
    }
    #${STATUS_LEGEND_ID} {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
      font-size: 10px;
      line-height: 1.2;
      color: #6b5a65;
    }
    .dark #${STATUS_LEGEND_ID} {
      color: #d8c7d0;
    }
    .bc-paper-ctec-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(102, 2, 60, 0.06);
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-legend-item {
      background: rgba(252, 165, 207, 0.08);
    }
    .bc-paper-ctec-legend-key {
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #66023c;
    }
    .dark .bc-paper-ctec-legend-key {
      color: #fbcfe8;
    }
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
    .bc-paper-ctec-analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(${PAPER_CTEC_CONFIG.ui.analyticsMetricMinWidthPx}px, 1fr));
      gap: 8px;
      margin-bottom: 0;
    }
    .bc-paper-ctec-analytics-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid rgba(102, 2, 60, 0.1);
      border-radius: 14px;
      background: rgba(255, 251, 253, 0.86);
    }
    .bc-paper-ctec-analytics-group-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7a596a;
    }
    .dark .bc-paper-ctec-analytics-group {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(17, 24, 39, 0.26);
    }
    .dark .bc-paper-ctec-analytics-group-title {
      color: #d4b9c5;
    }
    .bc-paper-ctec-analytics-card {
      border-radius: 12px;
      border: 1px solid rgba(102, 2, 60, 0.1);
      background: rgba(255, 255, 255, 0.72);
      padding: 10px;
    }
    .dark .bc-paper-ctec-analytics-card {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(17, 24, 39, 0.3);
    }
    .bc-paper-ctec-analytics-card-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #7a596a;
    }
    .dark .bc-paper-ctec-analytics-card-label {
      color: #d4b9c5;
    }
    .bc-paper-ctec-analytics-card-rating {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .bc-paper-ctec-analytics-card-value {
      font-size: 14px;
      font-weight: 800;
      color: #2f1f29;
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-analytics-card-value {
      color: #fff6fb;
    }
    .bc-paper-ctec-analytics-card-hours {
      margin-top: 8px;
      font-size: 15px;
      font-weight: 800;
      color: #2f1f29;
    }
    .dark .bc-paper-ctec-analytics-card-hours {
      color: #fff6fb;
    }
    .bc-paper-ctec-stars {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .bc-paper-ctec-star {
      position: relative;
      display: inline-flex;
      width: ${PAPER_CTEC_CONFIG.ui.analyticsStarSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.analyticsStarSizePx}px;
      flex: 0 0 auto;
    }
    .bc-paper-ctec-star svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      stroke-width: 1.7;
    }
    .bc-paper-ctec-star-base {
      color: #c9b4bf;
    }
    .bc-paper-ctec-star-fill {
      position: absolute;
      inset: 0 auto 0 0;
      overflow: hidden;
      color: #d97706;
    }
    .dark .bc-paper-ctec-star-base {
      color: rgba(255, 227, 238, 0.36);
    }
    .dark .bc-paper-ctec-star-fill {
      color: #fbbf24;
    }
    .bc-paper-ctec-hours-track {
      margin-top: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(102, 2, 60, 0.12);
      overflow: hidden;
    }
    .bc-paper-ctec-hours-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #a21caf, #db2777);
    }
    .dark .bc-paper-ctec-hours-track {
      background: rgba(252, 165, 207, 0.16);
    }
    .bc-paper-ctec-hours-meta {
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      line-height: 1.35;
      color: #6b7280;
    }
    .dark .bc-paper-ctec-hours-meta {
      color: #cbd5e1;
    }
    .bc-paper-ctec-analytics-section-title {
      margin: 16px 0 8px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7a596a;
    }
    .dark .bc-paper-ctec-analytics-section-title {
      color: #d4b9c5;
    }
    .bc-paper-ctec-analytics-term-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .bc-paper-ctec-analytics-term-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .bc-paper-ctec-analytics-term-selector label {
      font-size: 12px;
      font-weight: 700;
      color: #6b5a65;
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-analytics-term-selector label {
      color: #d8c7d0;
    }
    .bc-paper-ctec-analytics-term-select {
      min-width: 0;
      flex: 1 1 auto;
      border: 1px solid rgba(102, 2, 60, 0.14);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.84);
      color: #2f1f29;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 10px;
    }
    .dark .bc-paper-ctec-analytics-term-select {
      border-color: rgba(252, 165, 207, 0.18);
      background: rgba(17, 24, 39, 0.35);
      color: #fff6fb;
    }
    .bc-paper-ctec-analytics-term-summary {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(102, 2, 60, 0.08);
      background: rgba(255, 255, 255, 0.56);
    }
    .dark .bc-paper-ctec-analytics-term-summary {
      border-color: rgba(252, 165, 207, 0.12);
      background: rgba(17, 24, 39, 0.22);
    }
    .bc-paper-ctec-analytics-term-title {
      font-size: 14px;
      font-weight: 800;
      color: #2f1f29;
    }
    .dark .bc-paper-ctec-analytics-term-title {
      color: #fff6fb;
    }
    .bc-paper-ctec-analytics-term-meta {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.45;
      color: #6b7280;
    }
    .dark .bc-paper-ctec-analytics-term-meta {
      color: #cbd5e1;
    }
    .bc-paper-ctec-analytics-term-link {
      color: #66023c;
      font-size: 11px;
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 3px;
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-analytics-term-link {
      color: #fbcfe8;
    }
    .bc-paper-ctec-analytics-state-note {
      font-size: 12px;
      line-height: 1.5;
      color: #6b7280;
    }
    .dark .bc-paper-ctec-analytics-state-note {
      color: #cbd5e1;
    }
    .bc-paper-ctec-analytics-metric-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-metric-card {
      border-radius: 12px;
      border: 1px solid rgba(102, 2, 60, 0.08);
      background: rgba(255, 255, 255, 0.62);
      padding: 12px;
    }
    .dark .bc-paper-ctec-analytics-metric-card {
      border-color: rgba(252, 165, 207, 0.12);
      background: rgba(17, 24, 39, 0.22);
    }
    .bc-paper-ctec-analytics-metric-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-metric-chart-btn {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(102, 2, 60, 0.12);
      border-radius: 999px;
      background: rgba(102, 2, 60, 0.05);
      color: #66023c;
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-metric-chart-btn svg {
      width: 14px;
      height: 14px;
      stroke-width: 1.9;
    }
    .bc-paper-ctec-analytics-metric-chart-btn:hover {
      background: rgba(102, 2, 60, 0.1);
    }
    .dark .bc-paper-ctec-analytics-metric-chart-btn {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(252, 165, 207, 0.1);
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-analytics-metric-chart-btn:hover {
      background: rgba(252, 165, 207, 0.16);
    }
    .bc-paper-ctec-analytics-inline-chart {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(102, 2, 60, 0.08);
    }
    .dark .bc-paper-ctec-analytics-inline-chart {
      border-top-color: rgba(252, 165, 207, 0.12);
    }
    .bc-paper-ctec-analytics-inline-chart-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-chart-title {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
    }
    .bc-paper-ctec-analytics-chart-image {
      width: 100%;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.88);
    }
    .bc-paper-ctec-analytics-comments-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
    }
    .bc-paper-ctec-analytics-comments-search {
      width: 100%;
      border: 1px solid rgba(102, 2, 60, 0.14);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.84);
      color: #2f1f29;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 10px;
    }
    .dark .bc-paper-ctec-analytics-comments-search {
      border-color: rgba(252, 165, 207, 0.18);
      background: rgba(17, 24, 39, 0.35);
      color: #fff6fb;
    }
    .bc-paper-ctec-analytics-comments-count {
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 700;
      color: #6b5a65;
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-analytics-comments-count {
      color: #d8c7d0;
    }
    .bc-paper-ctec-analytics-comments {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 10px;
    }
    .bc-paper-ctec-analytics-comment-group {
      border-radius: 12px;
      border: 1px solid rgba(102, 2, 60, 0.08);
      background: rgba(255, 255, 255, 0.56);
      padding: 12px;
    }
    .dark .bc-paper-ctec-analytics-comment-group {
      border-color: rgba(252, 165, 207, 0.12);
      background: rgba(17, 24, 39, 0.22);
    }
    .bc-paper-ctec-analytics-comment-prompt {
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.45;
      color: #5b4451;
    }
    .dark .bc-paper-ctec-analytics-comment-prompt {
      color: #f3e5ed;
    }
    .bc-paper-ctec-analytics-comment-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bc-paper-ctec-analytics-comment-card {
      padding: 10px;
      border-radius: 10px;
      background: rgba(102, 2, 60, 0.05);
      font-size: 12px;
      line-height: 1.5;
      color: #4b5563;
      white-space: pre-wrap;
    }
    .dark .bc-paper-ctec-analytics-comment-card {
      background: rgba(252, 165, 207, 0.08);
      color: #e5e7eb;
    }
    .bc-paper-ctec-comment-highlight {
      background: rgba(250, 204, 21, 0.38);
      color: inherit;
      border-radius: 2px;
      padding: 0 1px;
    }
    .dark .bc-paper-ctec-comment-highlight {
      background: rgba(250, 204, 21, 0.24);
    }
    #${AUTH_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(2px);
      animation: bc-paper-ctec-auth-fade 140ms ease-out;
    }
    @keyframes bc-paper-ctec-auth-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .bc-paper-ctec-auth-card {
      position: relative;
      width: min(420px, 100%);
      padding: 28px 26px 22px;
      border-radius: 18px;
      background: #ffffff;
      color: #2f1f29;
      box-shadow: 0 28px 60px rgba(15, 23, 42, 0.32);
      text-align: left;
      animation: bc-paper-ctec-auth-pop 160ms ease-out;
    }
    @keyframes bc-paper-ctec-auth-pop {
      from { transform: translateY(8px) scale(0.98); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    .dark .bc-paper-ctec-auth-card {
      background: #1f1318;
      color: #fbeaf2;
      box-shadow: 0 28px 60px rgba(0, 0, 0, 0.6);
    }
    .bc-paper-ctec-auth-close {
      position: absolute;
      top: 8px;
      right: 10px;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      opacity: 0.6;
    }
    .bc-paper-ctec-auth-close:hover {
      background: rgba(15, 23, 42, 0.08);
      opacity: 1;
    }
    .dark .bc-paper-ctec-auth-close:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .bc-paper-ctec-auth-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin-bottom: 14px;
      border-radius: 14px;
      background: rgba(102, 2, 60, 0.12);
      color: #66023c;
    }
    .bc-paper-ctec-auth-icon svg {
      width: 22px;
      height: 22px;
      stroke-width: 1.8;
    }
    .dark .bc-paper-ctec-auth-icon {
      background: rgba(252, 165, 207, 0.16);
      color: #fbcfe8;
    }
    .bc-paper-ctec-auth-spinner {
      position: relative;
    }
    .bc-paper-ctec-auth-spinner::before {
      content: "";
      position: absolute;
      inset: 10px;
      border-radius: 999px;
      border: 2.5px solid rgba(102, 2, 60, 0.18);
      border-top-color: #66023c;
      animation: bc-paper-ctec-auth-spin 900ms linear infinite;
    }
    .dark .bc-paper-ctec-auth-spinner::before {
      border-color: rgba(252, 165, 207, 0.22);
      border-top-color: #fbcfe8;
    }
    @keyframes bc-paper-ctec-auth-spin {
      to { transform: rotate(360deg); }
    }
    .bc-paper-ctec-auth-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 800;
      color: #66023c;
    }
    .dark .bc-paper-ctec-auth-title {
      color: #fbcfe8;
    }
    .bc-paper-ctec-auth-body {
      margin: 0 0 12px;
      font-size: 13px;
      line-height: 1.5;
      color: #4b3a44;
    }
    .dark .bc-paper-ctec-auth-body {
      color: #e8d3dc;
    }
    .bc-paper-ctec-auth-note {
      margin: 0 0 12px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(102, 2, 60, 0.06);
      font-size: 12px;
      line-height: 1.45;
      color: #6b5a65;
    }
    .dark .bc-paper-ctec-auth-note {
      background: rgba(252, 165, 207, 0.08);
      color: #d8c7d0;
    }
    .bc-paper-ctec-auth-trust {
      margin: 0 0 18px;
      font-size: 12px;
      line-height: 1.45;
      color: #6b5a65;
    }
    .dark .bc-paper-ctec-auth-trust {
      color: #d8c7d0;
    }
    .bc-paper-ctec-auth-link {
      color: #66023c;
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .bc-paper-ctec-auth-link:hover {
      color: #500030;
    }
    .dark .bc-paper-ctec-auth-link {
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-auth-link:hover {
      color: #ffe4f0;
    }
    .bc-paper-ctec-auth-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .bc-paper-ctec-auth-primary,
    .bc-paper-ctec-auth-secondary {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 9px 14px;
      border-radius: 10px;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      text-decoration: none;
    }
    .bc-paper-ctec-auth-primary {
      flex: 1 1 auto;
      border: 1px solid #66023c;
      background: #66023c;
      color: #ffffff;
    }
    .bc-paper-ctec-auth-primary:hover {
      background: #500030;
    }
    .bc-paper-ctec-auth-secondary {
      border: 1px solid rgba(102, 2, 60, 0.2);
      background: transparent;
      color: inherit;
    }
    .bc-paper-ctec-auth-secondary:hover {
      background: rgba(102, 2, 60, 0.08);
    }
    .dark .bc-paper-ctec-auth-secondary {
      border-color: rgba(252, 165, 207, 0.3);
    }
    .dark .bc-paper-ctec-auth-secondary:hover {
      background: rgba(252, 165, 207, 0.12);
    }
    @media (max-width: 900px) {
      .bc-paper-ctec-status-brand {
        display: none;
      }
      .bc-paper-ctec-instructor-line {
        max-width: 50%;
      }
    }
  `;

  (document.head ?? document.documentElement).appendChild(style);
}

export {
  hideAuthModal,
  hideStatusBar,
  renderAuthModal,
  renderLoading,
  renderStatusBar,
  renderWidget
} from "./schedule-ui";
export { renderSideCardAnalytics } from "./analytics-ui";
