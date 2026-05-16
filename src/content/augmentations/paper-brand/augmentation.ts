import type { Augmentation } from "../../framework";
import { el } from "../../framework/dom";
import {
  FEATURE_ID,
  HOST_MARKER_ATTR,
  MARK_MARKER_ATTR,
  MODAL_ID
} from "./constants";
import { openAboutModal, type AboutModalHandle } from "./modal";
import { PENCIL_SVG_MARKUP } from "./pencil-svg";
import {
  injectPaperBrandStyles,
  removePaperBrandStyles
} from "./styles";

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

// Locates paper.nu's sidebar logo button by finding the `<img alt="paper.nu">`
// and walking up to its enclosing `<button>`. The alt attribute is stable
// across paper.nu's hashed PNG filename versions (the file's hash changes
// on every paper.nu release; the alt does not).
function findLogoButton(doc: Document): HTMLButtonElement | null {
  const img = doc.querySelector<HTMLImageElement>('img[alt="paper.nu"]');
  if (!img) return null;
  return img.closest("button");
}

export class PaperBrandAugmentation implements Augmentation {
  readonly id = FEATURE_ID;

  private modal: AboutModalHandle | null = null;
  // Tracked on the instance so cleanup() can unhook the listener even when
  // the modal handle's destroy() shortcut skips its own onClose path (e.g.
  // when the runner tears down on a feature-flag flip with the modal open).
  private modalDoc: Document | null = null;
  private modalKeydown: ((event: KeyboardEvent) => void) | null = null;

  run(doc: Document = document): void {
    if (!isPaperHost()) return;

    injectPaperBrandStyles(doc);

    const host = findLogoButton(doc);
    if (!host) return;
    if (host.getAttribute(HOST_MARKER_ATTR) === "1") return;

    // Span + role="button" instead of a nested <button> because the mark
    // lives inside paper.nu's logo <button> and nesting button-in-button
    // is invalid HTML. tabindex + keydown handlers cover keyboard access
    // (Enter / Space) like a real button would.
    const mark = el(
      doc,
      "span",
      {
        class: "bc-paper-brand-mark",
        attrs: {
          [MARK_MARKER_ATTR]: "1",
          role: "button",
          tabindex: "0",
          "aria-label": "About pencil.nu",
          title: "About pencil.nu"
        },
        // stopPropagation + preventDefault on click so paper.nu's React
        // handler on the parent logo button doesn't ALSO fire and open
        // its own About modal underneath ours.
        on: {
          click: (event) => {
            event.stopPropagation();
            event.preventDefault();
            this.openModal(doc);
          },
          keydown: (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.stopPropagation();
            event.preventDefault();
            this.openModal(doc);
          }
        }
      },
      [
        el(doc, "span", {
          class: "bc-paper-brand-mark__text",
          text: "and pencil"
        }),
        el(doc, "span", {
          class: "bc-paper-brand-mark__icon",
          html: PENCIL_SVG_MARKUP
        })
      ]
    );

    host.appendChild(mark);
    host.setAttribute(HOST_MARKER_ATTR, "1");
  }

  cleanup(doc: Document = document): void {
    this.closeModal();
    doc.getElementById(MODAL_ID)?.remove();
    for (const mark of Array.from(
      doc.querySelectorAll<HTMLElement>(`[${MARK_MARKER_ATTR}]`)
    )) {
      mark.remove();
    }
    for (const host of Array.from(
      doc.querySelectorAll<HTMLElement>(`[${HOST_MARKER_ATTR}]`)
    )) {
      host.removeAttribute(HOST_MARKER_ATTR);
    }
    removePaperBrandStyles(doc);
  }

  private openModal(doc: Document): void {
    if (this.modal) return;
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      this.closeModal();
    };
    doc.addEventListener("keydown", onKeydown);
    this.modalDoc = doc;
    this.modalKeydown = onKeydown;
    this.modal = openAboutModal(doc, () => this.closeModal());
  }

  private closeModal(): void {
    if (this.modalKeydown && this.modalDoc) {
      this.modalDoc.removeEventListener("keydown", this.modalKeydown);
    }
    this.modalKeydown = null;
    this.modalDoc = null;
    this.modal?.destroy();
    this.modal = null;
  }
}
