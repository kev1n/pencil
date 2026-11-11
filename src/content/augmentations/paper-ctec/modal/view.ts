import { html, render, type TemplateResult } from "lit-html";

import { extractCatalogLabel } from "../../../ctec-index/helpers";
import { seasonIcon, seasonOf } from "../../../design/icons";
import type { CtecAnalyticsStrategy } from "../../ctec-links/types";
import { ANALYTICS_MODAL_ID } from "../constants";
import type { ModalDisplayData, ModalTerm } from "../modal-data";
import { renderComments } from "./comments";
import {
  plural,
  termName,
  termShortYear,
  type SheetContext,
  type SheetLocal
} from "./common";
import { renderDryRun } from "./dry-run";
import { renderRatings, renderSummary, renderWorkload } from "./summary";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState
} from "./types";

// The CTEC analytics side sheet: a panel docked to the right edge, with the
// host page still visible and usable beside it. One scrolling column, no
// tabs; a term switch in the header turns the whole sheet into one term's
// CTEC. Owns the root element, the lit-html render lifecycle, Escape, and
// the bits of state that only matter while it is on screen (see SheetLocal).
export interface ModalView {
  open(
    input: AnalyticsModalInput,
    state: AnalyticsModalState,
    callbacks: AnalyticsModalCallbacks
  ): void;
  close(): void;
  isOpen(): boolean;
  // Where the sheet lives. Null docks it to the right edge of the page;
  // an element (Paper.nu's own Section Info panel) renders it in place.
  setHost(host: HTMLElement | null): void;
}

export interface ModalViewDeps {
  doc: Document;
}

type Current = {
  input: AnalyticsModalInput;
  state: AnalyticsModalState;
  callbacks: AnalyticsModalCallbacks;
};

export function createModalView(deps: ModalViewDeps): ModalView {
  const { doc } = deps;
  let root: HTMLElement | null = null;
  let current: Current | null = null;
  let shownFor = "";
  let host: HTMLElement | null = null;
  const local: SheetLocal = {
    lensOpen: false,
    scrub: null,
    peek: null,
    charts: new Map()
  };

  const rerender = (): void => {
    if (!root || !current) return;
    render(sheetTemplate(current, local, () => root, rerender), root);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !current) return;
    if (local.lensOpen) {
      local.lensOpen = false;
      rerender();
      return;
    }
    current.callbacks.onClose();
  };

  // The view menu closes when the student clicks anywhere else, on the
  // sheet or on the page beside it.
  const onPointerDown = (event: Event): void => {
    if (!local.lensOpen) return;
    const target = event.target as Element | null;
    if (target?.closest?.(".bc-sheet-lens")) return;
    local.lensOpen = false;
    rerender();
  };

  return {
    open(input, state, callbacks) {
      const inline = !!host && host.isConnected;
      const parent = inline ? host! : doc.body ?? doc.documentElement;
      if (!root || !root.isConnected) {
        root = doc.createElement("aside");
        root.id = ANALYTICS_MODAL_ID;
        doc.addEventListener("keydown", onKeydown);
        doc.addEventListener("pointerdown", onPointerDown, true);
      }
      if (root.parentElement !== parent) parent.appendChild(root);
      root.className = inline ? "bc-sheet bc-sheet--inline" : "bc-sheet";
      const key = `${input.identity.subject}|${input.identity.catalog}|${input.identity.instructor}|${input.strategy}`;
      if (key !== shownFor) {
        shownFor = key;
        local.lensOpen = false;
        local.scrub = null;
        local.peek = null;
      }
      current = { input, state, callbacks };
      root.setAttribute(
        "aria-label",
        `${courseCode(input)} evaluations`
      );
      rerender();
    },
    close() {
      doc.removeEventListener("keydown", onKeydown);
      doc.removeEventListener("pointerdown", onPointerDown, true);
      doc.getElementById(ANALYTICS_MODAL_ID)?.remove();
      root = null;
      current = null;
      shownFor = "";
    },
    isOpen() {
      return !!root && root.isConnected;
    },
    setHost(next) {
      host = next;
    }
  };
}

function courseCode(input: AnalyticsModalInput): string {
  return `${input.identity.subject} ${input.identity.catalog.replace(/-0$/, "")}`;
}

