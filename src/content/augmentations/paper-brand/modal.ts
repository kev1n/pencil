import { el, injectModalStyles } from "../../framework";
import {
  FEEDBACK_URL,
  JASON_LINKEDIN_URL,
  KEVIN_LINKEDIN_URL,
  LANDING_URL,
  MODAL_ID
} from "./constants";
import { PENCIL_SVG_MARKUP } from "../../design/pencil-svg";
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

  const title = el(doc, "h2", {
    class: "bc-paper-brand-about-title",
    text: "pencil.nu"
  });

  const versionLine = el(doc, "p", {
    class: "bc-paper-brand-about-version",
    text: `Version ${version}`
  });

  const header = el(doc, "div", { class: "bc-paper-brand-about-header" }, [
    iconTile,
    el(doc, "div", {}, [title, versionLine])
  ]);

  const lede = el(doc, "p", {
    class: "bc-paper-brand-about-lede",
    text: "A small layer of upgrades on top of Paper.nu and CAESAR, to make registration easier for Northwestern students."
  });

  // Names link out to LinkedIn.
  const credit = el(doc, "p", { class: "bc-paper-brand-about-credit" }, [
    "Designed and developed by ",
    el(doc, "a", {
      class: "bc-paper-brand-about-credit-link",
      attrs: {
        href: KEVIN_LINKEDIN_URL,
        target: "_blank",
        rel: "noopener noreferrer"
      },
      text: "Kevin Wang"
    }),
    " and ",
    el(doc, "a", {
      class: "bc-paper-brand-about-credit-link",
      attrs: {
        href: JASON_LINKEDIN_URL,
        target: "_blank",
        rel: "noopener noreferrer"
      },
      text: "Jason Latz"
    }),
    "."
  ]);

  const disclaimer = el(doc, "p", {
    class: "bc-paper-brand-about-disclaimer",
    text: "Not affiliated with Paper.nu, Northwestern University, or its IT department. Built independently as a free add-on."
  });

  const visitBtn = el(doc, "a", {
    class: "bc-btn bc-btn--primary bc-btn--soft bc-paper-brand-about-cta",
    attrs: {
      href: LANDING_URL,
      target: "_blank",
      rel: "noopener noreferrer"
    },
    text: "Learn more"
  });

  const feedbackBtn = el(doc, "a", {
    class: "bc-btn bc-btn--secondary bc-paper-brand-about-cta",
    attrs: {
      href: FEEDBACK_URL,
      target: "_blank",
      rel: "noopener noreferrer"
    },
    text: "Leave feedback"
  });

  const actions = el(doc, "div", {
    class: "bc-modal-actions"
  }, [visitBtn, feedbackBtn]);

  const card = el(
    doc,
    "div",
    {
      class: "bc-modal-card bc-paper-brand-about-card",
      on: { click: (event) => event.stopPropagation() }
    },
    [
      closeBtn,
      header,
      lede,
      credit,
      disclaimer,
      actions
    ]
  );

  const backdrop = el(doc, "div", {
    class: "bc-modal",
    attrs: { id: MODAL_ID, role: "dialog", "aria-modal": "true" },
    on: { click: () => onClose() }
  });
  backdrop.appendChild(card);

  doc.body.appendChild(backdrop);
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };
  doc.addEventListener("keydown", onKeydown, true);

  return {
    destroy: () => {
      doc.removeEventListener("keydown", onKeydown, true);
      backdrop.remove();
    }
  };
}
