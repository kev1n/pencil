// CAESAR ends a session that sits idle. While the app is open and signed in,
// one small request every ten minutes keeps it going, so live seats and the
// cart don't need a new sign-in after a break. It never opens a sign-in page:
// if the session has ended anyway, the app just shows signed out.
import { LANDING_PAGE_URL } from "@ext/content/auth/silent-recovery";
import { NUSession } from "./native";
import { getSessionState, noteResponse } from "./session-state";

const EVERY_MS = 10 * 60 * 1000;

export function startKeepAlive(): void {
  setInterval(() => {
    const session = getSessionState();
    if (session.caesar !== "in" || session.unreachable) return;
    void NUSession.request({ url: LANDING_PAGE_URL, timeoutMs: 20000 })
      .then((result) => noteResponse(LANDING_PAGE_URL, result))
      .catch(() => undefined);
  }, EVERY_MS);
}
