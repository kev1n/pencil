import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __CART_SUCCESS_RESET_MS,
  createChipCartCoordinator,
  type ChipCartCoordinatorDeps,
  type ChipIdentity
} from "./chip-cart-coordinator";
import type { CartChipResult, ResolvedChipSection } from "./cart-flow";
import type { CartLookupHit } from "../../cart-cache";
import type { CartAnchorState } from "./schedule-ui";

function makeChip(overrides: Partial<ChipIdentity> = {}): ChipIdentity {
  return {
    key: "chip-1",
    params: {
      subject: "COMP_SCI",
      catalogNumber: "111",
      instructor: "Smith"
    },
    titleHint: "Fundamentals",
    ...overrides
  };
}

function makeResolved(overrides: Partial<ResolvedChipSection> = {}): ResolvedChipSection {
  return {
    termId: "4750",
    subject: "COMP_SCI",
    catalog: "111-0",
    sectionLabel: "1-LEC",
    ...overrides
  };
}

function makeDeps(
  overrides: Partial<ChipCartCoordinatorDeps> = {}
): ChipCartCoordinatorDeps {
  return {
    psCreditPool: {
      tryConsume: vi.fn().mockReturnValue({ allowed: true, waitMs: 0 }),
      format: vi.fn().mockReturnValue(null),
      formatLimitReached: vi.fn().mockReturnValue("limit reached")
    },
    showToast: vi.fn(),
    addChipSectionToCart: vi.fn().mockResolvedValue({
      ok: true,
      classNumber: "12345",
      sectionLabel: "1-LEC",
      termId: "4750"
    } as CartChipResult),
    resolveChipSection: vi.fn().mockResolvedValue(makeResolved()),
    enrollClass: vi.fn().mockResolvedValue({ ok: true, message: "Enrolled: Success." }),
    enrollFailureText: () => "failed",
    lookupBySignature: vi.fn().mockReturnValue(null),
    recordOptimisticAdd: vi.fn(),
    subscribeCartCache: vi.fn().mockReturnValue(vi.fn()),
    attachToWidgets: vi.fn(),
    ...overrides
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createChipCartCoordinator — kickChipCart happy path", () => {
  it("consumes credit, calls cart-flow, writes success state + cart-cache + toast", async () => {
    const deps = makeDeps();
    const coord = createChipCartCoordinator(deps);
    const chip = makeChip();

    coord.kickChipCart(chip);
    expect(deps.psCreditPool.tryConsume).toHaveBeenCalledWith(
      "paper-ctec-chip-cart"
    );
    // adding state painted immediately
    expect(deps.attachToWidgets).toHaveBeenCalledWith(
      "chip-1",
      expect.objectContaining({ kind: "adding" }),
      expect.any(Function)
    );
    expect(coord.hasInFlight("chip-1")).toBe(true);

    // resolve the addChipSectionToCart promise
    await vi.runAllTimersAsync();

    expect(deps.addChipSectionToCart).toHaveBeenCalledTimes(1);
    expect(coord.hasInFlight("chip-1")).toBe(false);
    expect(coord.getState("chip-1")).toEqual({
      kind: "success",
      classNumber: "12345"
    });
    expect(deps.recordOptimisticAdd).toHaveBeenCalledWith(
      "4750",
      expect.objectContaining({
        classNumber: "12345",
        subject: "COMP_SCI",
        // The success path uses the resolved sectionLabel + termIdHint
        // directly and falls back to params.catalogNumber for the catalog
        // (the bare CTEC-link form), without consulting paper.nu's
        // resolved suffix. Locks in the pre-extraction behavior.
        catalog: "111",
        sectionLabel: "1-LEC"
      })
    );
    expect(deps.showToast).toHaveBeenCalledWith(
      expect.stringContaining("Added COMP_SCI 111 1-LEC"),
      expect.objectContaining({ tone: "success" })
    );
  });

  it("guards re-entrancy: second kick while first in-flight is a no-op", () => {
    const deps = makeDeps();
    const coord = createChipCartCoordinator(deps);
    const chip = makeChip();

    coord.kickChipCart(chip);
    coord.kickChipCart(chip);
    expect(deps.psCreditPool.tryConsume).toHaveBeenCalledTimes(1);
    expect(deps.addChipSectionToCart).toHaveBeenCalledTimes(1);
  });
});

