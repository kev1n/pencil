import type {
  AbortFetchMessage,
  FetchBinaryMessage,
  FetchBinaryResponse,
  FetchTextMessage,
  FetchTextResponse
} from "../shared/messages";
import { CAESAR_HOSTNAME, CAESAR_SERVICE_URL, safeHostname } from "../shared/nu-hosts";
import { CaesarConnectionError, CaesarWrongPageError } from "./peoplesoft/connection";

type FetchTextOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  allowNonOkStatus?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

// CAESAR keeps only the last few page states per PeopleSoft "window", and
// every request in a window uses one up. Background requests therefore run
// in their own window (`csnu_<n>`), otherwise a handful of lookups expires
// the page the user is looking at ("This page is no longer available") and
// every page the Back button could return to. Responses name their form and
// helpers after the window (`win37`), so they are renamed back to `win0`
// for the parsers.
const BACKGROUND_WINDOW = "37";
const MAIN_WINDOW_PATH = /^\/ps([cp])\/csnu\//;
const BACKGROUND_WINDOW_TOKEN = new RegExp(`win${BACKGROUND_WINDOW}(?!\\d)`, "g");

export function toBackgroundWindowUrl(url: string): string {
  if (safeHostname(url) !== CAESAR_HOSTNAME) return url;
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(
    MAIN_WINDOW_PATH,
    `/ps$1/csnu_${BACKGROUND_WINDOW}/`
  );
  return parsed.toString();
}

// A PeopleSoft form post names its window twice: in the URL (`csnu_<n>`) and
// in the body (`ICElementNum`). When they disagree CAESAR answers with its
// home page, which parsers read as an empty result. The body is made to
// follow the URL here, at the one place every request passes through, so no
// caller can get it wrong.
const WINDOW_IN_PATH = /^\/ps[cp]\/csnu(?:_(\d+))?\//;

export function alignBodyWindow(url: string, body: string | undefined): string | undefined {
  if (!body || safeHostname(url) !== CAESAR_HOSTNAME) return body;
  const match = new URL(url).pathname.match(WINDOW_IN_PATH);
  if (!match) return body;
  const params = new URLSearchParams(body);
  if (!params.has("ICSID") && !params.has("ICElementNum")) return body;
  params.set("ICElementNum", match[1] ?? "0");
  return params.toString();
}

const HOME_PAGE_RESPONSE = /<PAGE id='(?:PT_LANDINGPAGE|SCC_START_PAGE_FL)'/;
const HOME_COMPONENTS = /\/c\/(?:NUI_FRAMEWORK\.PT_LANDINGPAGE|NW_PROFILE_START\.SCC_PROFILE_FL)\.GBL/;

function isUnexpectedHomePage(url: string, method: string | undefined, text: string): boolean {
  return method === "POST" && !HOME_COMPONENTS.test(url) && HOME_PAGE_RESPONSE.test(text);
}

let requestSequence = 0;
function nextRequestId(): string {
  requestSequence += 1;
  return `bc-${Date.now().toString(36)}-${requestSequence.toString(36)}`;
}

export async function fetchTextResultViaBackground(
  url: string,
  options?: FetchTextOptions
): Promise<Extract<FetchTextResponse, { ok: true }>> {
  url = toBackgroundWindowUrl(url);
  const requestId = nextRequestId();
  const signal = options?.signal;

  const onAbort = () => {
    const message: AbortFetchMessage = { type: "abort-fetch", requestId };
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "fetch-text",
      url,
      method: options?.method,
      headers: options?.headers,
      body: alignBodyWindow(url, options?.body),
      requestId,
      timeoutMs: options?.timeoutMs
    } satisfies FetchTextMessage) as FetchTextResponse;

    if (safeHostname(url) === CAESAR_HOSTNAME && response) {
      // Off-network CAESAR requests redirect to the university's service page.
      // The browser may also reject the cross-origin redirect before exposing it.
      if (response.ok
        ? response.finalUrl?.split(/[?#]/, 1)[0] === CAESAR_SERVICE_URL
        : response.connectionFailed) {
        throw new CaesarConnectionError();
      }
    }
    if (!response?.ok) {
      throw new Error(response?.error || "Background fetch failed.");
    }

    if (safeHostname(url) !== CAESAR_HOSTNAME) return response;
    if (isUnexpectedHomePage(url, options?.method, response.text)) {
      throw new CaesarWrongPageError();
    }
    return { ...response, text: response.text.replace(BACKGROUND_WINDOW_TOKEN, "win0") };
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

export async function fetchTextViaBackground(
  url: string,
  options?: FetchTextOptions
): Promise<string> {
  const response = await fetchTextResultViaBackground(url, options);
  if (!options?.allowNonOkStatus && (response.status < 200 || response.status >= 300)) {
    throw new Error(`Request failed (${response.status}).`);
  }
  return response.text;
}

export async function fetchBinaryViaBackground(
  url: string,
  signal?: AbortSignal,
  options?: { timeoutMs?: number }
): Promise<{ buffer: ArrayBuffer; contentType: string; finalUrl: string }> {
  const requestId = nextRequestId();
  const onAbort = () => {
    const message: AbortFetchMessage = { type: "abort-fetch", requestId };
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "fetch-binary",
      url,
      requestId,
      timeoutMs: options?.timeoutMs
    } satisfies FetchBinaryMessage)) as FetchBinaryResponse;
    if (!response?.ok) {
      throw new Error(response?.error || "Background binary fetch failed.");
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Binary fetch ${response.status}`);
    }
    const binary = atob(response.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { buffer: bytes.buffer, contentType: response.contentType, finalUrl: response.finalUrl };
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
