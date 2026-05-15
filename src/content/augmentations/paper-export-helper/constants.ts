export const FEATURE_ID = "paper-export-helper";

export const STYLE_ID = "bc-paper-export-helper-style";
export const MODAL_ID = "bc-paper-export-helper-modal";

// Marker stamped on paper.nu's native "Export schedule to calendar"
// button once we've bound our interceptor — keeps run() idempotent
// across the AugmentationRunner's mutation-driven re-ticks.
export const BUTTON_BOUND_ATTR = "data-bc-export-helper-bound";

// Stamped on the top-level EXPORT button to opt it into the purple
// highlight styling. Pure cosmetic — no click handler, no behavior
// change. Lets the CSS find the button without us re-querying it on
// every theme/state read.
export const HIGHLIGHT_ATTR = "data-bc-export-highlight";