describe("createChipCartCoordinator — credit + error paths", () => {
  it("blocks when credit pool is exhausted: warn toast, no network call", () => {
    const deps = makeDeps({
      psCreditPool: {
        tryConsume: vi.fn().mockReturnValue({ allowed: false, waitMs: 12345 }),
        format: vi.fn().mockReturnValue(null),
        formatLimitReached: vi.fn().mockReturnValue("limit hit")
      }
    });
    const coord = createChipCartCoordinator(deps);
    coord.kickChipCart(makeChip());

    expect(deps.psCreditPool.formatLimitReached).toHaveBeenCalledWith(12345);
    expect(deps.showToast).toHaveBeenCalledWith(
      "limit hit",
      expect.objectContaining({ tone: "warn" })
    );
    expect(deps.addChipSectionToCart).not.toHaveBeenCalled();
    expect(coord.hasInFlight("chip-1")).toBe(false);
  });

  it("error result: paints error state + error toast", async () => {
    const deps = makeDeps({
      addChipSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        error: "CAESAR refused"
      } as CartChipResult)
    });
    const coord = createChipCartCoordinator(deps);
    coord.kickChipCart(makeChip());
    await vi.runAllTimersAsync();

    expect(coord.getState("chip-1")).toEqual({
      kind: "error",
      message: "CAESAR refused"
    });
    expect(deps.showToast).toHaveBeenCalledWith(
      expect.stringContaining("CAESAR refused"),
      expect.objectContaining({ tone: "error" })
    );
    expect(deps.recordOptimisticAdd).not.toHaveBeenCalled();
  });

  it("alreadyInCart result: paints already state + writes cart-cache", async () => {
    const deps = makeDeps({
      addChipSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        alreadyInCart: true,
        classNumber: "99999",
        error: "duplicate"
      } as CartChipResult)
    });
    const coord = createChipCartCoordinator(deps);
    coord.kickChipCart(makeChip());
    await vi.runAllTimersAsync();

    expect(coord.getState("chip-1")).toEqual({
      kind: "already",
      classNumber: "99999"
    });
    // alreadyInCart path falls through to the resolveChipSection-based
    // fallback for cache write.
    expect(deps.recordOptimisticAdd).toHaveBeenCalledWith(
      "4750",
      expect.objectContaining({ classNumber: "99999" })
    );
  });
});

