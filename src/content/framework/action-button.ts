// createActionButton — the single primitive every async-action button must
// route through. Locks down the regression class where buttons stay clickable
// while a click's promise chain is in flight, look stale, or appear inert.
//
// The factory enforces:
//   • Synchronous disabled lock on the very first click — set BEFORE the
//     first await so a back-to-back synchronous double-click on the same
//     task tick is filtered out (the browser's disabled-button click filter
//     covers the second hop, the re-entry guard covers the first).
//   • Re-entry guard — clicks that land while state !== "idle" are no-ops,
//     except retryable error states which return to idle on the next click.
//   • AbortSignal — every onClick invocation receives a signal that fires
//     when destroy() runs mid-flight, so callers can plumb cancellation
//     into their network layer if they want.
//   • State machine — idle → loading → success | error, with optional
//     non-sticky success that flips back to idle after a brief flash, and
//     sticky success that locks the button as a terminal state.
//
// External orchestrators (cart-button-registry, controllers that show
// chained pickers) can still drive the button via `setState(...)` — the
// re-entry guard reads `state()` so a manual flip to "disabled" with a
// custom label keeps the click-once contract intact.

import { el } from "./dom";

export type ActionButtonState =
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "disabled";

export type ActionButtonResult =
  | { kind: "idle"; label?: string }
  | { kind: "success"; label?: string; sticky?: boolean }
  | { kind: "error"; label?: string; retryable?: boolean };

