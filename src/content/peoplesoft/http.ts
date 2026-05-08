import {
  getCurrentPeopleSoftTaskSignal,
  PeopleSoftTaskCancelledError
} from "./traffic";
import { fetchTextResultViaBackground, fetchTextViaBackground } from "../remote-fetch";

// All requests route through the service worker so background.ts's
// circuit breaker covers same-origin and cross-origin uniformly.

export type PeopleSoftTextResponse = {
  status: number;
  text: string;
  finalUrl: string;
};

export async function fetchPeopleSoftResult(
  actionUrl: string,
  params: URLSearchParams,
  options?: { timeoutMs?: number }
): Promise<PeopleSoftTextResponse> {
  const signal = getCurrentPeopleSoftTaskSignal();

  try {
    throwIfAborted(signal);
    const response = await fetchTextResultViaBackground(actionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: params.toString(),
      signal: signal ?? undefined,
      timeoutMs: options?.timeoutMs
    });
    throwIfAborted(signal);
    return {
      status: response.status,
      text: response.text,
      finalUrl: response.finalUrl
    };
  } catch (error) {
    rethrowAsCancellation(signal, error);
  }
}

export async function fetchPeopleSoftGetResult(
  url: string,
  options?: { timeoutMs?: number }
): Promise<PeopleSoftTextResponse> {
  const signal = getCurrentPeopleSoftTaskSignal();

  try {
    throwIfAborted(signal);
    const response = await fetchTextResultViaBackground(url, {
      method: "GET",
      signal: signal ?? undefined,
      timeoutMs: options?.timeoutMs
    });
    throwIfAborted(signal);
    return {
      status: response.status,
      text: response.text,
      finalUrl: response.finalUrl
    };
  } catch (error) {
    rethrowAsCancellation(signal, error);
  }
}

export async function fetchPeopleSoft(
  actionUrl: string,
  params: URLSearchParams
): Promise<string> {
  const signal = getCurrentPeopleSoftTaskSignal();
  try {
    throwIfAborted(signal);
    const text = await fetchTextViaBackground(actionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: params.toString(),
      allowNonOkStatus: true,
      signal: signal ?? undefined
    });
    throwIfAborted(signal);
    return text;
  } catch (error) {
    rethrowAsCancellation(signal, error);
  }
}

export async function fetchPeopleSoftGet(url: string): Promise<string> {
  const signal = getCurrentPeopleSoftTaskSignal();
  try {
    throwIfAborted(signal);
    const text = await fetchTextViaBackground(url, {
      method: "GET",
      allowNonOkStatus: true,
      signal: signal ?? undefined
    });
    throwIfAborted(signal);
    return text;
  } catch (error) {
    rethrowAsCancellation(signal, error);
  }
}

function throwIfAborted(signal: AbortSignal | null): void {
  if (!signal?.aborted) return;

  const reason = signal.reason;
  if (reason instanceof PeopleSoftTaskCancelledError) {
    throw reason;
  }

  throw new PeopleSoftTaskCancelledError(
    reason instanceof Error ? reason.message : "PeopleSoft task canceled."
  );
}

// Convert any post-fetch failure into a PeopleSoftTaskCancelledError when
// the active signal was aborted; otherwise re-throw the original. Keeps
// `lookupClassInternal` / `addSectionToCartInternal` from misclassifying a
// cancellation as a normal lookup failure.
function rethrowAsCancellation(signal: AbortSignal | null, error: unknown): never {
  if (signal?.aborted) {
    const reason = signal.reason;
    if (reason instanceof PeopleSoftTaskCancelledError) throw reason;
    throw new PeopleSoftTaskCancelledError(
      reason instanceof Error ? reason.message : "PeopleSoft task canceled."
    );
  }
  throw error;
}
