export const PREREQ_FILTER_FEATURE_ID = "prereq-filter";
export const PREREQ_FILTER_UNKNOWN_AS_ELIGIBLE_ID = "prereq-filter-unknown-as-eligible";

// Binary on/off filter persisted in chrome.storage.local. The popup's
// `unknown-as-eligible` sub-toggle decides whether unverifiable courses
// (freeform topics, standing, placement) stay visible when the switch is
// on — that's the second axis the user has control over.
export const PREREQ_FILTER_ENABLED_STORAGE_KEY = "better-caesar:prereq-filter-on:v1";
export const DEFAULT_PREREQ_FILTER_ENABLED = false;

export const STYLE_ID = "bc-prereq-filter-style";
export const SEARCH_SWITCH_ID = "bc-prereq-filter-switch";
export const TOOLTIP_ID = "bc-prereq-filter-tooltip";

export const SEARCH_BADGE_CLASS = "bc-prereq-search-badge";
export const GRID_BADGE_CLASS = "bc-prereq-grid-badge";

export const HIDDEN_CARD_ATTR = "data-bc-prereq-hidden";
export const STATE_ATTR = "data-bc-prereq-state";
