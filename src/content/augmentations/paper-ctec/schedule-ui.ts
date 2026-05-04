import { isFeatureEnabled } from "../../settings";
import { getOrCreatePreviewController } from "./analytics-preview";
import { PAPER_CTEC_CONFIG } from "./config";
import { COMPACT_CARD_STARS_FEATURE_ID, WIDGET_CLASS } from "./constants";
import type { ModalDisplayData } from "./modal-data";
import { ratingPercentSignature } from "./rating-format";
import type { PaperCtecWidgetData } from "./types";
import { createIcon, preventAndStop, type IconName } from "./ui-shared";
import { globalChip, makeChip, metricChip } from "./widget-chips";

export type AnalyticsPreviewSource = () => ModalDisplayData | null;

export const ACTIONS_ANCHOR_CLASS = `${WIDGET_CLASS}-actions-anchor`;
const ANALYTICS_BTN_CLASS = `${WIDGET_CLASS}-analytics-btn`;
const CART_BTN_CLASS = `${WIDGET_CLASS}-cart-btn`;

// Per-card UI state for the inline "+ Cart" button. Lives in the
// augmentation (passed in to attachCartAnchor) so the button can survive
// the card's continual re-renders and reflect mid-flight progress without
// flicker. `kind` drives label + style; the controller flips back to idle
// after a short delay on success.
export type CartAnchorState =
  | { kind: "idle" }
  | { kind: "adding"; message: string }
  | { kind: "success"; classNumber: string }
  | { kind: "already"; classNumber: string }
  | { kind: "enrolled"; classNumber: string }
  | { kind: "error"; message: string };

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
  onOpenAnalytics?: () => void,
  getPreviewData?: AnalyticsPreviewSource
): void {
  const signature = `${buildWidgetSignature(data)}|a:${onOpenAnalytics ? "1" : "0"}|p:${
    getPreviewData ? "1" : "0"
  }`;
  if (widget.dataset.bcPaperCtecSignature === signature) {
    if (data.state === "found" && getPreviewData) {
      refreshPreviewSource(widget, getPreviewData);
    }
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

  // Primary chip set: a single rolled-up Global rating chip + hours. The
  // GBL chip averages Instruction / Course / Learned (matching the modal's
  // Global KPI), and the Hrs chip is unchanged. Hovering either one opens
  // the analytics preview popup.
  const gbl = globalChip(aggregate);
  const hrs = metricChip("Hrs", "Hours", aggregate.metrics.hours, aggregate, "hours");
  const chips = [gbl, hrs].filter((chip): chip is HTMLElement => !!chip);

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
          "Matching CTEC reports were found, but the compact card does not have Global, Hours, Challenge, or Interest summary metrics for this course."
        )
      );
    }
  } else {
    chips.forEach((chip) => summary.appendChild(chip));
    if (getPreviewData) attachPreviewToChips(widget, chips, getPreviewData);
  }
  attachAnalyticsAnchor(widget, onOpenAnalytics);
  widget.dataset.bcPaperCtecSignature = signature;
}

function attachPreviewToChips(
  widget: HTMLElement,
  chips: HTMLElement[],
  getPreviewData: AnalyticsPreviewSource
): void {
  const card = widget.closest<HTMLElement>(
    PAPER_CTEC_CONFIG.selectors.scheduleCard
  );
  if (!card) return;
  const controller = getOrCreatePreviewController(card);
  controller.refreshData(getPreviewData);
  for (const chip of chips) {
    controller.attachTrigger(chip);
  }
}

function refreshPreviewSource(
  widget: HTMLElement,
  getPreviewData: AnalyticsPreviewSource
): void {
  const card = widget.closest<HTMLElement>(
    PAPER_CTEC_CONFIG.selectors.scheduleCard
  );
  if (!card) return;
  getOrCreatePreviewController(card).refreshData(getPreviewData);
}

export { hideStatusBar, renderStatusBar } from "./status-bar-ui";

// Both action buttons (cart + analytics) live inside a single right-anchored
// wrapper so they always sit flush against the card's right edge — using a
// fixed pixel offset would collide on narrow cards (short timeslots) and
// overlap each other once labels expand on hover. The wrapper is mounted as
// a direct child of the outer schedule card so it escapes the dense-card
// `overflow: hidden`.
function getOrCreateActionsAnchor(card: HTMLElement): HTMLElement {
  let anchor = card.querySelector<HTMLElement>(
    `:scope > .${ACTIONS_ANCHOR_CLASS}`
  );
  if (!anchor) {
    anchor = card.ownerDocument.createElement("div");
    anchor.className = ACTIONS_ANCHOR_CLASS;
    card.appendChild(anchor);
  }
  return anchor;
}

