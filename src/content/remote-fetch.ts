import type {
  AbortFetchMessage,
  FetchTextMessage,
  FetchTextResponse
} from "../shared/messages";

type FetchTextOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  allowNonOkStatus?: boolean;
  signal?: AbortSignal;
};

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

  try {
    const response = await chrome.runtime.sendMessage({
      type: "fetch-text",
      url,
      method: options?.method,
      headers: options?.headers,
      body: options?.body,
      requestId
    } satisfies FetchTextMessage) as FetchTextResponse;

    if (!response?.ok) {
      throw new Error(response?.error || "Background fetch failed.");
    }

    return response;
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
