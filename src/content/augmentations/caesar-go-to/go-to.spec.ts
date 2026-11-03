// @vitest-environment-options {"url":"https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/TEST.GBL"}

import { afterEach, describe, expect, it, vi } from "vitest";
import { CaesarGoToAugmentation } from ".";
import { DIALOG_ID, TRIGGER_ID } from "./palette";

// jsdom exposes the open attribute but leaves the modal methods to browsers.
HTMLDialogElement.prototype.showModal ??= function () { this.open = true; };
HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

function key(target: EventTarget, value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}

describe("CAESAR Go to", () => {
  const augmentation = new CaesarGoToAugmentation();

  afterEach(() => {
    augmentation.cleanup(document);
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("mounts one launcher next to the CAESAR header and removes it on cleanup", () => {
    augmentation.run(document);
    expect(document.getElementById(TRIGGER_ID)).toBeNull();
    document.body.innerHTML = '<header id="PT_HEADER"></header><main></main>';
    augmentation.run(document);
    augmentation.run(document);
    expect(document.querySelectorAll(`#PT_HEADER + div #${TRIGGER_ID}`)).toHaveLength(1);
    expect(key(window, "k", { ctrlKey: true, isComposing: true }).defaultPrevented).toBe(false);
    expect(key(window, "k", { metaKey: true }).defaultPrevented).toBe(true);
    const dialog = document.querySelector<HTMLDialogElement>(`#${DIALOG_ID}`)!;
    expect(dialog.open).toBe(true);
    expect(document.activeElement?.getAttribute("role")).toBe("combobox");
    expect(key(window, "k", { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);

    augmentation.cleanup(document);
    expect(document.getElementById(TRIGGER_ID)).toBeNull();
    expect(document.getElementById(DIALOG_ID)).toBeNull();
    expect(key(window, "k", { metaKey: true }).defaultPrevented).toBe(false);
  });

  it("filters destinations and opens a native navigation link on a standalone page", () => {
    document.body.innerHTML = `
      <nav><a href="#grades">View Grades</a></nav>
      <main id="win0divPSPAGECONTAINER"><a href="#unrelated">View Unofficial Transcript</a></main>
    `;
    const navigate = vi.fn((event: MouseEvent) => event.preventDefault());
    document.querySelector<HTMLAnchorElement>("nav a")!.addEventListener("click", navigate);
    augmentation.run(document);
    document.getElementById(TRIGGER_ID)!.click();
    const dialog = document.querySelector<HTMLDialogElement>(`#${DIALOG_ID}`)!;
    const input = dialog.querySelector<HTMLInputElement>("input")!;
    expect(dialog.querySelector("#bc-go-option-transcript")).toBeNull();
    input.value = "gpa";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.getAttribute("aria-activedescendant")).toBe("bc-go-option-grades");
    key(input, "Enter", { isComposing: true });
    expect(navigate).not.toHaveBeenCalled();
    key(input, "Enter");
    expect(navigate).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
  });
});
