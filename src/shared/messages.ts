export type LookupClassMessage = {
  type: "lookup-class";
  classNumber: string;
  // Single career to try first when the caller knows the school. Kept as
  // an open string because the resolver normalizes/widens it (see
  // `peoplesoft/shared.ts:normalizeCareer`).
  careerHint?: string;
  // Course identifier hints. When both are set, the lookup widens its
  // career candidates beyond UGRD+TGS using nu-careers (Law, SPS,
  // Kellogg-grad, etc.) so the search hits the right catalog on the first
  // round-trip. When either is missing, the lookup falls back to the
  // legacy UGRD-then-TGS order with the `careerHint` first.
  subjectHint?: string;
  catalogHint?: string;
  // CAESAR term (STRM) for the lookup. When set, overrides the term that
  // would otherwise be inferred from window.location.href / the entry-form
  // default. Required when the caller is not on a CAESAR page that already
  // carries STRM in its URL (e.g. the Sharper Search class-search UI, where
  // the user picks a term independently of CAESAR's default).
  termId?: string;
};

export type FetchTextMessage = {
  type: "fetch-text";
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  requestId?: string;
  // Per-request override for the background fetch timeout. Background
  // defaults to 30s when omitted; CTEC loading flows pass 60s because
  // CAESAR/Bluera occasionally take longer to respond under load.
  timeoutMs?: number;
};

export type FetchBinaryMessage = {
  type: "fetch-binary";
  url: string;
  requestId?: string;
  timeoutMs?: number;
};

export type FetchBinarySuccess = {
  ok: true;
  status: number;
  // Base64-encoded body. chrome.runtime.sendMessage serializes via JSON
  // in some Chrome versions, which mangles ArrayBuffer bytes — base64
  // sidesteps that.
  base64: string;
  contentType: string;
  finalUrl: string;
};

export type FetchBinaryFailure = {
  ok: false;
  error: string;
  status?: number;
};

export type FetchBinaryResponse = FetchBinarySuccess | FetchBinaryFailure;

export type AbortFetchMessage = {
  type: "abort-fetch";
  requestId: string;
};

export type FetchTextSuccess = {
  ok: true;
  status: number;
  text: string;
  finalUrl: string;
};

export type FetchTextFailure = {
  ok: false;
  error: string;
  status?: number;
};

export type FetchTextResponse = FetchTextSuccess | FetchTextFailure;

export type LookupClassSuccess = {
  ok: true;
  requestedClassNumber: string;
  criteriaClassNumber: string | null;
  firstResultClassNumber: string | null;
  nextActionForDetails: string | null;
  detailPageId: string | null;
  detailResponseText: string | null;
};

export type LookupClassFailure = {
  ok: false;
  error: string;
};

export type LookupClassResponse = LookupClassSuccess | LookupClassFailure;

export type OpenAuthPopupMessage = {
  type: "open-auth-popup";
  loginUrl: string;
};

export type OpenAuthPopupResponse =
  | { ok: true; tabId: number }
  | { ok: false; error: string };

export type AuthPopupClosedMessage = {
  type: "auth-popup-closed";
  reason: "succeeded" | "user-closed";
};

// Layer 2 of the silent SSO walk. Opens an INACTIVE background tab to
// `loginUrl` (typically the CAESAR landing page) so the browser's JS engine
// can complete any SAML POST-binding auto-submit step that `fetch()` can't
// follow. Background watches for the tab to settle on a `/psc/` URL and
// closes it as soon as it does. If the tab doesn't reach `/psc/` within
// `timeoutMs`, background closes it and reports `recovered: false` so the
// caller can fall back to a user-visible popup.
export type OpenSilentAuthTabMessage = {
  type: "open-silent-auth-tab";
  loginUrl: string;
  timeoutMs: number;
};

export type OpenSilentAuthTabResponse =
  | { ok: true; recovered: boolean }
  | { ok: false; error: string };

// Fire-and-forget telemetry from content scripts: a credit was just burned
// from one of the rate-limit pools. Logged in the background worker so the
// service-worker devtools show a persistent, cross-tab record of usage.
export type CreditUsedMessage = {
  type: "credit-used";
  pool: "ps" | "ctec";
  remaining: number;
  cap: number;
  owner?: string;
};
