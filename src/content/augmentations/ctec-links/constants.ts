export const PAGE_ID = "SSR_SSENRL_CART";
export const STYLE_ID = "better-caesar-ctec-links-style";
export const REQUEST_OWNER = "ctec-links";
export const CTEC_AUTH_URL =
  "https://caesar.ent.northwestern.edu/";

export const CLASS_ROW_SELECTOR = "tr[bufnum]";
export const CLASS_LINK_SELECTOR = "a[id^='P_CLASS_NAME$'], a[id^='E_CLASS_NAME$']";
export const INSTRUCTOR_SELECTOR = "[id^='DERIVED_REGFRM1_SSR_INSTR_LONG$']";
export const CTEC_CELL_CLASS = "better-caesar-ctec-links-cell";
export const CTEC_HEADER_CLASS = "better-caesar-ctec-links-header";

// Synthetic actionId stamped on sentinel index entries that record
// "we already searched and found nothing for this course". Lets the
// matchers tell sentinels apart from real CTEC rows.
export const NOT_FOUND_ACTION_ID = "BC_NOT_FOUND";
