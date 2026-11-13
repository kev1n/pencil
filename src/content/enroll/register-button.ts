// A Register button for one class that is in the CAESAR cart, for any row
// that shows such a class. The first click asks ("Confirm: enroll me"), the
// second enrolls through `enrollFromCart`, and CAESAR's answer comes up as a
// toast.
import { logQuiet } from "../../shared/log";
import { showToast } from "../../shared/toast";
import { createAuthRecovery, withAuthRecovery, type AuthRecovery } from "../augmentations/class-search/auth-recovery";
import { isCaesarAuthRequiredError } from "../augmentations/class-search/caesar-search/types";
import { createActionButton, type ActionButtonResult } from "../framework";
import { enrollFromCart, loadCartRows } from "./flow";

const CONFIRM_LABEL = "Confirm: enroll me";
const ARMED_MS = 6000;
// A confirm press sooner than this after arming is the second half of a
// double-click, not a decision: it keeps the button armed instead.
const CONFIRM_AFTER_MS = 600;

let sharedRecovery: AuthRecovery | null = null;
// One sign-in handshake for every Register button on the page.
export function registerAuthRecovery(): AuthRecovery {
  sharedRecovery ??= createAuthRecovery({
    chromeRuntime: chrome.runtime,
    windowLocation: { assign: (url: string | URL) => window.location.assign(url) }
  });
  return sharedRecovery;
}

// Enrolls in one cart class and says what CAESAR answered. Null when a
// sign-in was started instead. Throws when the request itself failed, in
// which case it may still have gone through.
export async function enrollOne(termId: string, classNumber: string): Promise<{ ok: boolean; message: string } | null> {
  const outcome = await withAuthRecovery(registerAuthRecovery(), isCaesarAuthRequiredError, () =>
    enrollFromCart(termId, [classNumber], "register-button")
  );
  if (outcome === null) return null;
  if (outcome.kind === "refused") return { ok: false, message: outcome.message };
  const mine = outcome.results.find((result) => result.label.includes(`(${classNumber})`)) ?? outcome.results[0]!;
  // Bring the saved cart and enrolled lists up to date.
  void loadCartRows(termId).catch((error: unknown) => logQuiet("register-button", error));
  return { ok: mine.ok, message: `${mine.ok ? "Enrolled" : "Not enrolled"}: ${mine.message}` };
}

// What to say when `enrollOne` threw.
export function enrollFailureText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return `${text} Check your schedule in CAESAR before trying again.`;
}

export type RegisterButtonOptions = {
  doc: Document;
  termId: string;
  // Read at click time: the class may have entered the cart after render.
  classNumber(): string | null;
  className: string;
  label?: string;
};

export function createRegisterButton(options: RegisterButtonOptions): HTMLButtonElement {
  const { doc, termId } = options;
  const label = options.label ?? "Register";
  let armed = false;
  let armedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const button = createActionButton({
    doc,
    label,
    loadingLabel: "Enrolling…",
    className: options.className,
    attrs: { title: "Enroll in this class through CAESAR" },
    onClick: async (): Promise<ActionButtonResult> => {
      if (armed && Date.now() - armedAt < CONFIRM_AFTER_MS) return { kind: "idle", label: CONFIRM_LABEL };
      if (!armed) {
        armed = true;
        armedAt = Date.now();
        timer = setTimeout(() => {
          armed = false;
          if (button.element.dataset.state !== "loading") button.element.textContent = label;
        }, ARMED_MS);
        return { kind: "idle", label: CONFIRM_LABEL };
      }
      armed = false;
      clearTimeout(timer);
      const classNumber = options.classNumber();
      if (!classNumber) {
        showToast("This class isn’t in your CAESAR cart anymore.", { tone: "warn" });
        return { kind: "idle", label };
      }
      try {
        const answer = await enrollOne(termId, classNumber);
        if (answer === null) return { kind: "idle", label };
        showToast(answer.message, { tone: answer.ok ? "success" : "error", durationMs: 8000 });
        return answer.ok ? { kind: "success", label: "Enrolled", sticky: true } : { kind: "idle", label };
      } catch (error: unknown) {
        logQuiet("register-button", error);
        // The request may have gone through: say so instead of guessing.
        showToast(enrollFailureText(error), { tone: "error", durationMs: 8000 });
        return { kind: "idle", label };
      }
    }
  });
  return button.element;
}
