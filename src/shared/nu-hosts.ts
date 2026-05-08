// Northwestern host names referenced by both content scripts and the
// background worker. Centralized here so the circuit breaker, silent
// recovery, login-prompt copy, and URL builders agree on one set of
// strings — and so renaming a host (or adding a third) is a single edit.

export const CAESAR_HOSTNAME = "caesar.ent.northwestern.edu";
export const CAESAR_ORIGIN = `https://${CAESAR_HOSTNAME}`;
export const BLUERA_HOSTNAME = "northwestern.bluera.com";
export const BLUERA_ORIGIN = `https://${BLUERA_HOSTNAME}`;

// Returns the lowercased hostname of `url`, or "" when the input is
// missing or unparseable. Many call sites guard `new URL()` against
// throwing on stray inputs (e.g. error.loginUrl when the error wasn't
// constructed with a URL); this collapses that boilerplate.
export function safeHostname(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
