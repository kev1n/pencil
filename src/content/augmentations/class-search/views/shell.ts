// Pure shell + status helpers for the class-search augmentation. These
// produce / mutate the wrapping DOM that frames the search UI:
//
//   • `buildLoadingShell` — placeholder shown during the initial
//     paper.nu data load.
//   • `renderFatalError` — terminal error UI when paper.nu data fails.
//   • `ensureRoot` — mounts (or re-uses) the augmentation's host <div>
//     adjacent to PeopleSoft's PAGECONTAINER so the native page can be
//     hidden via CSS without uprooting our own UI.
//   • `setStatus` — writes the status banner under the search form,
//     handling spinner + text composition.
//   • `escapeHtml` / `hasAnyFilter` — pure text + filter helpers.
//
// Extracted from augmentation.ts (Wave 5g). No behavior change.
//
// `ROOT_ID` is exported so the augmentation can id-check `getElementById`
// when reconciling mount state after PS DOM swaps.

import type { SearchFilters } from "../types";

export const ROOT_ID = "better-caesar-class-search-root";

export function ensureRoot(doc: Document): HTMLDivElement {
  const existing = doc.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (existing) return existing;
  const root = doc.createElement("div");
  root.id = ROOT_ID;
  // .bc-cs-root carries every CSS custom property; nothing renders without it.
  root.className = "bc-cs-root";
  const anchor =
    doc.getElementById("win0divPAGECONTAINER") ??
    doc.querySelector(".PSPAGECONTAINER")?.closest("td") ??
    doc.body;
  const parent = anchor.parentElement ?? doc.body;
  parent.insertBefore(root, anchor);
  return root;
}

export function buildLoadingShell(doc: Document): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "bc-cs-root";
  const card = doc.createElement("div");
  card.className = "bc-cs-card";
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:var(--bc-color-text-muted);font-size:var(--bc-font-13);">
      <span class="bc-cs-spinner"></span>
      <span>Loading paper.nu catalog data…</span>
    </div>
  `;
  wrap.appendChild(card);
  return wrap;
}

export function renderFatalError(root: HTMLElement, doc: Document, message: string): void {
  root.innerHTML = "";
  const wrap = doc.createElement("div");
  wrap.className = "bc-cs-root";
  const card = doc.createElement("div");
  card.className = "bc-cs-card";
  card.style.borderColor = "var(--bc-color-danger-border)";
  card.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;font-size:var(--bc-font-13);color:var(--bc-color-danger);">
      <strong>Couldn't load paper.nu catalog data.</strong>
      <span style="color:var(--bc-color-text-muted);">${escapeHtml(message)}</span>
      <span style="color:var(--bc-color-text-muted);font-size:var(--bc-font-12);">Reload the page to try again, or switch to Classic CAESAR using the tab above.</span>
    </div>
  `;
  wrap.appendChild(card);
  root.appendChild(wrap);
}

export function setStatus(
  doc: Document,
  statusEl: HTMLElement,
  kind: "loading" | "ok" | "error",
  message: string
): void {
  statusEl.innerHTML = "";
  statusEl.dataset.state = kind;
  if (kind === "loading") {
    const spinner = doc.createElement("span");
    spinner.className = "bc-cs-spinner";
    statusEl.appendChild(spinner);
  }
  const text = doc.createElement("span");
  text.textContent = message;
  statusEl.appendChild(text);
}

export function hasAnyFilter(filters: SearchFilters): boolean {
  return filters.query.trim().length > 0;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
