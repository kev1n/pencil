import { html, type TemplateResult } from "lit-html";

import type { ModalDisplayData } from "../modal-data";
import { preventAndStop, stopPropagation } from "../ui-shared";
import type { Section } from "./section";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState,
  ModalRefreshFlash,
  ModalTab
} from "./types";

export type HeaderSectionProps = {
  doc: Document;
  input: AnalyticsModalInput;
  state: AnalyticsModalState;
  callbacks: AnalyticsModalCallbacks;
};

// Modal header: close button, identity row (title + meta strip + actions),
// optional refresh-flash banner, optional tab strip. The tab strip only
// appears when data is loaded — otherwise the body shows a status card.
export const HeaderSection: Section<HeaderSectionProps> = {
  render({ doc: _doc, input, state, callbacks }) {
    return html`<header class="bc-paper-ctec-modal-header">
      <button
        type="button"
        class="bc-paper-ctec-modal-close"
        aria-label="Close"
        @click=${(event: Event) => {
          preventAndStop(event);
          callbacks.onClose();
        }}
      >✕</button>
      <div class="bc-paper-ctec-modal-identity">
        <div>
          <h1 class="bc-paper-ctec-modal-title">
            ${input.identity.title || `${input.identity.subject} ${input.identity.catalog}`}
          </h1>
          <div class="bc-paper-ctec-modal-meta">
            <span class="bc-paper-ctec-modal-code"
              >${input.identity.subject} ${input.identity.catalog}</span
            >
            ${metaItem(input.identity.instructor, input.identity.sectionTerm)}
            ${input.data
              ? metaItem(
                  `${input.data.terms.length} ${
                    input.data.terms.length === 1 ? "term" : "terms"
                  }`,
                  `${input.data.responses} responses`
                )
              : ""}
          </div>
        </div>
        ${renderActions(input, callbacks)}
      </div>
      ${input.refreshFlash ? renderRefreshFlash(input.refreshFlash, callbacks) : ""}
      ${input.data
        ? html`${renderDisclaimer(input)}${renderTabs(state, callbacks, input.data)}`
        : ""}
    </header>`;
  }
};

const REFRESH_TOOLTIP =
  "Use this when a new round of CTECs comes out each quarter. Asks Northwestern for any newly-published evaluations for this course and adds them to your view. Runs in the background — your existing data stays visible the whole time.";