export interface ActionButtonClock {
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ActionButtonProps {
  doc: Document;
  /** Idle label. */
  label: string;
  /** Optional override labels for non-idle states. */
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  /** Tag classes (state-specific is added automatically as data-state). */
  className?: string;
  /** Optional extra attrs (title, aria-label, etc.). */
  attrs?: Record<string, string>;
  /** The async action. Throws or returns ActionButtonResult. */
  onClick(ctx: { signal: AbortSignal }): Promise<ActionButtonResult | void>;
  /** Optional state-change observer for tests / metrics. */
  onStateChange?(state: ActionButtonState): void;
  /** DI for the success-flash timer. Defaults to global setTimeout/clearTimeout. */
  clock?: ActionButtonClock;
  /** ms to flash a non-sticky success before reverting to idle (default 2000). */
  successFlashMs?: number;
}

export interface ActionButton {
  readonly element: HTMLButtonElement;
  state(): ActionButtonState;
  setState(
    state: ActionButtonState,
    opts?: { label?: string; sticky?: boolean }
  ): void;
  trigger(): Promise<void>;
  destroy(): void;
}

const DEFAULT_LOADING_LABEL = "Loading…";
const DEFAULT_ERROR_LABEL = "Try again";
const DEFAULT_SUCCESS_FLASH_MS = 2000;

/**
 * Marker attached to every button created via this factory. The
 * lint:buttons script greps for `[data-bc-action-button]` to allowlist
 * a button as the safe path.
 */
export const ACTION_BUTTON_MARKER_ATTR = "data-bc-action-button";

/**
 * Adopt an existing `<button>` (from static HTML, e.g. the popup) into the
 * action-button contract. Same state machine + click-once + loading-lock
 * semantics as `createActionButton`, but the caller supplies the element.
 *
 * The element is mutated in place: its existing click listeners are NOT
 * removed (the contract is additive), but the new click handler runs first
 * and short-circuits when state is non-idle. Original button text is
 * captured as the idle label unless `props.label` is provided.
 */
export interface BindActionButtonProps extends Omit<ActionButtonProps, "doc" | "label" | "className" | "attrs"> {
  /** Idle label override. Defaults to the element's existing textContent. */
  label?: string;
}

export function bindActionButton(
  element: HTMLButtonElement,
  props: BindActionButtonProps
): ActionButton {
  const idleLabel = props.label ?? element.textContent ?? "";
  return createActionButtonOnElement(element, { ...props, label: idleLabel, doc: element.ownerDocument });
}

export function createActionButton(props: ActionButtonProps): ActionButton {
  const button = el(props.doc, "button", {
    class: props.className,
    attrs: {
      type: "button",
      [ACTION_BUTTON_MARKER_ATTR]: "1",
      ...(props.attrs ?? {})
    },
    text: props.label
  });
  return createActionButtonOnElement(button, props);
}

function createActionButtonOnElement(
  button: HTMLButtonElement,
  props: ActionButtonProps
): ActionButton {
  // Idempotent: re-binding an element that already carries the marker is OK.
  if (!button.hasAttribute(ACTION_BUTTON_MARKER_ATTR)) {
    button.setAttribute(ACTION_BUTTON_MARKER_ATTR, "1");
  }
  if (button.type !== "button") button.type = "button";

  const clock: ActionButtonClock = props.clock ?? {
    setTimeout: (handler, ms) => setTimeout(handler, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
  };

  let currentState: ActionButtonState = "idle";
  let lastErrorRetryable = true;
  let abortController: AbortController | null = null;
  let successFlashHandle: unknown = null;
  let destroyed = false;

  const successFlashMs = props.successFlashMs ?? DEFAULT_SUCCESS_FLASH_MS;

  function applyState(
    next: ActionButtonState,
    opts: { label?: string; disabled?: boolean } = {}
  ): void {
    currentState = next;
    button.dataset.state = next;
    if (opts.label !== undefined) {
      button.textContent = opts.label;
    }
    button.disabled =
      opts.disabled !== undefined
        ? opts.disabled
        : next === "loading" || next === "disabled";
    props.onStateChange?.(next);
  }

  function clearSuccessFlash(): void {
    if (successFlashHandle !== null) {
      clock.clearTimeout(successFlashHandle);
      successFlashHandle = null;
    }
  }

  function returnToIdle(): void {
    clearSuccessFlash();
    applyState("idle", { label: props.label, disabled: false });
  }

  async function runOnce(): Promise<void> {
    if (destroyed) return;

    // Re-entry guard. The only way a click reaches `runOnce` while the
    // button is non-idle is the retryable-error path: that case explicitly
    // resets to idle and falls through to the run.
    if (currentState !== "idle") {
      if (currentState === "error" && lastErrorRetryable) {
        // fall through — the error-state click is a manual retry.
      } else {
        return;
      }
    }

    clearSuccessFlash();

    // Synchronous lock — must complete before any await so the browser's
    // disabled-button filter and the dataset.state guard above both bite
    // on a back-to-back synchronous double-click.
    applyState("loading", {
      label: props.loadingLabel ?? DEFAULT_LOADING_LABEL,
      disabled: true
    });

    abortController = new AbortController();
    const signal = abortController.signal;

    let result: ActionButtonResult | void;
    try {
      result = await props.onClick({ signal });
    } catch (err) {
      if (destroyed) return;
      const errLabel = props.errorLabel ?? DEFAULT_ERROR_LABEL;
      lastErrorRetryable = true;
      applyState("error", { label: errLabel, disabled: false });
      // Re-throw is suppressed: the error contract is "throw → state
      // transitions to retryable error". Callers needing the original
      // error should handle it inside onClick and return an explicit
      // error result.
      void err;
      return;
    }

    if (destroyed) return;

    if (!result || result.kind === "idle") {
      returnToIdle();
      if (result && result.kind === "idle" && result.label !== undefined) {
        // An "idle" result with an explicit label keeps the new label.
        button.textContent = result.label;
      }
      return;
    }

    if (result.kind === "success") {
      const label = result.label ?? props.successLabel ?? props.label;
      const sticky = result.sticky === true;
      // Non-sticky success ALSO keeps the button disabled during the flash
      // window — the action is complete, the user shouldn't be inviting
      // them to re-click before the success label clears. After the flash
      // expires, returnToIdle() re-enables.
      applyState("success", { label, disabled: true });
      if (sticky) {
        // Sticky → terminal state. Drop the success flash entirely so the
        // button stays locked until destroy() or an explicit setState().
        return;
      }
      successFlashHandle = clock.setTimeout(() => {
        successFlashHandle = null;
        if (destroyed || currentState !== "success") return;
        returnToIdle();
      }, successFlashMs);
      return;
    }

    // result.kind === "error"
    lastErrorRetryable = result.retryable !== false;
    const label = result.label ?? props.errorLabel ?? DEFAULT_ERROR_LABEL;
    applyState("error", { label, disabled: false });
  }

  button.addEventListener("click", () => {
    void runOnce();
  });

  return {
    element: button,
    state: () => currentState,
    setState(next, opts) {
      if (destroyed) return;
      clearSuccessFlash();
      const sticky = opts?.sticky === true;
      const label =
        opts?.label ??
        (next === "idle" ? props.label : button.textContent ?? props.label);
      // Manual setState always honors `sticky` for the disabled axis;
      // otherwise fall back to the natural state→disabled mapping.
      const disabled = sticky || next === "loading" || next === "disabled";
      applyState(next, { label, disabled });
    },
    async trigger() {
      await runOnce();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearSuccessFlash();
      abortController?.abort();
      abortController = null;
      // Leave the element in place — the caller owns DOM lifecycle.
    }
  };
}
