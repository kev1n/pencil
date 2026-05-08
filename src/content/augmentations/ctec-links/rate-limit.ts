import {
  CTEC_CREDIT_CAP,
  CTEC_CREDIT_WINDOW_MS as SHARED_CTEC_WINDOW_MS,
  ctecCreditPool
} from "../../../shared/credit-pool";

// Re-exported for backward-compat with callers that referenced these
// constants directly.
export const CTEC_CREDIT_LIMIT = CTEC_CREDIT_CAP;
export const CTEC_CREDIT_WINDOW_MS = SHARED_CTEC_WINDOW_MS;
export const CTEC_BATCH_SIZE = 3;

// CTEC discovery + Bluera report fetches sometimes need longer than the
// default 30s background-fetch timeout — CAESAR can stall when its session
// has gone stale and Bluera's report endpoints occasionally take 20–40s
// under load. Bumping these specific call sites to 60s keeps the shopping
// cart and enrollment-side widgets from spuriously failing.
export const CTEC_FETCH_TIMEOUT_MS = 60_000;

// Backward-compat wrappers around the shared credit pool. Existing callers
// (ctec-links/augmentation) keep their old import paths — paper-ctec
// consumes the shared module directly.
export function tryConsumeCtecCredit(
  now: number,
  owner?: string
): { ok: true } | { ok: false; waitMs: number } {
  const result = ctecCreditPool.tryConsume(owner, now);
  if (result.allowed) return { ok: true };
  return { ok: false, waitMs: result.waitMs };
}

export function buildCtecCreditToastMessage(waitMs: number): string {
  return ctecCreditPool.formatLimitReached(waitMs);
}

// Shown when a CTEC fetch fails (timeout, transport error, server error).
// Points the user at CAESAR directly so they can finish what they were doing
// without us, and includes the cookie-clear escape hatch for the most common
// stuck-state we've seen.
export const CTEC_ERROR_TOAST_MESSAGE =
  "CTEC load failed. Try opening https://caesar.ent.northwestern.edu/ yourself. If it's stuck on infinite loading, clear your cookies for the site.";

export function formatCtecCreditsWarning(now: number = Date.now()): string | null {
  return ctecCreditPool.format(now);
}
