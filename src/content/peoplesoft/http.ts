import {
  getCurrentPeopleSoftTaskSignal,
  PeopleSoftTaskCancelledError
} from "./traffic";
import { fetchTextResultViaBackground, fetchTextViaBackground } from "../remote-fetch";

type RequestOptions = {
  owner?: string;
};

export type PeopleSoftTextResponse = {
  status: number;
  text: string;
  finalUrl: string;
};

export async function fetchPeopleSoftResult(
  actionUrl: string,
  params: URLSearchParams,
  options?: RequestOptions
): Promise<PeopleSoftTextResponse> {
  const signal = getCurrentPeopleSoftTaskSignal();

  try {
    void options;
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
  url: string,
  options?: RequestOptions
): Promise<PeopleSoftTextResponse> {
  const signal = getCurrentPeopleSoftTaskSignal();

  try {
    void options;
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
  params: URLSearchParams,
  options?: RequestOptions
): Promise<string> {
  if (shouldUseBackgroundFetch()) {
    const signal = getCurrentPeopleSoftTaskSignal();
    return fetchTextViaBackground(actionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: params.toString(),
      allowNonOkStatus: true,
      signal: signal ?? undefined
    });
  }

  const response = await fetchPeopleSoftResult(actionUrl, params, options);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Search request failed (${response.status}).`);
  }
  return response.text;
}

export async function fetchPeopleSoftGet(url: string, options?: RequestOptions): Promise<string> {
  if (shouldUseBackgroundFetch()) {
    const signal = getCurrentPeopleSoftTaskSignal();
    return fetchTextViaBackground(url, {
      method: "GET",
      allowNonOkStatus: true,
      signal: signal ?? undefined
    });
  }

  const response = await fetchPeopleSoftGetResult(url, options);
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
