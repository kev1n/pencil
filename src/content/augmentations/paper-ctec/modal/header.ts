import { html, type TemplateResult } from "lit-html";

import { extractCatalogLabel } from "../../../ctec-index/helpers";
import type { CtecAnalyticsStrategy } from "../../ctec-links/types";
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
// strategy selector (always visible — lets the user pivot even when the
// current lens has no data), optional refresh-flash banner, optional tab
// strip (only when data is loaded; otherwise the body shows a status card).
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
      ${renderStrategySelector(input, callbacks)}
      ${input.refreshFlash ? renderRefreshFlash(input.refreshFlash, callbacks) : ""}
      ${input.data ? renderTabs(state, callbacks, input.data) : ""}
    </header>`;
  }
};

type StrategyOption = {
  id: CtecAnalyticsStrategy;
  label: string;
  shortDescription: string;
};

const STRATEGY_OPTIONS: readonly StrategyOption[] = [
  {
    id: "combo",
    label: "Course + Prof",
    shortDescription: "This professor's sections of this course"
  },
  {
    id: "course",
    label: "Course",
    shortDescription: "Every professor who has taught this course"
  },
  {
    id: "instructor",
    label: "Prof",
    shortDescription: "Every course this professor has taught"
  }
];

// Segmented control above the disclaimer. Each click persists globally
// (chip ratings + future modal opens), but the user can still flip back
// without consequence — strategies share the same per-subject cache.
function renderStrategySelector(
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  // All three tabs always render, even when the broader lens would
  // surface the same rows as combo. Hiding "redundant" tabs proved
  // confusing in practice: users who'd just used a lens saw its tab
  // vanish on the next combo switch, and users who'd never explored
  // the broader lens had no way to find it. Predictable affordances
  // win over auto-hiding. The wizard choose-stage still respects
  // redundancy because that's a one-time pick with its own "0
  // sections" framing for empty pathways.
  const options = STRATEGY_OPTIONS;
  return html`<div class="bc-paper-ctec-modal-strategy-row">
    <div
      class="bc-paper-ctec-modal-strategy"
      role="tablist"
      aria-label="CTEC view"
    >
      ${options.map((option) => {
        const isActive = input.strategy === option.id;
        return html`<button
          type="button"
          class=${`bc-paper-ctec-modal-strategy-option${
            isActive ? " is-active" : ""
          }`}
          role="tab"
          aria-selected=${isActive ? "true" : "false"}
          title=${option.shortDescription}
          @click=${(event: Event) => {
            preventAndStop(event);
            if (isActive) return;
            callbacks.onStrategyChange(option.id);
          }}
        >${option.label}</button>`;
      })}
    </div>
    ${input.strategy === "combo"
      ? ""
      : html`<button
          type="button"
          class="bc-paper-ctec-modal-strategy-reopen"
          title="Adjust which sections are loaded for the active lens"
          @click=${(event: Event) => {
            preventAndStop(event);
            callbacks.onOpenDryRun();
          }}
        >Adjust selection…</button>`}
    ${input.data ? renderDisclaimer(input) : ""}
  </div>`;
}

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
  // Incremental "Load N more terms" only makes sense in combo view —
  // course and instructor lenses are explored through the wizard's
  // preset picker (which sets the scope explicitly), and the
  // "(M left)" counter in those lenses points at every untouched
  // section CAESAR knows about, which can balloon past 20+ and isn't
  // the right affordance for the lens's "broader summary" framing.
  const showLoadMore =
    input.strategy === "combo" && (input.canLoadMore || input.loading);
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

// Single-line scope pill sitting between the strategy selector and tabs.
// Tells the user which lens is active and the size of the aggregate
// window. The orange "name" pill tracks the variable axis: combo +
// instructor highlight the professor; course highlights the course code.
function renderDisclaimer(input: AnalyticsModalInput): TemplateResult {
  const instructor = input.identity.instructor.trim();
  const code = `${input.identity.subject} ${input.identity.catalog}`;
  const terms = input.data?.terms ?? [];
  const termCount = terms.length;
  const termLabel = termCount === 1 ? "term" : "terms";
  const termFragment = html`<span class="bc-paper-ctec-modal-disclaimer-count"
    >${termCount} ${termLabel}</span
  >`;
  const namePill = (label: string) =>
    html`<span class="bc-paper-ctec-modal-disclaimer-name">${label}</span>`;

  let body: TemplateResult;
  if (input.strategy === "course") {
    const profCount = new Set(
      terms
        .map((t) => t.instructor.trim().toLowerCase())
        .filter((v) => v.length > 0)
    ).size;
    const acrossClause =
      profCount > 0
        ? html` across ${profCount} ${profCount === 1 ? "professor" : "professors"}`
        : "";
    body = html`All ${namePill(code)} sections — ${termFragment}${acrossClause}`;
  } else if (input.strategy === "instructor") {
    const courseCount = new Set(
      terms
        .map((t) => extractCatalogLabel(t.description))
        .filter((v) => v.length > 0)
    ).size;
    const acrossClause =
      courseCount > 0
        ? html` across ${courseCount} ${courseCount === 1 ? "course" : "courses"}`
        : "";
    const profPill = instructor ? namePill(instructor) : "this professor";
    body = html`${profPill}'s ${input.identity.subject} teaching —
      ${termFragment}${acrossClause}`;
  } else {
    const profPill = instructor ? namePill(instructor) : "this professor";
    body = html`${profPill}'s ${code} — ${termFragment}`;
  }

  return html`<div
    class="bc-paper-ctec-modal-disclaimer"
    role="note"
    aria-label="Data scope"
  >${body}</div>`;
}

function renderRefreshFlash(
  flash: ModalRefreshFlash,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const icon = flash.kind === "success" ? "✓" : "!";
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
