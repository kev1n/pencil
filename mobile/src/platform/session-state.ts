// What the app knows about its Northwestern session, learned from the
// responses that come back. No extension modules are imported here, so the
// request layer can depend on it.
import { useSyncExternalStore } from "react";
import { NUSession, type NativeResponse } from "./native";

export type SessionState = {
  // "in": the last CAESAR request was answered by CAESAR.
  // "out": no session, or CAESAR sent us to the sign-in page.
  caesar: "unknown" | "in" | "out";
  // CAESAR could not be reached at all: off campus without the VPN.
  unreachable: boolean;
};

let state: SessionState = { caesar: "unknown", unreachable: false };
// How many CAESAR requests were sent to the sign-in page. Loaders that
// swallow that redirect are caught by comparing this before and after.
let signInRedirects = 0;
export function signInRedirectCount(): number {
  return signInRedirects;
}
const listeners = new Set<() => void>();

function set(next: Partial<SessionState>): void {
  const merged = { ...state, ...next };
  if (merged.caesar === state.caesar && merged.unreachable === state.unreachable) return;
  state = merged;
  for (const listener of [...listeners]) listener();
}

const CAESAR_HOST = "caesar.ent.northwestern.edu";
const SIGN_IN_HOSTS = /(^|\.)login\.(microsoftonline\.com|windows\.net)$/;
const SERVICE_PAGE = "services.northwestern.edu";

function host(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname;
  } catch {
    return "";
  }
}

export function noteResponse(url: string, result: NativeResponse): void {
  if (host(url) !== CAESAR_HOST) return;
  if (!result.ok) {
    if (result.connectionFailed) set({ unreachable: true });
    return;
  }
  const ended = host(result.finalUrl);
  if (ended === SERVICE_PAGE) set({ unreachable: true });
  else if (SIGN_IN_HOSTS.test(ended)) {
    signInRedirects += 1;
    set({ caesar: "out", unreachable: false });
  }
  else if (ended === CAESAR_HOST) set({ caesar: "in", unreachable: false });
}

export function markSignedIn(): void {
  set({ caesar: "in", unreachable: false });
}

export function markSignedOut(): void {
  set({ caesar: "out" });
}

export async function loadSessionState(): Promise<void> {
  try {
    const { hasCaesarSession } = await NUSession.status();
    if (state.caesar === "unknown") set({ caesar: hasCaesarSession ? "in" : "out" });
  } catch {
    set({ caesar: "out" });
  }
}

export function getSessionState(): SessionState {
  return state;
}

export function useSessionState(): SessionState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );
}
