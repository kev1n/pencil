import { CAESAR_HOSTNAME } from "../../../shared/nu-hosts";
import { el, ensureStyle, type Augmentation } from "../../framework";
import { readBookmarks, type Bookmark } from "./destinations";
import { STYLE_ID, styles } from "./styles";

const BOOKMARKS_ID = "bc-caesar-bookmarks";
const BANNER_SLOT = '[id$="hdrdivPT_CUSTOM_RIGHT"]';
const TRANSACTION_TITLE = '[id$="divDERIVED_REGFRM1_SS_TRANSACT_TITLE"]';
const APP_PATH = /^\/ps[cp]\/csnu(?:_\d+)?\/EMPLOYEE\/SA(?:\/|$)/i;

function createBookmark(doc: Document, bookmark: Bookmark): HTMLElement {
  const label = bookmark.shortLabel ?? bookmark.label;
  const attrs = { title: bookmark.label, "aria-label": bookmark.label };
  if (!bookmark.href) {
    return el(doc, "button", {
      text: label,
      attrs: { ...attrs, type: "button" },
      on: { click: bookmark.navigate }
    });
  }

  return el(doc, "a", {
    text: label,
    attrs: { ...attrs, href: bookmark.href },
    on: {
      click: (event) => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        bookmark.navigate();
      }
    }
  });
}

export class CaesarBookmarksAugmentation implements Augmentation {
  // Keep the existing ID so the user's navigation preference carries over.
  readonly id = "caesar-go-to";
  private host?: Element;
  private bar?: HTMLElement;
  private bookmarkIds = "";

  run(doc: Document = document): void {
    const view = doc.defaultView;
    if (!view || view !== view.top || doc.location.hostname !== CAESAR_HOSTNAME ||
        !APP_PATH.test(doc.location.pathname)) {
      return;
    }

    const banner = doc.querySelector(BANNER_SLOT);
    const title = doc.querySelector(TRANSACTION_TITLE);
    const host = banner ?? doc.querySelector(".bc-cs-tabs") ?? title;
    if (!host) {
      if (this.bar) this.cleanup(doc);
      return;
    }

    const bookmarks = readBookmarks(doc);
    const bookmarkIds = bookmarks.map(({ id }) => id).join(" ");
    if (this.host === host && this.bar?.parentElement === host && this.bookmarkIds === bookmarkIds) {
      return;
    }

    this.cleanup(doc);
    ensureStyle(doc, STYLE_ID, styles);
    if (host === banner) host.setAttribute("data-bc-bookmark-slot", "");
    if (host === title) host.setAttribute("data-bc-bookmark-title", "");
    const bar = el(doc, "nav", {
      attrs: { id: BOOKMARKS_ID, "aria-label": "CAESAR bookmarks" },
      dataset: { banner: String(host === banner) }
    }, bookmarks.map((bookmark) => createBookmark(doc, bookmark)));
    host.append(bar);
    this.host = host;
    this.bar = bar;
    this.bookmarkIds = bookmarkIds;
  }

  cleanup(doc: Document = document): void {
    this.bar?.remove();
    this.host?.removeAttribute("data-bc-bookmark-title");
    this.host?.removeAttribute("data-bc-bookmark-slot");
    this.host = undefined;
    this.bar = undefined;
    this.bookmarkIds = "";
    doc.getElementById(STYLE_ID)?.remove();
  }
}

export const caesarBookmarksAugmentation = new CaesarBookmarksAugmentation();
