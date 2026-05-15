import type { Augmentation } from "../../framework";
import { BUTTON_BOUND_ATTR, FEATURE_ID, HIGHLIGHT_ATTR } from "./constants";
import {
  findExportButton,
  findExportToCalendarButton,
  waitForDownloadButton
} from "./detection";
import { openExportHelperModal, type ModalHandle } from "./modal";
import { loadLastTab, saveLastTab } from "./storage";
import {
  injectExportHelperStyles,
  removeExportHelperStyles
} from "./styles";
import { DEFAULT_CALENDAR_APP, type CalendarApp } from "./types";

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

export class PaperExportHelperAugmentation implements Augmentation {
  readonly id = FEATURE_ID;

  // Tracked so cleanup() can remove the listener even if the underlying
  // button has been re-keyed by React in the meantime.
  private boundButton: HTMLButtonElement | null = null;
  private modal: ModalHandle | null = null;
  // Set true by the modal's "Download" CTA so the next native click on
  // the "Export to calendar" button is allowed to flow through. Cleared
  // back to false after the click resolves.
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

    // Style injection lives here (not in openModal) so the EXPORT
    // button highlight paints even when the user hasn't interacted
    // with the modal yet. ensureStyle is idempotent.
    injectExportHelperStyles(doc);

    // Highlight the top-level EXPORT button. The marker carries the
    // styling via `[data-bc-export-highlight="1"]`; idempotent across
    // mutation re-ticks. React occasionally swaps the button node
    // identity (when paper.nu re-renders the toolbar) but the marker
    // attribute survives the swap as long as the new node carries it
    // forward; if not, the next tick re-marks the new node.
    const exportBtn = findExportButton(doc);
    if (exportBtn && !exportBtn.hasAttribute(HIGHLIGHT_ATTR)) {
      exportBtn.setAttribute(HIGHLIGHT_ATTR, "1");
    }

    // The "Export to calendar" button only exists in the DOM while
    // paper.nu's EXPORT dropdown is open. The AugmentationRunner's
    // mutation-driven re-ticks pick it up as soon as it mounts, and
    // the BUTTON_BOUND_ATTR marker keeps the bind idempotent across
    // the re-mounts React does when the dropdown closes and reopens.
    const button = findExportToCalendarButton(doc);
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
    // Strip the highlight marker from every node that has it — the
    // attribute may live on stale React nodes too if the toolbar was
    // re-rendered between marks, and host-page parity matters.
    for (const el of Array.from(
      doc.querySelectorAll<HTMLElement>(`[${HIGHLIGHT_ATTR}]`)
    )) {
      el.removeAttribute(HIGHLIGHT_ATTR);
    }
    this.allowNativeClickThrough = false;
    this.closeModal();
    removeExportHelperStyles(doc);
  }

  private bindButton(button: HTMLButtonElement): void {
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
      onDownload: () => {
        void this.triggerNativeDownload();
      },
      onClose: () => this.closeModal(),
      onTabChange: (app) => {
        this.cachedLastTab = app;
        saveLastTab(app);
      }
    });
  }

  // Walk paper.nu's own export flow on the user's behalf:
  //   1. Bypass-click "Export to calendar" so paper.nu's React handler
  //      opens its calendar modal.
  //   2. Wait for the Download button to mount inside that modal.
  //   3. Click it — that's the call that actually triggers the .ics
  //      download (paper.nu builds and saves the file from its in-memory
  //      schedule data).
  //   4. Send Escape to close paper.nu's modal so the user is left with
  //      just the downloaded file and our walkthrough still open above.
  //
  // We deliberately do NOT close our walkthrough modal on success — the
  // user still needs the steps and the "Open <calendar>" deep-link
  // button visible to finish the import flow. They close it themselves
  // when they're done.
  private async triggerNativeDownload(): Promise<void> {
    const modal = this.modal;
    if (!modal) return;
    const button = this.boundButton;
    if (!button) {
      modal.setDownloadState("error");
      return;
    }
    modal.setDownloadState("loading");
    this.allowNativeClickThrough = true;
    try {
      button.click();
    } finally {
      this.allowNativeClickThrough = false;
    }
    const downloadBtn = await waitForDownloadButton(document, 1500);
    if (!downloadBtn) {
      modal.setDownloadState("error");
      return;
    }
    downloadBtn.click();
    // Most React modal libraries dismiss on Escape. If paper.nu's
    // doesn't, the modal stays open but the .ics already downloaded
    // — non-blocking failure mode.
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    modal.setDownloadState("success");
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
  }
}
