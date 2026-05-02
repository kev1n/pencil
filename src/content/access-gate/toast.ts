import {
  getGateStatusSync,
  onGateStatusChange,
  type GateStatus
} from "./index";
import { canonicalizeCodeInput, isCodeValidForLastName } from "./code";
import { writeStoredCode } from "./storage";

const HOST_ID = "better-caesar-gate-toast";

let lastShownKind: Exclude<GateStatus["kind"], "unlocked"> | null = null;
let dismissedKind: GateStatus["kind"] | null = null;
let codeFormOpen = false;

export function mountAccessGateToast(): void {
  const apply = (status: GateStatus) => {
    if (status.kind !== "unlocked" && lastShownKind !== status.kind) {
      // New lock state — reset the per-status dismissal and any open form.
      dismissedKind = null;
      codeFormOpen = false;
    }
    if (status.kind !== "unlocked") {
      lastShownKind = status.kind;
    }
    whenBodyReady(() => render(status));
  };

  apply(getGateStatusSync());
  onGateStatusChange(apply);
}

function whenBodyReady(cb: () => void): void {
  if (document.body) {
    cb();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!document.body) return;
    observer.disconnect();
    cb();
  });
  observer.observe(document.documentElement, { childList: true });
}

type LockedStatus = Exclude<GateStatus, { kind: "unlocked" }>;

function render(status: GateStatus): void {
  const existing = document.getElementById(HOST_ID);

  if (status.kind === "unlocked") {
    existing?.remove();
    return;
  }
  if (dismissedKind === status.kind) {
    existing?.remove();
    return;
  }
  // Hide the "needs CAESAR" prompt on CAESAR itself — we expect the cookie/
  // fetch handshake to resolve in seconds, so the prompt is just noise there.
  if (status.kind === "needs-caesar" && isCaesarHost()) {
    existing?.remove();
    return;
  }

  const { root } = ensureHost(existing);
  paint(root, status);
}

function ensureHost(existing: HTMLElement | null): { host: HTMLElement; root: ShadowRoot } {
  if (existing && existing.shadowRoot) {
    return { host: existing, root: existing.shadowRoot };
  }
  existing?.remove();
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = [
    "all: initial",
    "position: fixed",
    "right: 16px",
    "bottom: 16px",
    "z-index: 2147483647"
  ].join(";");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${TOAST_STYLES}</style><div class="toast"></div>`;
  document.body.appendChild(host);
  return { host, root };
}

function paint(root: ShadowRoot, status: LockedStatus): void {
  const toast = root.querySelector(".toast");
  if (!(toast instanceof HTMLElement)) return;

  toast.innerHTML = "";
  toast.dataset.kind = status.kind;

  const close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  close.addEventListener("click", () => {
    dismissedKind = status.kind;
    codeFormOpen = false;
    document.getElementById(HOST_ID)?.remove();
  });

  const body = document.createElement("div");
  body.className = "body";

  const title = document.createElement("div");
  title.className = "title";

  const sub = document.createElement("div");
  sub.className = "sub";

  body.append(title, sub);
  toast.append(close, body);

  if (status.kind === "needs-caesar") {
    title.textContent = "Sign in to CAESAR";
    sub.textContent = "Better CAESAR will activate automatically once you've signed in.";
    const link = document.createElement("a");
    link.className = "primary";
    link.textContent = "Open CAESAR";
    link.href = "https://caesar.ent.northwestern.edu/";
    link.target = "_blank";
    link.rel = "noopener";
    body.append(link);
    return;
  }

  // locked-bucket
  const when = new Date(status.releaseAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  title.textContent = `Better CAESAR launches ${when}`;
  sub.textContent = `Last names ${status.bucketLabel} get access at that time.`;

  if (codeFormOpen) {
    body.append(buildCodeForm(status, root));
  } else {
    const codeBtn = document.createElement("button");
    codeBtn.className = "primary";
    codeBtn.type = "button";
    codeBtn.textContent = "I have a code";
    codeBtn.addEventListener("click", () => {
      codeFormOpen = true;
      paint(root, status);
      const input = root.querySelector(".code-input");
      if (input instanceof HTMLInputElement) input.focus();
    });
    body.append(codeBtn);
  }
}

function buildCodeForm(status: LockedStatus, root: ShadowRoot): HTMLElement {
  const form = document.createElement("form");
  form.className = "form";

  const input = document.createElement("input");
  input.className = "code-input";
  input.type = "text";
  input.placeholder = "XXX-XXX";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.maxLength = 8;

  const submit = document.createElement("button");
  submit.className = "primary";
  submit.type = "submit";
  submit.textContent = "Unlock";

  const status_msg = document.createElement("div");
  status_msg.className = "msg";

  form.append(input, submit, status_msg);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status_msg.textContent = "";
    status_msg.classList.remove("err");
    const cleaned = canonicalizeCodeInput(input.value);
    if (cleaned.length === 0) return;
    if (status.kind !== "locked-bucket") {
      status_msg.textContent = "Sign in to CAESAR first so we know who you are.";
      status_msg.classList.add("err");
      return;
    }
    const ok = await isCodeValidForLastName(cleaned, status.lastName);
    if (!ok) {
      status_msg.textContent = "Code didn't match.";
      status_msg.classList.add("err");
      return;
    }
    await writeStoredCode(cleaned);
    // Storage change triggers gate re-eval → toast removes itself.
  });

  // Re-render keeps `root` referenced; silence unused-var warning by reading it.
  void root;

  return form;
}

function isCaesarHost(): boolean {
  return window.location.hostname === "caesar.ent.northwestern.edu";
}

const TOAST_STYLES = `
  :host, * { box-sizing: border-box; }
  .toast {
    width: 320px;
    max-width: calc(100vw - 32px);
    background: #ffffff;
    color: #111827;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px 14px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.4;
    position: relative;
  }
  .close {
    position: absolute;
    top: 6px;
    right: 8px;
    background: none;
    border: none;
    font-size: 18px;
    line-height: 1;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px 6px;
  }
  .close:hover { color: #111827; }
  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 18px;
  }
  .title {
    font-size: 13px;
    font-weight: 700;
    color: #66023c;
  }
  .sub {
    font-size: 12px;
    color: #4b5563;
  }
  .primary {
    align-self: flex-start;
    padding: 6px 12px;
    border-radius: 8px;
    border: none;
    background: #66023c;
    color: #ffffff;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }
  .primary:hover { background: #4a012b; }
  .form {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .code-input {
    flex: 1 1 120px;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #111827;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .code-input:focus {
    outline: 2px solid #66023c;
    outline-offset: 1px;
    border-color: #66023c;
  }
  .msg {
    flex-basis: 100%;
    font-size: 11px;
    color: #4b5563;
  }
  .msg.err { color: #b91c1c; }
`;
