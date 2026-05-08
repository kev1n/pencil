import { html, render } from "lit-html";

import { PAPER_CTEC_CONFIG } from "./config";
import { STATUS_BAR_ID } from "./constants";
import type { PaperCtecStatusBarData } from "./types";
import { iconTemplate, type IconName } from "./ui-shared";

// Mounts (and re-renders) the persistent status bar in the paper.nu action
// row. Auth-required is no longer a status state — the popup-and-retry
// flow handles credentials silently in the background.
export function renderStatusBar(
  doc: Document,
  data: PaperCtecStatusBarData
): void {
  const host = findActionHost(doc);
  if (!host) return;
  ensureActionHostLayout(host);

  let bar = doc.getElementById(STATUS_BAR_ID) as HTMLDivElement | null;
  if (!bar) {
    bar = doc.createElement("div");
    bar.id = STATUS_BAR_ID;
    bar.setAttribute("aria-live", "polite");
  }

  if (bar.parentElement !== host || host.firstElementChild !== bar) {
    host.prepend(bar);
  }

  bar.className = data.state === "ready" ? "is-ready" : "is-loading";
  bar.title = buildStatusTitle(data);

  render(
    html`<div class="bc-paper-ctec-status-mark">
        ${iconTemplate(statusIcon(data.state))}<span
          class="bc-paper-ctec-status-brand"
          >pencil.nu</span
        >
      </div>
      <div class="bc-paper-ctec-status-copy">${buildStatusCopy(data)}</div>`,
    bar
  );
}

export function hideStatusBar(doc: Document): void {
  doc.getElementById(STATUS_BAR_ID)?.remove();
}

// paper.nu's action row is the toolbar that holds Custom / Export / Clear
// — the only stable hook for mounting the status bar that doesn't get blown
// away on schedule re-renders.
function findActionHost(doc: Document): HTMLElement | null {
  const exact = Array.from(
    doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.actionHostExact)
  ).find((candidate) => hasPaperActions(candidate));
  if (exact) return exact;

  return Array.from(
    doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.actionHostFallback)
  ).find((candidate) => hasPaperActions(candidate)) ?? null;
}

function ensureActionHostLayout(host: HTMLElement): void {
  if (host.dataset.bcPaperCtecExpanded === "1") return;

  host.style.left = `${PAPER_CTEC_CONFIG.layout.actionHostInsetRem}rem`;
  host.style.right = `${PAPER_CTEC_CONFIG.layout.actionHostInsetRem}rem`;
  host.style.justifyContent = "flex-end";
  host.style.alignItems = "flex-start";
  host.style.minWidth = "0";
  host.dataset.bcPaperCtecExpanded = "1";
}

function hasPaperActions(candidate: HTMLElement): boolean {
  const labels = Array.from(candidate.querySelectorAll("button")).map((button) =>
    (button.textContent ?? "").trim().toLowerCase()
  );

  return labels.some((label) => label.includes("custom")) &&
    labels.some((label) => label.includes("export")) &&
    labels.some((label) => label.includes("clear"));
}

function buildStatusCopy(data: PaperCtecStatusBarData): string {
  if (data.state === "loading") {
    const detail = data.latestMessage
      ? ` · ${data.latestMessage}`
      : data.activeCount > 0
        ? ` · ${data.activeCount} active`
        : "";
    return `Loading CTECs into Paper · ${data.resolvedCount}/${data.totalCount} classes checked${detail}`;
  }

  const parts = [];
  if (data.foundCount > 0) parts.push(`${data.foundCount} enriched`);
  if (data.notFoundCount > 0) parts.push(`${data.notFoundCount} no CTEC`);
  if (data.errorCount > 0) parts.push(`${data.errorCount} unavailable`);
  if (parts.length === 0) parts.push("no visible classes");
  return `CTEC sync complete on Paper · ${parts.join(" · ")}`;
}

function buildStatusTitle(data: PaperCtecStatusBarData): string {
  if (data.state === "loading") {
    return "pencil.nu is reading Northwestern CTEC data and attaching summaries to the current Paper schedule.";
  }

  return "pencil.nu finished syncing Northwestern CTEC summaries into the current Paper schedule.";
}

function statusIcon(state: PaperCtecStatusBarData["state"]): IconName {
  if (state === "ready") return "stack";
  return "spark";
}
