import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Wrap-the-abort regression coverage. Pre-fix, `fetchPeopleSoft` and
// `fetchPeopleSoftGet` (the bare-text variants) did NOT mirror the
// abort-wrapping behavior of `fetchPeopleSoftResult` / `fetchPeopleSoftGetResult`,
// so a background-fetch abort surfaced as a raw `AbortError` (or whatever
// `fetchTextViaBackground` rejected with) instead of `PeopleSoftTaskCancelledError`.
// `lookupClassInternal` / `addSectionToCartInternal` then misclassified it as
// a normal lookup failure rather than a retryable cancellation.

vi.mock("../remote-fetch", () => ({
  fetchTextResultViaBackground: vi.fn(),
  fetchTextViaBackground: vi.fn()
}));

vi.mock("./traffic", async () => {
  const actual =
    await vi.importActual<typeof import("./traffic")>("./traffic");
  return {
    ...actual,
    getCurrentPeopleSoftTaskSignal: vi.fn()
  };
});

import { fetchPeopleSoft, fetchPeopleSoftGet } from "./http";
import { fetchTextViaBackground } from "../remote-fetch";
import {
  getCurrentPeopleSoftTaskSignal,
  PeopleSoftTaskCancelledError
} from "./traffic";

const fetchTextSpy = vi.mocked(fetchTextViaBackground);
const signalSpy = vi.mocked(getCurrentPeopleSoftTaskSignal);

beforeEach(() => {
  // Force the background-fetch path: `shouldUseBackgroundFetch()` returns
  // true whenever the hostname is not caesar.ent.northwestern.edu, which is
  // always true in jsdom.
  fetchTextSpy.mockReset();
  signalSpy.mockReset();
});

afterEach(() => {
  fetchTextSpy.mockReset();
  signalSpy.mockReset();
});

describe("fetchPeopleSoft (background path) — abort wrapping", () => {
  it("wraps an aborted background fetch as PeopleSoftTaskCancelledError when reason is the cancellation error", async () => {
    const controller = new AbortController();
    signalSpy.mockReturnValue(controller.signal);
    const cancelReason = new PeopleSoftTaskCancelledError("user aborted");
    controller.abort(cancelReason);

    // Simulate the background fetch rejecting with a generic AbortError
    // (the shape the chrome runtime would surface).
    fetchTextSpy.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    await expect(
      fetchPeopleSoft("https://example.org", new URLSearchParams())
    ).rejects.toBeInstanceOf(PeopleSoftTaskCancelledError);
  });

  it("wraps a generic abort reason into a fresh PeopleSoftTaskCancelledError", async () => {
    const controller = new AbortController();
    signalSpy.mockReturnValue(controller.signal);
    controller.abort(new Error("some other reason"));

    fetchTextSpy.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    const err = await fetchPeopleSoft(
      "https://example.org",
      new URLSearchParams()
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PeopleSoftTaskCancelledError);
  });

  it("does NOT wrap unrelated rejections (no abort) — passes the original error through", async () => {
    signalSpy.mockReturnValue(null);
    const original = new Error("background-fetch crashed for an unrelated reason");
    fetchTextSpy.mockRejectedValue(original);

    await expect(
      fetchPeopleSoft("https://example.org", new URLSearchParams())
    ).rejects.toBe(original);
  });
});

describe("fetchPeopleSoftGet (background path) — abort wrapping", () => {
  it("wraps an aborted background GET as PeopleSoftTaskCancelledError", async () => {
    const controller = new AbortController();
    signalSpy.mockReturnValue(controller.signal);
    controller.abort(new PeopleSoftTaskCancelledError("nav took priority"));

    fetchTextSpy.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    await expect(fetchPeopleSoftGet("https://example.org")).rejects.toBeInstanceOf(
      PeopleSoftTaskCancelledError
    );
  });
});
