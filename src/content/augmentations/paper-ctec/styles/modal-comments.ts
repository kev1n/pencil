// Comments tab styles: rail (topic filter list with sentiment bars),
// toolbar (search + sort), filter chips, comment cards (term/tag/prompt/
// text/highlight/themes/clamp toggle), and the inline highlight markup.
export function modalCommentStyles(): string {
  return `
    .bc-paper-ctec-modal-comments {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 260px 1fr;
    }
    .bc-paper-ctec-modal-rail {
      border-right: 1px solid var(--bc-color-border);
      padding: 20px 18px 28px;
      background: var(--bc-color-bg);
      overflow-y: auto;
      min-height: 0;
    }
    .bc-paper-ctec-modal-comments-main {
      overflow-y: auto;
      min-height: 0;
    }
    .bc-paper-ctec-modal-rail-header {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: 0.12em;
      color: var(--bc-color-text-muted);
      text-transform: uppercase;
      margin: 14px 0 6px;
    }
    .bc-paper-ctec-modal-rail-header:first-child {
      margin-top: 0;
    }
    .bc-paper-ctec-modal-rail-btn {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px;
      align-items: center;
      width: 100%;
      padding: 7px 10px;
      border-radius: var(--bc-radius-md);
      border: 0;
      background: transparent;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-rail-btn.is-active {
      background: var(--bc-color-accent-surface-soft);
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-modal-rail-btn:hover:not(.is-active) {
      background: var(--bc-color-surface-hover);
    }
    .bc-paper-ctec-modal-rail-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--bc-radius-circle);
      grid-column: auto;
    }
    .bc-paper-ctec-modal-rail-label {
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-medium);
    }
    .bc-paper-ctec-modal-rail-btn.is-active .bc-paper-ctec-modal-rail-label {
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-rail-count {
      font-size: var(--bc-font-10);
      font-family: ui-monospace, monospace;
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-modal-rail-empty {
      padding: 6px 10px 4px;
      font-size: var(--bc-font-11);
      line-height: 1.4;
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-modal-rail-btn.has-sentiment {
      grid-template-rows: auto auto;
      grid-template-columns: 1fr auto;
      row-gap: 5px;
    }
    .bc-paper-ctec-modal-rail-tone {
      grid-column: 1 / -1;
      display: flex;
      width: 100%;
      height: 4px;
      border-radius: var(--bc-radius-pill);
      overflow: hidden;
      background: var(--bc-color-chart-trend-axis);
    }
    .bc-paper-ctec-modal-rail-tone-seg {
      height: 100%;
      flex-grow: 0;
      flex-shrink: 0;
      flex-basis: 0;
    }
    .bc-paper-ctec-modal-comment-theme.is-active {
      background: var(--bc-color-highlight);
      color: var(--bc-color-highlight-text);
    }
    .bc-paper-ctec-modal-comments-main {
      padding: 20px 28px 32px;
    }
    .bc-paper-ctec-modal-comments-toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-modal-comments-search {
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-xl);
      padding: 8px 12px;
      background: var(--bc-color-surface-hover);
      flex: 1;
      min-width: 240px;
    }
    .bc-paper-ctec-modal-comments-search-icon {
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-modal-comments-input {
      border: 0;
      outline: 0;
      font-size: var(--bc-font-14);
      flex: 1;
      background: transparent;
      color: var(--bc-color-text);
      font-family: inherit;
    }
    .bc-paper-ctec-modal-comments-input::placeholder {
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-modal-comments-sort {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-comments-sort-select {
      font-family: inherit;
      font-size: var(--bc-font-12);
      padding: 5px 8px;
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-md);
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-filter-chips {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 14px;
      flex-wrap: wrap;
      font-size: var(--bc-font-12);
    }
    .bc-paper-ctec-modal-filter-chips:empty {
      display: none;
    }
    .bc-paper-ctec-modal-filter-label {
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 4px 3px 10px;
      background: var(--bc-color-accent-surface-soft);
      border-radius: var(--bc-radius-2xl);
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-modal-filter-chip-x {
      border: 0;
      background: transparent;
      color: var(--bc-color-accent);
      cursor: pointer;
      padding: 0 6px;
      font-size: var(--bc-font-12);
      line-height: 1;
    }
    .bc-paper-ctec-modal-filter-clear {
      border: 0;
      background: transparent;
      color: var(--bc-color-text-muted);
      cursor: pointer;
      text-decoration: underline;
      font-size: var(--bc-font-12);
    }
    .bc-paper-ctec-modal-comments-count {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      margin-bottom: 12px;
    }
    .bc-paper-ctec-modal-comments-count strong {
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-comments-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bc-paper-ctec-modal-comments-empty {
      padding: 60px 20px;
      text-align: center;
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-14);
      background: var(--bc-color-bg);
      border-radius: var(--bc-radius-xl);
      border: 1px dashed var(--bc-color-border);
    }
    .bc-paper-ctec-modal-comments-more {
      align-self: center;
      margin-top: 4px;
      padding: 10px 22px;
      font-size: var(--bc-font-13);
      font-weight: 600;
      color: var(--bc-color-accent);
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-pill);
      cursor: pointer;
      transition: background 0.12s ease, border-color 0.12s ease;
    }
    .bc-paper-ctec-modal-comments-more:hover {
      background: var(--bc-color-surface-hover);
      border-color: var(--bc-color-accent);
    }
    .bc-paper-ctec-modal-comment-card {
      background: var(--bc-color-comments-card-bg);
      border: 1px solid var(--bc-color-border-strong);
      border-left-width: 3px;
      border-radius: var(--bc-radius-xl);
      padding: 14px 18px 16px;
    }
    .bc-paper-ctec-modal-comment-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .bc-paper-ctec-modal-comment-meta-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-modal-comment-meter {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .bc-paper-ctec-modal-comment-meter-dot {
      width: 7px;
      height: 7px;
      border-radius: var(--bc-radius-circle);
      background: var(--bc-color-text-subtle);
      opacity: 0.35;
    }
    .bc-paper-ctec-modal-comment-meter-dot.is-on {
      opacity: 1;
    }
    .bc-paper-ctec-modal-comment-term {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-comment-term strong {
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-comment-length {
      font-size: var(--bc-font-10);
      color: var(--bc-color-text-subtle);
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-modal-comment-prompt {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-muted);
      font-style: italic;
      margin-bottom: 8px;
    }
    .bc-paper-ctec-modal-comment-text {
      font-size: var(--bc-font-14);
      line-height: 1.6;
      color: var(--bc-color-text);
      white-space: pre-wrap;
      position: relative;
    }
    .bc-paper-ctec-modal-comment-text.is-clamped {
      display: -webkit-box;
      -webkit-line-clamp: 6;
      -webkit-box-orient: vertical;
      max-height: calc(1.6em * 6);
      overflow: hidden;
      mask-image: linear-gradient(to bottom, black calc(100% - 1.6em), transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 1.6em), transparent 100%);
    }
    .bc-paper-ctec-modal-comment-toggle {
      border: 0;
      background: transparent;
      color: var(--bc-color-accent);
      cursor: pointer;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      padding: 6px 0 0;
      font-family: inherit;
    }
    .bc-paper-ctec-modal-comment-themes {
      display: flex;
      gap: 5px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-modal-comment-theme {
      font-size: var(--bc-font-10);
      padding: 3px 8px;
      background: var(--bc-color-surface-hover-strong);
      color: var(--bc-color-text-soft);
      border-radius: var(--bc-radius-xl);
      font-weight: var(--bc-fw-medium);
    }
    .bc-paper-ctec-modal-highlight {
      background: var(--bc-color-highlight-mark);
      padding: 1px 2px;
      border-radius: var(--bc-radius-xs);
    }
    .bc-paper-ctec-modal-rail,
    .bc-paper-ctec-modal-comments-main,
    .bc-paper-ctec-modal-overview,
    .bc-paper-ctec-modal-terms {
      scrollbar-color: var(--bc-color-border-strong) var(--bc-color-bg);
    }
    .dark .bc-paper-ctec-modal-rail::-webkit-scrollbar,
    .dark .bc-paper-ctec-modal-comments-main::-webkit-scrollbar,
    .dark .bc-paper-ctec-modal-overview::-webkit-scrollbar,
    .dark .bc-paper-ctec-modal-terms::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    .dark .bc-paper-ctec-modal-rail::-webkit-scrollbar-track,
    .dark .bc-paper-ctec-modal-comments-main::-webkit-scrollbar-track,
    .dark .bc-paper-ctec-modal-overview::-webkit-scrollbar-track,
    .dark .bc-paper-ctec-modal-terms::-webkit-scrollbar-track {
      background: var(--bc-color-bg);
    }
    .dark .bc-paper-ctec-modal-rail::-webkit-scrollbar-thumb,
    .dark .bc-paper-ctec-modal-comments-main::-webkit-scrollbar-thumb,
    .dark .bc-paper-ctec-modal-overview::-webkit-scrollbar-thumb,
    .dark .bc-paper-ctec-modal-terms::-webkit-scrollbar-thumb {
      background: var(--bc-color-border-strong);
      border-radius: var(--bc-radius-lg);
      border: 2px solid var(--bc-color-bg);
    }
    .dark .bc-paper-ctec-modal-rail::-webkit-scrollbar-thumb:hover,
    .dark .bc-paper-ctec-modal-comments-main::-webkit-scrollbar-thumb:hover,
    .dark .bc-paper-ctec-modal-overview::-webkit-scrollbar-thumb:hover,
    .dark .bc-paper-ctec-modal-terms::-webkit-scrollbar-thumb:hover {
      background: var(--bc-color-text-subtle);
    }
  `;
}
