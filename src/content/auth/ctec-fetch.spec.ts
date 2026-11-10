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

  it("skips the CAESAR search when retrying after the CTECs sign-in", async () => {
    vi.mocked(fetchTextResultViaBackground)
      .mockResolvedValueOnce({ status: 401, text: "", finalUrl: BLUERA_URL } as never)
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
