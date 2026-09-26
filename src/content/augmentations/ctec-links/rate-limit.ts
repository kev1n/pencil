import {
  CTEC_CREDIT_CAP,
  CTEC_CREDIT_WINDOW_MS as SHARED_CTEC_WINDOW_MS,
  ctecCreditPool
} from "../../../shared/credit-pool";
import { CAESAR_ORIGIN } from "../../../shared/nu-hosts";

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
// Leads with the VPN hint (the most common cause of consistent failures),
// then points the user at CAESAR directly so they can finish what they were
// doing without us, and includes the cookie-clear escape hatch for the most
// common stuck-state we've seen.
export const CTEC_ERROR_TOAST_MESSAGE =
  "CTEC load failed. If you're on a VPN, turn it off and try again. Otherwise open CAESAR to reverify your session, or clear your cookies for the site if it keeps loading.";

export function ctecErrorToastOptions() {
  return {
    tone: "warn" as const,
    durationMs: 15_000,
    action: {
      label: "Open CAESAR ↗",
      run: () => { window.open(CAESAR_ORIGIN, "_blank", "noopener,noreferrer"); }
    }
  };
}

export function formatCtecCreditsWarning(now: number = Date.now()): string | null {
  return ctecCreditPool.format(now);
}
