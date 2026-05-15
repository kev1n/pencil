import { el, injectModalStyles } from "../../framework";
import {
  JASON_LINKEDIN_URL,
  KEVIN_LINKEDIN_URL,
  LANDING_URL,
  MODAL_ID
} from "./constants";
import { PENCIL_SVG_MARKUP } from "./pencil-svg";
import { injectPaperBrandStyles } from "./styles";

export type AboutModalHandle = {
  destroy(): void;
};

// Mount the pencil.nu "About" dialog into `doc`. Idempotent — a second
// call while the modal is already mounted destroys the old one and
// returns a fresh handle. Reuses the framework's `bc-modal-*` chrome
// (backdrop, card, close) and the paper-brand stylesheet for the
// pencil-themed copy.
export function openAboutModal(
  doc: Document,
  onClose: () => void
): AboutModalHandle {
  injectModalStyles(doc);
  injectPaperBrandStyles(doc);

  const existing = doc.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const version = chrome.runtime.getManifest().version;

  const closeBtn = el(doc, "button", {
    class: "bc-modal-close",
    attrs: { type: "button", "aria-label": "Close" },
    text: "×",
    on: { click: () => onClose() }
  });

  const iconTile = el(doc, "div", {
    class: "bc-paper-brand-about-icon",
    html: PENCIL_SVG_MARKUP
  });

  const eyebrow = el(doc, "p", {
    class: "bc-paper-brand-about-eyebrow",
    text: "Browser extension"
  });

  const title = el(doc, "h2", {
    class: "bc-paper-brand-about-title",
    text: "pencil.nu"
  });

  const versionLine = el(doc, "p", {
    class: "bc-paper-brand-about-version",
    text: `version ${version}`
  });

  const lede = el(doc, "p", {
    class: "bc-paper-brand-about-lede",
    text: "A small layer of upgrades that sit on top of Paper.nu and CAESAR to make lives easier for Northwestern students :)"
  });

  // Names link out to LinkedIn but keep the credit line's handwriting
  // font and accent color (no blue underline, no default `a` styling).
  // The `.bc-paper-brand-about-credit-link` class wipes the browser
  // default and inherits font + color from the surrounding paragraph.
  const credit = el(doc, "p", { class: "bc-paper-brand-about-credit" }, [
    "designed and developed by ",
    el(doc, "a", {
      class: "bc-paper-brand-about-credit-link",
      attrs: {
        href: KEVIN_LINKEDIN_URL,
        target: "_blank",
        rel: "noopener noreferrer"
      }
    }, [el(doc, "strong", { text: "Kevin Wang" })]),
    " and ",
    el(doc, "a", {
      class: "bc-paper-brand-about-credit-link",
      attrs: {
        href: JASON_LINKEDIN_URL,
        target: "_blank",
        rel: "noopener noreferrer"
      }
    }, [el(doc, "strong", { text: "Jason Latz" })]),
    "."
  ]);

  const disclaimer = el(doc, "p", {
    class: "bc-paper-brand-about-disclaimer",
    text: "Not affiliated with Paper.nu, Northwestern University, or its IT department. Built independently as a free add-on."
  });

  const visitBtn = el(doc, "a", {
    class: "bc-btn bc-btn--primary bc-btn--soft bc-btn--fill bc-paper-brand-about-cta",
    attrs: {
      href: LANDING_URL,
      target: "_blank",
      rel: "noopener noreferrer"
    },
    text: "Learn More"
  });

  const card = el(
    doc,
    "div",
    {
      class: "bc-modal-card bc-paper-brand-about-card",
      on: { click: (event) => event.stopPropagation() }
    },
    [
      closeBtn,
      iconTile,
      eyebrow,
      title,
      versionLine,
      lede,
      credit,
      visitBtn,
      disclaimer
    ]
  );

  const backdrop = el(doc, "div", {
    class: "bc-modal",
    attrs: { id: MODAL_ID, role: "dialog", "aria-modal": "true" },
    on: { click: () => onClose() }
  });
  backdrop.appendChild(card);

  doc.body.appendChild(backdrop);

  return {
    destroy: () => {
      backdrop.remove();
    }
  };
}
