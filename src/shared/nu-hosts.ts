// Northwestern host names referenced by both content scripts and the
// background worker. Centralized here so the circuit breaker, silent
// recovery, login-prompt copy, and URL builders agree on one set of
// strings — and so renaming a host (or adding a third) is a single edit.

export const CAESAR_HOSTNAME = "caesar.ent.northwestern.edu";
export const CAESAR_ORIGIN = `https://${CAESAR_HOSTNAME}`;
export const BLUERA_HOSTNAME = "northwestern.bluera.com";
export const BLUERA_ORIGIN = `https://${BLUERA_HOSTNAME}`;

// Bluera moved CTEC hosting off `northwestern.bluera.com`. The legacy host
// now 301s to `my-northwestern-bc.bluera.com` (dropping the `/northwestern/`
// path prefix), which bounces through `my-northwestern-auth.bluera.com` for
// OAuth before landing back and, eventually, at NU's SAML IdP.
//
// We deliberately keep building report URLs on the legacy origin: index
// entries are deduped by `blueraUrl`, so switching the canonical origin
// would fork every user's cached index. Instead every host *check* — the
// circuit breaker, the Bluera-auth-error probe, the login-prompt copy —
// accepts the whole family, and the manifest grants all of them so the
// background fetch can follow the redirect chain.
export const BLUERA_HOSTNAMES: readonly string[] = [
  BLUERA_HOSTNAME,
  "my-northwestern.bluera.com",
  "my-northwestern-bc.bluera.com",
  "my-northwestern-auth.bluera.com"
];

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

// True when `url` points at any host Bluera serves CTECs (or their login
// hop) from — legacy or current.
export function isBlueraHost(url: string | null | undefined): boolean {
  return BLUERA_HOSTNAMES.includes(safeHostname(url));
}
