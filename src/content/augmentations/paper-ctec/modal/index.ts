import { ANALYTICS_MODAL_ID } from "../constants";
import type { ModalDisplayData } from "../modal-data";
import { preventAndStop, stopPropagation } from "../ui-shared";
import { disposeTrendChartObserver } from "./charts";
import { renderComments } from "./comments";
import { renderHeader } from "./header";
import { renderOverview } from "./overview";
import { renderTerms } from "./terms";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState
} from "./types";

export function renderAnalyticsModal(
  doc: Document,
  input: AnalyticsModalInput,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): void {
  let modal = doc.getElementById(ANALYTICS_MODAL_ID) as HTMLDivElement | null;
  if (!modal) {
    modal = doc.createElement("div");
    modal.id = ANALYTICS_MODAL_ID;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    (doc.body ?? doc.documentElement).appendChild(modal);
  }
  syncPaperNuDarkMode(doc, modal);

  modal.onclick = (event) => {
    if (event.target !== modal) return;
    preventAndStop(event);
    callbacks.onClose();
  };

  if (!modal.dataset.bcPaperCtecEscBound) {
    doc.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const open = doc.getElementById(ANALYTICS_MODAL_ID);
      if (!open) return;
      callbacks.onClose();
    });
    modal.dataset.bcPaperCtecEscBound = "1";
  }

  const signature = buildSignature(input, state);
  if (modal.dataset.bcPaperCtecSignature === signature) return;

  modal.replaceChildren();

  const card = doc.createElement("div");
  card.className = "bc-paper-ctec-modal-card";
  card.addEventListener("click", stopPropagation);

  card.append(renderHeader(doc, input, state, callbacks));

  if (input.data) {
    card.append(renderBody(doc, input.data, state, callbacks));
  } else {
    card.append(renderStatusBody(doc, input, callbacks));
  }

  modal.append(card);
  modal.dataset.bcPaperCtecSignature = signature;
}

export function hideAnalyticsModal(doc: Document): void {
  doc.getElementById(ANALYTICS_MODAL_ID)?.remove();
  disposeTrendChartObserver();
  disposeDarkObserver();
}

// paper.nu applies its `.dark` class to a div inside the React tree, but
// our modal is appended to document.body — outside that ancestor — so
// `.dark .bc-paper-ctec-modal-*` rules never match. Mirror paper.nu's dark
// state onto the modal element itself, and observe DOM mutations so the
// modal updates live when the user toggles the setting.
let darkObserver: MutationObserver | null = null;

function syncPaperNuDarkMode(doc: Document, modal: HTMLElement): void {
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
}

function disposeDarkObserver(): void {
  darkObserver?.disconnect();
  darkObserver = null;
}

export function readModalCommentsQuery(doc: Document): string | null {
  const input = doc.querySelector<HTMLInputElement>(
    `#${ANALYTICS_MODAL_ID} input[data-bc-paper-ctec-modal-search="1"]`
  );
  return input?.value ?? null;
}