// Right side: Refresh + Load-more + Open-original-report. These are the
// controls that used to live in the side panel; they're now part of the
// modal header so the analytics view is self-contained. Templated via
// lit-html — the refresh-button tooltip is just a styled `<span>` child of
// the host (the design-system `bc-tooltip-host` class drives hover/focus
// behavior), so it inlines cleanly.
function renderActions(
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): TemplateResult | string {
  const showLoadMore = input.canLoadMore || input.loading;
  const showRefresh = input.canRefresh;
  const reportUrl = input.data?.course.reportUrl;

  if (!showLoadMore && !showRefresh && !reportUrl) return "";

  const batch =
    input.remainingTerms > 0
      ? Math.min(input.loadMoreBatchSize, input.remainingTerms)
      : input.loadMoreBatchSize;
  const loadMoreLabel = input.loading
    ? `Loading ${batch}…`
    : `Load ${batch} more term${batch === 1 ? "" : "s"}${
        input.remainingTerms > 0 ? ` (${input.remainingTerms} left)` : ""
      }`;
  const loadMoreTitle = `${input.parsedTermCount} loaded · ${input.remainingTerms} remaining. CTEC term reports load on demand to keep traffic on Northwestern's servers low.`;
  const loadMoreDisabled = input.loading || !input.canLoadMore;

  return html`<div class="bc-paper-ctec-modal-actions">
    ${showLoadMore
      ? html`<button
          type="button"
          class="bc-paper-ctec-modal-action-btn bc-paper-ctec-modal-action-loadmore"
          ?disabled=${loadMoreDisabled}
          title=${loadMoreTitle}
          @click=${(event: Event) => {
            preventAndStop(event);
            if (loadMoreDisabled) return;
            callbacks.onLoadMore();
          }}
        >${loadMoreLabel}</button>`
      : ""}
    ${showRefresh
      ? html`<button
          type="button"
          class="bc-paper-ctec-modal-action-btn bc-paper-ctec-modal-action-refresh bc-tooltip-host"
          ?disabled=${input.backgroundRefreshing}
          @click=${(event: Event) => {
            preventAndStop(event);
            if (input.backgroundRefreshing) return;
            callbacks.onRefresh();
          }}
        ><span
          >${input.backgroundRefreshing
            ? "Checking Northwestern…"
            : "↻ Check for new CTECs"}</span
          > <span class="bc-paper-ctec-modal-info-icon" aria-hidden="true">i</span
          ><span class="bc-tooltip bc-tooltip--rich bc-tooltip--right">${REFRESH_TOOLTIP}</span></button>`
      : ""}
    ${reportUrl
      ? html`<a
          class="bc-paper-ctec-modal-report-link"
          href=${reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          @click=${stopPropagation}
        >↗ Open original CTEC report</a>`
      : ""}
  </div>`;
}

// Persistent scope banner sitting between the identity row and tabs. The
// analytics view aggregates *only* the sections of this exact course taught
// by this exact professor — no cross-professor or cross-course mixing — and
// users were misreading trend deltas as comparing different instructors.
// This banner makes the scope unmissable on every tab.
function renderDisclaimer(input: AnalyticsModalInput): TemplateResult {
  const instructor = input.identity.instructor.trim();
  const code = `${input.identity.subject} ${input.identity.catalog}`;
  const termCount = input.data?.terms.length ?? 0;
  const termLabel = termCount === 1 ? "term" : "terms";
  const subject = instructor || "this professor";

  return html`<div
    class="bc-paper-ctec-modal-disclaimer"
    role="note"
    aria-label="Data scope"
  >
    <span class="bc-paper-ctec-modal-disclaimer-text">
      <span class="bc-paper-ctec-modal-disclaimer-headline">
        Showing only ${instructor
          ? html`<span class="bc-paper-ctec-modal-disclaimer-name">${instructor}</span>`
          : "this professor"}'s ${code} data
        ${termCount > 0
          ? html` · <span class="bc-paper-ctec-modal-disclaimer-count"
              >${termCount} ${termLabel}</span
            >`
          : ""}
      </span>
      <span class="bc-paper-ctec-modal-disclaimer-detail"
        >No other professors are mixed in. Every chart, average, trend, and
        “vs recent term” number on this page is computed from
        ${subject}'s own past sections of ${code} — nothing else.</span
      >
    </span>
  </div>`;
}

function renderRefreshFlash(
  flash: ModalRefreshFlash,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const icon =
    flash.kind === "success" ? "✓" : flash.kind === "auth" ? "🔒" : "!";
  const role = flash.kind === "success" ? "status" : "alert";

  let title: string;
  let body: string;
  if (flash.kind === "success") {
    if (flash.addedCount > 0) {
      title =
        flash.addedCount === 1
          ? "1 new evaluation found"
          : `${flash.addedCount} new evaluations found`;
      body = "Newly-published CTECs were added to your view.";
    } else {
      title = "You're up to date";
      body = "Northwestern has no new CTECs for this course right now.";
    }
  } else if (flash.kind === "auth") {
    title = "Northwestern login required";
    body = "Sign in to CAESAR and try again.";
  } else {
    title = "Couldn't check for new CTECs";
    body = flash.message;
  }

  return html`<div
    class=${`bc-paper-ctec-modal-flash bc-paper-ctec-modal-flash-${flash.kind}`}
    role=${role}
  >
    <span class="bc-paper-ctec-modal-flash-icon" aria-hidden="true">${icon}</span>
    <div class="bc-paper-ctec-modal-flash-text">
      <strong class="bc-paper-ctec-modal-flash-title">${title}</strong>
      <span class="bc-paper-ctec-modal-flash-body">${body}</span>
    </div>
    ${flash.kind === "auth"
      ? html`<button
          type="button"
          class="bc-paper-ctec-modal-flash-action"
          @click=${(event: Event) => {
            preventAndStop(event);
            callbacks.onLogin();
          }}
        >Open login</button>`
      : ""}
    <button
      type="button"
      class="bc-paper-ctec-modal-flash-dismiss"
      aria-label="Dismiss"
      @click=${(event: Event) => {
        preventAndStop(event);
        callbacks.onDismissRefreshFlash();
      }}
    >✕</button>
  </div>`;
}

function metaItem(primary: string, secondary: string): TemplateResult {
  return html`<span><strong>${primary}</strong>${secondary ? ` · ${secondary}` : ""}</span>`;
}

function renderTabs(
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  data: ModalDisplayData
): TemplateResult {
  const definitions: Array<{ id: ModalTab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "comments", label: "Comments", count: data.comments.length },
    { id: "terms", label: "Terms", count: data.terms.length }
  ];

  return html`<div class="bc-paper-ctec-modal-tabs">
    ${definitions.map(
      (definition) => html`<button
        type="button"
        class=${`bc-paper-ctec-modal-tab${
          state.tab === definition.id ? " is-active" : ""
        }`}
        @click=${(event: Event) => {
          preventAndStop(event);
          callbacks.onTabChange(definition.id);
        }}
      >${definition.label}${definition.count != null
          ? html`<span class="bc-paper-ctec-modal-tab-count"
              >${definition.count}</span
            >`
          : ""}</button>`
    )}
  </div>`;
}

// Backwards-compat: pre-Wave-6c callsite kept while the orchestrator
// migrates to lit-html sections wholesale.
export function renderHeader(
  doc: Document,
  input: AnalyticsModalInput,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return HeaderSection.render({ doc, input, state, callbacks });
}
