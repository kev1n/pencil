import { html, render, type TemplateResult } from "lit-html";

import { getOrCreatePreviewController } from "./analytics-preview";
import { PAPER_CTEC_CONFIG } from "./config";
import { WIDGET_CLASS } from "./constants";
import type { ModalDisplayData } from "./modal-data";
import type { PaperCtecWidgetData } from "./types";
import { createIcon, iconTemplate, preventAndStop, type IconName } from "./ui-shared";
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
// just orchestrates which chips a given state should show, hands the
// composed template to lit-html for diffed re-render, and threads the
// "open analytics" button into the corner anchor.

export function renderIdle(
  widget: HTMLElement,
  onLoad: () => void,
  onOpenAnalytics?: () => void
): void {
  widget.title = "Click to fetch CTEC summary for this class.";

  render(
    html`<div class=${`${WIDGET_CLASS}-summary`}>
      <button
        type="button"
        class=${`${WIDGET_CLASS}-chip is-muted ${WIDGET_CLASS}-chip-button`}
        @pointerdown=${(event: Event) => {
          preventAndStop(event);
          onLoad();
        }}
        @click=${preventAndStop}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          preventAndStop(event);
          onLoad();
        }}
      >${iconTemplate("spark")}Load CTEC</button>
    </div>`,
    widget
  );

  attachAnalyticsAnchor(widget, onOpenAnalytics);
}

export function renderLoading(
  widget: HTMLElement,
  message = "CTEC…",
  onOpenAnalytics?: () => void
): void {
  widget.title = "pencil.nu is loading Northwestern CTEC data for this class.";

  render(
    html`<div class=${`${WIDGET_CLASS}-summary`}>
      <span
        class=${`${WIDGET_CLASS}-spinner`}
        role="status"
        aria-label="Loading CTEC"
      ></span>
      ${makeChip("spark", message, "is-muted")}
    </div>`,
    widget
  );

  attachAnalyticsAnchor(widget, onOpenAnalytics);
}

export function renderWidget(
  widget: HTMLElement,
  data: PaperCtecWidgetData,
  onAuthChipClick?: () => void,
  onOpenAnalytics?: () => void,
  getPreviewData?: AnalyticsPreviewSource
): void {
  // Title is updated via direct DOM (lit-html targets the widget's children;
  // the host's title attribute is independent).
  if (data.state === "auth-required") {
    widget.title = "Click to open the Northwestern login prompt for pencil.nu.";
  } else if (data.state === "error") {
    widget.title = data.message;
  } else {
    widget.removeAttribute("title");
  }

  // chips list is captured before render so we can pass it through to the
  // analytics-preview hover wiring after lit-html plants the DOM.
  const summary = buildWidgetSummary(data, onAuthChipClick);

  render(
    html`<div class=${`${WIDGET_CLASS}-summary`}>${summary}</div>`,
    widget
  );

  attachAnalyticsAnchor(widget, onOpenAnalytics);

  if (data.state === "found" && getPreviewData) {
    const chipNodes = Array.from(
      widget.querySelectorAll<HTMLElement>(
        `:scope > .${WIDGET_CLASS}-summary > .${WIDGET_CLASS}-chip`
      )
    );
    if (chipNodes.length > 0) {
      attachPreviewToChips(widget, chipNodes, getPreviewData);
    }
  }
}

// Computes the inner summary template for `renderWidget`. Pulled out so
// the chip set is easy to follow without weaving render() ergonomics
// through the data-state branches.
function buildWidgetSummary(
  data: PaperCtecWidgetData,
  onAuthChipClick?: () => void
): TemplateResult | TemplateResult[] {
  if (data.state === "not-found") {
    return makeChip("spark", "No CTEC", "is-muted");
  }

  if (data.state === "auth-required") {
    return makeAuthChipTemplate(onAuthChipClick);
  }

  if (data.state === "error") {
    return makeChip("spark", "CTEC unavailable", "is-muted");
  }

  const { aggregate } = data;
  const gbl = globalChip(aggregate);
  const hrs = metricChip("Hrs", "Hours", aggregate.metrics.hours, aggregate, "hours");
  const chips = [gbl, hrs].filter(
    (chip): chip is TemplateResult => chip !== null
  );

  if (chips.length === 0) {
    const fallbackChips = [
      metricChip("CHLG", "Challenge", aggregate.metrics.challenging, aggregate, "rating"),
      metricChip("INT", "Interest", aggregate.metrics.stimulating, aggregate, "rating")
    ].filter((chip): chip is TemplateResult => chip !== null);

    if (fallbackChips.length > 0) return fallbackChips;

    return makeChip(
      "spark",
      "CTEC detail",
      "is-muted",
      "Matching CTEC reports were found, but the compact card does not have Global, Hours, Challenge, or Interest summary metrics for this course."
    );
  }

  return chips;
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
    label = "Added";
    title = "Added to your CAESAR shopping cart.";
    disabled = true;
    stateAttr = "success";
  } else if (state.kind === "already") {
    icon = "cart";
    label = "In cart";
    title = "This class is in your CAESAR shopping cart.";
    disabled = true;
    stateAttr = "in-cart";
  } else if (state.kind === "enrolled") {
    icon = "cart";
    label = "Enrolled";
    title = "You're enrolled in this class.";
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

function makeAuthChipTemplate(onClick?: () => void): TemplateResult {
  const handler = onClick
    ? (event: Event) => {
        preventAndStop(event);
        onClick();
      }
    : undefined;

  return html`<button
    type="button"
    class=${`${WIDGET_CLASS}-chip is-warn ${WIDGET_CLASS}-chip-button`}
    title="Open the Northwestern login prompt for pencil.nu."
    @pointerdown=${handler}
    @click=${preventAndStop}
    @keydown=${(event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      handler?.(event);
    }}
  >${iconTemplate("lock")}Login needed</button>`;
}

// (Previously this file exported `buildWidgetSignature` for the
// hand-rolled idempotent-render pattern. lit-html now does that diffing
// internally from the template structure + bound values, so the helper
// was deleted along with the dataset.bcPaperCtecSignature dance.)
