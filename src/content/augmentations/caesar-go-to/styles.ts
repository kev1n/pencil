export const STYLE_ID = "bc-caesar-bookmarks-style";

export const styles = `
  #bc-caesar-bookmarks {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    margin-inline-start: auto;
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

  #bc-caesar-bookmarks .bc-caesar-bookmarks-brand {
    display: inline-flex;
    align-items: center;
    flex: none;
    gap: 4px;
    margin-inline-end: 4px;
    padding-inline-end: 8px;
    border-inline-end: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  }

  #bc-caesar-bookmarks .bc-caesar-bookmarks-icon svg {
    display: block;
    width: 18px;
    height: 18px;
  }

  @media (max-width: 900px) {
    #bc-caesar-bookmarks[data-banner="true"] .bc-caesar-bookmarks-credit {
      display: none;
    }
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

  #bc-caesar-header {
    position: sticky;
    inset-block-start: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    box-sizing: border-box;
    max-width: 100vw;
    min-height: 42px;
    padding: 4px 12px;
    background: var(--bc-color-bg);
    border-bottom: 1px solid var(--bc-color-border);
    box-shadow: var(--bc-shadow-elev-1);
  }

  .bc-caesar-home-logo {
    flex: none;
    color: inherit;
    font: 700 20px/1.25 var(--bc-font-body);
    letter-spacing: 0.02em;
    text-decoration: none;
    white-space: nowrap;
  }

  #bc-caesar-header .bc-caesar-home-logo {
    color: var(--bc-color-accent);
  }

  .bc-caesar-home-logo:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 3px;
  }

  [data-bc-caesar-logo-slot] {
    display: flex;
    align-items: center;
    gap: 12px;
    width: auto;
    /* The native Back chevron is absolutely positioned at the left. */
    padding-inline-start: 40px;
  }

  [data-bc-caesar-logo-slot] .bc-caesar-home-logo {
    color: var(--bc-color-on-saturated);
  }

  [data-bc-bookmark-slot] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    max-width: min(40vw, 34rem);
  }

  #bc-caesar-enrollment-dates {
    position: fixed;
    inset: 55px 12px auto auto;
    box-sizing: border-box;
    width: min(360px, calc(100vw - 24px));
    max-height: calc(100dvh - 67px);
    margin: 0;
    padding: 16px;
    overflow: auto;
    background: var(--bc-color-bg);
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-xl);
    box-shadow: var(--bc-shadow-modal);
    color: var(--bc-color-text);
    font: 400 13px/1.45 var(--bc-font-body);
  }

  #bc-caesar-enrollment-dates h2 {
    margin: 0 0 8px;
    font: 700 16px/1.25 var(--bc-font-body);
  }

  #bc-caesar-enrollment-dates .bc-dates-term {
    margin: 0;
    font-weight: 650;
  }

  #bc-caesar-enrollment-dates ul {
    margin: 8px 0;
    padding-inline-start: 18px;
  }

  #bc-caesar-enrollment-dates li + li {
    margin-top: 6px;
  }

  #bc-caesar-enrollment-dates .bc-dates-note {
    margin: 8px 0 0;
    color: var(--bc-color-text-muted);
  }

  #bc-caesar-enrollment-dates > a {
    display: block;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--bc-color-border);
    color: var(--bc-color-accent);
    font-weight: 650;
  }

  form#SSR_SSENRL_CART :is([id="SSR_REGFORM_VW$scroll$0"], [id="STDNT_ENRL_SSVW$scroll$0"]) table.PSLEVEL1GRID,
  form#SSR_SSENRL_APPT [id="SSR_SESSDT_VW$scroll$0"] table.PSLEVEL1GRID {
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-lg);
    background: var(--bc-color-bg);
    box-shadow: var(--bc-shadow-elev-1);
  }

  form#SSR_SSENRL_CART :is([id="SSR_REGFORM_VW$scroll$0"], [id="STDNT_ENRL_SSVW$scroll$0"]) table.PSLEVEL1GRID th,
  form#SSR_SSENRL_APPT [id="SSR_SESSDT_VW$scroll$0"] table.PSLEVEL1GRID th {
    padding: 7px 9px;
    background: var(--bc-color-bg-inset);
    color: var(--bc-color-text);
  }

  form#SSR_SSENRL_CART :is([id="SSR_REGFORM_VW$scroll$0"], [id="STDNT_ENRL_SSVW$scroll$0"]) table.PSLEVEL1GRID tr[bufnum] > td {
    padding: 7px 9px;
    border-color: var(--bc-color-border);
  }

  form#SSR_SSENRL_APPT [id$="divNW_DERIVED_SS3_HTMLAREA"] {
    padding: 14px 18px;
    background: var(--bc-color-bg);
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-lg);
    color: var(--bc-color-text);
  }
`;
