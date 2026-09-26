import type {
  AbortFetchMessage,
  FetchBinaryMessage,
  FetchBinaryResponse,
  FetchTextMessage,
  FetchTextResponse
} from "../shared/messages";
import { CAESAR_HOSTNAME, isBlueraHost, safeHostname } from "../shared/nu-hosts";
import { showToast } from "../shared/toast";

type FetchTextOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  allowNonOkStatus?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

// Northwestern's CAESAR / Bluera endpoints tend to stall (not fail) when
// the user is on a VPN, so CTEC widgets sit on their loading state until
// the 30–60s background timeout fires. A single request to those hosts
// that's still pending after this long is a strong hint something on the
// network path is wrong — nudge the user once per page instead of leaving
// them staring at a spinner.
export const SLOW_NU_REQUEST_HINT_MS = 15_000;
export const SLOW_NU_REQUEST_HINT_MESSAGE =
  "Northwestern's servers are taking a while to respond. If you're on a VPN, try turning it off and reloading.";
let slowHintShown = false;

function watchForSlowNuRequest(url: string): () => void {
  if (slowHintShown) return () => undefined;
  if (safeHostname(url) !== CAESAR_HOSTNAME && !isBlueraHost(url)) return () => undefined;
  const timer = setTimeout(() => {
    if (slowHintShown) return;
    slowHintShown = true;
    showToast(SLOW_NU_REQUEST_HINT_MESSAGE, { tone: "warn", durationMs: 12_000 });
  }, SLOW_NU_REQUEST_HINT_MS);
  return () => clearTimeout(timer);
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
  const stopSlowWatch = watchForSlowNuRequest(url);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "fetch-text",
      url,
      method: options?.method,
      headers: options?.headers,
      body: options?.body,
      requestId,
      timeoutMs: options?.timeoutMs
    } satisfies FetchTextMessage) as FetchTextResponse;

    if (!response?.ok) {
      throw new Error(response?.error || "Background fetch failed.");
    }

    return response;
  } finally {
    stopSlowWatch();
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
  const stopSlowWatch = watchForSlowNuRequest(url);
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
    stopSlowWatch();
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
