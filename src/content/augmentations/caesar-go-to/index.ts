import { CAESAR_HOSTNAME } from "../../../shared/nu-hosts";
import { el, ensureStyle, type Augmentation } from "../../framework";
import { readDestinations } from "./destinations";
import { createPalette, TRIGGER_ID } from "./palette";
import { STYLE_ID, styles } from "./styles";

const RIBBON_ID = "bc-caesar-go-to-ribbon";
const HEADER = "#PT_HEADER, #pthdr2container";
const PAGE_CONTENT = "#pt_pageinfo_win0, #ptifrmtgtframe, #win0divPSPAGECONTAINER";
const APP_PATH = /^\/ps[cp]\/csnu(?:_\d+)?\/EMPLOYEE\/SA(?:\/|$)/i;

function isShortcut(event: KeyboardEvent): boolean {
  return !event.defaultPrevented && !event.isComposing && !event.altKey && !event.shiftKey &&
    (event.metaKey !== event.ctrlKey) && event.key.toLowerCase() === "k";
}

export class CaesarGoToAugmentation implements Augmentation {
  readonly id = "caesar-go-to";
  private listeners: AbortController | undefined;
  private palette: ReturnType<typeof createPalette> | undefined;
  private ribbon: HTMLDivElement | undefined;

  run(doc: Document = document): void {
    const view = doc.defaultView;
    if (!view || doc.location.hostname !== CAESAR_HOSTNAME || !APP_PATH.test(doc.location.pathname)) {
      if (this.listeners) this.cleanup(doc);
      return;
    }

    if (view !== view.top) {
      // Keyboard events stay in the focused PeopleSoft frame. Use the top
      // document's launcher when both documents are on the CAESAR origin.
      if (!this.listeners) {
        this.listeners = new AbortController();
        view.addEventListener("keydown", (event) => {
          if (!isShortcut(event)) return;
          const parentDoc = view.frameElement?.ownerDocument;
          if (parentDoc?.defaultView !== view.top) return;
          const trigger = parentDoc.getElementById(TRIGGER_ID);
          if (!trigger) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!event.repeat) trigger.click();
        }, { capture: true, signal: this.listeners.signal });
      }
      return;
    }

    const header = doc.querySelector(HEADER);
    if (!doc.body || (!header && !doc.querySelector(PAGE_CONTENT))) {
      if (this.ribbon) this.cleanup(doc);
      return;
    }

    if (this.ribbon?.isConnected && this.palette?.dialog.isConnected) {
      if (header && header.nextElementSibling !== this.ribbon) header.after(this.ribbon);
      return;
    }
    this.cleanup(doc);
    ensureStyle(doc, STYLE_ID, styles);
    const palette = createPalette(doc, () => readDestinations(doc));
    const ribbon = el(doc, "div", { attrs: { id: RIBBON_ID } }, [palette.trigger]);
    if (header?.parentElement) header.after(ribbon);
    else doc.body.prepend(ribbon);
    doc.body.append(palette.dialog);
    this.palette = palette;
    this.ribbon = ribbon;

    this.listeners = new AbortController();
    view.addEventListener("pageshow", (event) => {
      if (event.persisted && palette.dialog.open) palette.dialog.close();
    }, { signal: this.listeners.signal });
    view.addEventListener("keydown", (event) => {
      if (!isShortcut(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) palette.toggle();
    }, { capture: true, signal: this.listeners.signal });
  }

  cleanup(doc: Document = document): void {
    this.listeners?.abort();
    this.listeners = undefined;
    if (this.palette?.dialog.open) this.palette.dialog.close();
    this.palette?.dialog.remove();
    this.palette = undefined;
    this.ribbon?.remove();
    this.ribbon = undefined;
    doc.getElementById(STYLE_ID)?.remove();
  }
}

export const caesarGoToAugmentation = new CaesarGoToAugmentation();
