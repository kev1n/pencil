import { PAPER_CTEC_CONFIG } from "./config";
import { STATUS_BAR_ID } from "./constants";
import type { PaperCtecStatusBarData } from "./types";
import { createIcon, type IconName } from "./ui-shared";

const STATUS_STACK_CLASS = "bc-paper-ctec-status-stack";
const STATUS_LEGEND_ID = "bc-paper-ctec-status-legend";

// Mounts (and re-renders) the persistent status bar in the paper.nu action
// row. Auth-required hides the bar entirely — the auth modal carries the
// signal in that case.
export function renderStatusBar(
  doc: Document,
  data: PaperCtecStatusBarData
): void {
  if (data.state === "auth-required") {
    hideStatusBar(doc);
    return;
  }

  const host = findActionHost(doc);
  if (!host) return;
  ensureActionHostLayout(host);

  const stack = ensureStatusStack(doc, host);

  let bar = doc.getElementById(STATUS_BAR_ID) as HTMLDivElement | null;
  if (!bar) {
    bar = doc.createElement("div");
    bar.id = STATUS_BAR_ID;
    bar.setAttribute("aria-live", "polite");
  }

  if (bar.parentElement !== stack || stack.firstElementChild !== bar) {
    stack.prepend(bar);
  }

  renderStatusLegend(doc, stack);

  const signature = buildStatusSignature(data);
  if (bar.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  const nextClassName = data.state === "ready" ? "is-ready" : "is-loading";

  bar.className = nextClassName;
  bar.replaceChildren();
  bar.title = buildStatusTitle(data);

  const mark = doc.createElement("div");
  mark.className = "bc-paper-ctec-status-mark";
  mark.append(createIcon(statusIcon(data.state)));

  const brand = doc.createElement("span");
  brand.className = "bc-paper-ctec-status-brand";
  brand.textContent = "Better CAESAR";
  mark.append(brand);

  const copy = doc.createElement("div");
  copy.className = "bc-paper-ctec-status-copy";
  copy.textContent = buildStatusCopy(data);

  bar.append(mark, copy);
  bar.dataset.bcPaperCtecSignature = signature;
}

export function hideStatusBar(doc: Document): void {
  doc.getElementById(STATUS_BAR_ID)?.remove();
  doc.getElementById(STATUS_LEGEND_ID)?.remove();
  doc.querySelector<HTMLElement>(`.${STATUS_STACK_CLASS}`)?.remove();
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

function ensureStatusStack(doc: Document, host: HTMLElement): HTMLElement {
  let stack = host.querySelector<HTMLElement>(`.${STATUS_STACK_CLASS}`);
  if (!stack) {
    stack = doc.createElement("div");
    stack.className = STATUS_STACK_CLASS;
  }

  if (stack.parentElement !== host || host.firstElementChild !== stack) {
    host.prepend(stack);
  }

  return stack;
}

function renderStatusLegend(doc: Document, stack: HTMLElement): void {
  let legend = doc.getElementById(STATUS_LEGEND_ID) as HTMLDivElement | null;
  if (!legend) {
    legend = doc.createElement("div");
    legend.id = STATUS_LEGEND_ID;
  }

  if (legend.parentElement !== stack) {
    stack.append(legend);
  }

  const signature = "inst|crse|lrn|hrs";
  if (legend.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  legend.replaceChildren(
    makeLegendItem(doc, "Inst", "instruction rating"),
    makeLegendItem(doc, "CRSE", "course rating"),
    makeLegendItem(doc, "LRN", "amount learned"),
    makeLegendItem(doc, "Hrs", "avg hours / week")
  );
  legend.dataset.bcPaperCtecSignature = signature;
}

function makeLegendItem(doc: Document, key: string, description: string): HTMLElement {
  const item = doc.createElement("div");
  item.className = "bc-paper-ctec-legend-item";

  const legendKey = doc.createElement("span");
  legendKey.className = "bc-paper-ctec-legend-key";
  legendKey.textContent = key;

  const legendText = doc.createElement("span");
  legendText.textContent = description;

  item.append(legendKey, legendText);
  return item;
}

function buildStatusSignature(data: PaperCtecStatusBarData): string {
  return [
    data.state,
    data.totalCount,
    data.resolvedCount,
    data.activeCount,
    data.foundCount,
    data.notFoundCount,
    data.errorCount,
    data.authCount,
    data.latestMessage ?? "",
    data.loginUrl ?? "",
    data.awaitingAuthRetry ? "1" : "0"
  ].join("|");
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
  if (data.state === "auth-required") {
    const prefix = data.awaitingAuthRetry
      ? "Waiting for Northwestern login to resume CTECs on Paper"
      : "Northwestern login required to continue CTECs on Paper";
    return `${prefix} · ${data.resolvedCount}/${data.totalCount} classes checked`;
  }

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
  if (data.state === "auth-required") {
    return "Better CAESAR needs one Northwestern login before it can keep reading CTEC reports for this Paper schedule.";
  }

  if (data.state === "loading") {
    return "Better CAESAR is reading Northwestern CTEC data and attaching summaries to the current Paper schedule.";
  }

  return "Better CAESAR finished syncing Northwestern CTEC summaries into the current Paper schedule.";
}

function statusIcon(state: PaperCtecStatusBarData["state"]): IconName {
  if (state === "auth-required") return "lock";
  if (state === "ready") return "stack";
  return "spark";
}
