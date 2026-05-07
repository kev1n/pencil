// CAESAR renders the class label as <a id="P_CLASS_NAME$N"> for selectable
// rows (lectures), but discussion / lab sub-rows are non-selectable and use
// <span id="P_CLASS_NAME$span$N" class="PSHYPERLINKDISABLED"> instead. Match
// both so we inject CTEC/Seats/Notes cells on every row, not just lectures.
export const CLASS_LINK_SELECTOR =
  "a[id^='P_CLASS_NAME$'], a[id^='E_CLASS_NAME$'], span[id^='P_CLASS_NAME$span$'], span[id^='E_CLASS_NAME$span$']";
export const GRID_TABLE_SELECTORS = [
  "#SSR_REGFORM_VW\\$scroll\\$0 table.PSLEVEL1GRID",
  "#STDNT_ENRL_SSVW\\$scroll\\$0 table.PSLEVEL1GRID"
];

export const SEATS_HEADER_CLASS = "better-caesar-seats-header";
export const NOTES_HEADER_CLASS = "better-caesar-notes-header";
export const SEATS_CELL_CLASS = "better-caesar-seats-cell";
export const NOTES_CELL_CLASS = "better-caesar-notes-cell";
export const STYLE_ID = "better-caesar-style";
