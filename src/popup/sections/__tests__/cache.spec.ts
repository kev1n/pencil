import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `cache.ts` transitively imports paper-ctec / cart-cache / prereqs
// modules that fire `chrome.storage.local.get` at module load. Stub
// `chrome` before the dynamic import so jsdom doesn't crash.
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve()
    },
    onChanged: { addListener: () => undefined }
  },
  runtime: { sendMessage: () => undefined, getURL: (path: string) => path }
};

const { makeClearCacheButton } = await import("../cache");

function makeButton(id: string, initial: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = id;
  btn.textContent = initial;
  document.body.appendChild(btn);
  return btn;
}

describe("makeClearCacheButton()", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const noopCleanup = async (): Promise<void> => Promise.resolve();

  it("does nothing when the button id is missing", () => {
    const cleanup = vi.fn(noopCleanup);
    expect(() =>
      makeClearCacheButton({
        containerId: "missing-id",
        buttonText: "Go",
        cleanup
      })
    ).not.toThrow();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("calls cleanup once on click", async () => {
    const btn = makeButton("clear-x", "Clear cache");
    const cleanup = vi.fn(noopCleanup);
    makeClearCacheButton({ containerId: "clear-x", buttonText: "Clear cache", cleanup });
    btn.click();
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1));
  });

  it("flips to default success label and disables the button after cleanup resolves", async () => {
    const btn = makeButton("clear-y", "Clear Y");
    const cleanup = vi.fn(noopCleanup);
    makeClearCacheButton({ containerId: "clear-y", buttonText: "Clear Y", cleanup });
    btn.click();
    await vi.waitFor(() => {
      expect(btn.textContent).toBe("Cleared!");
      expect(btn.disabled).toBe(true);
    });
  });

  it("respects a custom successText", async () => {
    const btn = makeButton("clear-z", "Clear Z");
    const cleanup = vi.fn(noopCleanup);
    makeClearCacheButton({
      containerId: "clear-z",
      buttonText: "Clear Z",
      successText: "Done!",
      cleanup
    });
    btn.click();
    await vi.waitFor(() => expect(btn.textContent).toBe("Done!"));
  });

  it("restores the original label and re-enables after the timeout", async () => {
    const btn = makeButton("clear-q", "Clear Q");
    const cleanup = vi.fn(noopCleanup);
    makeClearCacheButton({ containerId: "clear-q", buttonText: "Clear Q", cleanup });
    btn.click();
    await vi.waitFor(() => expect(btn.textContent).toBe("Cleared!"));
    vi.advanceTimersByTime(2000);
    expect(btn.textContent).toBe("Clear Q");
    expect(btn.disabled).toBe(false);
  });

  it("locks the button to a loading label synchronously before cleanup resolves", async () => {
    const btn = makeButton("clear-async", "Clear A");
    let resolveCleanup: () => void = () => undefined;
    const cleanup = vi.fn(
      () => new Promise<void>((resolve) => { resolveCleanup = resolve; })
    );
    makeClearCacheButton({ containerId: "clear-async", buttonText: "Clear A", cleanup });
    btn.click();
    // Synchronous lock fires before any await — the action-button contract
    // requires immediate visual feedback ("Clearing…") + disabled=true so a
    // double-click can't fire a second cleanup.
    expect(btn.textContent).toBe("Clearing…");
    expect(btn.disabled).toBe(true);
    resolveCleanup();
    await vi.waitFor(() => {
      expect(btn.textContent).toBe("Cleared!");
      expect(btn.disabled).toBe(true);
    });
  });

  it("ignores a non-button element with the same id", () => {
    const div = document.createElement("div");
    div.id = "not-a-button";
    document.body.appendChild(div);
    const cleanup = vi.fn(noopCleanup);
    makeClearCacheButton({
      containerId: "not-a-button",
      buttonText: "Clear",
      cleanup
    });
    div.dispatchEvent(new Event("click"));
    expect(cleanup).not.toHaveBeenCalled();
  });
});
