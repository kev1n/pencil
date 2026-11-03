export const STYLE_ID = "bc-caesar-bookmarks-style";

export const styles = `
  #bc-caesar-bookmarks {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    vertical-align: middle;
    color: var(--bc-color-text);
    font: 600 12px/1.25 var(--bc-font-body);
    white-space: nowrap;
  }

  #bc-caesar-bookmarks[data-banner="true"] {
    color: var(--bc-color-on-saturated);
  }

  #bc-caesar-bookmarks > a,
  #bc-caesar-bookmarks > button {
    display: inline-flex;
    align-items: center;
    flex: none;
    box-sizing: border-box;
    min-height: 30px;
    margin: 0;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--bc-radius-md);
    background: transparent;
    color: inherit;
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  #bc-caesar-bookmarks > :is(a, button):hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
    color: inherit;
    text-decoration: none;
  }

  #bc-caesar-bookmarks > :is(a, button):focus-visible {
    outline: 2px solid currentColor;
    outline-offset: -2px;
  }

  #bc-caesar-bookmarks[data-banner="false"] {
    margin-inline-start: auto;
  }

  [data-bc-bookmark-title] {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  [data-bc-bookmark-slot] {
    display: flex;
    align-items: center;
    min-width: 0;
    max-width: min(36vw, 28rem);
  }
`;
