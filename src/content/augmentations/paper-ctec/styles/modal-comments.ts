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
      border-right: 1px solid #e6e6ea;
      padding: 20px 18px 28px;
      background: white;
      overflow-y: auto;
      min-height: 0;
    }
    .bc-paper-ctec-modal-comments-main {
      overflow-y: auto;
      min-height: 0;
    }
    .bc-paper-ctec-modal-rail-header {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #6b7280;
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
      border-radius: 6px;
      border: 0;
      background: transparent;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      color: #1f2937;
    }
    .bc-paper-ctec-modal-rail-btn.is-active {
      background: #f6ecf2;
      color: #66023c;
    }
    .bc-paper-ctec-modal-rail-btn:hover:not(.is-active) {
      background: #f7f7f8;
    }
    .bc-paper-ctec-modal-rail-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      grid-column: auto;
    }
    .bc-paper-ctec-modal-rail-label {
      font-size: 12px;
      font-weight: 500;
    }
    .bc-paper-ctec-modal-rail-btn.is-active .bc-paper-ctec-modal-rail-label {
      font-weight: 600;
    }
    .bc-paper-ctec-modal-rail-count {
      font-size: 10px;
      font-family: ui-monospace, monospace;
      color: #9ca3af;
    }
    .bc-paper-ctec-modal-rail-empty {
      padding: 6px 10px 4px;
      font-size: 11px;
      line-height: 1.4;
      color: #9ca3af;
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
      border-radius: 999px;
      overflow: hidden;
      background: #f1ebef;
    }
    .bc-paper-ctec-modal-rail-tone-seg {
      height: 100%;
      flex-grow: 0;
      flex-shrink: 0;
      flex-basis: 0;
    }
    .bc-paper-ctec-modal-comment-theme.is-active {
      background: #fef08a;
      color: #713f12;
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
      border: 1px solid #e6e6ea;
      border-radius: 10px;
      padding: 8px 12px;
      background: white;
      flex: 1;
      min-width: 240px;
    }
    .bc-paper-ctec-modal-comments-search-icon {
      color: #9ca3af;
    }
    .bc-paper-ctec-modal-comments-input {
      border: 0;
      outline: 0;
      font-size: 14px;
      flex: 1;
      background: transparent;
      color: #1f2937;
      font-family: inherit;
    }
    .bc-paper-ctec-modal-comments-sort {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #6b7280;
    }
    .bc-paper-ctec-modal-comments-sort-select {
      font-family: inherit;
      font-size: 12px;
      padding: 5px 8px;
      border: 1px solid #e6e6ea;
      border-radius: 6px;
      background: white;
    }
    .bc-paper-ctec-modal-filter-chips {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 14px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .bc-paper-ctec-modal-filter-chips:empty {
      display: none;
    }
    .bc-paper-ctec-modal-filter-label {
      color: #6b7280;
    }
    .bc-paper-ctec-modal-filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 4px 3px 10px;
      background: #f6ecf2;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      color: #66023c;
    }
    .bc-paper-ctec-modal-filter-chip-x {
      border: 0;
      background: transparent;
      color: #66023c;
      cursor: pointer;
      padding: 0 6px;
      font-size: 12px;
      line-height: 1;
    }
    .bc-paper-ctec-modal-filter-clear {
      border: 0;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
      text-decoration: underline;
      font-size: 12px;
    }
    .bc-paper-ctec-modal-comments-count {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 12px;
    }
    .bc-paper-ctec-modal-comments-count strong {
      color: #1f2937;
    }
    .bc-paper-ctec-modal-comments-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bc-paper-ctec-modal-comments-empty {
      padding: 60px 20px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      background: white;
      border-radius: 10px;
      border: 1px dashed #e6e6ea;
    }
    .bc-paper-ctec-modal-comment-card {
      background: white;
      border: 1px solid #e6e6ea;
      border-left-width: 3px;
      border-radius: 10px;
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
    .bc-paper-ctec-modal-comment-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .bc-paper-ctec-modal-comment-tag-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .bc-paper-ctec-modal-comment-term {
      font-size: 12px;
      color: #6b7280;
    }
    .bc-paper-ctec-modal-comment-term strong {
      color: #1f2937;
    }
    .bc-paper-ctec-modal-comment-length {
      font-size: 10px;
      color: #9ca3af;
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-modal-comment-prompt {
      font-size: 11px;
      color: #6b7280;
      font-style: italic;
      margin-bottom: 8px;
    }
    .bc-paper-ctec-modal-comment-text {
      font-size: 14px;
      line-height: 1.6;
      color: #1f2937;
      white-space: pre-wrap;
      position: relative;
    }
    .bc-paper-ctec-modal-comment-text.is-clamped {
      max-height: 9em;
      overflow: hidden;
      mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
    }
    .bc-paper-ctec-modal-comment-toggle {
      border: 0;
      background: transparent;
      color: #66023c;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
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
      font-size: 10px;
      padding: 3px 8px;
      background: #f7f7f8;
      color: #6b7280;
      border-radius: 10px;
      font-weight: 500;
    }
    .bc-paper-ctec-modal-highlight {
      background: rgba(254, 240, 138, 0.7);
      padding: 1px 2px;
      border-radius: 2px;
    }
    .dark .bc-paper-ctec-modal-rail {
      border-right-color: rgba(252, 165, 207, 0.14);
      background: rgba(17, 24, 39, 0.3);
    }
    .dark .bc-paper-ctec-modal-rail-header {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-rail-btn {
      color: #f5e7ee;
    }
    .dark .bc-paper-ctec-modal-rail-btn.is-active {
      background: rgba(252, 165, 207, 0.16);
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-rail-btn:hover:not(.is-active) {
      background: rgba(252, 165, 207, 0.08);
    }
    .dark .bc-paper-ctec-modal-rail-count {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-rail-empty {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-rail-tone {
      background: rgba(252, 165, 207, 0.12);
    }
    .dark .bc-paper-ctec-modal-comment-theme.is-active {
      background: rgba(254, 240, 138, 0.85);
      color: #500030;
    }
    .dark .bc-paper-ctec-modal-comments-search {
      border-color: rgba(252, 165, 207, 0.18);
      background: rgba(17, 24, 39, 0.4);
    }
    .dark .bc-paper-ctec-modal-comments-search-icon {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-comments-input {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-comments-input::placeholder {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-comments-sort {
      color: #cbd5e1;
    }
    .dark .bc-paper-ctec-modal-comments-sort-select {
      border-color: rgba(252, 165, 207, 0.18);
      background: rgba(17, 24, 39, 0.4);
      color: #f5e7ee;
    }
    .dark .bc-paper-ctec-modal-filter-label {
      color: #cbd5e1;
    }
    .dark .bc-paper-ctec-modal-filter-chip {
      background: rgba(252, 165, 207, 0.18);
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-filter-chip-x {
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-filter-clear {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-comments-count {
      color: #cbd5e1;
    }
    .dark .bc-paper-ctec-modal-comments-count strong {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-comments-empty {
      background: rgba(17, 24, 39, 0.3);
      border-color: rgba(252, 165, 207, 0.18);
      color: #cbd5e1;
    }
    .dark .bc-paper-ctec-modal-comment-card {
      background: rgba(17, 24, 39, 0.4);
      border-color: rgba(252, 165, 207, 0.14);
    }
    .dark .bc-paper-ctec-modal-comment-term {
      color: #cbd5e1;
    }
    .dark .bc-paper-ctec-modal-comment-term strong {
      color: #fff6fb;
    }
    .dark .bc-paper-ctec-modal-comment-length {
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-comment-prompt {
      color: #cbd5e1;
    }
    .dark .bc-paper-ctec-modal-comment-text {
      color: #f5e7ee;
    }
    .dark .bc-paper-ctec-modal-comment-toggle {
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-modal-comment-theme {
      background: rgba(252, 165, 207, 0.1);
      color: #d4b9c5;
    }
    .dark .bc-paper-ctec-modal-highlight {
      background: rgba(254, 240, 138, 0.35);
      color: #fef9c3;
    }
  `;
}
