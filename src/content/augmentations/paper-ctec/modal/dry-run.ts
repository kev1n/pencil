// Dry-run dialog — two-stage wizard rendered as an overlay on top of
// the analytics modal:
//
//   Stage 1 (choose): no row detail. Just a top-line "no CTECs found"
//     statement plus two cards naming each alternative pathway and how
//     many sections it contains. User picks one — that's it.
//
//   Stage 2 (pick): a preset selector. No row-level picking. The user
//     chooses between "most recent N" (default) and a handful of
//     scoped substitutes — "only this professor's 281 sections", "max
//     unique professors", etc. Whichever radio is active drives the
//     eventual fetch.
//
// Auto-opens whenever the active strategy lands in not-found territory
// so users always see actionable alternatives instead of a dead-end
// empty state.

import { html, type TemplateResult } from "lit-html";

import { extractCatalogLabel, normalizeSearch } from "../../../ctec-index/helpers";
import { instructorMatches } from "../../ctec-links/helpers";
import type { CtecAnalyticsStrategy } from "../../ctec-links/types";
import type { CtecRowSeed } from "../../../ctec-index/types";
import { preventAndStop, stopPropagation } from "../ui-shared";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState,
  DryRunCandidate,
  DryRunPoolStatus,
  DryRunPreset,
  DryRunState
} from "./types";

const DRY_RUN_CAPACITY = 3;

