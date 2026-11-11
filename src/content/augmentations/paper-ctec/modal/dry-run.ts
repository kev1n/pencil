// "Pick a broader view" wizard, shown in the sheet in place of the report:
//
//   Stage 1 (choose): the two broader views and how many sections each
//     holds. The student picks one.
//
//   Stage 2 (pick): which sections of that view to load. No row-level
//     picking: "most recent" (default) or a handful of scoped substitutes
//     such as one professor's sections.
//
// Opens by itself whenever the active view finds nothing, so the student
// always has somewhere to go instead of a dead end.

import { html, type TemplateResult } from "lit-html";

import { extractCatalogLabel, normalizeSearch } from "../../../ctec-index/helpers";
import { instructorMatches } from "../../ctec-links/helpers";
import type { CtecAnalyticsStrategy } from "../../ctec-links/types";
import type { CtecRowSeed } from "../../../ctec-index/types";
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

export function renderDryRun(
  input: AnalyticsModalInput,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult | string {
  if (!state.dryRun) return "";
  return html`<section class="bc-sheet-wiz" aria-labelledby="bc-sheet-wiz-title">
    ${state.dryRun.stage.kind === "choose"
      ? renderChooseStage(input, state.dryRun, callbacks)
      : renderPickStage(input, state.dryRun, state.dryRun.stage, callbacks)}
  </section>`;
}

// ---------------------------------------------------------------------------
// Stage 1: the two broader views, each with a count. No row detail.
// ---------------------------------------------------------------------------

function renderChooseStage(
  input: AnalyticsModalInput,
  dryRun: DryRunState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const subject = input.identity.subject;
  const code = `${subject} ${input.identity.catalog.replace(/-0$/, "")}`;
  const prof = input.identity.instructor.trim() || "this professor";

  return html`<h3 id="bc-sheet-wiz-title" class="bc-sheet-wiz-title">
      No CTECs for ${prof} in ${code}
    </h3>
    <p class="bc-sheet-wiz-text">Pick a broader view to keep going.</p>
    <div class="bc-sheet-wiz-list">
      ${input.courseLensRedundant
        ? ""
        : renderChoice("course", `Everyone who taught ${code}`, dryRun.coursePool, callbacks)}
      ${input.instructorLensRedundant
        ? ""
        : renderChoice(
            "instructor",
            `Everything ${prof} teaches in ${subject}`,
            dryRun.instructorPool,
            callbacks
          )}
    </div>
    <div class="bc-sheet-wiz-foot">
      <span></span>
      <button
        type="button"
        class="bc-btn bc-btn--ghost bc-btn--sm"
        @click=${() => callbacks.onDryRunCancel()}
      >Cancel</button>
    </div>`;
}

function renderChoice(
  source: CtecAnalyticsStrategy,
  title: string,
  pool: DryRunPoolStatus,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const disabled = pool.kind !== "ready";
  return html`<button
    type="button"
    class="bc-sheet-wiz-row"
    ?disabled=${disabled}
    title=${pool.kind === "error" ? pool.message : ""}
    @click=${() => {
      if (!disabled) callbacks.onDryRunChooseSource(source);
    }}
  ><span class="bc-sheet-wiz-row-title">${title}</span
    ><span class="bc-sheet-wiz-row-meta">${poolLabel(pool)}</span></button>`;
}

function poolLabel(pool: DryRunPoolStatus): string {
  if (pool.kind === "loading") return "Checking";
  if (pool.kind === "ready") {
    return `${pool.rows.length} section${pool.rows.length === 1 ? "" : "s"}`;
  }
  if (pool.kind === "empty") return "None found";
  if (pool.kind === "no-access") return "No access";
  if (pool.kind === "auth-required") return "Sign in required";
  return "Couldn't load";
}

// ---------------------------------------------------------------------------
// Stage 2: which sections to load. Radio rows, no row-level interaction.
// ---------------------------------------------------------------------------

function renderPickStage(
  input: AnalyticsModalInput,
  dryRun: DryRunState,
  stage: { kind: "pick"; source: CtecAnalyticsStrategy; preset: DryRunPreset },
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const pool =
    stage.source === "course" ? dryRun.coursePool : dryRun.instructorPool;
  const subject = input.identity.subject;
  const code = `${subject} ${input.identity.catalog.replace(/-0$/, "")}`;
  const prof = input.identity.instructor.trim() || "this professor";

  return html`<button
      type="button"
      class="bc-sheet-wiz-back"
      @click=${() => callbacks.onDryRunBack()}
    >Back</button>
    <h3 id="bc-sheet-wiz-title" class="bc-sheet-wiz-title">
      ${stage.source === "course"
        ? `Everyone who taught ${code}`
        : `Everything ${prof} teaches in ${subject}`}
    </h3>
    <p class="bc-sheet-wiz-text">Choose which sections to load.</p>
    ${renderPickBody(pool, stage, dryRun.capacity, input, callbacks)}`;
}

// Drops presets that, when applied to the broader lens, would re-narrow
// back to combo's exact (prof, course) pair: "Only [section's prof]" in
// course view and "Only [section's catalog]" in instructor view are
// just combo dressed up. Returns the filtered list verbatim; callers
// detect an empty result and say so instead of offering a picker whose
// only option is the one we just hid.
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
// section) and a "205-3" identity (sequence variant).
function catalogMatches(presetCatalog: string, sectionCatalog: string): boolean {
  const digits = (s: string) => s.match(/\d{3}/)?.[0];
  const presetDigits = digits(presetCatalog);
  if (!presetDigits) return false;
  return presetDigits === digits(sectionCatalog);
}

// Body switches on pool status. Ready: preset radio rows. Anything else: a
// one-line status. The pick stage can open before discovery completes (when
// the student picks a view from the header menu), so a pool that isn't
// ready yet is a normal first paint, not an error.
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
          ? "This professor is the only one who has taught this course, so there is nothing more to add."
          : "This is the only course this professor has taught in the subject, so there is nothing more to add.";
      return html`<p class="bc-sheet-wiz-status">${message}</p>
        ${renderPickFooter(0, callbacks)}`;
    }
    const previewRows = applyPreset(pool.rows, stage.preset, capacity);
    return html`<div class="bc-sheet-wiz-list" role="radiogroup">
        ${presets.map((preset) =>
          renderPreset(preset, stage.preset, pool.rows, capacity, callbacks)
        )}
      </div>
      ${renderPickFooter(previewRows.length, callbacks)}`;
  }
  const message =
    pool.kind === "loading"
      ? "Looking up sections"
      : pool.kind === "empty"
        ? stage.source === "course"
          ? "No other sections found for this course."
          : "No other classes found for this professor."
        : pool.kind === "no-access"
          ? "You don't have access to CTECs."
          : pool.kind === "auth-required"
            ? "Sign in to Northwestern to continue."
            : pool.message;
  return html`<p class="bc-sheet-wiz-status">${message}</p>
    ${renderPickFooter(0, callbacks)}`;
}

