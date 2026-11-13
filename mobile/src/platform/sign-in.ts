// Sign-in flows. Northwestern has two front doors: Microsoft sign-in for
// CAESAR, and Online Passport for CTEC reports. Both run on Northwestern's
// own pages inside a native web view.
import { isBlueraHost } from "@ext/shared/nu-hosts";
import { CaesarConnectionError } from "@ext/content/peoplesoft/connection";
import { NUSession } from "./native";
import { getSessionState, markSignedIn, markSignedOut } from "./session-state";

const CAESAR_HOME = "https://caesar.ent.northwestern.edu/";
const CAESAR_LOADED = "^https://caesar\\.ent\\.northwestern\\.edu/ps[cp]/";
const CTEC_REPORT_LOADED = "^https://[^/]*bluera\\.com/.*rpvf-eng\\.aspx";

export async function signInToCaesar(): Promise<boolean> {
  const result = await NUSession.signIn({
    url: CAESAR_HOME,
    title: "Northwestern sign-in",
    doneUrlPattern: CAESAR_LOADED,
    resetPeopleSoft: true
  });
  if (result.completed) markSignedIn();
  return result.completed;
}

async function signInAt(loginUrl: string): Promise<boolean> {
  if (!isBlueraHost(loginUrl)) return signInToCaesar();
  const result = await NUSession.signIn({
    url: loginUrl,
    title: "Sign in for CTECs",
    doneUrlPattern: CTEC_REPORT_LOADED
  });
  return result.completed;
}

export async function signOut(): Promise<void> {
  await NUSession.signOut();
  markSignedOut();
}

export class SignInCancelledError extends Error {
  constructor() {
    super("Sign-in was cancelled.");
    this.name = "SignInCancelledError";
  }
}

function loginUrlOf(error: unknown): string | null {
  const url = (error as { loginUrl?: unknown } | null)?.loginUrl;
  return typeof url === "string" ? url : null;
}

// Runs something that talks to Northwestern. When it stops because a
// sign-in is needed, shows that sign-in page and tries again, up to twice
// (CAESAR first, then CTECs).
export async function withSignIn<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const loginUrl = loginUrlOf(error);
      if (!loginUrl || attempt >= 2) throw error;
      if (!(await signInAt(loginUrl))) throw new SignInCancelledError();
    }
  }
}

export function describeError(error: unknown): string {
  if (error instanceof CaesarConnectionError || getSessionState().unreachable) {
    return "Can’t reach CAESAR. Connect to campus Wi-Fi or the Northwestern VPN and try again.";
  }
  if (error instanceof SignInCancelledError) return "Sign in to Northwestern to load this.";
  return error instanceof Error ? error.message : String(error);
}