function sheetTemplate(
  current: Current,
  local: SheetLocal,
  sheet: () => HTMLElement | null,
  rerender: () => void
): TemplateResult {
  const { input, state, callbacks } = current;
  const data = input.freshLensLoading ? null : input.data;
  const term =
    data && state.selectedTermId
      ? data.terms.find((t) => t.id === state.selectedTermId) ?? null
      : null;

  const selectTerm = (id: string | null): void => {
    local.scrub = null;
    local.peek = null;
    callbacks.onTermChange(id);
    const body = sheet()?.querySelector(".bc-sheet-body");
    if (body) body.scrollTop = 0;
  };

  let body: TemplateResult | string;
  if (state.dryRun) {
    body = renderDryRun(input, state, callbacks);
  } else if (data) {
    const ctx: SheetContext = {
      input,
      data,
      state,
      callbacks,
      local,
      term,
      sheet,
      rerender,
      selectTerm
    };
    body = html`${renderSummary(ctx)}${renderRatings(ctx)}${renderWorkload(ctx)}${renderComments(ctx)}`;
  } else {
    body = renderStatus(input, callbacks);
  }

  // After picking another class from the no-CTECs list, the numbers on
  // screen belong to that class, so the heading names it.
  const picked = !state.dryRun && data ? state.activePreset : null;
  const shownCatalog = picked?.kind === "by-catalog" ? picked.catalog : null;
  const shownTitle = picked?.kind === "by-catalog" ? picked.title : "";

  return html`<header class="bc-sheet-top">
      <div class="bc-sheet-top-line">
        <span class="bc-sheet-code">${shownCatalog ?? courseCode(input)}</span>
        <div class="bc-sheet-top-right">
          ${renderLensMenu(input, callbacks, local, rerender)}
          ${input.canRefresh
            ? html`<button
                type="button"
                class="bc-sheet-icon-btn"
                data-bc-action-button="controller"
                aria-label="Check for new CTECs"
                title="Check for new CTECs. Run this when a new round of evaluations comes out; what you see stays put while it looks."
                ?disabled=${input.backgroundRefreshing}
                @click=${() => {
                  if (!input.backgroundRefreshing) callbacks.onRefresh();
                }}
              >${REFRESH_ICON}</button>`
            : ""}
          <button
            type="button"
            class="bc-sheet-icon-btn bc-sheet-close"
            aria-label="Close"
            @click=${() => callbacks.onClose()}
          >${CLOSE_ICON}</button>
        </div>
      </div>
      <h2 class="bc-sheet-title">${shownCatalog ? shownTitle || shownCatalog : courseTitle(input)}</h2>
      ${renderMeta(input, data, term)}
      ${renderNotice(input, callbacks)}
      ${data && !state.dryRun ? renderTermSwitch(input, data, term, selectTerm, callbacks) : ""}
    </header>
    <div
      class="bc-sheet-body"
      @scroll=${(event: Event) => {
        const el = event.currentTarget as HTMLElement;
        el.previousElementSibling?.classList.toggle("is-raised", el.scrollTop > 2);
      }}
    >${body}</div>`;
}

// "STAT 210-0 - Introductory Statistics" -> "Introductory Statistics".
function courseTitle(input: AnalyticsModalInput): string {
  if (input.data?.course.title) return input.data.course.title;
  const parts = input.identity.title
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? courseCode(input);
}

const CLOSE_ICON = html`<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
</svg>`;

const REFRESH_ICON = html`<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
  <path
    d="M11.5 7a4.5 4.5 0 1 1-1.5-3.35M11.6 1.9v2.5H9.1"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`;