// Adds (or refreshes) a "+ Cart" button next to the analytics button on
// the schedule card. Always present — independent of CTEC fetch state —
// because the user might want to add to cart without ever loading CTECs.
// State-driven icon/label/style: idle → adding → success/already/error.
//
// Idempotent on the state signature: paper.nu remounts schedule cards on
// every drag, scroll, etc., so the augmentation runner re-invokes us many
// times per second. Recreating the button each time would tear down the
// browser's :hover state mid-transition (label collapses again the moment
// the cursor enters), so we dedup on a signature derived from `state`.
// The latest onClick is stashed on the existing button so it stays current.
export function attachCartAnchor(
  widget: HTMLElement,
  state: CartAnchorState,
  onClick: () => void
): void {
  const card = widget.closest<HTMLElement>(
    PAPER_CTEC_CONFIG.selectors.scheduleCard
  );
  if (!card) return;

  const anchor = getOrCreateActionsAnchor(card);
  const signature = buildCartSignature(state);
  const existing = anchor.querySelector<HTMLElement>(`:scope > .${CART_BTN_CLASS}`);
  if (existing && existing.dataset.bcCartSig === signature) {
    (existing as HTMLButtonElement & { __bcCartClick?: () => void }).__bcCartClick =
      onClick;
    return;
  }
  existing?.remove();

  const button = makeCartButton(state, onClick);
  button.dataset.bcCartSig = signature;
  // Cart goes first so it ends up on the left of analytics in DOM order.
  anchor.prepend(button);
}

function buildCartSignature(state: CartAnchorState): string {
  if (state.kind === "adding") return `adding|${state.message}`;
  if (state.kind === "success") return `success|${state.classNumber}`;
  if (state.kind === "already") return `already|${state.classNumber}`;
  if (state.kind === "enrolled") return `enrolled|${state.classNumber}`;
  if (state.kind === "error") return `error|${state.message}`;
  return "idle";
}

function makeCartButton(
  state: CartAnchorState,
  onClick: () => void
): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = CART_BTN_CLASS;

  let icon: IconName = "plus";
  let label = "Add to shopping cart";
  let title = "Add this section to your CAESAR shopping cart.";
  let disabled = false;
  let stateAttr: string | null = null;

  if (state.kind === "adding") {
    icon = "plus";
    label = state.message || "Adding…";
    title = state.message;
    disabled = true;
    stateAttr = "loading";
  } else if (state.kind === "success") {
    icon = "cart";
    label = `Added #${state.classNumber}`;
    title = `Added class #${state.classNumber} to your CAESAR shopping cart.`;
    disabled = true;
    stateAttr = "success";
  } else if (state.kind === "already") {
    icon = "cart";
    label = "In cart";
    title = `Class #${state.classNumber} is in your CAESAR shopping cart.`;
    disabled = true;
    stateAttr = "in-cart";
  } else if (state.kind === "enrolled") {
    icon = "cart";
    label = "Enrolled";
    title = `You're enrolled in class #${state.classNumber}.`;
    disabled = true;
    stateAttr = "enrolled";
  } else if (state.kind === "error") {
    icon = "alert";
    label = "Retry";
    title = state.message;
    stateAttr = "error";
  }

  if (stateAttr) button.dataset.cartState = stateAttr;
  button.title = title;
  button.disabled = disabled;
  button.setAttribute("aria-label", title);

  button.append(createIcon(icon));
  const labelEl = document.createElement("span");
  labelEl.className = `${WIDGET_CLASS}-cart-btn-label`;
  labelEl.textContent = label;
  button.append(labelEl);

  const buttonRef = button as HTMLButtonElement & { __bcCartClick?: () => void };
  buttonRef.__bcCartClick = onClick;

  const trigger = (event: Event) => {
    preventAndStop(event);
    if (button.disabled) return;
    buttonRef.__bcCartClick?.();
  };
  button.addEventListener("pointerdown", trigger);
  button.addEventListener("click", preventAndStop);
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    trigger(event);
  });

  return button;
}

function attachAnalyticsAnchor(
  widget: HTMLElement,
  onOpenAnalytics?: () => void
): void {
  const card = widget.closest<HTMLElement>(
    PAPER_CTEC_CONFIG.selectors.scheduleCard
  );
  if (!card) return;

  const anchor = getOrCreateActionsAnchor(card);
  const existing = anchor.querySelector<HTMLElement>(
    `:scope > .${ANALYTICS_BTN_CLASS}`
  );
  existing?.remove();

  if (!onOpenAnalytics) {
    // No analytics callback — drop the wrapper if cart was also missing so
    // we don't leave an empty positioned element behind.
    if (!anchor.querySelector(`:scope > .${CART_BTN_CLASS}`)) anchor.remove();
    return;
  }

  const button = makeAnalyticsButton(onOpenAnalytics);
  anchor.appendChild(button);
}

function makeAnalyticsButton(onClick: () => void): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = ANALYTICS_BTN_CLASS;
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
