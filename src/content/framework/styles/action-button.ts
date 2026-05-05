// Default state-aware styling for buttons created via `createActionButton`.
// Tokens flow from the design system — never embed raw color literals here.
//
// Plugins that want their own visual treatment can layer their own classes
// on top via `className`; these `[data-state="…"]` rules just provide a
// sensible default for opacity, cursor, and tonal feedback so even an
// unstyled action-button never looks inert.

export const ACTION_BUTTON_STYLE_ID = "bc-action-button";

export const ACTION_BUTTON_STYLES = `
  button[data-bc-action-button] {
    transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
  }
  button[data-bc-action-button][data-state="loading"] {
    opacity: 0.7;
    cursor: progress;
    pointer-events: none;
  }
  button[data-bc-action-button][data-state="success"] {
    background: var(--bc-color-success-bg);
    color: var(--bc-color-success-text);
    border-color: var(--bc-color-success-border);
  }
  button[data-bc-action-button][data-state="error"] {
    background: var(--bc-color-danger-bg);
    color: var(--bc-color-danger-text);
    border-color: var(--bc-color-danger-border);
    cursor: pointer;
  }
  button[data-bc-action-button][data-state="error"]:hover {
    background: var(--bc-color-danger-bg-soft);
  }
  button[data-bc-action-button][data-state="disabled"],
  button[data-bc-action-button]:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  button[data-bc-action-button][data-state="disabled"]:hover,
  button[data-bc-action-button]:disabled:hover {
    background: inherit;
    color: inherit;
  }
`;
