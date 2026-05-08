// Confirmation modal shown before launching the Northwestern SSO popup
// tab. Concurrent calls coalesce onto a single in-flight promise so
// racing chip clicks share one dialog.

import { html, render } from "lit-html";

import { ensureStyle, el } from "../framework/dom";
import { injectModalStyles } from "../framework/modal";
import { iconTemplate } from "../augmentations/paper-ctec/ui-shared";
import {
  BLUERA_HOSTNAME,
  CAESAR_HOSTNAME,
  safeHostname
} from "../../shared/nu-hosts";

const MODAL_ID = "bc-login-prompt-modal";
const STYLE_ID = "bc-login-prompt-style";

let inFlight: Promise<boolean> | null = null;

// Hostname → user-facing service name. Drives the modal's title, body,
// and primary-button copy so the user knows whether they're being asked
// to sign into CAESAR (the registration system) or CTECs (the
// evaluations system, served by Bluera). Generic "Northwestern" is the
// fallback for anything else still gated by NetID SSO.
type LoginTarget = {
  service: string;        // "CAESAR" | "CTECs" | "Northwestern"
  whatWeNeed: string;     // body fragment after "pencil.nu needs a"
  buttonLabel: string;    // primary CTA
  noteSubject: string;    // possessive used in the "you'll need to repeat" note
};

function detectLoginTarget(loginUrl: string | undefined): LoginTarget {
  const host = safeHostname(loginUrl);

  if (host === BLUERA_HOSTNAME) {
    return {
      service: "CTECs",
      whatWeNeed: "CTECs login to read evaluation reports on your behalf",
      buttonLabel: "Open CTECs login",
      noteSubject: "CTECs"
    };
  }

  // CAESAR is the first SSO gate — opening it refreshes the IdP cookie
  // that downstream services share.
  if (host === CAESAR_HOSTNAME) {
    return {
      service: "CAESAR",
      whatWeNeed: "CAESAR login so it can act on your behalf",
      buttonLabel: "Open CAESAR login",
      noteSubject: "CAESAR"
    };
  }

  return {
    service: "Northwestern",
    whatWeNeed: "Northwestern login to continue",
    buttonLabel: "Open Northwestern login",
    noteSubject: "Northwestern"
  };
}

// Returns true when the user clicks the primary action, false on
// dismiss / Cancel / backdrop click. Idempotent: a second call while a
// modal is already open returns the same promise.
export function confirmLoginPrompt(
  loginUrl?: string,
  doc: Document = document
): Promise<boolean> {
  if (inFlight) return inFlight;
  const target = detectLoginTarget(loginUrl);
  inFlight = renderModal(doc, target).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function renderModal(doc: Document, target: LoginTarget): Promise<boolean> {
  injectModalStyles(doc);
  ensureStyle(doc, STYLE_ID, EXTRA_CSS);

  const root = doc.getElementById(MODAL_ID) ?? el(doc, "div", {
    attrs: {
      id: MODAL_ID,
      class: "bc-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": `${MODAL_ID}-title`
    }
  });
  if (!root.parentElement) {
    (doc.body ?? doc.documentElement).appendChild(root);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      doc.removeEventListener("keydown", onKey, true);
      root.remove();
      resolve(value);
    };

    root.onclick = (event) => {
      if (event.target !== root) return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };

    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finish(false);
    };
    doc.addEventListener("keydown", onKey, true);

    render(
      html`<div
        class="bc-modal-card"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <button
          type="button"
          class="bc-modal-close"
          aria-label="Dismiss login prompt"
          @click=${(event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            finish(false);
          }}
        >×</button>
        <div class="bc-modal-icon">${iconTemplate("lock")}</div>
        <h2 id=${`${MODAL_ID}-title`} class="bc-modal-title">
          ${target.service} login required
        </h2>
        <p class="bc-modal-body">
          pencil.nu needs a ${target.whatWeNeed}.
          <strong>It opens a new tab to Northwestern's login page so you can
          authorize access.</strong>
        </p>
        <p class="bc-modal-note">
          You'll need to repeat this any time ${target.noteSubject} signs you
          out (typically every few hours).
        </p>
        <p class="bc-modal-trust">
          pencil.nu is open source. If you'd like, you may review the code at
          <a
            class="bc-modal-link"
            href="https://github.com/kev1n/pencil"
            target="_blank"
            rel="noopener noreferrer"
            @click=${(event: Event) => event.stopPropagation()}
            >github.com/kev1n/pencil</a
          >.
        </p>
        <div class="bc-modal-actions">
          <button
            type="button"
            class="bc-btn bc-btn--primary bc-btn--soft bc-btn--fill"
            @click=${(event: Event) => {
              event.preventDefault();
              event.stopPropagation();
              finish(true);
            }}
          >${target.buttonLabel}</button>
          <button
            type="button"
            class="bc-btn bc-btn--secondary-accent"
            @click=${(event: Event) => {
              event.preventDefault();
              event.stopPropagation();
              finish(false);
            }}
          >Not now</button>
        </div>
      </div>`,
      root
    );
  });
}

// Anchor the modal above the access-gate banner / paper.nu's own React
// portals; bc-modal already z-indexes very high but doesn't pin pointer
// events on the strong tag that wraps the body emphasis.
const EXTRA_CSS = `
  #${MODAL_ID} .bc-modal-body strong {
    color: var(--bc-color-accent-soft);
    font-weight: var(--bc-fw-bold);
  }
`;