const CHEVRON_ICON = html`<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
  <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

// ---------------------------------------------------------------------------
// View menu: which slice of CTECs the sheet is showing
// ---------------------------------------------------------------------------

const LENSES: ReadonlyArray<{ id: CtecAnalyticsStrategy; label: string }> = [
  { id: "combo", label: "This professor, this course" },
  { id: "course", label: "Everyone who taught it" },
  { id: "instructor", label: "Everything they teach" }
];

function renderLensMenu(
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks,
  local: SheetLocal,
  rerender: () => void
): TemplateResult {
  const active = LENSES.find((lens) => lens.id === input.strategy) ?? LENSES[0]!;
  const close = (): void => {
    local.lensOpen = false;
    rerender();
  };
  // A broader view that would show these same reports still opens, but
  // says so first.
  const hint = (id: CtecAnalyticsStrategy): string => {
    if (id === "course" && input.courseLensRedundant) return "No one else has";
    if (id === "instructor" && input.instructorLensRedundant) {
      return `Nothing else in ${input.identity.subject}`;
    }
    return "";
  };

  return html`<div class=${`bc-sheet-lens${local.lensOpen ? " is-open" : ""}`}>
    <button
      type="button"
      class="bc-sheet-lens-btn"
      aria-haspopup="listbox"
      aria-expanded=${local.lensOpen ? "true" : "false"}
      @click=${() => {
        local.lensOpen = !local.lensOpen;
        rerender();
      }}
    ><span>${active.label}</span>${CHEVRON_ICON}</button>
    ${local.lensOpen
      ? html`<div class="bc-sheet-lens-list" role="listbox">
          ${LENSES.map((lens) => {
            const on = lens.id === input.strategy;
            const note = hint(lens.id);
            return html`<button
              type="button"
              role="option"
              class=${`bc-sheet-lens-opt${on ? " is-on" : ""}`}
              aria-selected=${on ? "true" : "false"}
              @click=${() => {
                close();
                if (!on) callbacks.onStrategyChange(lens.id);
              }}
            ><span>${lens.label}</span>${note
                ? html`<span class="bc-sheet-lens-note">${note}</span>`
                : ""}</button>`;
          })}
          ${input.strategy === "combo"
            ? ""
            : html`<button
                type="button"
                class="bc-sheet-lens-opt bc-sheet-lens-adjust"
                @click=${() => {
                  close();
                  callbacks.onOpenDryRun();
                }}
              >Choose which sections</button>`}
        </div>`
      : ""}
  </div>`;
}

// ---------------------------------------------------------------------------
// Meta line, refresh notice, term switch
// ---------------------------------------------------------------------------

function distinct(values: string[]): number {
  return new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)).size;
}

function renderMeta(
  input: AnalyticsModalInput,
  data: ModalDisplayData | null,
  term: ModalTerm | null
): TemplateResult {
  const parts: Array<string | TemplateResult> = [];
  const instructor = input.identity.instructor.trim();

  if (term) {
    if (term.instructor.trim()) parts.push(term.instructor.trim());
    if (input.strategy === "instructor") parts.push(extractCatalogLabel(term.description));
    parts.push(plural(term.responses, "response"));
    if (term.reportUrl) {
      parts.push(html`<a
        class="bc-sheet-link"
        href=${term.reportUrl}
        target="_blank"
        rel="noopener noreferrer"
      >Open original report</a>`);
    }
  } else if (data) {
    if (input.strategy === "course") {
      const professors = distinct(data.terms.map((t) => t.instructor));
      parts.push(
        professors === 1 ? data.terms[0]!.instructor.trim() : plural(professors, "professor")
      );
    } else {
      if (instructor) parts.push(instructor);
      if (input.strategy === "instructor") {
        parts.push(
          plural(distinct(data.terms.map((t) => extractCatalogLabel(t.description))), "course")
        );
      }
    }
    parts.push(plural(data.responses, "response"));
  } else if (instructor) {
    parts.push(instructor);
  }

  return html`<div class="bc-sheet-meta">
    ${parts.map(
      (part, i) =>
        html`${i > 0 ? html`<span class="bc-sheet-meta-sep">·</span>` : ""}<span>${part}</span>`
    )}
  </div>`;
}

// One quiet line under the meta: what the last "check for new CTECs" found,
// or that one is running.
function renderNotice(
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): TemplateResult | string {
  const flash = input.refreshFlash;
  if (!flash) {
    return input.backgroundRefreshing
      ? html`<div class="bc-sheet-notice" role="status">Checking Northwestern for new CTECs</div>`
      : "";
  }
  const text =
    flash.kind === "error"
      ? `Couldn't check for new CTECs. ${flash.message}`
      : flash.addedCount > 0
        ? `${plural(flash.addedCount, "new evaluation")} added`
        : "Up to date. Northwestern has no new CTECs for this course.";
  return html`<div
    class=${`bc-sheet-notice${flash.kind === "error" ? " is-error" : ""}`}
    role=${flash.kind === "error" ? "alert" : "status"}
  >
    <span>${text}</span>
    <button
      type="button"
      class="bc-sheet-notice-x"
      aria-label="Dismiss"
      @click=${() => callbacks.onDismissRefreshFlash()}
    >${CLOSE_ICON}</button>
  </div>`;
}

