// Confirmation modal shown before launching the Northwestern SSO popup
// tab. Concurrent calls coalesce onto a single in-flight promise so
// racing chip clicks share one dialog.

import { html, render } from "lit-html";

import { el } from "../framework/dom";
import { injectModalStyles } from "../framework/modal";
import {
  CAESAR_HOSTNAME,
  isBlueraHost,
  safeHostname
} from "../../shared/nu-hosts";

const MODAL_ID = "bc-login-prompt-modal";

let inFlight: Promise<boolean> | null = null;

// Hostname → user-facing service name. Drives the modal's title, body,
// and primary-button copy so the user knows whether they're being asked
// to sign into CAESAR (the registration system) or CTECs (the
// evaluations system, served by Bluera). Generic "Northwestern" is the
// fallback for anything else still gated by NetID SSO.
type LoginTarget = {
  service: string;        // "CAESAR" | "CTECs" | "Northwestern"
  why: string;            // one sentence on what the login is for
  buttonLabel: string;    // primary CTA
};

function detectLoginTarget(loginUrl: string | undefined): LoginTarget {
  const host = safeHostname(loginUrl);

  if (isBlueraHost(loginUrl)) {
    return {
      service: "CTECs",
      why: "Pencil reads evaluation reports through your own Northwestern login.",
      buttonLabel: "Open CTECs login"
    };
  }

  // CAESAR is the first SSO gate — opening it refreshes the IdP cookie
  // that downstream services share.
  if (host === CAESAR_HOSTNAME) {
    return {
      service: "CAESAR",
      why: "Pencil works through your own CAESAR session.",
      buttonLabel: "Open CAESAR login"
    };
  }

  return {
    service: "Northwestern",
    why: "Pencil needs your Northwestern login to continue.",
    buttonLabel: "Open Northwestern login"
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
        <h2 id=${`${MODAL_ID}-title`} class="bc-modal-title">
          Sign in to ${target.service}
        </h2>
        <p class="bc-modal-body">
          ${target.why} The login page opens in a new tab.
        </p>
        <p class="bc-modal-note">
          Your password goes to Northwestern, never to Pencil.
          ${target.service} signs you out every few hours, so you'll see this
          again.
          <a
            class="bc-modal-link"
            href="https://github.com/kev1n/pencil"
            target="_blank"
            rel="noopener noreferrer"
            @click=${(event: Event) => event.stopPropagation()}
            >View the source</a
          >.
        </p>
        <div class="bc-modal-actions">
          <button
            type="button"
            class="bc-btn bc-btn--primary bc-btn--soft"
            @click=${(event: Event) => {
              event.preventDefault();
              event.stopPropagation();
              finish(true);
            }}
          >${target.buttonLabel}</button>
          <button
            type="button"
            class="bc-btn bc-btn--secondary"
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
