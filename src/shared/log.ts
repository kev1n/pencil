// Quiet, opt-in logging for swallowed errors. Production builds stay
// silent unless the user sets `localStorage.setItem("bc-debug", "1")` —
// at which point logQuiet/logDebug start surfacing on the console with a
// scope tag (e.g. `[bc:cart-cache.persist]`).

const DEBUG_KEY = "bc-debug";

// Re-read localStorage on every call so users can toggle bc-debug mid-session
// without reloading the page. Cost is negligible — logQuiet/logDebug are
// called at human-action rates, not in hot loops.
function isDebug(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function logQuiet(scope: string, err: unknown): void {
  if (!isDebug()) return;
  console.warn(`[bc:${scope}]`, err);
}

export function logDebug(scope: string, ...args: unknown[]): void {
  if (!isDebug()) return;
  console.debug(`[bc:${scope}]`, ...args);
}

// Spec back-compat. No longer needed since isDebug re-reads localStorage,
// but specs call this between cases to be explicit about scope reset.
export function _resetDebugCache(): void {
  // intentional no-op
}
