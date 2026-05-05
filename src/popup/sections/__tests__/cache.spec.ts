import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `cache.ts` transitively pulls in access-gate/server-client.ts, which
// references the build-time-substituted `__BC_BUCKET_SCHEDULE_URL__`. The
// test runner has no esbuild define step, so seed it by hand before any
// import touches the module.
(globalThis as unknown as { __BC_BUCKET_SCHEDULE_URL__: string }).__BC_BUCKET_SCHEDULE_URL__ =
  "https://example.test/bucket-schedule.json";

// `cache.ts` transitively imports access-gate / paper-ctec / cart-cache
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

  it("awaits the cleanup promise before showing success feedback", async () => {
    const btn = makeButton("clear-async", "Clear A");
    let resolveCleanup: () => void = () => undefined;
    const cleanup = vi.fn(
      () => new Promise<void>((resolve) => { resolveCleanup = resolve; })
    );
    makeClearCacheButton({ containerId: "clear-async", buttonText: "Clear A", cleanup });
    btn.click();
    // Give a microtask for the click handler to run; cleanup is pending.
    await Promise.resolve();
    expect(btn.textContent).toBe("Clear A");
    expect(btn.disabled).toBe(false);
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
