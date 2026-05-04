import { renderInlineMarkdown } from "./markdown";
import {
  readCachedRemoteSchedule,
  SCHEDULE_CACHE_STORAGE_KEY,
  type Broadcast
} from "./server-client";

const HOST_ID = "better-caesar-server-banner";
const DISMISSED_IDS_STORAGE_KEY = "better-caesar:server-banner:dismissed-ids:v1";

export function mountServerBanner(): void {
  // Content scripts run in every frame (all_frames: true). A position:fixed
  // banner inside an iframe (e.g. CAESAR's #ptifrmtgtframe) would anchor to
  // the iframe's viewport, not the page — gate to the top frame.
  if (!isTopFrame()) return;
  void renderFromCache();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[SCHEDULE_CACHE_STORAGE_KEY] && !changes[DISMISSED_IDS_STORAGE_KEY]) return;
    void renderFromCache();
  });
}

function isTopFrame(): boolean {
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}

async function renderFromCache(): Promise<void> {
  const schedule = await readCachedRemoteSchedule();
  const banner = schedule?.banner ?? null;
  const dismissed = await readDismissedIds();
  whenBodyReady(() => render(banner, dismissed));
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

function render(banner: Broadcast | null, dismissed: Set<string>): void {
  const existing = document.getElementById(HOST_ID);
  if (!banner || dismissed.has(banner.id)) {
    existing?.remove();
    return;
  }

  const { root } = ensureHost(existing);
  paint(root, banner);
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
    "top: 0",
    "left: 0",
    "right: 0",
    "z-index: 2147483646",
    "pointer-events: none"
  ].join(";");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${BANNER_STYLES}</style><div class="banner"></div>`;
  document.body.appendChild(host);
  return { host, root };
}

function paint(root: ShadowRoot, banner: Broadcast): void {
  const el = root.querySelector(".banner");
  if (!(el instanceof HTMLElement)) return;
  el.innerHTML = "";

  const text = document.createElement("div");
  text.className = "text";
  renderInlineMarkdown(text, banner.message);

  const close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  close.addEventListener("click", () => void dismiss(banner.id));

  el.append(text, close);
}

async function dismiss(id: string): Promise<void> {
  const current = await readDismissedIds();
  if (current.has(id)) return;
  current.add(id);
  await chrome.storage.local.set({ [DISMISSED_IDS_STORAGE_KEY]: [...current] });
  // Storage onChange listener triggers re-render, which removes the host.
}

async function readDismissedIds(): Promise<Set<string>> {
  const result = (await chrome.storage.local.get(DISMISSED_IDS_STORAGE_KEY)) as Record<string, unknown>;
  const raw = result[DISMISSED_IDS_STORAGE_KEY];
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((s) => typeof s === "string"));
}

// Colors pull from --bc-gate-warning-* injected by content/index.ts before
// the design system bootstraps. Variables inherit into this shadow root
// from the host element via :root.
const BANNER_STYLES = `
  :host, * { box-sizing: border-box; }
  .banner {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    background: var(--bc-gate-warning-bg);
    color: var(--bc-gate-warning-fg);
    border-bottom: 1px solid var(--bc-gate-warning-border);
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.4;
    box-shadow: 0 2px 6px var(--bc-gate-warning-shadow);
  }
  .text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .text a {
    color: inherit;
    text-decoration: underline;
    font-weight: 600;
  }
  .text a:hover { color: var(--bc-gate-warning-link-hover); }
  .close {
    flex: 0 0 auto;
    background: none;
    border: none;
    font-size: 18px;
    line-height: 1;
    color: var(--bc-gate-warning-muted);
    cursor: pointer;
    padding: 4px 6px;
  }
  .close:hover { color: var(--bc-gate-warning-fg); }
`;
