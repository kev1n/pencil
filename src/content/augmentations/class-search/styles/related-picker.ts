// Related-component picker UI (lab/discussion required when adding lecture).
export function relatedPickerStyles(): string {
  return `
    /* ── Related-component picker (lab/discussion required) ──────────────── */
    .bc-cs-related-row {
      display: block;
      padding: 0;
      border-top: 1px solid var(--bc-color-border-divider);
    }
    .bc-cs-related {
      padding: 12px 0 14px 88px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-cs-related-header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .bc-cs-related-title {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-related-sub {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      flex: 1;
    }
    .bc-cs-related-cancel {
      appearance: none;
      height: 28px;
      padding: 0 9px;
      background: transparent;
      border: 0;
      border-radius: 7px;
      color: var(--bc-color-text-soft);
      font: inherit;
      font-size: 12.5px;
      cursor: pointer;
    }
    .bc-cs-related-cancel:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-related-list {
      display: flex;
      flex-direction: column;
    }
    .bc-cs-related-option {
      appearance: none;
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      border-radius: 7px;
      padding: 8px 10px;
      margin-left: -10px;
      font-family: inherit;
      cursor: pointer;
      display: grid;
      grid-template-columns: minmax(80px, auto) minmax(160px, 1fr) minmax(120px, auto);
      gap: 12px;
      align-items: center;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text);
      transition: border-color 0.12s, box-shadow 0.12s, transform 0.04s;
    }
    .bc-cs-related-option:hover:not(:disabled) {
      background: var(--bc-color-surface-hover);
    }
    .bc-cs-related-option:active:not(:disabled) {
      transform: translateY(1px);
    }
    .bc-cs-related-option:disabled {
      cursor: progress;
    }
    .bc-cs-related-option[data-status="Closed"] {
      color: var(--bc-color-text-muted);
    }
    .bc-cs-related-option-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bc-cs-related-option-section {
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-strong);
    }
    .bc-cs-related-option-mid {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bc-cs-related-option-right {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
    }
    .bc-cs-related-option-instr {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-related-option-progress {
      margin-left: 8px;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
  `;
}
