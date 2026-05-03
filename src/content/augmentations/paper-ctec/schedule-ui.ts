import { isFeatureEnabled } from "../../settings";
import { PAPER_CTEC_CONFIG } from "./config";
import { COMPACT_CARD_STARS_FEATURE_ID, WIDGET_CLASS } from "./constants";
import { ratingPercentSignature } from "./rating-format";
import type { PaperCtecWidgetData } from "./types";
import { createIcon, preventAndStop } from "./ui-shared";
import { buildTooltip, makeChip, metricChip } from "./widget-chips";

const ANALYTICS_ANCHOR_CLASS = `${WIDGET_CLASS}-analytics-anchor`;

// Card-state renderers (idle / loading / data) for the per-class summary
// widget that paper.nu schedule cards inherit. Status-bar logic lives in
// status-bar-ui.ts and chip factories live in widget-chips.ts; this file
// just orchestrates which chips a given state should show, signature-based
// idempotence, and the "open analytics" button in the corner.

export function renderIdle(
  widget: HTMLElement,
  onLoad: () => void,
  onOpenAnalytics?: () => void
): void {
  const signature = `idle|${onOpenAnalytics ? "1" : "0"}`;
  if (widget.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  widget.textContent = "";
  widget.title = "Click to fetch CTEC summary for this class.";

  const summary = widget.ownerDocument.createElement("div");
  summary.className = `${WIDGET_CLASS}-summary`;

  const chip = widget.ownerDocument.createElement("button");
  chip.type = "button";
  chip.className = `${WIDGET_CLASS}-chip is-muted ${WIDGET_CLASS}-chip-button`;
  chip.append(createIcon("spark"), document.createTextNode("Load CTEC"));

  const trigger = (event: Event) => {
    preventAndStop(event);
    onLoad();
  };
  chip.addEventListener("pointerdown", trigger);
  chip.addEventListener("click", preventAndStop);
  chip.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    trigger(event);
  });

  summary.appendChild(chip);
  attachAnalyticsAnchor(widget, onOpenAnalytics);
  widget.appendChild(summary);
  widget.dataset.bcPaperCtecSignature = signature;
}

export function renderLoading(
  widget: HTMLElement,
  message = "CTEC…",
  onOpenAnalytics?: () => void
): void {
  const signature = `loading|${message}|${onOpenAnalytics ? "1" : "0"}`;
  if (widget.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  widget.textContent = "";
  widget.title = "Better CAESAR is loading Northwestern CTEC data for this class.";

  const summary = widget.ownerDocument.createElement("div");
  summary.className = `${WIDGET_CLASS}-summary`;
  const spinner = widget.ownerDocument.createElement("span");
  spinner.className = `${WIDGET_CLASS}-spinner`;
  spinner.setAttribute("role", "status");
  spinner.setAttribute("aria-label", "Loading CTEC");
  summary.appendChild(spinner);
  summary.appendChild(makeChip("spark", message, "is-muted"));
  attachAnalyticsAnchor(widget, onOpenAnalytics);
  widget.appendChild(summary);
  widget.dataset.bcPaperCtecSignature = signature;
}

export function renderWidget(
  widget: HTMLElement,
  data: PaperCtecWidgetData,
  onAuthChipClick?: () => void,
  onOpenAnalytics?: () => void
): void {
  const signature = `${buildWidgetSignature(data)}|a:${onOpenAnalytics ? "1" : "0"}`;
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
    attachAnalyticsAnchor(widget, onOpenAnalytics);
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  if (data.state === "auth-required") {
    widget.title = "Click to open the Northwestern login prompt for Better CAESAR.";
    summary.appendChild(makeAuthChip(onAuthChipClick));
    attachAnalyticsAnchor(widget, onOpenAnalytics);
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  if (data.state === "error") {
    widget.title = data.message;
    summary.appendChild(makeChip("spark", "CTEC unavailable", "is-muted"));
    attachAnalyticsAnchor(widget, onOpenAnalytics);
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  const { aggregate } = data;
  widget.title = buildTooltip(aggregate);

  // Primary chip set: instruction + course + learned + hours. Drops to a
  // challenge / interest fallback when none of the primary metrics survived
  // the parser — some courses only have those secondary metrics published.
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
  attachAnalyticsAnchor(widget, onOpenAnalytics);
  widget.dataset.bcPaperCtecSignature = signature;
}

export { hideStatusBar, renderStatusBar } from "./status-bar-ui";

// Mounts (or refreshes) the analytics button as a direct child of the
// outer schedule card so it can visually hang below the card edge instead
// of crowding the chip row. Lives outside the dense-card content area so
// it's not clipped by `overflow: hidden` on the dense-card host. Idempotent:
// always replaces the previous anchor, so the click handler closure stays
// in sync with the latest render.
function attachAnalyticsAnchor(
  widget: HTMLElement,
  onOpenAnalytics?: () => void
): void {
  const card = widget.closest<HTMLElement>(
    PAPER_CTEC_CONFIG.selectors.scheduleCard
  );
  if (!card) return;

  const existing = card.querySelector<HTMLElement>(
    `:scope > .${ANALYTICS_ANCHOR_CLASS}`
  );
  existing?.remove();

  if (!onOpenAnalytics) return;

  const button = makeAnalyticsButton(onOpenAnalytics);
  button.classList.add(ANALYTICS_ANCHOR_CLASS);
  card.appendChild(button);
}

function makeAnalyticsButton(onClick: () => void): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${WIDGET_CLASS}-analytics-btn`;
  button.title = "Open the full CTEC analytics view for this class.";
  button.setAttribute("aria-label", "Open CTEC analytics");
  button.append(createIcon("chart"));
  const labelEl = document.createElement("span");
  labelEl.className = `${WIDGET_CLASS}-analytics-btn-label`;
  labelEl.textContent = "Analytics";
  button.append(labelEl);

  const trigger = (event: Event) => {
    preventAndStop(event);
    onClick();
  };
  button.addEventListener("pointerdown", trigger);
  button.addEventListener("click", preventAndStop);
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    trigger(event);
  });

  return button;
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

// Includes every aggregate field the chip set depends on. Stars/values mode
// is part of the signature so a settings flip re-renders even without a
// data change. ratingPercentSignature is included for the same reason.
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