describe("createChipCartCoordinator — seedCartStateFromCache", () => {
  it("paints already state from cart-cache when lookup hits in-cart", async () => {
    const hit: CartLookupHit = {
      status: "in-cart",
      entry: {
        classNumber: "55555",
        subject: "COMP_SCI",
        catalog: "111-0",
        sectionLabel: "1-LEC",
        capturedAt: 0
      }
    };
    const deps = makeDeps({
      lookupBySignature: vi.fn().mockReturnValue(hit)
    });
    const coord = createChipCartCoordinator(deps);

    await coord.seedCartStateFromCache(makeChip());
    expect(deps.resolveChipSection).toHaveBeenCalledTimes(1);
    expect(deps.lookupBySignature).toHaveBeenCalledWith(
      "4750",
      "COMP_SCI",
      "111-0",
      "1-LEC"
    );
    expect(coord.getState("chip-1")).toEqual({
      kind: "already",
      classNumber: "55555"
    });
    expect(deps.attachToWidgets).toHaveBeenCalledWith(
      "chip-1",
      { kind: "already", classNumber: "55555" },
      expect.any(Function)
    );
  });

  it("paints enrolled state when the cart-cache hit is enrolled", async () => {
    const hit: CartLookupHit = {
      status: "enrolled",
      entry: {
        classNumber: "44444",
        subject: "COMP_SCI",
        catalog: "111-0",
        sectionLabel: "1-LEC",
        capturedAt: 0
      }
    };
    const deps = makeDeps({ lookupBySignature: vi.fn().mockReturnValue(hit) });
    const coord = createChipCartCoordinator(deps);

    await coord.seedCartStateFromCache(makeChip());
    expect(coord.getState("chip-1")).toEqual({
      kind: "enrolled",
      classNumber: "44444"
    });
  });

  it("no-op when resolveChipSection returns null (paper.nu data missing)", async () => {
    const deps = makeDeps({
      resolveChipSection: vi.fn().mockResolvedValue(null)
    });
    const coord = createChipCartCoordinator(deps);
    await coord.seedCartStateFromCache(makeChip());
    expect(deps.lookupBySignature).not.toHaveBeenCalled();
    expect(deps.attachToWidgets).not.toHaveBeenCalled();
    expect(coord.getState("chip-1")).toBeUndefined();
  });

  it("memoizes resolveChipSection across calls", async () => {
    const deps = makeDeps();
    const coord = createChipCartCoordinator(deps);
    await coord.seedCartStateFromCache(makeChip());
    await coord.seedCartStateFromCache(makeChip());
    expect(deps.resolveChipSection).toHaveBeenCalledTimes(1);
  });

  it("does not trample mid-flight 'adding' state when cache update arrives", async () => {
    const hit: CartLookupHit = {
      status: "in-cart",
      entry: {
        classNumber: "55555",
        subject: "COMP_SCI",
        catalog: "111-0",
        sectionLabel: "1-LEC",
        capturedAt: 0
      }
    };
    // Hold the cart-flow promise so kickChipCart stays mid-flight.
    let resolveAdd: (v: CartChipResult) => void = () => undefined;
    const addPromise = new Promise<CartChipResult>((resolve) => {
      resolveAdd = resolve;
    });
    const deps = makeDeps({
      addChipSectionToCart: vi.fn().mockReturnValue(addPromise),
      lookupBySignature: vi.fn().mockReturnValue(hit)
    });
    const coord = createChipCartCoordinator(deps);
    coord.kickChipCart(makeChip());
    expect(coord.getState("chip-1")?.kind).toBe("adding");

    await coord.seedCartStateFromCache(makeChip());
    // Must still be 'adding' — cache-cycle override is suppressed.
    expect(coord.getState("chip-1")?.kind).toBe("adding");

    resolveAdd({
      ok: true,
      classNumber: "12345",
      sectionLabel: "1-LEC",
      termId: "4750"
    });
    await vi.runAllTimersAsync();
  });
});

