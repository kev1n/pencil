// Shared SSO walk for CAESAR. Three layers, in order:
//
//   1. silentFetchHandshake() — background GET to LANDING_PAGE_URL. PS
//      redirects to NetID SSO; if the IdP cookie is alive, the chain mints
//      a fresh PS_TOKEN and redirects back, all via 3xx. Invisible.
//   2. silentTabHandshake() — opens an inactive tab to LANDING_PAGE_URL so
//      the *browser* (with a JS engine) can complete any SSO step that uses
//      a SAML POST-binding auto-submit form (which fetch can't follow).
//      Background closes the tab the moment it lands on /psc/. Times out
//      after `timeoutMs` if real interactive login is required.
//   3. (caller-provided) — popup tab + user-visible modal/toast for the
//      "credentials actually expired" case.
//
// `withSilentAuthRecovery(action, isAuthError)` runs Layers 1 + 2 around an
// arbitrary `action` and re-runs `action` after each successful layer. If
// both silent layers fail, the original auth error escapes — caller decides
// whether to surface a popup/modal or give up. This is the deduplication
// point: ctec-links fetches and class-search add-to-cart / load-CAESAR all
// share the same silent walk through this helper.

import type {
  OpenSilentAuthTabMessage,
  OpenSilentAuthTabResponse
} from "../../shared/messages";
import { fetchPeopleSoftGet } from "../peoplesoft/http";

// Hitting this URL silently re-handshakes through NetID SSO when the CAESAR
// session cookie has expired but the IdP cookie is still alive — the
// redirect chain mints a fresh PS_TOKEN without any user interaction. Also
// reused as the popup `loginUrl` when the silent re-handshake fails:
// opening it in a real tab walks the user through Duo, then bounces them
// back through the `psc/` post-auth pattern that `background.ts` watches.
export const LANDING_PAGE_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL?";

export const DEFAULT_SILENT_TAB_TIMEOUT_MS = 10_000;

// Layer 1. Hits the landing URL. Failure (network error, 4xx) is swallowed
// — the caller's retry of the original action is what determines success.
export async function silentFetchHandshake(): Promise<void> {
  await fetchPeopleSoftGet(LANDING_PAGE_URL).catch(() => undefined);
}

// Layer 2. Opens an inactive background tab and resolves with `true` once
// the tab settles on a `/psc/` URL within `timeoutMs`. Resolves `false` on
// timeout or any failure to open the tab. The background worker closes the
// tab in either case.
export async function silentTabHandshake(
  timeoutMs: number = DEFAULT_SILENT_TAB_TIMEOUT_MS
): Promise<boolean> {
  const message: OpenSilentAuthTabMessage = {
    type: "open-silent-auth-tab",
    loginUrl: LANDING_PAGE_URL,
    timeoutMs
  };
  try {
    const response = (await chrome.runtime.sendMessage(message)) as
      | OpenSilentAuthTabResponse
      | undefined;
    return response?.ok === true && response.recovered;
  } catch {
    return false;
  }
}

export type WithSilentAuthRecoveryOptions = {
  silentTabTimeoutMs?: number;
};

// Runs `action`, retrying through the silent layers if it throws an auth
// error. Re-throws whatever escapes after both silent layers fail, so the
// caller can react (open a popup modal, show a toast, etc.).
//
// `isAuthError` is the only contract: a function that detects whether a
// thrown value represents "CAESAR session expired." Each augmentation
// already has its own error class for this — class-search uses
// `CaesarAuthRequiredError`; ctec-links throws the same error so this
// helper works for both.
export async function withSilentAuthRecovery<T>(
  action: () => Promise<T>,
  isAuthError: (err: unknown) => boolean,
  opts: WithSilentAuthRecoveryOptions = {}
): Promise<T> {
  try {
    return await action();
  } catch (err1) {
    if (!isAuthError(err1)) throw err1;

    await silentFetchHandshake();
    try {
      return await action();
    } catch (err2) {
      if (!isAuthError(err2)) throw err2;

      const recovered = await silentTabHandshake(opts.silentTabTimeoutMs);
      if (!recovered) throw err2;

      return await action();
    }
  }
}