function renderTermSwitch(
  input: AnalyticsModalInput,
  data: ModalDisplayData,
  selected: ModalTerm | null,
  selectTerm: (id: string | null) => void,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const button = (term: ModalTerm | null): TemplateResult => {
    const on = (term?.id ?? null) === (selected?.id ?? null);
    if (!term) {
      return html`<button
        type="button"
        role="tab"
        class=${`bc-sheet-term${on ? " is-on" : ""}`}
        aria-selected=${on ? "true" : "false"}
        @click=${() => selectTerm(null)}
      >All terms</button>`;
    }
    const season = seasonOf(term.term);
    // In the broader views two sections can share a term, so the full name
    // also says whose it is, or which course.
    const full = [
      termName(term.term),
      input.strategy === "course" ? term.instructor.trim() : "",
      input.strategy === "instructor" ? extractCatalogLabel(term.description) : ""
    ]
      .filter(Boolean)
      .join(", ");
    return html`<button
      type="button"
      role="tab"
      class=${`bc-sheet-term${on ? " is-on" : ""}`}
      aria-selected=${on ? "true" : "false"}
      aria-label=${full}
      title=${full}
      @click=${() => selectTerm(term.id)}
    >${season ? seasonIcon(season) : ""}<span
        >${season ? termShortYear(term.term) : term.term}</span
      ></button>`;
  };

  // Loading older terms a batch at a time only makes sense for this
  // professor's sections of this course. The broader views are scoped
  // through "Choose which sections" instead, where "everything left" can
  // run past twenty sections.
  const showLoadMore =
    input.strategy === "combo" && (input.canLoadMore || input.loading);
  const batch =
    input.remainingTerms > 0
      ? Math.min(input.loadMoreBatchSize, input.remainingTerms)
      : input.loadMoreBatchSize;

  return html`<div class="bc-sheet-terms" role="tablist" aria-label="Term">
    ${button(null)}${data.terms.map(button)}
    ${showLoadMore
      ? html`<button
          type="button"
          class="bc-sheet-term bc-sheet-term-more"
          data-bc-action-button="controller"
          ?disabled=${input.loading || !input.canLoadMore}
          title=${`${plural(input.parsedTermCount, "term")} loaded, ${input.remainingTerms} more available. Reports load a few at a time to go easy on Northwestern's servers.`}
          @click=${() => {
            if (!input.loading && input.canLoadMore) callbacks.onLoadMore();
          }}
        >${input.loading ? "Loading" : `${batch} more`}</button>`
      : ""}
  </div>`;
}

// ---------------------------------------------------------------------------
// Nothing to show yet: loading, error, not found
// ---------------------------------------------------------------------------

function renderStatus(
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const code = courseCode(input);
  const prof = input.identity.instructor.trim() || "this professor";
  const broader = html`<button
    type="button"
    class="bc-btn bc-btn--secondary bc-btn--sm"
    @click=${() => callbacks.onOpenDryRun()}
  >See other reports</button>`;

  let title: string;
  let text: string;
  let action: TemplateResult | string = "";
  let busy = false;

  if (input.freshLensLoading) {
    busy = true;
    title = "Loading this view";
    text = "Pulling fresh reports from Northwestern.";
  } else if (input.errorMessage) {
    title = "Couldn't load CTEC reports";
    text = input.errorMessage;
    if (input.canRefresh) {
      action = html`<button
        type="button"
        class="bc-btn bc-btn--secondary bc-btn--sm"
        data-bc-action-button="controller"
        ?disabled=${input.backgroundRefreshing}
        @click=${() => {
          if (!input.backgroundRefreshing) callbacks.onRefresh();
        }}
      >${input.backgroundRefreshing ? "Retrying" : "Try again"}</button>`;
    }
  } else if (input.notFound) {
    action = broader;
    if (input.strategy === "course") {
      title = `No CTECs for ${code}`;
      text = "Northwestern hasn't published any for this course yet.";
    } else if (input.strategy === "instructor") {
      title = `No CTECs for ${prof} in ${input.identity.subject}`;
      text = "Northwestern hasn't published any for this professor in this subject yet.";
    } else {
      title = `No CTECs for ${prof} in ${code}`;
      text =
        "Reports only exist once a class has been taught and evaluated. The course with other professors, or this professor's other classes, can still tell you what to expect.";
    }
  } else if (input.loading) {
    busy = true;
    title = "Loading CTEC reports";
    text = `Pulling the most recent ${plural(input.loadMoreBatchSize, "term")} from Northwestern.`;
  } else {
    title = "Nothing loaded for this view yet";
    text = "Pick another view from the menu above, or look at other reports.";
    action = broader;
  }

  return html`<section class="bc-sheet-status" role=${input.errorMessage ? "alert" : "status"}>
    <h3 class="bc-sheet-status-title">
      ${busy ? html`<span class="bc-spinner bc-spinner--xs" aria-hidden="true"></span>` : ""}${title}
    </h3>
    <p class="bc-sheet-status-text">${text}</p>
    ${action}
  </section>`;
}
