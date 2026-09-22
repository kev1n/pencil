// Constants + types shared between the content-script's access state
// machine (`./access.ts`) and the popup's read-only access-status row
// (`src/popup/sections/ctec-access-status.ts`). Pulled into its own
// module so the popup can import them without dragging in `access.ts`'s
// chrome.storage hydration, legacy-key cleanup, and onChanged listener
// — all of which are content-script-only side effects.

// Kill switch for the whole CTEC-access check (upfront probe, passive
// DOM detector, sticky denied/confirmed verdict, popup pill). Flip to
// false for local debugging only: access is then treated as confirmed
// and nothing is probed or persisted. Must ship as true.
export const CTEC_ACCESS_CHECK_ENABLED = true;

export const CTEC_ACCESS_STORAGE_KEY = "better-caesar:ctec-no-access:v2";

// Auto-expire any access verdict after this long, applied symmetrically
// to "confirmed" and "denied". Northwestern can flip access either way
// at any time (revoke for skipped prior-period CTECs, restore once those
// are completed), so neither verdict deserves to be sticky indefinitely.
// After the TTL the next Load CTEC click re-probes; the popup's "Clear
// CTEC cache" button is still the immediate-reset escape hatch.
export const ACCESS_VERDICT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CtecAccessStatus = "denied" | "confirmed" | "unknown";
