import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetDebugCache, logDebug, logQuiet } from "./log";

// Reusable no-op for spyOn().mockImplementation — keeps the empty-function
// lint happy without scattering eslint-disable comments.
function noop(): void {
  return;
}

describe("logQuiet / logDebug", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetDebugCache();
    localStorage.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(noop);
    debugSpy = vi.spyOn(console, "debug").mockImplementation(noop);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    debugSpy.mockRestore();
    _resetDebugCache();
    localStorage.clear();
  });

  it("is silent when bc-debug flag is unset", () => {
    logQuiet("cart-cache.persist", new Error("boom"));
    logDebug("cart-cache.persist", "details");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("is silent when bc-debug flag is something other than '1'", () => {
    localStorage.setItem("bc-debug", "true");
    logQuiet("scope.x", new Error("boom"));
    logDebug("scope.x", "data");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("logs via console.warn with bc:<scope> prefix when flag is '1'", () => {
    localStorage.setItem("bc-debug", "1");
    const err = new Error("nope");
    logQuiet("cart-cache.persist", err);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[bc:cart-cache.persist]", err);
  });

  it("logs via console.debug with bc:<scope> prefix when flag is '1'", () => {
    localStorage.setItem("bc-debug", "1");
    logDebug("paper-data.prune", "removed", 3, "items");
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy).toHaveBeenCalledWith(
      "[bc:paper-data.prune]",
      "removed",
      3,
      "items"
    );
  });

  it("does not double-log if called twice with the same flag state", () => {
    localStorage.setItem("bc-debug", "1");
    logQuiet("a", "x");
    logQuiet("b", "y");
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
