import { CAESAR_HOSTNAME } from "../../../shared/nu-hosts";
import { PENCIL_SVG_MARKUP } from "../../design/pencil-svg";
import { el, ensureStyle, type Augmentation } from "../../framework";
import { openAboutModal, type AboutModalHandle } from "../paper-brand/modal";
import { removePaperBrandStyles } from "../paper-brand/styles";
import { createEnrollmentDatesPopover } from "../../enrollment-dates/popover";
import { readBookmarks, type Bookmark } from "./destinations";
import { STYLE_ID, styles } from "./styles";

const BOOKMARKS_ID = "bc-caesar-bookmarks";
const HEADER_ID = "bc-caesar-header";
const DATES_ID = "bc-caesar-enrollment-dates";
const BANNER_SLOT = '[id$="hdrdivPT_CUSTOM_RIGHT"], #pthdr2navbarlinks';
const STANDALONE_PAGE = 'form#SSR_SSENRL_CART, form#SSR_SSENRL_APPT, form#CLASS_SEARCH, form#SSR_CRSE_HIST_FL, [id$="divDERIVED_REGFRM1_SS_TRANSACT_TITLE"]';
const APP_PATH = /^\/ps[cp]\/csnu(?:_\d+)?\/EMPLOYEE\/SA(?:\/|$)/i;

function createBookmark(doc: Document, bookmark: Bookmark): HTMLElement {
  const label = bookmark.shortLabel ?? bookmark.label;
  const attrs = { title: bookmark.label, "aria-label": bookmark.label };
  if (bookmark.id === "appointment") {
    return el(doc, "button", {
      text: label,
      attrs: { ...attrs, type: "button", popovertarget: DATES_ID }
    });
  }
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
  private header?: HTMLElement;
  private logo?: HTMLElement;
  private logoHost?: Element;
  private popover?: HTMLElement;
  private aboutModal?: AboutModalHandle;
  private bookmarkIds = "";

  run(doc: Document = document): void {
    const view = doc.defaultView;
    if (!view || doc.location.hostname !== CAESAR_HOSTNAME ||
        !APP_PATH.test(doc.location.pathname)) {
      return;
    }

    const standalone = doc.querySelector(STANDALONE_PAGE);
    if (view !== view.top) {
      if (standalone) ensureStyle(doc, STYLE_ID, styles);
      return;
    }
    const banner = doc.querySelector(BANNER_SLOT);
    const host = banner ?? (standalone || doc.querySelector('form[name="win0"]') ? doc.body : null);
    if (!host) {
      if (this.bar) this.cleanup(doc);
      return;
    }

    const routes = readBookmarks(doc);
    const bookmarks = routes.filter(({ id }) => id !== "home");
    const bookmarkIds = bookmarks.map(({ id }) => id).join(" ");
    const logoHost = banner ? doc.getElementById("classicbackbuttoncontainer") : null;
    if (this.host === host && (this.header ?? this.bar)?.parentElement === host &&
        this.bookmarkIds === bookmarkIds && (!logoHost || this.logo?.parentElement === logoHost)) {
      return;
    }

    this.cleanup(doc);
    ensureStyle(doc, STYLE_ID, styles);
    if (host === banner) host.setAttribute("data-bc-bookmark-slot", "");
    const bar = el(doc, "nav", {
      attrs: { id: BOOKMARKS_ID, "aria-label": "CAESAR bookmarks" },
      dataset: { banner: String(host === banner) }
    }, [
      el(doc, "button", {
        class: "bc-caesar-bookmarks-brand",
        attrs: { type: "button", "aria-label": "About pencil.nu", title: "About pencil.nu" },
        on: {
          click: () => this.openAboutModal(doc),
          keydown: (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            // PeopleSoft handles Enter globally as a form submission.
            event.preventDefault();
            event.stopPropagation();
            this.openAboutModal(doc);
          }
        }
      }, [
        el(doc, "span", { class: "bc-caesar-bookmarks-icon", html: PENCIL_SVG_MARKUP }),
        el(doc, "span", { class: "bc-caesar-bookmarks-credit", text: "by Pencil" })
      ]),
      ...bookmarks.map((bookmark) => createBookmark(doc, bookmark))
    ]);
    const home = routes.find(({ id }) => id === "home")!;
    const createLogo = (): HTMLElement => {
      const logo = createBookmark(doc, { ...home, shortLabel: "CAESAR" });
      logo.className = "bc-caesar-home-logo";
      return logo;
    };
    if (host === banner) {
      host.prepend(bar);
      // The classic portal shell has native controls but no CAESAR
      // branding. Keep its Back, Home and Actions controls in place.
      if (logoHost) {
        this.logo = createLogo();
        this.logoHost = logoHost;
        logoHost.setAttribute("data-bc-caesar-logo-slot", "");
        logoHost.prepend(this.logo);
      }
    } else {
      this.header = el(doc, "header", { attrs: { id: HEADER_ID } }, [createLogo(), bar]);
      host.prepend(this.header);
    }
    const popover = createEnrollmentDatesPopover(doc, {
      id: DATES_ID,
      trigger: bar.querySelector(`[popovertarget="${DATES_ID}"]`)!
    });
    doc.body.append(popover);
    this.host = host;
    this.bar = bar;
    this.popover = popover;
    this.bookmarkIds = bookmarkIds;
  }

  cleanup(doc: Document = document): void {
    this.closeAboutModal();
    removePaperBrandStyles(doc);
    this.bar?.remove();
    this.header?.remove();
    this.logo?.remove();
    this.logoHost?.removeAttribute("data-bc-caesar-logo-slot");
    this.popover?.remove();
    this.host?.removeAttribute("data-bc-bookmark-slot");
    this.host = undefined;
    this.bar = undefined;
    this.header = undefined;
    this.logo = undefined;
    this.logoHost = undefined;
    this.popover = undefined;
    this.bookmarkIds = "";
    doc.getElementById(STYLE_ID)?.remove();
  }

  private openAboutModal(doc: Document): void {
    this.aboutModal ??= openAboutModal(doc, () => this.closeAboutModal());
  }

  private closeAboutModal(): void {
    this.aboutModal?.destroy();
    this.aboutModal = undefined;
  }
}

export const caesarBookmarksAugmentation = new CaesarBookmarksAugmentation();
