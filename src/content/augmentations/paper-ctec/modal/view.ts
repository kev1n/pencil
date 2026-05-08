import { html, render, type TemplateResult } from "lit-html";

import { ANALYTICS_MODAL_ID } from "../constants";
import { preventAndStop, stopPropagation } from "../ui-shared";
import { disposeTrendChartObserver } from "./charts";
import { CommentsSection } from "./comments";
import { HeaderSection } from "./header";
import { OverviewSection } from "./overview";
import { TermsSection } from "./terms";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState
} from "./types";

// Modal orchestrator. Owns the root <div id="bc-paper-ctec-modal"> element,
// the lit-html render lifecycle, ESC-key handling, and the dark-mode mirror
// observer. Tab dispatch is centralized here so each section receives only
// the props it needs.
//
// lit-html does its own template-result diffing across renders, so the
// dataset.bcPaperCtecSignature short-circuit the legacy renderer used has
// been removed: every callsite invokes view.open() and lit-html minimizes
// the actual DOM mutations.
export interface ModalView {
  open(
    input: AnalyticsModalInput,
    state: AnalyticsModalState,
    callbacks: AnalyticsModalCallbacks
  ): void;
  close(): void;
  isOpen(): boolean;
}

export interface ModalViewDeps {
  doc: Document;
}

export function createModalView(deps: ModalViewDeps): ModalView {
  const { doc } = deps;
  let escKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  let darkObserver: MutationObserver | null = null;
  let modalEl: HTMLElement | null = null;

  const ensureRoot = (): HTMLElement => {
    let modal = doc.getElementById(ANALYTICS_MODAL_ID) as HTMLDivElement | null;
    if (!modal) {
      modal = doc.createElement("div");
      modal.id = ANALYTICS_MODAL_ID;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      (doc.body ?? doc.documentElement).appendChild(modal);
    }
    return modal;
  };

  // paper.nu applies its `.dark` class to a div inside the React tree, but
  // our modal is appended to document.body — outside that ancestor — so
  // `.dark .bc-paper-ctec-modal-*` rules never match. Mirror paper.nu's dark
  // state onto the modal element itself, and observe DOM mutations so the
  // modal updates live when the user toggles the setting.
  const syncDarkMode = (modal: HTMLElement): void => {
    const apply = () => {
      modal.classList.toggle("dark", !!doc.querySelector(".dark"));
    };
    apply();
    if (!darkObserver && typeof MutationObserver !== "undefined") {
      darkObserver = new MutationObserver(apply);
      darkObserver.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: true
      });
    }
  };

  return {
    open(input, state, callbacks) {
      const modal = ensureRoot();
      modalEl = modal;
      syncDarkMode(modal);

      // Backdrop click → close. Re-bound on every render via lit-html's
      // event syntax through the inner card stopPropagation guard.
      modal.onclick = (event) => {
        if (event.target !== modal) return;
        preventAndStop(event);
        callbacks.onClose();
      };

      if (escKeydownHandler) {
        doc.removeEventListener("keydown", escKeydownHandler);
      }
      escKeydownHandler = (event) => {
        if (event.key !== "Escape") return;
        if (!doc.getElementById(ANALYTICS_MODAL_ID)) return;
        callbacks.onClose();
      };
      doc.addEventListener("keydown", escKeydownHandler);

      render(buildTemplate(doc, input, state, callbacks), modal);
    },
    close() {
      doc.getElementById(ANALYTICS_MODAL_ID)?.remove();
      modalEl = null;
      if (escKeydownHandler) {
        doc.removeEventListener("keydown", escKeydownHandler);
        escKeydownHandler = null;
      }
      disposeTrendChartObserver();
      darkObserver?.disconnect();
      darkObserver = null;
    },
    isOpen() {
      return !!modalEl && !!doc.getElementById(ANALYTICS_MODAL_ID);
    }
  };
}

function buildTemplate(
  doc: Document,
  input: AnalyticsModalInput,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-card" @click=${stopPropagation}>
    ${HeaderSection.render({ doc, input, state, callbacks })}
    ${input.data
      ? renderBody(doc, input.data, state, callbacks)
      : renderStatusBody(input, callbacks)}
  </div>`;
}

// Tab dispatcher. Order matches the header tab order: overview → comments →
// terms. Body wrapper carries .bc-paper-ctec-modal-body so charts/tabs can
// scroll independently of the header.
function renderBody(
  doc: Document,
  data: NonNullable<AnalyticsModalInput["data"]>,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-body">
    ${state.tab === "overview"
      ? OverviewSection.render({ doc, data, state, callbacks })
      : state.tab === "comments"
        ? CommentsSection.render({ doc, data, state, callbacks })
        : TermsSection.render({ doc, data, state, callbacks })}
  </div>`;
}

// Centered status callout when there's no loaded data yet — error, loading,
// or not-found. Replaces the rich body with a single message + (optionally)
// an action button. Identity in the header is still drawn from
// input.identity so the user knows what course they were looking at while
// the data fetches.
function renderStatusBody(
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const inner = (() => {
    if (input.errorMessage) {
      return html`<h3 class="bc-paper-ctec-modal-status-title">
          Couldn't load CTEC reports
        </h3>
        <p class="bc-paper-ctec-modal-status-text">${input.errorMessage}</p>
        ${input.canRefresh
          ? html`<button
              type="button"
              class="bc-btn bc-btn--primary bc-btn--pill"
              ?disabled=${input.backgroundRefreshing}
              @click=${(event: Event) => {
                preventAndStop(event);
                if (input.backgroundRefreshing) return;
                callbacks.onRefresh();
              }}
            >${input.backgroundRefreshing ? "Retrying…" : "Try again"}</button>`
          : ""}`;
    }

    if (input.notFound) {
      return html`<h3 class="bc-paper-ctec-modal-status-title">
          No CTEC reports found
        </h3>
        <p class="bc-paper-ctec-modal-status-text">
          We couldn't find any published CTEC evaluations for this section.
        </p>`;
    }

    if (input.loading) {
      return html`<div class="bc-paper-ctec-modal-status-spinner"></div>
        <h3 class="bc-paper-ctec-modal-status-title">Loading CTEC reports…</h3>
        <p class="bc-paper-ctec-modal-status-text">
          Pulling the most recent ${input.loadMoreBatchSize} term${input.loadMoreBatchSize === 1 ? "" : "s"} from Northwestern.
        </p>`;
    }

    return "";
  })();

  const cardCls = input.errorMessage
    ? "bc-paper-ctec-modal-status-card is-warn"
    : "bc-paper-ctec-modal-status-card";

  return html`<div class="bc-paper-ctec-modal-status-body">
    <div class=${cardCls}>${inner}</div>
  </div>`;
}
