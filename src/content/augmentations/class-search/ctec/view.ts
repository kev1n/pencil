// Renders the CTEC pill area inside a section-row's CTEC cell. Reuses
// paper-ctec's chip helpers (globalChip, metricChip, makeChip,
// iconTemplate) so the visual language matches the paper.nu schedule-card
// widget exactly. Only the host container class differs (bc-cs-ctec-host
// vs bc-paper-ctec) so cleanup paths in either augmentation don't sweep
// the other.

import { html, render, type TemplateResult } from "lit-html";
import { CAESAR_CONNECTION_LABEL, CAESAR_CONNECTION_MESSAGE } from "../../../peoplesoft/connection";

import { getOrCreatePreviewController } from "../../paper-ctec/analytics-preview";
import { WIDGET_CLASS } from "../../paper-ctec/constants";
import type { ModalDisplayData } from "../../paper-ctec/modal-data";
import {
  globalChip,
  errorChip,
  makeChip,
  metricChip
} from "../../paper-ctec/widget-chips";
import type { PaperCtecWidgetData } from "../../paper-ctec/types";

export const CTEC_HOST_CLASS = "bc-cs-ctec-host";

// Mirror of paper-ctec/schedule-ui.ts:renderIdle — same chip + icon, but
// without the analytics-anchor side-effect (we render a separate
// Analytics button via renderFound below). Idle host carries no chips
// until the user explicitly clicks Load.
export function renderIdle(host: HTMLElement, onLoad: () => void, caesarUnreachable = false): void {
  host.dataset.state = "idle";
  host.title = caesarUnreachable
    ? CAESAR_CONNECTION_MESSAGE
    : "Load this section's CTEC ratings.";

  render(
    html`<div class="bc-cs-ctec-summary">
      <button
        type="button"
        class="bc-cs-ctec-load-btn"
        title=${host.title}
        aria-label=${caesarUnreachable ? `${CAESAR_CONNECTION_LABEL}. Retry CTEC` : "Load CTEC"}
        @click=${(event: Event) => {
          event.preventDefault();
          event.stopPropagation();
          onLoad();
        }}
      ><span>${caesarUnreachable ? CAESAR_CONNECTION_LABEL : "CTEC"}</span></button>
    </div>`,
    host
  );
}

export function renderLoading(
  host: HTMLElement,
  message = "Loading CTEC"
): void {
  host.dataset.state = "loading";
  host.title = "Loading CTEC ratings for this section.";

  render(
    html`<div class="bc-cs-ctec-summary">
      <span class="bc-cs-ctec-loading">
        <span class="bc-cs-ctec-spinner" role="status" aria-label="Loading CTEC"></span>
        <span class="bc-cs-ctec-message">${message}</span>
      </span>
    </div>`,
    host
  );
}

export function renderResolved(
  host: HTMLElement,
  data: PaperCtecWidgetData,
  onAnalyticsClick: () => void,
  getPreviewData?: () => ModalDisplayData | null
): void {
  host.dataset.state = data.state;
  if (data.state === "error") {
    host.title = data.message;
  } else if (data.state === "no-access") {
    host.title = "Northwestern hasn't given this NetID access to CTECs.";
  } else {
    host.removeAttribute("title");
  }

  render(
    html`<div class="bc-cs-ctec-summary">
      ${data.state === "found"
        ? renderAnalyticsButton(onAnalyticsClick, buildSummary(data))
        : buildSummary(data)}
    </div>`,
    host
  );

  // Hover preview popup — same controller paper-ctec uses on schedule
  // cards, anchored to the section row's <li> instead of a paper.nu card.
  // Each section row is its own preview surface (per-instructor); the
  // popup positions absolutely against the row (CSS makes <li> position:
  // relative). Only wired in the "found" state — other states have
  // nothing chart-worthy to preview.
  if (data.state === "found" && getPreviewData) {
    const row = host.closest<HTMLElement>("li.bc-cs-section");
    if (row) {
      const controller = getOrCreatePreviewController(row);
      controller.refreshData(getPreviewData, onAnalyticsClick);
      const chips = host.querySelectorAll<HTMLElement>(
        `.${WIDGET_CLASS}-chip`
      );
      for (const chip of Array.from(chips)) controller.attachTrigger(chip);
    }
  }
}

// The loaded numbers are the button: one chip, same shape as the CTEC chip
// it replaces, that opens the analytics sheet.
function renderAnalyticsButton(
  onClick: () => void,
  summary: TemplateResult | TemplateResult[]
): TemplateResult {
  return html`<button
    type="button"
    class="bc-cs-ctec-load-btn bc-cs-ctec-analytics-btn"
    title="Open CTEC analytics for this section."
    aria-label="Open CTEC analytics"
    @click=${(event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }}
  >${summary}</button>`;
}

function buildSummary(
  data: PaperCtecWidgetData
): TemplateResult | TemplateResult[] {
  if (data.state === "not-found") {
    return makeChip("spark", "No CTEC", "is-muted");
  }

  if (data.state === "no-access") {
    return makeChip(
      "lock",
      "No CTEC access",
      "is-muted",
      "Northwestern hasn't given this NetID access to CTECs."
    );
  }

  if (data.state === "error") {
    return errorChip(data.message);
  }

  const { aggregate } = data;
  const gbl = globalChip(aggregate);
  const hrs = metricChip("Hrs", "Hours", aggregate.metrics.hours, aggregate, "hours");
  const chips = [gbl, hrs].filter(
    (chip): chip is TemplateResult => chip !== null
  );

  if (chips.length === 0) {
    const fallback = [
      metricChip("Challenge", "Challenge", aggregate.metrics.challenging, aggregate, "rating"),
      metricChip("Interest", "Interest", aggregate.metrics.stimulating, aggregate, "rating")
    ].filter((chip): chip is TemplateResult => chip !== null);

    if (fallback.length > 0) return fallback;
    return makeChip("spark", "See analytics", "is-muted");
  }

  return chips;
}
