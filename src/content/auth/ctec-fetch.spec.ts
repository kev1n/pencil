import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CtecSubjectIndex } from "../ctec-index/types";

const BLUERA_URL = "https://northwestern.bluera.com/northwestern/rpvf-eng.aspx?r=1";

const store = new Map<string, CtecSubjectIndex>();

vi.mock("../ctec-index/storage", () => ({
  readSubjectIndex: (subject: string) => store.get(subject) ?? null,
  writeSubjectIndex: (subject: string, index: CtecSubjectIndex) => {
    store.set(subject, index);
  }
}));
vi.mock("../ctec-index/access", () => ({
  getCtecAccessStatus: () => "confirmed",
  isCtecAccessDenied: () => false
}));
vi.mock("../augmentations/ctec-links/section-lens", () => ({
  getSectionLens: () => "course",
  isSectionLensConfirmed: () => true
}));
vi.mock("../augmentations/ctec-links/fetcher", () => ({
  fetchCtecLinksBackground: vi.fn(async () => {
    store.set("COMP_SCI", {
      entries: [
        {
          actionId: "a1",
          term: "2025 Fall",
          description: "COMP_SCI 211-0-1 Fundamentals of Computer Programming II",
          instructor: "Jane Doe",
          blueraUrl: BLUERA_URL,
          error: null,
          searchText: "comp_sci 211"
        }
      ]
    } as unknown as CtecSubjectIndex);
    return { state: "found", entries: [], hasMore: false };
  })
}));
vi.mock("../augmentations/ctec-links/fetcher-instructor", () => ({
  fetchCtecLinksByInstructor: vi.fn()
}));
vi.mock("../remote-fetch", () => ({
  fetchTextResultViaBackground: vi.fn()
}));
vi.mock("./login-prompt", () => ({
  confirmLoginPrompt: vi.fn(async () => true)
}));

import { fetchCtecLinksBackground } from "../augmentations/ctec-links/fetcher";
import { fetchTextResultViaBackground } from "../remote-fetch";
import { fetchAggregateWithAuth } from "./ctec-fetch";

describe("fetchAggregateWithAuth", () => {
  beforeEach(() => {
    store.clear();
    vi.mocked(fetchCtecLinksBackground).mockClear();
  });

  it.each([
    ["a 401", { status: 401, text: "", finalUrl: BLUERA_URL }],
    [
      "the SSO hand-off page",
      {
        status: 200,
        text: "<form><input name=\"SAMLResponse\"></form>",
        finalUrl: "https://fed.it.northwestern.edu/idp/profile/SAML2/Redirect/SSO"
      }
    ],
    // remote-fetch rethrows the background's TypeError message as a plain Error.
    ["a blocked redirect to Duo", new Error("Failed to fetch")]
  ])("skips the CAESAR search when retrying after %s", async (_label, signedOut) => {
    vi.mocked(fetchTextResultViaBackground)
      .mockReset()
      .mockImplementationOnce(async () => {
        if (signedOut instanceof Error) throw signedOut;
        return signedOut as never;
      })
      .mockResolvedValueOnce({ status: 200, text: "<html></html>", finalUrl: BLUERA_URL } as never);
    const ensure = vi.fn(async () => undefined);

    const result = await fetchAggregateWithAuth(
      { ensure, dispose: () => undefined },
      { subject: "COMP_SCI", catalogNumber: "211", instructor: "Jane Doe" },
      "Fundamentals of Computer Programming II",
      () => undefined,
      { fetchLimit: 4, aggregateLimit: 4 }
    );

    expect(ensure).toHaveBeenCalledWith(BLUERA_URL);
    expect(fetchTextResultViaBackground).toHaveBeenCalledTimes(2);
    expect(fetchCtecLinksBackground).toHaveBeenCalledTimes(1);
    expect(result?.state).toBe("found");
  });
});
