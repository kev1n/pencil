export const PREREQ_FILTER_FEATURE_ID = "prereq-filter";
export const PREREQ_FILTER_UNKNOWN_AS_ELIGIBLE_ID = "prereq-filter-unknown-as-eligible";
// Internal augmentation id — distinct from PREREQ_FILTER_FEATURE_ID so the
// runner doesn't tear the inline switch row down when the user flips the
// feature off. The experimental UI strip (left "Prereqs (Beta)" switch +
// info tooltip) is always mounted on paper.nu's search panel; only the
// filter switch + per-card badges depend on PREREQ_FILTER_FEATURE_ID.
export const PREREQ_FILTER_MOUNT_ID = "prereq-filter-mount";

// Binary on/off filter persisted in chrome.storage.local. The popup's
// `unknown-as-eligible` sub-toggle decides whether unverifiable courses
// (freeform topics, standing, placement) stay visible when the switch is
// on — that's the second axis the user has control over.
export const PREREQ_FILTER_ENABLED_STORAGE_KEY = "better-caesar:prereq-filter-on:v1";
export const DEFAULT_PREREQ_FILTER_ENABLED = false;

export const STYLE_ID = "bc-prereq-filter-style";
// The in-page row that mounts above the search results list. Holds the
// feature on/off switch + the "Meets prereqs" filter button side by side.
export const SEARCH_ROW_ID = "bc-prereq-filter-row";
export const SEARCH_SWITCH_ID = "bc-prereq-filter-switch";
export const SEARCH_FILTER_BTN_ID = "bc-prereq-filter-btn";
export const TOOLTIP_ID = "bc-prereq-filter-tooltip";

// Single class used by both surfaces (search panel + schedule grid).
// Visual + glyph + label are identical — the only thing that differs
// between the two mounts is *where* in the DOM the badge attaches.
export const PREREQ_BADGE_CLASS = "bc-prereq-badge";

export const HIDDEN_CARD_ATTR = "data-bc-prereq-hidden";
export const STATE_ATTR = "data-bc-prereq-state";
// Marks a search-result card whose `position` style we set to "relative"
// so the absolutely-positioned badge can pin to the top-right corner.
// Cleanup uses this marker to undo only the cards we touched.
export const POSITIONED_CARD_ATTR = "data-bc-prereq-positioned";