describe("createChipCartCoordinator — cart-cache subscription lifecycle", () => {
  it("start() subscribes; stop() unsubscribes", () => {
    const unsubscribe = vi.fn();
    const subscribeCartCache = vi.fn().mockReturnValue(unsubscribe);
    const coord = createChipCartCoordinator(makeDeps({ subscribeCartCache }));

    coord.start();
    expect(subscribeCartCache).toHaveBeenCalledTimes(1);
    coord.stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("start() is idempotent — second call does not re-subscribe", () => {
    const subscribeCartCache = vi.fn().mockReturnValue(vi.fn());
    const coord = createChipCartCoordinator(makeDeps({ subscribeCartCache }));
    coord.start();
    coord.start();
    expect(subscribeCartCache).toHaveBeenCalledTimes(1);
  });

  it("cart-cache change triggers re-evaluation of every resolved chip", async () => {
    let subscriber: () => void = () => undefined;
    const subscribeCartCache = vi.fn().mockImplementation((listener: () => void) => {
      subscriber = listener;
      return vi.fn();
    });
    const lookupBySignature = vi.fn().mockReturnValue(null);
    const deps = makeDeps({ subscribeCartCache, lookupBySignature });
    const coord = createChipCartCoordinator(deps);
    coord.start();

    await coord.seedCartStateFromCache(makeChip());
    expect(lookupBySignature).toHaveBeenCalledTimes(1);

    subscriber();
    await vi.runAllTimersAsync();
    expect(lookupBySignature).toHaveBeenCalledTimes(2);
  });

  it("stop() clears all timers and resets in-flight state", () => {
    const coord = createChipCartCoordinator(makeDeps());
    const chip = makeChip();
    coord.scheduleCartReset(chip.key);
    // Remember identity so scheduleCartReset has someone to repaint.
    coord.kickChipCart(chip);
    coord.stop();
    expect(coord.hasInFlight("chip-1")).toBe(false);
    // The reset timer must not fire after stop().
    vi.advanceTimersByTime(__CART_SUCCESS_RESET_MS + 1);
    // No assertion needed — if the timer fired into a stopped coordinator
    // it would attempt to repaint via attachToWidgets after the identity
    // map was cleared and crash. Reaching here without throwing is the test.
  });
});

describe("createChipCartCoordinator — scheduleCartReset / clearCartResetTimer", () => {
  it("scheduleCartReset flips back to idle after the timeout", () => {
    const deps = makeDeps();
    const coord = createChipCartCoordinator(deps);
    const chip = makeChip();
    // Seed identity + a sticky state.
    coord.kickChipCart(chip);
    (deps.attachToWidgets as ReturnType<typeof vi.fn>).mockClear();

    coord.scheduleCartReset(chip.key);
    vi.advanceTimersByTime(__CART_SUCCESS_RESET_MS - 1);
    expect(deps.attachToWidgets).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(deps.attachToWidgets).toHaveBeenCalledWith(
      "chip-1",
      { kind: "idle" },
      expect.any(Function)
    );
    expect(coord.getState("chip-1")).toBeUndefined();
  });

  it("clearCartResetTimer cancels a pending reset", () => {
    const deps = makeDeps();
    const coord = createChipCartCoordinator(deps);
    const chip = makeChip();
    coord.kickChipCart(chip);
    (deps.attachToWidgets as ReturnType<typeof vi.fn>).mockClear();

    coord.scheduleCartReset(chip.key);
    coord.clearCartResetTimer(chip.key);
    vi.advanceTimersByTime(__CART_SUCCESS_RESET_MS + 1);
    // attachToWidgets was never called from the (cancelled) reset.
    const idleCalls = (deps.attachToWidgets as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => (call[1] as CartAnchorState).kind === "idle"
    );
    expect(idleCalls).toHaveLength(0);
  });
});

describe("createChipCartCoordinator — kills synthesized-target hack", () => {
  it("kickChipCart accepts a ChipIdentity (no card / widget DOM refs needed)", () => {
    const deps = makeDeps();
    const coord = createChipCartCoordinator(deps);
    // Note: this object has only key/params/titleHint — no card or widget.
    // The pre-Wave-6a code required `as PaperCtecTarget` with
    // `card: document.body, widget: document.body` to satisfy types. The
    // coordinator's API takes the minimal identity directly.
    const chip: ChipIdentity = {
      key: "minimal",
      params: {
        subject: "COMP_SCI",
        catalogNumber: "111",
        instructor: "Smith"
      },
      titleHint: "Fundamentals"
    };
    coord.kickChipCart(chip);
    expect(deps.attachToWidgets).toHaveBeenCalledWith(
      "minimal",
      expect.objectContaining({ kind: "adding" }),
      expect.any(Function)
    );
  });
});

describe("createChipCartCoordinator — registering from the cart button", () => {
  const inCart = (): CartLookupHit => ({
    status: "in-cart",
    entry: { classNumber: "12345", subject: "COMP_SCI", catalog: "111-0", sectionLabel: "1-LEC", capturedAt: 0 }
  });

  it("first press asks, second press enrolls that class in its term", async () => {
    const deps = makeDeps({ lookupBySignature: vi.fn().mockReturnValue(inCart()) });
    const coord = createChipCartCoordinator(deps);
    const chip = makeChip();
    await coord.seedCartStateFromCache(chip);
    expect(coord.getState(chip.key)).toEqual({ kind: "already", classNumber: "12345" });

    coord.kickChipCart(chip);
    expect(coord.getState(chip.key)?.kind).toBe("confirm");
    expect(deps.enrollClass).not.toHaveBeenCalled();
    expect(deps.addChipSectionToCart).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    coord.kickChipCart(chip);
    await vi.runOnlyPendingTimersAsync();
    expect(deps.enrollClass).toHaveBeenCalledTimes(1);
    expect(deps.enrollClass).toHaveBeenCalledWith("4750", "12345");
    expect(coord.getState(chip.key)?.kind).toBe("enrolled");
  });

  it("a double press does not enroll, and the ask lapses", async () => {
    const deps = makeDeps({ lookupBySignature: vi.fn().mockReturnValue(inCart()) });
    const coord = createChipCartCoordinator(deps);
    const chip = makeChip();
    await coord.seedCartStateFromCache(chip);
    coord.kickChipCart(chip);
    coord.kickChipCart(chip);
    expect(deps.enrollClass).not.toHaveBeenCalled();
    vi.advanceTimersByTime(7000);
    expect(coord.getState(chip.key)?.kind).toBe("already");
  });

  it("a refusal leaves the class in the cart and says why", async () => {
    const deps = makeDeps({
      lookupBySignature: vi.fn().mockReturnValue(inCart()),
      enrollClass: vi.fn().mockResolvedValue({ ok: false, message: "Not enrolled: no access." })
    });
    const coord = createChipCartCoordinator(deps);
    const chip = makeChip();
    await coord.seedCartStateFromCache(chip);
    coord.kickChipCart(chip);
    vi.advanceTimersByTime(1000);
    coord.kickChipCart(chip);
    await vi.runOnlyPendingTimersAsync();
    expect(coord.getState(chip.key)?.kind).toBe("already");
    expect(deps.showToast).toHaveBeenCalledWith("Not enrolled: no access.", expect.objectContaining({ tone: "error" }));
  });
});

it("finds a card's class under the Section Info panel's name for it", async () => {
  vi.useFakeTimers();
  const hit: CartLookupHit = {
    status: "in-cart",
    entry: { classNumber: "12345", subject: "COMP_SCI", catalog: "111-0", sectionLabel: "1-LEC", capturedAt: 0 }
  };
  const deps = makeDeps({
    lookupBySignature: vi.fn((_t: string, _s: string, catalog: string) => (catalog === "111-0" ? hit : null)),
    resolveChipSection: vi.fn(async (params: { catalogNumber: string }) => makeResolved({ catalog: `${params.catalogNumber}-0` }))
  });
  const coord = createChipCartCoordinator(deps);
  await coord.seedCartStateFromCache(makeChip({ key: "COMP_SCI:111:smith:intro: part 1" }));
  const named = (key: string, catalogNumber = "111") =>
    coord.actionFor(makeChip({ key, params: { subject: "COMP_SCI", catalogNumber, instructor: "x" } }));
  expect(named("COMP_SCI:111:j smith:intro: part 1").state.kind).toBe("already");
  expect(named("COMP_SCI:111:j jones:intro: part 1").state.kind).toBe("idle");
  expect(named("COMP_SCI:211:j smith:intro: part 1", "211").state.kind).toBe("idle");

  // Its press moves the card's own class on: it asks, it does not add again.
  named("COMP_SCI:111:j smith:intro: part 1").kick();
  expect(coord.getState("COMP_SCI:111:smith:intro: part 1")?.kind).toBe("confirm");
  expect(deps.addChipSectionToCart).not.toHaveBeenCalled();
  vi.useRealTimers();
});