// Renders a centered status callout when there's no loaded data yet — auth
// required, error, loading, or not-found. Replaces the rich body with a
// single message + (optionally) an action button. Identity in the header
// is still drawn from input.identity so the user knows what course they
// were looking at while the data fetches.
function renderStatusBody(
  doc: Document,
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-status-body";

  const card = doc.createElement("div");
  card.className = "bc-paper-ctec-modal-status-card";

  if (input.authUrl) {
    card.classList.add("is-warn");
    const title = doc.createElement("h3");
    title.className = "bc-paper-ctec-modal-status-title";
    title.textContent = input.awaitingAuth
      ? "Waiting for Northwestern login…"
      : "Northwestern login required";
    card.append(title);

    const body = doc.createElement("p");
    body.className = "bc-paper-ctec-modal-status-text";
    body.textContent = input.awaitingAuth
      ? "Finish signing in on the Northwestern tab. CTEC reports will load automatically once you're back."
      : "Better CAESAR needs a CAESAR login to load the CTEC reports for this course.";
    card.append(body);

    const action = doc.createElement("button");
    action.type = "button";
    action.className = "bc-paper-ctec-modal-status-primary";
    action.textContent = input.awaitingAuth ? "Reopen login" : "Open Northwestern login";
    action.addEventListener("click", (event) => {
      preventAndStop(event);
      callbacks.onLogin();
    });
    card.append(action);
  } else if (input.errorMessage) {
    card.classList.add("is-warn");
    const title = doc.createElement("h3");
    title.className = "bc-paper-ctec-modal-status-title";
    title.textContent = "Couldn't load CTEC reports";
    card.append(title);

    const body = doc.createElement("p");
    body.className = "bc-paper-ctec-modal-status-text";
    body.textContent = input.errorMessage;
    card.append(body);
  } else if (input.notFound) {
    const title = doc.createElement("h3");
    title.className = "bc-paper-ctec-modal-status-title";
    title.textContent = "No CTEC reports found";
    card.append(title);

    const body = doc.createElement("p");
    body.className = "bc-paper-ctec-modal-status-text";
    body.textContent =
      "We couldn't find any published CTEC evaluations for this section.";
    card.append(body);
  } else if (input.loading) {
    const spinner = doc.createElement("div");
    spinner.className = "bc-paper-ctec-modal-status-spinner";
    card.append(spinner);

    const title = doc.createElement("h3");
    title.className = "bc-paper-ctec-modal-status-title";
    title.textContent = "Loading CTEC reports…";
    card.append(title);

    const body = doc.createElement("p");
    body.className = "bc-paper-ctec-modal-status-text";
    body.textContent = `Pulling the most recent ${input.loadMoreBatchSize} term${
      input.loadMoreBatchSize === 1 ? "" : "s"
    } from Northwestern.`;
    card.append(body);
  } else {
    // Idle, no data — usually means the user opened the modal without
    // having loaded anything yet. Offer the load CTA explicitly.
    const title = doc.createElement("h3");
    title.className = "bc-paper-ctec-modal-status-title";
    title.textContent = "No CTEC reports loaded yet";
    card.append(title);

    const body = doc.createElement("p");
    body.className = "bc-paper-ctec-modal-status-text";
    body.textContent =
      "CTEC term reports load on demand to keep traffic on Northwestern's servers low.";
    card.append(body);

    const action = doc.createElement("button");
    action.type = "button";
    action.className = "bc-paper-ctec-modal-status-primary";
    action.textContent = `Load ${input.loadMoreBatchSize} most recent term${
      input.loadMoreBatchSize === 1 ? "" : "s"
    }`;
    action.addEventListener("click", (event) => {
      preventAndStop(event);
      callbacks.onLoadMore();
    });
    card.append(action);
  }

  wrapper.append(card);
  return wrapper;
}

// Tab switcher. Order matches the header tab order: overview → comments →
// terms. Body wrapper carries .bc-paper-ctec-modal-body so charts/tabs can
// scroll independently of the header.
function renderBody(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const body = doc.createElement("div");
  body.className = "bc-paper-ctec-modal-body";

  if (state.tab === "overview") body.append(renderOverview(doc, data, state, callbacks));
  else if (state.tab === "comments") body.append(renderComments(doc, data, state, callbacks));
  else body.append(renderTerms(doc, data, state, callbacks));

  return body;
}

// Big concatenation of every input + state field that should trigger a
// re-render. Cheaper than diffing — modal already debounces re-renders to
// changes only. Keep all relevant fields here; missing one means stale UI.
function buildSignature(
  input: AnalyticsModalInput,
  state: AnalyticsModalState
): string {
  const data = input.data;
  return [
    state.tab,
    state.activeMetric,
    state.selectedTermId ?? "",
    state.commentsSentimentFilter,
    state.commentsActiveTopic ?? "",
    state.commentsTermFilter,
    state.commentsSortBy,
    state.heatmapExpanded ? "1" : "0",
    input.identity.subject,
    input.identity.catalog,
    input.identity.title,
    input.identity.instructor,
    input.loading ? "1" : "0",
    input.authUrl ?? "",
    input.awaitingAuth ? "1" : "0",
    input.errorMessage ?? "",
    input.notFound ? "1" : "0",
    input.canRefresh ? "1" : "0",
    input.canLoadMore ? "1" : "0",
    input.backgroundRefreshing ? "1" : "0",
    input.refreshFlash ? `${input.refreshFlash.kind}:${"addedCount" in input.refreshFlash ? input.refreshFlash.addedCount : input.refreshFlash.kind === "error" ? input.refreshFlash.message : ""}` : "",
    input.remainingTerms,
    input.parsedTermCount,
    data?.terms.map((term) => `${term.id}:${term.responses}`).join("|") ?? "",
    data?.comments.length ?? 0,
    data?.topics.map((t) => `${t.label}=${t.count}`).join(",") ?? ""
  ].join("||");
}