function renderPreset(
  preset: DryRunPreset,
  active: DryRunPreset,
  rows: DryRunCandidate[],
  capacity: number,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const isActive = presetsEqual(preset, active);
  const preview = applyPreset(rows, preset, capacity);
  const meta = presetMeta(preset);

  return html`<label class="bc-sheet-wiz-row bc-sheet-wiz-preset">
    <input
      type="radio"
      name="bc-sheet-wiz-preset"
      .checked=${isActive}
      @change=${() => callbacks.onDryRunSelectPreset(preset)}
    />
    <span class="bc-sheet-wiz-preset-body">
      <span class="bc-sheet-wiz-row-title">${meta.title}</span>
      <span class="bc-sheet-wiz-row-meta">${meta.sublabel}</span>
      ${preview.length > 0
        ? preview.map((row) => renderPreviewRow(row, preset))
        : html`<span class="bc-sheet-wiz-row-meta">Nothing matches</span>`}
    </span>
  </label>`;
}

function renderPreviewRow(
  row: DryRunCandidate,
  preset: DryRunPreset
): TemplateResult {
  // Which axis we show depends on which dimension the preset varies. For
  // `by-catalog` the course is fixed, so term + instructor; for
  // `by-instructor` the professor is fixed, so term + course; the others
  // vary both.
  const parts = [row.term];
  if (preset.kind !== "by-instructor") parts.push(row.instructor);
  if (preset.kind !== "by-catalog") {
    const courseTitle = extractCourseTitle(row.description);
    parts.push(courseTitle ? `${row.catalogLabel} ${courseTitle}` : row.catalogLabel);
  }
  return html`<span class="bc-sheet-wiz-preview">${parts.join(" · ")}</span>`;
}

function renderPickFooter(
  loadCount: number,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<div class="bc-sheet-wiz-foot">
    <span class="bc-sheet-wiz-count"
      >${loadCount === 0
        ? "Nothing to load"
        : `Loads ${loadCount} evaluation${loadCount === 1 ? "" : "s"}`}</span
    >
    <button
      type="button"
      class="bc-btn bc-btn--ghost bc-btn--sm"
      @click=${() => callbacks.onDryRunCancel()}
    >Cancel</button>
    <button
      type="button"
      class="bc-btn bc-btn--primary bc-btn--sm"
      data-bc-action-button="controller"
      ?disabled=${loadCount === 0}
      @click=${() => {
        if (loadCount > 0) callbacks.onDryRunConfirm();
      }}
    >Load</button>
  </div>`;
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

function presetMeta(preset: DryRunPreset): { title: string; sublabel: string } {
  if (preset.kind === "recent") {
    return {
      title: "Most recent",
      sublabel: "Latest sections, whoever taught them and whatever the class"
    };
  }
  if (preset.kind === "diverse-instructors") {
    return {
      title: "One section per professor",
      sublabel: "Most recent first"
    };
  }
  const sublabel = `${preset.count} section${preset.count === 1 ? "" : "s"} found`;
  if (preset.kind === "by-catalog") {
    const titleText = preset.title.trim();
    return {
      title: titleText ? `Only ${preset.catalog} ${titleText}` : `Only ${preset.catalog}`,
      sublabel
    };
  }
  return { title: `Only ${preset.instructor}`, sublabel };
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
