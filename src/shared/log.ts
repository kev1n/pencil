// Quiet, opt-in logging for swallowed errors. Production builds stay
// silent unless the user sets `localStorage.setItem("bc-debug", "1")` —
// at which point logQuiet/logDebug start surfacing on the console with a
// scope tag (e.g. `[bc:cart-cache.persist]`).

const DEBUG_KEY = "bc-debug";

let debugEnabled: boolean | null = null;

function isDebug(): boolean {
  if (debugEnabled !== null) return debugEnabled;
  try {
    debugEnabled =
      typeof localStorage !== "undefined" && localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    debugEnabled = false;
  }
  return debugEnabled;
}

export function logQuiet(scope: string, err: unknown): void {
  if (!isDebug()) return;
  console.warn(`[bc:${scope}]`, err);
}

export function logDebug(scope: string, ...args: unknown[]): void {
  if (!isDebug()) return;
  console.debug(`[bc:${scope}]`, ...args);
}

// Test-only: reset the cached debug flag so each test starts fresh.
export function _resetDebugCache(): void {
  debugEnabled = null;
}
