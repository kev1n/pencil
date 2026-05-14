import { logDebug } from "../../../shared/log";
import type { Augmentation } from "../../framework";
import { BUTTON_BOUND_ATTR, FEATURE_ID } from "./constants";
import { findExportDownloadButton } from "./detection";

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

type BoundTarget = HTMLButtonElement | HTMLAnchorElement;

export class PaperExportHelperAugmentation implements Augmentation {
  readonly id = FEATURE_ID;

  // Tracked so cleanup() can remove the listener even if the underlying
  // button has been re-keyed by React in the meantime.
  private boundButton: BoundTarget | null = null;
  // Set true by the (future) modal's "Download" CTA so the next native
  // click on the button is allowed to flow through. Cleared back to false
  // after the click resolves.
  private allowNativeClickThrough = false;

  run(doc: Document = document): void {
    if (!isPaperHost()) return;

    const button = findExportDownloadButton(doc);
    if (!button) return;
    if (button === this.boundButton) return;
    if (button.hasAttribute(BUTTON_BOUND_ATTR)) {
      // React swapped the element identity but the marker survived;
      // re-bind so this.boundButton points at the live node.
      this.boundButton = button;
      return;
    }

    this.bindButton(button);
  }

  cleanup(_doc: Document = document): void {
    if (this.boundButton) {
      this.boundButton.removeEventListener("click", this.handleClick, true);
      this.boundButton.removeAttribute(BUTTON_BOUND_ATTR);
      this.boundButton = null;
    }
    this.allowNativeClickThrough = false;
  }

  private bindButton(button: BoundTarget): void {
    button.setAttribute(BUTTON_BOUND_ATTR, "1");
    button.addEventListener("click", this.handleClick, true);
    this.boundButton = button;
  }

  // Arrow property so the same reference can be used for add/remove.
  // Capture phase so we fire before paper.nu's React onClick handler.
  private handleClick = (event: Event): void => {
    if (this.allowNativeClickThrough) {
      this.allowNativeClickThrough = false;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    logDebug("paper-export-helper.intercept", "intercepted paper.nu export click");
    // The walkthrough modal lands in the next commit.
  };
}
