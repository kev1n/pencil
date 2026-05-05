import { describe, expect, it, vi } from "vitest";

import {
  ACTION_BUTTON_MARKER_ATTR,
  createActionButton,
  type ActionButtonClock,
  type ActionButtonResult
} from "./action-button";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function fakeClock(): {
  clock: ActionButtonClock;
  flush(): void;
  pending(): number;
} {
  const queue = new Map<number, () => void>();
  let nextHandle = 1;
  return {
    clock: {
      setTimeout(handler) {
        const handle = nextHandle++;
        queue.set(handle, handler);
        return handle;
      },
      clearTimeout(handle) {
        queue.delete(handle as number);
      }
    },
    flush() {
      for (const handler of Array.from(queue.values())) handler();
      queue.clear();
    },
    pending() {
      return queue.size;
    }
  };
}

describe("createActionButton — synchronous lock + click-once", () => {
  it("returns an element marked with the data-bc-action-button attribute", () => {
    const doc = fresh();
    const ab = createActionButton({
      doc,
      label: "Go",
      onClick: vi.fn().mockResolvedValue(undefined)
    });
    expect(ab.element.getAttribute(ACTION_BUTTON_MARKER_ATTR)).toBe("1");
    expect(ab.element.tagName).toBe("BUTTON");
    expect(ab.element.type).toBe("button");
    expect(ab.element.textContent).toBe("Go");
  });

  it("synchronous double-click only fires onClick once", async () => {
    const doc = fresh();
    let resolve!: () => void;
    const onClick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        })
    );
    const ab = createActionButton({ doc, label: "Run", onClick });
    doc.body.appendChild(ab.element);

    ab.element.click();
    ab.element.click();
    ab.element.click();

    // First click sets disabled synchronously; subsequent clicks should be
    // filtered both by disabled (browser) and the state guard (our code).
    expect(ab.element.disabled).toBe(true);
    expect(ab.element.dataset.state).toBe("loading");

    // Drain microtasks so onClick's promise body has run.
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    resolve();
    await Promise.resolve();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows loadingLabel during pending and disables the button", () => {
    const doc = fresh();
    const onClick = vi
      .fn()
      .mockImplementation(() => new Promise<void>(() => undefined));
    const ab = createActionButton({
      doc,
      label: "Run",
      loadingLabel: "Working…",
      onClick
    });
    ab.element.click();
    expect(ab.element.textContent).toBe("Working…");
    expect(ab.element.disabled).toBe(true);
    expect(ab.state()).toBe("loading");
  });

  it("uses the default 'Loading…' label when loadingLabel is omitted", () => {
    const doc = fresh();
    const onClick = vi
      .fn()
      .mockImplementation(() => new Promise<void>(() => undefined));
    const ab = createActionButton({ doc, label: "Run", onClick });
    ab.element.click();
    expect(ab.element.textContent).toBe("Loading…");
  });
});

