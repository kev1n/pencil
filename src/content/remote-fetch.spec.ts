import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Slow-request VPN hint. Requests to CAESAR / Bluera that stall past
// SLOW_NU_REQUEST_HINT_MS surface one toast per page; fast responses and
// non-NU hosts never do.

const TOAST_HOST_ID = "bc-seats-toast-host";

type Pending = { resolve: (value: unknown) => void };

async function loadModule() {
  vi.resetModules();
  return import("./remote-fetch");
}

describe("remote-fetch slow NU request hint", () => {
  let pending: Pending[];

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    pending = [];
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(
          () => new Promise((resolve) => { pending.push({ resolve }); })
        )
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function toastTexts(): string[] {
    const host = document.getElementById(TOAST_HOST_ID);
    return Array.from(host?.querySelectorAll(".bc-toast-text") ?? []).map(
      (node) => node.textContent ?? ""
    );
  }

  it("shows the VPN hint once when a CAESAR request stalls", async () => {
    const mod = await loadModule();
    void mod.fetchTextResultViaBackground("https://caesar.ent.northwestern.edu/psc/x");
    void mod.fetchTextResultViaBackground("https://my-northwestern-bc.bluera.com/rpv");

    vi.advanceTimersByTime(mod.SLOW_NU_REQUEST_HINT_MS);

    expect(toastTexts()).toEqual([mod.SLOW_NU_REQUEST_HINT_MESSAGE]);
  });

  it("stays quiet when the request settles in time", async () => {
    const mod = await loadModule();
    const request = mod.fetchTextResultViaBackground(
      "https://caesar.ent.northwestern.edu/psc/x"
    );
    pending[0]!.resolve({ ok: true, status: 200, text: "", finalUrl: "" });
    await request;

    vi.advanceTimersByTime(mod.SLOW_NU_REQUEST_HINT_MS * 2);

    expect(toastTexts()).toEqual([]);
  });

  it("ignores non-Northwestern hosts", async () => {
    const mod = await loadModule();
    void mod.fetchTextResultViaBackground("https://api.paper.nu/plan.json");

    vi.advanceTimersByTime(mod.SLOW_NU_REQUEST_HINT_MS * 2);

    expect(toastTexts()).toEqual([]);
  });
});
