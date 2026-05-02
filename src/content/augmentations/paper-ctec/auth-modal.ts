import { AUTH_MODAL_ID } from "./constants";
import { createIcon, preventAndStop, stopPropagation } from "./ui-shared";

type AuthModalCallbacks = {
  onLogin: () => void;
  onDismiss: () => void;
  onCancelPending: () => void;
};

type AuthModalData = {
  loginUrl?: string;
  awaitingAuthRetry: boolean;
  pending: boolean;
};

export function renderAuthModal(
  doc: Document,
  data: AuthModalData,
  callbacks: AuthModalCallbacks
): void {
  let modal = doc.getElementById(AUTH_MODAL_ID) as HTMLDivElement | null;
  if (!modal) {
    modal = doc.createElement("div");
    modal.id = AUTH_MODAL_ID;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", `${AUTH_MODAL_ID}-title`);
    (doc.body ?? doc.documentElement).appendChild(modal);
  }

  const dismissAction = data.pending ? callbacks.onCancelPending : callbacks.onDismiss;

  modal.onclick = (event) => {
    if (event.target !== modal) return;
    preventAndStop(event);
    dismissAction();
  };

  const signature = `${data.loginUrl ?? ""}|${data.awaitingAuthRetry ? "1" : "0"}|${data.pending ? "P" : "N"}`;
  if (modal.dataset.bcPaperCtecSignature === signature) return;

  modal.replaceChildren();

  const card = doc.createElement("div");
  card.className = "bc-paper-ctec-auth-card";
  card.addEventListener("click", stopPropagation);

  card.append(makeCloseButton(doc, data.pending, dismissAction));

  if (data.pending) {
    renderPendingCard(doc, card, data, callbacks);
  } else {
    renderLoginCard(doc, card, data, callbacks);
  }

  modal.append(card);
  modal.dataset.bcPaperCtecSignature = signature;
}

export function hideAuthModal(doc: Document): void {
  doc.getElementById(AUTH_MODAL_ID)?.remove();
}

function makeCloseButton(doc: Document, pending: boolean, onClose: () => void): HTMLButtonElement {
  const close = doc.createElement("button");
  close.type = "button";
  close.className = "bc-paper-ctec-auth-close";
  close.setAttribute("aria-label", pending ? "Cancel login flow" : "Dismiss login prompt");
  close.textContent = "×";
  close.addEventListener("click", (event) => {
    preventAndStop(event);
    onClose();
  });
  return close;
}

function renderLoginCard(
  doc: Document,
  card: HTMLElement,
  data: AuthModalData,
  callbacks: AuthModalCallbacks
): void {
  const lock = doc.createElement("div");
  lock.className = "bc-paper-ctec-auth-icon";
  lock.append(createIcon("lock"));
  card.append(lock);

  card.append(makeTitle(doc, "Northwestern login required"));

  const body = doc.createElement("p");
  body.className = "bc-paper-ctec-auth-body";
  body.append(
    doc.createTextNode(
      "Better CAESAR needs a CAESAR login to read CTEC reports on your behalf to display on your paper.nu. "
    )
  );
  const bodyEmphasis = doc.createElement("strong");
  bodyEmphasis.textContent =
    "It authorizes that you have the permissions to access CTECs before you can view them.";
  body.append(bodyEmphasis);
  card.append(body);

  card.append(
    makeNote(doc, "You'll need to repeat this any time Northwestern signs you out (typically every few hours).")
  );

  const trust = doc.createElement("p");
  trust.className = "bc-paper-ctec-auth-trust";
  trust.append(doc.createTextNode("Better CAESAR is open source. If you'd like, you may review the code at "));

  const repoLink = doc.createElement("a");
  repoLink.className = "bc-paper-ctec-auth-link";
  repoLink.href = "https://github.com/kev1n/better-caesar";
  repoLink.target = "_blank";
  repoLink.rel = "noopener noreferrer";
  repoLink.textContent = "github.com/kev1n/better-caesar";
  repoLink.addEventListener("click", stopPropagation);
  trust.append(repoLink, doc.createTextNode("."));
  card.append(trust);

  const actions = doc.createElement("div");
  actions.className = "bc-paper-ctec-auth-actions";

  if (data.loginUrl) {
    actions.append(
      makeActionButton(
        doc,
        "primary",
        data.awaitingAuthRetry ? "Open Northwestern login again" : "Open Northwestern login",
        callbacks.onLogin
      )
    );
  }
  actions.append(makeActionButton(doc, "secondary", "Not now", callbacks.onDismiss));
  card.append(actions);
}

function renderPendingCard(
  doc: Document,
  card: HTMLElement,
  data: AuthModalData,
  callbacks: AuthModalCallbacks
): void {
  const spinner = doc.createElement("div");
  spinner.className = "bc-paper-ctec-auth-icon bc-paper-ctec-auth-spinner";
  spinner.setAttribute("aria-hidden", "true");
  card.append(spinner);

  card.append(makeTitle(doc, "Waiting for Northwestern login…"));

  const body = doc.createElement("p");
  body.className = "bc-paper-ctec-auth-body";
  body.textContent =
    "Finish signing in on the Northwestern tab. Better CAESAR will detect when you're back and resume loading CTECs automatically — the login tab will close on its own.";
  card.append(body);

  card.append(makeNote(doc, "Don't see the login tab? Click the button below to reopen it."));

  const actions = doc.createElement("div");
  actions.className = "bc-paper-ctec-auth-actions";

  if (data.loginUrl) {
    actions.append(makeActionButton(doc, "primary", "Reopen login tab", callbacks.onLogin));
  }
  actions.append(makeActionButton(doc, "secondary", "Cancel", callbacks.onCancelPending));
  card.append(actions);
}

function makeTitle(doc: Document, text: string): HTMLHeadingElement {
  const title = doc.createElement("h2");
  title.id = `${AUTH_MODAL_ID}-title`;
  title.className = "bc-paper-ctec-auth-title";
  title.textContent = text;
  return title;
}

function makeNote(doc: Document, text: string): HTMLParagraphElement {
  const note = doc.createElement("p");
  note.className = "bc-paper-ctec-auth-note";
  note.textContent = text;
  return note;
}

function makeActionButton(
  doc: Document,
  variant: "primary" | "secondary",
  text: string,
  onClick: () => void
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = `bc-paper-ctec-auth-${variant}`;
  button.textContent = text;
  button.addEventListener("click", (event) => {
    preventAndStop(event);
    onClick();
  });
  return button;
}