describe("createActionButton — result handling", () => {
  it("void return restores idle and re-enables the button", async () => {
    const doc = fresh();
    const onClick = vi.fn().mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Run", onClick });
    await ab.trigger();
    expect(ab.state()).toBe("idle");
    expect(ab.element.disabled).toBe(false);
    expect(ab.element.textContent).toBe("Run");
  });

  it("non-sticky success briefly shows then reverts to idle", async () => {
    const doc = fresh();
    const fc = fakeClock();
    const onClick = vi
      .fn()
      .mockResolvedValue({ kind: "success" } satisfies ActionButtonResult);
    const ab = createActionButton({
      doc,
      label: "Run",
      successLabel: "Done",
      onClick,
      clock: fc.clock
    });
    await ab.trigger();
    expect(ab.state()).toBe("success");
    expect(ab.element.textContent).toBe("Done");
    // Non-sticky success keeps the button disabled during the flash window
    // so a frantic re-click can't fire while the success label is still up.
    expect(ab.element.disabled).toBe(true);
    expect(fc.pending()).toBe(1);
    fc.flush();
    expect(ab.state()).toBe("idle");
    expect(ab.element.textContent).toBe("Run");
  });

  it("sticky success stays disabled and never schedules a flash timer", async () => {
    const doc = fresh();
    const fc = fakeClock();
    const onClick = vi
      .fn()
      .mockResolvedValue({ kind: "success", sticky: true, label: "In cart" });
    const ab = createActionButton({
      doc,
      label: "Add",
      onClick,
      clock: fc.clock
    });
    await ab.trigger();
    expect(ab.state()).toBe("success");
    expect(ab.element.disabled).toBe(true);
    expect(ab.element.textContent).toBe("In cart");
    expect(fc.pending()).toBe(0);
  });

  it("non-sticky success re-enables the button after the flash timer expires", async () => {
    const doc = fresh();
    const fc = fakeClock();
    const onClick = vi
      .fn()
      .mockResolvedValue({ kind: "success" } satisfies ActionButtonResult);
    const ab = createActionButton({
      doc,
      label: "Run",
      onClick,
      clock: fc.clock
    });
    await ab.trigger();
    expect(ab.element.disabled).toBe(true);
    fc.flush();
    expect(ab.state()).toBe("idle");
    expect(ab.element.disabled).toBe(false);
    expect(ab.element.textContent).toBe("Run");
  });

  it("error result re-enables the button and renders errorLabel", async () => {
    const doc = fresh();
    const onClick = vi
      .fn()
      .mockResolvedValue({ kind: "error" } satisfies ActionButtonResult);
    const ab = createActionButton({
      doc,
      label: "Run",
      errorLabel: "Try again",
      onClick
    });
    await ab.trigger();
    expect(ab.state()).toBe("error");
    expect(ab.element.disabled).toBe(false);
    expect(ab.element.textContent).toBe("Try again");
  });

  it("retryable error: clicking again re-runs onClick and locks back to loading", async () => {
    const doc = fresh();
    const onClick = vi
      .fn()
      .mockResolvedValueOnce({ kind: "error", retryable: true })
      .mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Run", onClick });
    await ab.trigger();
    expect(ab.state()).toBe("error");
    await ab.trigger();
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(ab.state()).toBe("idle");
  });

  it("non-retryable error: subsequent clicks are no-ops", async () => {
    const doc = fresh();
    const onClick = vi
      .fn()
      .mockResolvedValueOnce({ kind: "error", retryable: false })
      .mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Run", onClick });
    await ab.trigger();
    expect(ab.state()).toBe("error");
    await ab.trigger();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("createActionButton — throw handling", () => {
  it("a thrown error transitions to error state with retry enabled", async () => {
    const doc = fresh();
    const onClick = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const ab = createActionButton({
      doc,
      label: "Run",
      errorLabel: "Try again",
      onClick
    });
    await ab.trigger();
    expect(ab.state()).toBe("error");
    expect(ab.element.disabled).toBe(false);
    expect(ab.element.textContent).toBe("Try again");
  });

  it("retry after a thrown error re-runs onClick", async () => {
    const doc = fresh();
    const onClick = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Run", onClick });
    await ab.trigger();
    expect(ab.state()).toBe("error");
    await ab.trigger();
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(ab.state()).toBe("idle");
  });
});

describe("createActionButton — abort + lifecycle", () => {
  it("destroy() aborts the in-flight signal", async () => {
    const doc = fresh();
    let captured: AbortSignal | null = null;
    const onClick = vi.fn().mockImplementation(({ signal }: { signal: AbortSignal }) => {
      captured = signal;
      return new Promise<void>(() => undefined);
    });
    const ab = createActionButton({ doc, label: "Run", onClick });
    ab.element.click();
    await Promise.resolve();
    expect(captured).not.toBeNull();
    expect(captured!.aborted).toBe(false);
    ab.destroy();
    expect(captured!.aborted).toBe(true);
  });

  it("destroy() suppresses post-destroy state transitions", async () => {
    const doc = fresh();
    let resolve!: () => void;
    const onClick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        })
    );
    const onStateChange = vi.fn();
    const ab = createActionButton({ doc, label: "Run", onClick, onStateChange });
    ab.element.click();
    await Promise.resolve();
    ab.destroy();
    resolve();
    await Promise.resolve();
    // Calls: idle (initial is not emitted), then loading on click. No
    // post-destroy transition.
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith("loading");
  });
});

describe("createActionButton — manual setState", () => {
  it("setState('disabled') locks the button with a custom label", () => {
    const doc = fresh();
    const onClick = vi.fn().mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Add", onClick });
    ab.setState("disabled", { label: "In cart" });
    expect(ab.state()).toBe("disabled");
    expect(ab.element.disabled).toBe(true);
    expect(ab.element.textContent).toBe("In cart");
  });

  it("setState('idle') re-enables the button and restores the idle label", () => {
    const doc = fresh();
    const onClick = vi.fn().mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Add", onClick });
    ab.setState("disabled", { label: "In cart" });
    ab.setState("idle");
    expect(ab.state()).toBe("idle");
    expect(ab.element.disabled).toBe(false);
    expect(ab.element.textContent).toBe("Add");
  });

  it("setState('success', { sticky: true }) keeps the button disabled", () => {
    const doc = fresh();
    const onClick = vi.fn().mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Add", onClick });
    ab.setState("success", { label: "Enrolled", sticky: true });
    expect(ab.state()).toBe("success");
    expect(ab.element.disabled).toBe(true);
    expect(ab.element.textContent).toBe("Enrolled");
  });
});

describe("createActionButton — trigger + onStateChange", () => {
  it("trigger() invokes onClick without a real DOM click", async () => {
    const doc = fresh();
    const onClick = vi.fn().mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Run", onClick });
    await ab.trigger();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("onStateChange fires for each transition (loading + idle on void return)", async () => {
    const doc = fresh();
    const onClick = vi.fn().mockResolvedValue(undefined);
    const onStateChange = vi.fn();
    const ab = createActionButton({ doc, label: "Run", onClick, onStateChange });
    await ab.trigger();
    expect(onStateChange.mock.calls.map((c) => c[0])).toEqual(["loading", "idle"]);
  });

  it("onStateChange records loading → success → idle on a non-sticky success", async () => {
    const doc = fresh();
    const fc = fakeClock();
    const onClick = vi.fn().mockResolvedValue({ kind: "success" });
    const onStateChange = vi.fn();
    const ab = createActionButton({
      doc,
      label: "Run",
      onClick,
      onStateChange,
      clock: fc.clock
    });
    await ab.trigger();
    fc.flush();
    expect(onStateChange.mock.calls.map((c) => c[0])).toEqual([
      "loading",
      "success",
      "idle"
    ]);
  });
});

describe("createActionButton — re-entry guard", () => {
  it("trigger() while loading is a no-op", async () => {
    const doc = fresh();
    let resolve!: () => void;
    const onClick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        })
    );
    const ab = createActionButton({ doc, label: "Run", onClick });
    const first = ab.trigger();
    await Promise.resolve();
    const second = ab.trigger();
    expect(onClick).toHaveBeenCalledTimes(1);
    resolve();
    await Promise.all([first, second]);
  });

  it("trigger() in sticky success state is a no-op", async () => {
    const doc = fresh();
    const onClick = vi
      .fn()
      .mockResolvedValueOnce({ kind: "success", sticky: true })
      .mockResolvedValue(undefined);
    const ab = createActionButton({ doc, label: "Run", onClick });
    await ab.trigger();
    expect(ab.state()).toBe("success");
    await ab.trigger();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
