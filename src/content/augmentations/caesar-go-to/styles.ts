export const STYLE_ID = "bc-caesar-go-to-style";

export const styles = `
  #bc-caesar-go-to-trigger,
  #bc-caesar-go-to {
    color: var(--bc-color-text);
    font: 400 14px/1.45 var(--bc-font-body);
    box-sizing: border-box;
  }

  #bc-caesar-go-to-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: none;
    padding: 5px 8px;
    min-height: 32px;
    background: var(--bc-color-bg);
    border: 1px solid var(--bc-color-border-strong);
    border-radius: var(--bc-radius-lg);
    box-shadow: var(--bc-shadow-elev-1);
    cursor: pointer;
    font-weight: 650;
    white-space: nowrap;
  }

  #bc-caesar-go-to-trigger:hover {
    background: var(--bc-color-accent-surface-faint);
    border-color: var(--bc-color-accent-mid-border);
  }

  #bc-caesar-go-to-trigger:focus-visible,
  #bc-caesar-go-to .bc-go-close:focus-visible {
    outline: 2px solid var(--bc-color-accent);
    outline-offset: 2px;
  }

  #bc-caesar-go-to-ribbon {
    display: flex;
    justify-content: flex-end;
    padding: 6px 16px;
    background: var(--bc-color-bg);
    border-bottom: 1px solid var(--bc-color-border);
  }

  .bc-go-icon {
    display: block;
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--bc-color-accent-soft);
  }

  .bc-go-key {
    flex: none;
    padding: 1px 5px;
    background: var(--bc-color-bg-inset);
    color: var(--bc-color-text-soft);
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-sm);
    font: 500 11px/1.5 var(--bc-font-mono);
    white-space: nowrap;
  }

  #bc-caesar-go-to {
    position: fixed;
    inset: clamp(12px, 13dvh, 130px) 0 auto;
    margin: 0 auto;
    width: min(488px, calc(100% - 24px));
    max-width: none;
    max-height: calc(100dvh - clamp(12px, 13dvh, 130px) - 12px);
    padding: 0;
    overflow: hidden;
    background: var(--bc-color-bg);
    border: 1px solid var(--bc-color-border-strong);
    border-radius: var(--bc-radius-3xl);
    box-shadow: var(--bc-shadow-modal);
  }

  #bc-caesar-go-to::backdrop {
    background: var(--bc-color-overlay-modal);
  }

  #bc-caesar-go-to .bc-go-shell {
    display: flex;
    flex-direction: column;
    max-height: inherit;
  }

  #bc-caesar-go-to .bc-go-header {
    padding: 15px 16px 12px;
    border-top: 3px solid var(--bc-color-accent);
    border-bottom: 1px solid var(--bc-color-border);
  }

  #bc-caesar-go-to .bc-go-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  #bc-caesar-go-to .bc-go-title {
    margin: 0;
    color: var(--bc-color-text-strong);
    font: 700 19px/1.25 var(--bc-font-body);
    font-family: var(--bc-font-display);
  }

  #bc-caesar-go-to .bc-go-close {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--bc-color-text-soft);
    background: var(--bc-color-bg-inset);
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-sm);
    font: 500 20px/1 var(--bc-font-body);
    cursor: pointer;
  }

  #bc-caesar-go-to .bc-go-close:hover {
    background: var(--bc-color-surface-hover);
    border-color: var(--bc-color-border-strong);
  }

  #bc-caesar-go-to .bc-go-search {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 11px;
    background: var(--bc-color-bg-inset);
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-lg);
  }

  #bc-caesar-go-to .bc-go-search:focus-within {
    border-color: var(--bc-color-accent-mid-border);
    box-shadow: var(--bc-shadow-input-focus-ring);
  }

  #bc-caesar-go-to .bc-go-input {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    height: 40px;
    margin: 0;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    box-shadow: none;
    color: var(--bc-color-text-strong);
    font: 500 14px/1.4 var(--bc-font-body);
  }

  #bc-caesar-go-to .bc-go-input::placeholder {
    color: var(--bc-color-text-muted);
  }

  #bc-caesar-go-to .bc-go-list {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 6px 8px 9px;
  }

  #bc-caesar-go-to .bc-go-group-label {
    padding: 7px 8px 4px;
    color: var(--bc-color-text-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .045em;
  }

  #bc-caesar-go-to .bc-go-option {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 41px;
    padding: 3px 8px;
    border: 1px solid transparent;
    border-radius: var(--bc-radius-lg);
    cursor: pointer;
  }

  #bc-caesar-go-to .bc-go-option[aria-selected="true"] {
    background: var(--bc-color-accent-surface-soft);
    border-color: var(--bc-color-accent-mid-border);
  }

  #bc-caesar-go-to .bc-go-option-icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    background: var(--bc-color-bg-inset);
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-md);
  }

  #bc-caesar-go-to .bc-go-option-title {
    flex: 1;
    color: var(--bc-color-text-strong);
    font-weight: 620;
  }

  #bc-caesar-go-to .bc-go-arrow {
    color: var(--bc-color-text-soft);
    visibility: hidden;
  }

  #bc-caesar-go-to .bc-go-option[aria-selected="true"] .bc-go-arrow {
    visibility: visible;
  }

  #bc-caesar-go-to .bc-go-empty {
    margin: 0;
    padding: 12px 16px;
    color: var(--bc-color-text-soft);
  }

  #bc-caesar-go-to .bc-go-empty[hidden] { display: none; }

  #bc-caesar-go-to .bc-go-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 16px;
    background: var(--bc-color-bg-inset);
    border-top: 1px solid var(--bc-color-border);
    color: var(--bc-color-text-muted);
    font-size: 11px;
  }

  #bc-caesar-go-to .bc-go-footer-hints {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  @media (pointer: coarse) {
    #bc-caesar-go-to-trigger { min-height: 44px; }
    #bc-caesar-go-to-trigger .bc-go-key,
    #bc-caesar-go-to .bc-go-footer-hints { display: none; }
    #bc-caesar-go-to .bc-go-close { min-width: 44px; min-height: 32px; }
  }
`;
