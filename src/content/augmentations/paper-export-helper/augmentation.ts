import type { Augmentation } from "../../framework";
import { BUTTON_BOUND_ATTR, FEATURE_ID } from "./constants";
import { findExportDownloadButton } from "./detection";
import { openExportHelperModal, type ModalHandle } from "./modal";
import { loadLastTab, saveLastTab } from "./storage";
import { removeExportHelperStyles } from "./styles";
import { DEFAULT_CALENDAR_APP, type CalendarApp } from "./types";

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
  private modal: ModalHandle | null = null;
  // Set true by the modal's "Download" CTA so the next native click on
  // the button is allowed to flow through. Cleared back to false after
  // the click resolves.
  private allowNativeClickThrough = false;
  // Pre-warmed on construction so the click handler can read it
  // synchronously without an await. Falls back to DEFAULT until the
  // storage read resolves — which happens long before any user click.
  private cachedLastTab: CalendarApp = DEFAULT_CALENDAR_APP;

  constructor() {
    void loadLastTab().then((app) => {
      this.cachedLastTab = app;
    });
  }

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

  cleanup(doc: Document = document): void {
    if (this.boundButton) {
      this.boundButton.removeEventListener("click", this.handleClick, true);
      this.boundButton.removeAttribute(BUTTON_BOUND_ATTR);
      this.boundButton = null;
    }
    this.allowNativeClickThrough = false;
    this.closeModal();
    removeExportHelperStyles(doc);
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
    this.openModal();
  };

  private openModal(): void {
    if (this.modal) return;
    this.modal = openExportHelperModal(document, this.cachedLastTab, {
      onDownload: () => this.triggerNativeDownload(),
      onClose: () => this.closeModal(),
      onTabChange: (app) => {
        this.cachedLastTab = app;
        saveLastTab(app);
      }
    });
  }

  // Re-dispatch a click on paper.nu's native Download button with the
  // bypass flag flipped so our capture-phase interceptor lets the event
  // through to React. We deliberately keep the modal open until the
  // click lands — the dispatch is synchronous, so by the time we close,
  // the native handler has already initiated the .ics download.
  private triggerNativeDownload(): void {
    const button = this.boundButton;
    if (!button) {
      this.closeModal();
      return;
    }
    this.allowNativeClickThrough = true;
    try {
      button.click();
    } finally {
      this.allowNativeClickThrough = false;
    }
    this.closeModal();
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
  }
}
