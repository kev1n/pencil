import { PAPER_CTEC_CONFIG } from "../config";

// Content rendered inside the side-card analytics panel: metric grid +
// group + card, star ratings, hours track, term selector + summary, metric
// stack with the chart toggle button, inline chart frame, comments preview,
// refresh + load-more controls. Rendered conditionally when the user has
// the side-card analytics tab open instead of opening the modal.
export function sideCardPanelStyles(): string {
  return `
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
    .bc-paper-ctec-analytics-refresh-toolbar {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 14px;
      padding: 12px;
      border-radius: 12px;
      border: 1px dashed rgba(102, 2, 60, 0.22);
      background: rgba(102, 2, 60, 0.04);
    }
    .dark .bc-paper-ctec-analytics-refresh-toolbar {
      border-color: rgba(252, 165, 207, 0.22);
      background: rgba(252, 165, 207, 0.06);
    }
    .bc-paper-ctec-analytics-refresh-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-refresh-copy {
      flex: 1 1 180px;
      min-width: 0;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.45;
      color: #5b4451;
    }
    .dark .bc-paper-ctec-analytics-refresh-copy {
      color: #f3e5ed;
    }
    .bc-paper-ctec-analytics-refresh-explainer {
      font-size: 11px;
      line-height: 1.4;
      color: #6b5a65;
    }
    .dark .bc-paper-ctec-analytics-refresh-explainer {
      color: #d8c7d0;
    }
    .bc-paper-ctec-analytics-load-more {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin: 16px 0 8px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px dashed rgba(102, 2, 60, 0.22);
      background: rgba(102, 2, 60, 0.04);
    }
    .dark .bc-paper-ctec-analytics-load-more {
      border-color: rgba(252, 165, 207, 0.22);
      background: rgba(252, 165, 207, 0.06);
    }
    .bc-paper-ctec-analytics-load-more-copy {
      flex: 1 1 180px;
      min-width: 0;
      font-size: 12px;
      line-height: 1.4;
      color: #5b4451;
    }
    .dark .bc-paper-ctec-analytics-load-more-copy {
      color: #f3e5ed;
    }
    .bc-paper-ctec-analytics-refresh-btn {
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(102, 2, 60, 0.32);
      background: rgba(255, 255, 255, 0.72);
      color: #66023c;
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-refresh-btn:hover:not(:disabled) {
      background: rgba(102, 2, 60, 0.12);
    }
    .bc-paper-ctec-analytics-refresh-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .dark .bc-paper-ctec-analytics-refresh-btn {
      border-color: rgba(252, 165, 207, 0.36);
      background: rgba(17, 24, 39, 0.32);
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-analytics-refresh-btn:hover:not(:disabled) {
      background: rgba(252, 165, 207, 0.14);
    }
    .bc-paper-ctec-analytics-load-more-btn {
      flex: 0 0 auto;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid #66023c;
      background: #66023c;
      color: #ffffff;
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-load-more-btn:hover {
      background: #500030;
    }
    .dark .bc-paper-ctec-analytics-load-more-btn {
      background: #fbcfe8;
      border-color: #fbcfe8;
      color: #500030;
    }
    .dark .bc-paper-ctec-analytics-load-more-btn:hover {
      background: #f9a8d4;
    }
  `;
}