export function renderDryRunOverlay(
  input: AnalyticsModalInput,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult | string {
  if (!state.dryRun) return "";

  return html`<div
    class="bc-paper-ctec-dry-run-backdrop"
    @click=${(event: Event) => {
      preventAndStop(event);
      callbacks.onDryRunCancel();
    }}
  >
    <div
      class="bc-paper-ctec-dry-run-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bc-paper-ctec-dry-run-title"
      @click=${stopPropagation}
    >
      ${state.dryRun.stage.kind === "choose"
        ? renderChooseStage(input, state.dryRun, callbacks)
        : renderPickStage(input, state.dryRun, state.dryRun.stage, callbacks)}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Stage 1: pathway picker. Two big cards with counts, no row detail.
// ---------------------------------------------------------------------------

function renderChooseStage(
  input: AnalyticsModalInput,
  dryRun: DryRunState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const subject = input.identity.subject;
  const catalog = input.identity.catalog;
  const code = `${subject} ${catalog}`;
  const prof = input.identity.instructor.trim() || "this professor";

  return html`<div class="bc-paper-ctec-dry-run-stage bc-paper-ctec-dry-run-stage--choose">
    <header class="bc-paper-ctec-dry-run-header">
      <div class="bc-paper-ctec-dry-run-heading">
        <span class="bc-paper-ctec-dry-run-eyebrow">No data for this section</span>
        <h2
          id="bc-paper-ctec-dry-run-title"
          class="bc-paper-ctec-dry-run-title"
        >
          ${prof} hasn't taught ${code}
        </h2>
        <p class="bc-paper-ctec-dry-run-subtitle">
          We couldn't find any published CTEC evaluations for this
          specific pairing. Pick a broader view to keep going:
        </p>
      </div>
      <button
        type="button"
        class="bc-paper-ctec-dry-run-close"
        aria-label="Close preview"
        @click=${(event: Event) => {
          preventAndStop(event);
          callbacks.onDryRunCancel();
        }}
      >✕</button>
    </header>

    <div class="bc-paper-ctec-dry-run-choices">
      ${input.courseLensRedundant
        ? ""
        : renderChoiceCard({
            source: "course",
            icon: COURSE_ICON,
            title: html`Other times
              <strong class="bc-paper-ctec-dry-run-choice-keyword"
                >${code}</strong
              >
              has been taught`,
            sublabel: html`Any professor &middot;
              <strong>${code}</strong>`,
            pool: dryRun.coursePool,
            callbacks
          })}
      ${input.instructorLensRedundant
        ? ""
        : renderChoiceCard({
            source: "instructor",
            icon: INSTRUCTOR_ICON,
            title: html`Other
              <strong class="bc-paper-ctec-dry-run-choice-keyword"
                >${subject}</strong
              >
              classes
              <strong class="bc-paper-ctec-dry-run-choice-keyword"
                >${prof}</strong
              >
              has taught`,
            sublabel: html`Same professor &middot;
              Other ${subject} courses`,
            pool: dryRun.instructorPool,
            callbacks
          })}
    </div>

    <footer class="bc-paper-ctec-dry-run-footer bc-paper-ctec-dry-run-footer--choose">
      <button
        type="button"
        class="bc-paper-ctec-dry-run-btn"
        @click=${(event: Event) => {
          preventAndStop(event);
          callbacks.onDryRunCancel();
        }}
      >Cancel</button>
    </footer>
  </div>`;
}

function renderChoiceCard(args: {
  source: CtecAnalyticsStrategy;
  icon: TemplateResult;
  title: TemplateResult;
  sublabel: TemplateResult;
  pool: DryRunPoolStatus;
  callbacks: AnalyticsModalCallbacks;
}): TemplateResult {
  const { source, icon, title, sublabel, pool, callbacks } = args;
  const disabled =
    pool.kind === "loading" ||
    pool.kind === "empty" ||
    pool.kind === "no-access" ||
    pool.kind === "auth-required" ||
    pool.kind === "error";

  return html`<button
    type="button"
    class=${`bc-paper-ctec-dry-run-choice bc-paper-ctec-dry-run-choice--${source}${
      disabled ? " is-disabled" : ""
    }${pool.kind === "loading" ? " is-loading" : ""}`}
    ?disabled=${disabled}
    @click=${(event: Event) => {
      preventAndStop(event);
      if (disabled) return;
      callbacks.onDryRunChooseSource(source);
    }}
  >
    <span class="bc-paper-ctec-dry-run-choice-icon" aria-hidden="true">${icon}</span>
    <div class="bc-paper-ctec-dry-run-choice-main">
      <span class="bc-paper-ctec-dry-run-choice-title">${title}</span>
      <span class="bc-paper-ctec-dry-run-choice-sublabel">${sublabel}</span>
    </div>
    <div class="bc-paper-ctec-dry-run-choice-meta">
      ${renderChoiceMeta(pool)}
      <span class="bc-paper-ctec-dry-run-choice-chevron" aria-hidden="true"
        >→</span
      >
    </div>
  </button>`;
}

function renderChoiceMeta(pool: DryRunPoolStatus): TemplateResult {
  if (pool.kind === "loading") {
    return html`<span class="bc-paper-ctec-dry-run-choice-loading">
      <span class="bc-paper-ctec-dry-run-choice-spinner" aria-hidden="true"></span>
      <span class="bc-paper-ctec-dry-run-choice-loading-text">Checking…</span>
    </span>`;
  }
  if (pool.kind === "ready") {
    const n = pool.rows.length;
    return html`<span class="bc-paper-ctec-dry-run-choice-count">${n}</span>
      <span class="bc-paper-ctec-dry-run-choice-count-label"
        >section${n === 1 ? "" : "s"} found</span
      >`;
  }
  if (pool.kind === "empty") {
    return html`<span class="bc-paper-ctec-dry-run-choice-status"
      >None found</span
    >`;
  }
  if (pool.kind === "no-access") {
    return html`<span class="bc-paper-ctec-dry-run-choice-status is-error"
      >No access</span
    >`;
  }
  if (pool.kind === "auth-required") {
    return html`<span class="bc-paper-ctec-dry-run-choice-status is-error"
      >Sign in required</span
    >`;
  }
  return html`<span
    class="bc-paper-ctec-dry-run-choice-status is-error"
    title=${pool.message}
    >Couldn't load</span
  >`;
}

const COURSE_ICON: TemplateResult = html`<svg
  viewBox="0 0 24 24"
  width="22"
  height="22"
  fill="currentColor"
  aria-hidden="true"
>
  <path
    d="M12 3 1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"
  />
</svg>`;

const INSTRUCTOR_ICON: TemplateResult = html`<svg
  viewBox="0 0 24 24"
  width="22"
  height="22"
  fill="currentColor"
  aria-hidden="true"
>
  <path
    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
  />
</svg>`;

// ---------------------------------------------------------------------------
// Stage 2: preset picker. Radio cards — no row-level interaction.
// ---------------------------------------------------------------------------

function renderPickStage(
  input: AnalyticsModalInput,
  dryRun: DryRunState,
  stage: { kind: "pick"; source: CtecAnalyticsStrategy; preset: DryRunPreset },
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const pool =
    stage.source === "course" ? dryRun.coursePool : dryRun.instructorPool;

  return html`<div class="bc-paper-ctec-dry-run-stage bc-paper-ctec-dry-run-stage--pick">
    ${renderPickHeader(input, stage.source, callbacks)}
    ${renderPickBody(pool, stage, dryRun.capacity, input, callbacks)}
  </div>`;
}

// Drops presets that, when applied to the broader lens, would re-narrow
// back to combo's exact (prof, course) pair: "Only [section's prof]" in
// course view and "Only [section's catalog]" in instructor view are
// just combo dressed up — pointless redundancy in the picker. Users
// who want that data should switch to the combo tab. Returns the
// filtered list verbatim — callers detect an empty result and render
// a "no broader view available" message instead of presets so the
// user isn't stranded on a picker whose only option is the one we
// just hid.
function filterRedundantPresets(
  presets: DryRunPreset[],
  source: CtecAnalyticsStrategy,
  identity: { catalog: string; instructor: string }
): DryRunPreset[] {
  return presets.filter((preset) => {
    if (
      source === "course" &&
      preset.kind === "by-instructor" &&
      instructorMatches(preset.instructor, identity.instructor)
    ) {
      return false;
    }
    if (
      source === "instructor" &&
      preset.kind === "by-catalog" &&
      catalogMatches(preset.catalog, identity.catalog)
    ) {
      return false;
    }
    return true;
  });
}

// Extracts the bare 3-digit catalog number from either side so a
// preset of "GEN_ENG 205" matches both a "205" identity (default -0
// section) and a "205-3" identity (sequence variant) — the broader
// preset would surface the same course's data regardless of the
// section's sequence suffix.
function catalogMatches(presetCatalog: string, sectionCatalog: string): boolean {
  const digits = (s: string) => s.match(/\d{3}/)?.[0];
  const presetDigits = digits(presetCatalog);
  if (!presetDigits) return false;
  return presetDigits === digits(sectionCatalog);
}

// Body switches based on pool status. Ready → preset radio cards.
// Loading → skeleton placeholder. Anything else → terse status line +
// Cancel button. Pick stage can open before discovery completes (when
// the user clicks a strategy tab on the modal header), so a non-ready
// pool is a normal first-paint state, not an error.
function renderPickBody(
  pool: DryRunPoolStatus,
  stage: { kind: "pick"; source: CtecAnalyticsStrategy; preset: DryRunPreset },
  capacity: number,
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  if (pool.kind === "ready") {
    const presets = filterRedundantPresets(
      computePresets(pool.rows, stage.source),
      stage.source,
      { catalog: input.identity.catalog, instructor: input.identity.instructor }
    );
    if (presets.length === 0) {
      const message =
        stage.source === "course"
          ? "This professor is the only one who's taught this course — combo already has these evaluations."
          : "This is the only course this professor has taught in the subject — combo already has these evaluations.";
      return html`<div class="bc-paper-ctec-dry-run-pick-status">${message}</div>
        ${renderPickFooter(0, callbacks)}`;
    }
    const previewRows = applyPreset(pool.rows, stage.preset, capacity);
    return html`<div class="bc-paper-ctec-dry-run-presets" role="radiogroup">
        ${presets.map((preset, i) =>
          renderPresetCard(preset, stage.preset, pool.rows, capacity, i === 0, callbacks)
        )}
      </div>
      ${renderPickFooter(previewRows.length, callbacks)}`;
  }
  if (pool.kind === "loading") {
    return html`<div class="bc-paper-ctec-dry-run-pick-status">
        <span class="bc-paper-ctec-dry-run-choice-spinner" aria-hidden="true"></span>
        <span>Looking up sections…</span>
      </div>
      ${renderPickFooter(0, callbacks)}`;
  }
  const message =
    pool.kind === "empty"
      ? stage.source === "course"
        ? "No other sections found for this course."
        : "No other classes found for this professor."
      : pool.kind === "no-access"
        ? "You don't have access to CTECs."
        : pool.kind === "auth-required"
          ? "Sign in to Northwestern to continue."
          : pool.message;
  return html`<div class="bc-paper-ctec-dry-run-pick-status">${message}</div>
    ${renderPickFooter(0, callbacks)}`;
}

function renderPickHeader(
  input: AnalyticsModalInput,
  source: CtecAnalyticsStrategy,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const subject = input.identity.subject;
  const catalog = input.identity.catalog;
  const code = `${subject} ${catalog}`;
  const prof = input.identity.instructor.trim() || "this professor";

  const title =
    source === "course"
      ? html`Pick from <strong>${code}</strong> sections`
      : html`Pick from <strong>${prof}</strong>'s
          <strong>${subject}</strong> classes`;
  const subtitle =
    source === "course"
      ? `Which subset should we pull? Default loads the most recent regardless of professor.`
      : `Which subset should we pull? Default loads the most recent regardless of class.`;

  return html`<header class="bc-paper-ctec-dry-run-header">
    <button
      type="button"
      class="bc-paper-ctec-dry-run-back"
      aria-label="Back to alternatives"
      @click=${(event: Event) => {
        preventAndStop(event);
        callbacks.onDryRunBack();
      }}
    >← Back</button>
    <div class="bc-paper-ctec-dry-run-heading">
      <h2
        id="bc-paper-ctec-dry-run-title"
        class="bc-paper-ctec-dry-run-title"
      >${title}</h2>
      <p class="bc-paper-ctec-dry-run-subtitle">${subtitle}</p>
    </div>
    <button
      type="button"
      class="bc-paper-ctec-dry-run-close"
      aria-label="Close preview"
      @click=${(event: Event) => {
        preventAndStop(event);
        callbacks.onDryRunCancel();
      }}
    >✕</button>
  </header>`;
}

function renderPresetCard(
  preset: DryRunPreset,
  active: DryRunPreset,
  rows: DryRunCandidate[],
  capacity: number,
  isDefault: boolean,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const isActive = presetsEqual(preset, active);
  const preview = applyPreset(rows, preset, capacity);
  const meta = presetMeta(preset);

  return html`<label
    class=${`bc-paper-ctec-dry-run-preset${
      isActive ? " is-active" : ""
    }`}
  >
    <input
      type="radio"
      name="bc-paper-ctec-dry-run-preset"
      class="bc-paper-ctec-dry-run-preset-radio"
      ?checked=${isActive}
      @change=${(event: Event) => {
        event.stopPropagation();
        callbacks.onDryRunSelectPreset(preset);
      }}
    />
    <div class="bc-paper-ctec-dry-run-preset-body">
      <div class="bc-paper-ctec-dry-run-preset-headline">
        <span class="bc-paper-ctec-dry-run-preset-title">${meta.title}</span>
        ${isDefault
          ? html`<span class="bc-paper-ctec-dry-run-preset-badge">Default</span>`
          : ""}
      </div>
      ${meta.sublabel
        ? html`<span class="bc-paper-ctec-dry-run-preset-sublabel"
            >${meta.sublabel}</span
          >`
        : ""}
      ${preview.length > 0
        ? html`<ul class="bc-paper-ctec-dry-run-preset-preview">
            ${preview.map((row) => renderPreviewRow(row, preset))}
          </ul>`
        : html`<span class="bc-paper-ctec-dry-run-preset-empty"
            >Nothing matches this filter</span
          >`}
    </div>
  </label>`;
}

function renderPreviewRow(
  row: DryRunCandidate,
  preset: DryRunPreset
): TemplateResult {
  // Which axis we *highlight* depends on which dimension the preset is
  // varying. For `recent`, both vary so we show term + instructor +
  // course. For `by-catalog` (instructor mode), instructor is fixed —
  // term + instructor. For `by-instructor` (course mode), course is
  // fixed — term + course. For `diverse-instructors`, instructor is
  // the varying axis we want to spotlight.
  const showInstructor =
    preset.kind === "recent" ||
    preset.kind === "by-catalog" ||
    preset.kind === "diverse-instructors";
  const showCatalog =
    preset.kind === "recent" ||
    preset.kind === "by-instructor" ||
    preset.kind === "diverse-instructors";

  const courseTitle = extractCourseTitle(row.description);

  return html`<li class="bc-paper-ctec-dry-run-preset-preview-row">
    <span class="bc-paper-ctec-dry-run-preset-preview-term">${row.term}</span>
    ${showInstructor
      ? html`<span class="bc-paper-ctec-dry-run-preset-preview-sep"
            >·</span
          ><span class="bc-paper-ctec-dry-run-preset-preview-axis"
            >${row.instructor}</span
          >`
      : ""}
    ${showCatalog
      ? html`<span class="bc-paper-ctec-dry-run-preset-preview-sep"
            >·</span
          ><span class="bc-paper-ctec-dry-run-preset-preview-axis-faint"
            >${row.catalogLabel}${courseTitle
              ? html` <span class="bc-paper-ctec-dry-run-preset-preview-title"
                  >(${courseTitle})</span
                >`
              : ""}</span
          >`
      : ""}
  </li>`;
}

function renderPickFooter(
  loadCount: number,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<footer class="bc-paper-ctec-dry-run-footer">
    <span class="bc-paper-ctec-dry-run-count">
      Will load <strong>${loadCount}</strong>
      ${loadCount === 1 ? "evaluation" : "evaluations"}
    </span>
    <div class="bc-paper-ctec-dry-run-actions">
      <button
        type="button"
        class="bc-paper-ctec-dry-run-btn"
        @click=${(event: Event) => {
          preventAndStop(event);
          callbacks.onDryRunCancel();
        }}
      >Cancel</button>
      <button
        type="button"
        class="bc-paper-ctec-dry-run-btn bc-paper-ctec-dry-run-btn--primary"
        ?disabled=${loadCount === 0}
        @click=${(event: Event) => {
          preventAndStop(event);
          if (loadCount === 0) return;
          callbacks.onDryRunConfirm();
        }}
      >${loadCount === 0 ? "Nothing to load" : "Load"}</button>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------------------
// Preset computation + matching
// ---------------------------------------------------------------------------

// Builds the list of presets available for a given source + pool.
// When the pool only has one unique group (one catalog in instructor
// mode, one professor in course mode), the "recent" preset would
// produce the same result as the single per-group preset — so we
// collapse and emit only the per-group preset, marked default. With
// multiple groups, "recent" leads (the default) followed by the
// per-group filters.
export function computePresets(
  rows: DryRunCandidate[],
  source: CtecAnalyticsStrategy
): DryRunPreset[] {
  if (rows.length === 0) return [{ kind: "recent" }];

  if (source === "course") {
    const byInstructor = groupByInstructor(rows);
    const perInstructor: DryRunPreset[] = [];
    for (const group of byInstructor.values()) {
      const first = group[0];
      if (!first) continue;
      perInstructor.push({
        kind: "by-instructor",
        instructor: first.instructor,
        count: group.length
      });
    }
    // Only one prof teaches this course in the pool — recent would
    // duplicate the one by-instructor preset. Emit just one.
    if (perInstructor.length <= 1) return perInstructor.length === 1
      ? perInstructor
      : [{ kind: "recent" }];

    return [
      { kind: "recent" },
      { kind: "diverse-instructors" },
      ...perInstructor
    ];
  }

  // instructor source
  const byCatalog = groupByCatalog(rows);
  const perCatalog: DryRunPreset[] = [];
  for (const group of byCatalog.values()) {
    const first = group[0];
    if (!first) continue;
    perCatalog.push({
      kind: "by-catalog",
      catalog: first.catalogLabel,
      title: extractCourseTitle(first.description),
      count: group.length
    });
  }
  // Only one course this prof has taught in the pool — collapse.
  if (perCatalog.length <= 1) return perCatalog.length === 1
    ? perCatalog
    : [{ kind: "recent" }];

  return [{ kind: "recent" }, ...perCatalog];
}

// Applies a preset to the row pool and returns the resulting rows
// (capped at `capacity` where it makes sense — `recent` and
// `diverse-instructors` cap; `by-*` presets show the full filtered
// list so the user can see scope).
export function applyPreset(
  rows: DryRunCandidate[],
  preset: DryRunPreset,
  capacity: number
): DryRunCandidate[] {
  if (preset.kind === "recent") {
    return rows.slice(0, capacity);
  }
  if (preset.kind === "diverse-instructors") {
    const seen = new Set<string>();
    const out: DryRunCandidate[] = [];
    for (const row of rows) {
      const key = normalizeSearch(row.instructor);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= capacity) break;
    }
    return out;
  }
  if (preset.kind === "by-catalog") {
    return rows.filter((r) => r.catalogLabel === preset.catalog).slice(0, capacity);
  }
  if (preset.kind === "by-instructor") {
    const target = normalizeSearch(preset.instructor);
    return rows
      .filter((r) => normalizeSearch(r.instructor) === target)
      .slice(0, capacity);
  }
  return [];
}

export function presetsEqual(a: DryRunPreset, b: DryRunPreset): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "by-catalog" && b.kind === "by-catalog") {
    return a.catalog === b.catalog;
  }
  if (a.kind === "by-instructor" && b.kind === "by-instructor") {
    return normalizeSearch(a.instructor) ===
      normalizeSearch(b.instructor);
  }
  return true;
}

function presetMeta(preset: DryRunPreset): {
  title: TemplateResult | string;
  sublabel: string;
} {
  if (preset.kind === "recent") {
    return {
      title: "Most recent (mixed)",
      sublabel: "Latest sections regardless of professor or class"
    };
  }
  if (preset.kind === "diverse-instructors") {
    return {
      title: "Maximize unique professors",
      sublabel: "One section per professor, most recent first"
    };
  }
  if (preset.kind === "by-catalog") {
    const titleText = preset.title.trim();
    return {
      title: titleText
        ? html`Only <strong>${preset.catalog}</strong>
            <span class="bc-paper-ctec-dry-run-preset-title-suffix"
              >(${titleText})</span
            >`
        : html`Only <strong>${preset.catalog}</strong>`,
      sublabel: `${preset.count} section${preset.count === 1 ? "" : "s"} found`
    };
  }
  return {
    title: html`Only <strong>${preset.instructor}</strong>`,
    sublabel: `${preset.count} section${preset.count === 1 ? "" : "s"} found`
  };
}

function groupByCatalog(
  rows: DryRunCandidate[]
): Map<string, DryRunCandidate[]> {
  const out = new Map<string, DryRunCandidate[]>();
  for (const row of rows) {
    const existing = out.get(row.catalogLabel);
    if (existing) existing.push(row);
    else out.set(row.catalogLabel, [row]);
  }
  return out;
}

function groupByInstructor(
  rows: DryRunCandidate[]
): Map<string, DryRunCandidate[]> {
  const out = new Map<string, DryRunCandidate[]>();
  for (const row of rows) {
    const key = normalizeSearch(row.instructor);
    const existing = out.get(key);
    if (existing) existing.push(row);
    else out.set(key, [row]);
  }
  return out;
}

// "ECON 281-0-30 STATS FOR ECON" → "STATS FOR ECON". Falls back to ""
// when the description doesn't have the expected three-part shape so
// the caller can omit the parenthetical title.
function extractCourseTitle(description: string): string {
  const match = description
    .trim()
    .match(/^[A-Z][A-Z_]*\s+\d+(?:-\d+)*\s+(.+?)\s*$/);
  if (!match || !match[1]) return "";
  return titleCase(match[1].trim());
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bFor\b/g, "for")
    .replace(/\bAnd\b/g, "and")
    .replace(/\bThe\b/g, "the")
    .replace(/\bOf\b/g, "of");
}

// ---------------------------------------------------------------------------
// State construction + discovery-result adoption helpers.
// ---------------------------------------------------------------------------

export function buildInitialDryRunState(): DryRunState {
  return {
    stage: { kind: "choose" },
    capacity: DRY_RUN_CAPACITY,
    coursePool: { kind: "loading" },
    instructorPool: { kind: "loading" }
  };
}

export function rowsToCandidates(
  rows: CtecRowSeed[],
  source: CtecAnalyticsStrategy,
  idPrefix: string
): DryRunCandidate[] {
  // Dedupe by (term, normalized-instructor, catalogLabel). CAESAR's class-row
  // listing returns one row per section, so two lab/lecture sections of the
  // same course in the same term taught by the same prof both come through —
  // but they collapse to one CTEC report once Bluera URLs resolve (dedupe
  // by blueraUrl in the real fetch path). The preview shouldn't show those
  // as separate evaluations or the "Will load 3" footer over-promises and
  // the actual load comes back with fewer.
  const seen = new Set<string>();
  const out: DryRunCandidate[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const catalogLabel = extractCatalogLabel(row.description);
    const key = [
      row.term,
      row.instructor.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
      catalogLabel
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `${idPrefix}-${i}`,
      source,
      term: row.term,
      instructor: row.instructor,
      catalogLabel,
      description: row.description
    });
  }
  return out;
}

export function applyCoursePool(
  state: DryRunState,
  status: DryRunPoolStatus
): DryRunState {
  const next = { ...state, coursePool: status };
  return normalizePresetForPool(next, "course");
}

export function applyInstructorPool(
  state: DryRunState,
  status: DryRunPoolStatus
): DryRunState {
  const next = { ...state, instructorPool: status };
  return normalizePresetForPool(next, "instructor");
}

// When the pool we're currently picking from transitions to ready and
// the active preset isn't representable in the computed list (e.g. user
// landed in pick stage with the placeholder `recent` preset, then the
// pool resolved to a single-prof-only course where `computePresets`
// returns just `by-instructor`), snap the preset to whatever the
// computed list flags as default. Otherwise the radio group renders
// with nothing checked and Load applies a preset that doesn't match
// any visible card.
function normalizePresetForPool(
  state: DryRunState,
  source: CtecAnalyticsStrategy
): DryRunState {
  const stage = state.stage;
  if (stage.kind !== "pick" || stage.source !== source) return state;
  const pool = source === "course" ? state.coursePool : state.instructorPool;
  if (pool.kind !== "ready") return state;
  const presets = computePresets(pool.rows, source);
  const stillValid = presets.some((p) => presetsEqual(p, stage.preset));
  if (stillValid) return state;
  const defaultPreset = presets[0] ?? { kind: "recent" };
  return {
    ...state,
    stage: { ...stage, preset: defaultPreset }
  };
}

// Advance the wizard from `choose` into `pick` for the chosen pathway.
// When `initialPreset` is supplied (re-opening via Adjust selection),
// land on that preset so the user sees their last pick checked. The
// `normalizePresetForPool` step downstream snaps it to the computed
// default if the pool later resolves with a row set that doesn't
// include the picked preset. When no initial preset is given, fall
// back to the computed default (or `recent` for non-ready pools).
export function enterPickStage(
  state: DryRunState,
  source: CtecAnalyticsStrategy,
  initialPreset?: DryRunPreset | null
): DryRunState {
  if (state.stage.kind === "pick" && state.stage.source === source) {
    return state;
  }
  const pool = source === "course" ? state.coursePool : state.instructorPool;
  const fallbackPreset: DryRunPreset =
    pool.kind === "ready"
      ? computePresets(pool.rows, source)[0] ?? { kind: "recent" }
      : { kind: "recent" };
  return {
    ...state,
    stage: { kind: "pick", source, preset: initialPreset ?? fallbackPreset }
  };
}

export function enterChooseStage(state: DryRunState): DryRunState {
  return { ...state, stage: { kind: "choose" } };
}

export function setPreset(
  state: DryRunState,
  preset: DryRunPreset
): DryRunState {
  if (state.stage.kind !== "pick") return state;
  return {
    ...state,
    stage: { ...state.stage, preset }
  };
}
