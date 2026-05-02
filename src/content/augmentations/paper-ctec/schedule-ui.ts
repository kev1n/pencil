import type { CtecAggregateMetric } from "../ctec-links/reports";
import { isFeatureEnabled } from "../../settings";
import { PAPER_CTEC_CONFIG } from "./config";
import {
  COMPACT_CARD_STARS_FEATURE_ID,
  STATUS_BAR_ID,
  WIDGET_CLASS
} from "./constants";
import {
  formatChipRating,
  formatRatingDetail,
  ratingPercentSignature
} from "./rating-format";
import type { PaperCtecStatusBarData, PaperCtecWidgetData } from "./types";
import {
  createIcon,
  createRatingStars,
  preventAndStop,
  stopPropagation,
  type IconName
} from "./ui-shared";

type CompactChipTone = {
  lightBackground: string;
  darkBackground: string;
  lightBorder: string;
  darkBorder: string;
  lightText: string;
  darkText: string;
};

type WidgetAggregate = Extract<PaperCtecWidgetData, { state: "found" }>["aggregate"];

const STATUS_STACK_CLASS = "bc-paper-ctec-status-stack";
const STATUS_LEGEND_ID = "bc-paper-ctec-status-legend";

export function renderLoading(widget: HTMLElement, message = "CTEC…"): void {
  const signature = `loading|${message}`;
  if (widget.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  widget.textContent = "";
  widget.title = "Better CAESAR is loading Northwestern CTEC data for this class.";

  const summary = widget.ownerDocument.createElement("div");
  summary.className = `${WIDGET_CLASS}-summary`;
  summary.appendChild(makeChip("spark", message, "is-muted"));
  widget.appendChild(summary);
  widget.dataset.bcPaperCtecSignature = signature;
}

export function renderWidget(
  widget: HTMLElement,
  data: PaperCtecWidgetData,
  onAuthChipClick?: () => void
): void {
  const signature = buildWidgetSignature(data);
  if (widget.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  widget.textContent = "";
  widget.removeAttribute("title");

  const summary = widget.ownerDocument.createElement("div");
  summary.className = `${WIDGET_CLASS}-summary`;
  widget.appendChild(summary);

  if (data.state === "not-found") {
    summary.appendChild(makeChip("spark", "No CTEC", "is-muted"));
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  if (data.state === "auth-required") {
    widget.title = "Click to open the Northwestern login prompt for Better CAESAR.";
    summary.appendChild(makeAuthChip(onAuthChipClick));
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  if (data.state === "error") {
    widget.title = data.message;
    summary.appendChild(makeChip("spark", "CTEC unavailable", "is-muted"));
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  const { aggregate } = data;
  widget.title = buildTooltip(aggregate);

  const chips = [
    metricChip("Inst", "Instruction", aggregate.metrics.instruction, aggregate, "rating"),
    metricChip("CRSE", "Course", aggregate.metrics.course, aggregate, "rating"),
    metricChip("LRN", "Learned", aggregate.metrics.learned, aggregate, "rating"),
    metricChip("Hrs", "Hours", aggregate.metrics.hours, aggregate, "hours")
  ].filter((chip): chip is HTMLElement => !!chip);

  if (chips.length === 0) {
    const fallbackChips = [
      metricChip("CHLG", "Challenge", aggregate.metrics.challenging, aggregate, "rating"),
      metricChip("INT", "Interest", aggregate.metrics.stimulating, aggregate, "rating")
    ].filter((chip): chip is HTMLElement => !!chip);

    if (fallbackChips.length > 0) {
      fallbackChips.forEach((chip) => summary.appendChild(chip));
    } else {
      summary.appendChild(
        makeChip(
          "spark",
          "CTEC detail",
          "is-muted",
          "Matching CTEC reports were found, but the compact card does not have Inst, CRSE, LRN, Hrs, Challenge, or Interest summary metrics for this course."
        )
      );
    }
  } else {
    chips.forEach((chip) => summary.appendChild(chip));
  }
  widget.dataset.bcPaperCtecSignature = signature;
}

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

function makeAuthChip(onClick?: () => void): HTMLElement {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `${WIDGET_CLASS}-chip is-warn ${WIDGET_CLASS}-chip-button`;
  chip.title = "Open the Northwestern login prompt for Better CAESAR.";
  chip.append(createIcon("lock"), document.createTextNode("Login needed"));

  if (onClick) {
    const trigger = (event: Event) => {
      preventAndStop(event);
      onClick();
    };
    chip.addEventListener("pointerdown", trigger);
    chip.addEventListener("click", preventAndStop);
    chip.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      trigger(event);
    });
  }

  return chip;
}

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

function metricChip(
  shortLabel: string,
  label: string,
  metric: CtecAggregateMetric | undefined,
  aggregate: WidgetAggregate,
  scale: "rating" | "hours"
): HTMLElement | null {
  if (!metric) return null;

  const starMode = isFeatureEnabled(COMPACT_CARD_STARS_FEATURE_ID);
  if (scale === "rating" && starMode) {
    return makeMetricStarsChip(
      shortLabel,
      metric.mean,
      buildMetricChipTooltip(label, metric, aggregate)
    );
  }

  const tone = !starMode
    ? scale === "hours"
      ? buildCompactChipTone(metric.mean, PAPER_CTEC_CONFIG.aggregate.hoursGraphMax, true)
      : buildCompactChipTone(metric.mean, PAPER_CTEC_CONFIG.aggregate.ratingScaleMax, false)
    : undefined;

  const value = scale === "rating"
    ? formatChipRating(metric.mean)
    : metric.mean.toFixed(1);

  return makeMetricValueChip(
    shortLabel,
    value,
    "",
    buildMetricChipTooltip(label, metric, aggregate),
    tone
  );
}

function buildWidgetSignature(data: PaperCtecWidgetData): string {
  if (data.state !== "found") {
    return data.state === "error" ? `${data.state}|${data.message}` : data.state;
  }

  const { aggregate } = data;
  const metricSignature = [
    aggregate.metrics.instruction?.mean ?? "",
    aggregate.metrics.course?.mean ?? "",
    aggregate.metrics.learned?.mean ?? "",
    aggregate.metrics.hours?.mean ?? "",
    aggregate.metrics.challenging?.mean ?? "",
    aggregate.metrics.stimulating?.mean ?? "",
    aggregate.parsedCount
  ].join(",");

  return [
    data.state,
    isFeatureEnabled(COMPACT_CARD_STARS_FEATURE_ID) ? "stars" : "values",
    ratingPercentSignature(),
    aggregate.evaluationCount,
    aggregate.aggregateEvaluationCount,
    aggregate.partial ? "1" : "0",
    aggregate.latestTerm ?? "",
    aggregate.windowTerms.join(","),
    aggregate.maxEntriesUsed ?? "",
    metricSignature
  ].join("|");
}

function makeChip(icon: IconName, text: string, extraClass = "", title?: string): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip${extraClass ? ` ${extraClass}` : ""}`;
  if (title) chip.title = title;
  chip.append(createIcon(icon), document.createTextNode(text));
  return chip;
}

function makeMetricValueChip(
  label: string,
  value: string,
  extraClass = "",
  title?: string,
  tone?: CompactChipTone
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip${extraClass ? ` ${extraClass}` : ""}`;
  if (title) chip.title = title;
  if (tone) applyCompactChipTone(chip, tone);

  const chipLabel = document.createElement("span");
  chipLabel.className = `${WIDGET_CLASS}-chip-label`;
  chipLabel.textContent = label;

  const chipValue = document.createElement("span");
  chipValue.className = `${WIDGET_CLASS}-chip-value`;
  chipValue.textContent = value;

  chip.append(chipLabel, chipValue);
  return chip;
}

function makeMetricStarsChip(
  label: string,
  value: number,
  title?: string
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip`;
  if (title) chip.title = title;

  const chipLabel = document.createElement("span");
  chipLabel.className = `${WIDGET_CLASS}-chip-label`;
  chipLabel.textContent = label;

  const chipStars = document.createElement("span");
  chipStars.className = `${WIDGET_CLASS}-chip-stars`;
  chipStars.append(createRatingStars(document, value));

  chip.append(chipLabel, chipStars);
  return chip;
}

function applyCompactChipTone(chip: HTMLElement, tone: CompactChipTone): void {
  chip.style.setProperty("--bc-paper-ctec-chip-bg", tone.lightBackground);
  chip.style.setProperty("--bc-paper-ctec-chip-bg-dark", tone.darkBackground);
  chip.style.setProperty("--bc-paper-ctec-chip-border", tone.lightBorder);
  chip.style.setProperty("--bc-paper-ctec-chip-border-dark", tone.darkBorder);
  chip.style.setProperty("--bc-paper-ctec-chip-fg", tone.lightText);
  chip.style.setProperty("--bc-paper-ctec-chip-fg-dark", tone.darkText);
}

function buildCompactChipTone(
  value: number,
  max: number,
  invert: boolean
): CompactChipTone {
  const normalized = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const score = invert ? 1 - normalized : normalized;
  const scale = invert
    ? PAPER_CTEC_CONFIG.ui.hoursChipTones
    : PAPER_CTEC_CONFIG.ui.ratingChipTones;
  const hue =
    scale.find((step) => score >= step.minScore)?.hue ??
    scale[scale.length - 1]?.hue ??
    4;

  return {
    lightBackground: `hsla(${hue}, 96%, 68%, 0.98)`,
    darkBackground: `hsla(${hue}, 78%, 32%, 0.94)`,
    lightBorder: `hsla(${hue}, 82%, 24%, 0.38)`,
    darkBorder: `hsla(${hue}, 90%, 78%, 0.28)`,
    lightText: `hsl(${hue}, 62%, 18%)`,
    darkText: "#f9fafb"
  };
}

function buildTooltip(data: WidgetAggregate): string {
  const scope = buildAggregateScopeText(data);
  const parts = [
    `CTEC compact summary uses ${scope}. ${data.evaluationCount} matching evaluation${data.evaluationCount === 1 ? "" : "s"} found overall.`
  ];

  appendMetricTooltip(parts, "Instructor", data.metrics.instruction, data);
  appendMetricTooltip(parts, "Course", data.metrics.course, data);
  appendMetricTooltip(parts, "Learned", data.metrics.learned, data);
  appendMetricTooltip(parts, "Challenge", data.metrics.challenging, data);
  appendMetricTooltip(parts, "Interest", data.metrics.stimulating, data);
  if (data.metrics.hours) {
    parts.push(
      `Hours ${data.metrics.hours.mean.toFixed(1)}/week across ${data.metrics.hours.evaluationCount} matching term${
        data.metrics.hours.evaluationCount === 1 ? "" : "s"
      } in ${scope}.`
    );
  }
  if (data.latestTerm) parts.push(`Latest ${data.latestTerm}.`);
  if (data.partial) parts.push("Some linked evaluations were available but not fully parsed.");

  return parts.join(" ");
}

function appendMetricTooltip(
  parts: string[],
  label: string,
  metric: CtecAggregateMetric | undefined,
  aggregate: WidgetAggregate
): void {
  if (!metric) return;
  parts.push(buildMetricChipTooltip(label, metric, aggregate));
}

function buildAggregateScopeText(aggregate: WidgetAggregate): string {
  if (!aggregate.maxEntriesUsed || aggregate.aggregateEvaluationCount >= aggregate.evaluationCount) {
    return "all matching evaluations";
  }

  return `the latest ${aggregate.aggregateEvaluationCount} matching evaluation${
    aggregate.aggregateEvaluationCount === 1 ? "" : "s"
  }`;
}

function buildMetricChipTooltip(
  label: string,
  metric: CtecAggregateMetric,
  aggregate: WidgetAggregate
): string {
  const scope = buildAggregateScopeText(aggregate);
  return `${label} ${formatRatingDetail(metric.mean)} across ${metric.evaluationCount} matching term${
    metric.evaluationCount === 1 ? "" : "s"
  } in ${scope}.`;
}
