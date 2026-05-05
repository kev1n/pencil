import {
  getCurrentPeopleSoftTaskSignal,
  PeopleSoftTaskCancelledError
} from "./traffic";
import { fetchTextResultViaBackground, fetchTextViaBackground } from "../remote-fetch";

export type PeopleSoftTextResponse = {
  status: number;
  text: string;
  finalUrl: string;
};

export async function fetchPeopleSoftResult(
  actionUrl: string,
  params: URLSearchParams
): Promise<PeopleSoftTextResponse> {
  const signal = getCurrentPeopleSoftTaskSignal();

  try {
    if (shouldUseBackgroundFetch()) {
      throwIfAborted(signal);
      const response = await fetchTextResultViaBackground(actionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body: params.toString(),
        signal: signal ?? undefined
      });
      throwIfAborted(signal);
      return {
        status: response.status,
        text: response.text,
        finalUrl: response.finalUrl
      };
    }

    const res = await fetch(actionUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: params.toString(),
      signal
    });

    return {
      status: res.status,
      text: await res.text(),
      finalUrl: res.url
    };
  } catch (error) {
    if (signal?.aborted) {
      const reason = signal.reason;
      if (reason instanceof PeopleSoftTaskCancelledError) {
        throw reason;
      }

      throw new PeopleSoftTaskCancelledError(
        reason instanceof Error ? reason.message : "PeopleSoft task canceled."
      );
    }

    throw error;
  }
}

export async function fetchPeopleSoftGetResult(
  url: string
): Promise<PeopleSoftTextResponse> {
  const signal = getCurrentPeopleSoftTaskSignal();

  try {
    if (shouldUseBackgroundFetch()) {
      throwIfAborted(signal);
      const response = await fetchTextResultViaBackground(url, {
        method: "GET",
        signal: signal ?? undefined
      });
      throwIfAborted(signal);
      return {
        status: response.status,
        text: response.text,
        finalUrl: response.finalUrl
      };
    }

    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      signal
    });

    return {
      status: res.status,
      text: await res.text(),
      finalUrl: res.url
    };
  } catch (error) {
    if (signal?.aborted) {
      const reason = signal.reason;
      if (reason instanceof PeopleSoftTaskCancelledError) {
        throw reason;
      }

      throw new PeopleSoftTaskCancelledError(
        reason instanceof Error ? reason.message : "PeopleSoft task canceled."
      );
    }

    throw error;
  }
}

export async function fetchPeopleSoft(
  actionUrl: string,
  params: URLSearchParams
): Promise<string> {
  if (shouldUseBackgroundFetch()) {
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

  const response = await fetchPeopleSoftResult(actionUrl, params);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Search request failed (${response.status}).`);
  }
  return response.text;
}

export async function fetchPeopleSoftGet(url: string): Promise<string> {
  if (shouldUseBackgroundFetch()) {
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

  const response = await fetchPeopleSoftGetResult(url);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Context request failed (${response.status}).`);
  }
  return response.text;
}

function shouldUseBackgroundFetch(): boolean {
  return window.location.hostname !== "caesar.ent.northwestern.edu";
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

// Mirror the wrapping behavior of `fetchPeopleSoftResult` / `fetchPeopleSoftGetResult`
// for the bare-string variants (`fetchPeopleSoft` / `fetchPeopleSoftGet`). Pre-fix,
// background-fetch aborts surfaced as raw `AbortError`s (or whatever
// `fetchTextViaBackground` rejected with), bypassing
// `isRetryablePeopleSoftTaskError` and getting treated as normal lookup
// failures by `lookupClassInternal` and `addSectionToCartInternal`.
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
