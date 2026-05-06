// CAESAR auth recovery — drives the SSO popup flow when CAESAR's PS session
// is dead and the silent re-handshake in `getEntryFormState()` couldn't
// recover it. Coalesces concurrent failures (e.g. Load CAESAR + Add to
// cart both racing through `getEntryFormState()`) onto a single popup
// handshake so we never open two sign-in tabs.
//
// Extracted from augmentation.ts (Wave 5b). chrome.runtime + window.location
// are injected for testability. Critically, `dispose()` removes any
// in-flight onMessage listener — the original module-level implementation
// never explicitly cleaned up the listener after the handshake settled,
// which leaked across mount/unmount cycles in long-lived tabs.

import { showToast } from "../../../shared/toast";
import type {
  AuthPopupClosedMessage,
  OpenAuthPopupMessage,
  OpenAuthPopupResponse
} from "../../../shared/messages";
import { withSilentAuthRecovery } from "../../auth/silent-recovery";

export type AuthRecoveryDeps = {
  chromeRuntime: typeof chrome.runtime;
  windowLocation: Pick<Location, "assign">;
};

export interface AuthRecovery {
  /**
   * Begin (or join an existing) auth-recovery handshake. Resolves once the
   * popup tab reports a successful sign-in. Rejects if the popup couldn't
   * open or the user closed it without signing in.
   */
  ensure(loginUrl: string): Promise<void>;

  /**
   * Tear down — removes any in-flight onMessage listener and resets the
   * mutex so a future mount cycle starts clean.
   */
  dispose(): void;
}

export function createAuthRecovery(deps: AuthRecoveryDeps): AuthRecovery {
  let pending: Promise<void> | null = null;
  let activeListener: ((message: unknown) => void) | null = null;

  async function handshake(loginUrl: string): Promise<void> {
    showToast("CAESAR session expired — opening sign-in…", {
      tone: "info",
      durationMs: 3500
    });

    const reasonPromise = new Promise<AuthPopupClosedMessage["reason"]>((resolve) => {
      const listener = (message: unknown): void => {
        if (
          message &&
          typeof message === "object" &&
          (message as { type?: string }).type === "auth-popup-closed"
        ) {
          deps.chromeRuntime.onMessage.removeListener(
            listener as (...args: unknown[]) => void
          );
          if (activeListener === listener) activeListener = null;
          resolve((message as AuthPopupClosedMessage).reason);
        }
      };
      activeListener = listener;
      deps.chromeRuntime.onMessage.addListener(
        listener as (...args: unknown[]) => void
      );
    });

    const request: OpenAuthPopupMessage = {
      type: "open-auth-popup",
      loginUrl
    };
    const response = (await deps.chromeRuntime.sendMessage(request)) as
      | OpenAuthPopupResponse
      | undefined;
    if (!response?.ok) {
      throw new Error("Couldn't open the CAESAR sign-in tab.");
    }

    const reason = await reasonPromise;
    if (reason !== "succeeded") {
      throw new Error("CAESAR sign-in was canceled.");
    }
  }

  function removeActiveListener(): void {
    if (activeListener) {
      deps.chromeRuntime.onMessage.removeListener(
        activeListener as (...args: unknown[]) => void
      );
      activeListener = null;
    }
  }

  return {
    ensure(loginUrl: string): Promise<void> {
      if (pending) return pending;
      const job = handshake(loginUrl).finally(() => {
        if (pending === job) pending = null;
        // Safety net: every successful handshake removes its listener
        // inside the listener body, but a thrown sendMessage / rejected
        // path leaves the listener attached. Drop it here.
        removeActiveListener();
      });
      pending = job;
      return job;
    },
    dispose(): void {
      removeActiveListener();
      pending = null;
    }
  };
}

/**
 * Wrap a CAESAR action with the full auth-recovery cascade:
 *
 *   1. Run `action`.
 *   2. On auth failure, attempt the silent layers (background fetch, then
 *      inactive tab) via `withSilentAuthRecovery`. Each successful layer
 *      retries `action` automatically.
 *   3. If both silent layers fail, fall back to the user-visible popup
 *      handshake and retry `action` once after the user signs in.
 *
 * Re-throws the original error when it's not an auth-required error.
 * Returns `null` when the user cancels sign-in or the popup couldn't open.
 *
 * `isAuthError` extracts the login URL so the popup tab lands on the right
 * SSO endpoint (matches the original behavior where
 * `CaesarAuthRequiredError.loginUrl` flowed straight through).
 */
export async function withAuthRecovery<T>(
  recovery: AuthRecovery,
  isAuthError: (err: unknown) => err is { loginUrl: string },
  action: () => Promise<T>
): Promise<T | null> {
  try {
    return await withSilentAuthRecovery(action, isAuthError);
  } catch (error) {
    if (!isAuthError(error)) throw error;
    try {
      await recovery.ensure(error.loginUrl);
    } catch (recoveryError) {
      const msg =
        recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
      showToast(msg, { tone: "error", durationMs: 5000 });
      return null;
    }
    return await action();
  }
}
