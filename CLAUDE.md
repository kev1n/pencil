# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Keeping this file fresh

This file is a living document. Update it as the repo evolves — when adding/removing augmentations, changing host permissions, restructuring folders, or shifting conventions. Keep entries **high level**: directory roles, plugin patterns, and where things live. Avoid pinning specific DOM selectors, regexes, or detailed flow steps — those drift fast and belong in code comments or the augmentation's own files.

## What this is

A Manifest V3 Chrome/Firefox extension that augments two sites for Northwestern students:

- **CAESAR** (`caesar.ent.northwestern.edu`) — course registration. Adds seat/notes details, CTEC evaluation links, and enrollment-term navigation.
- **Paper.nu** (`paper.nu`, `www.paper.nu`) — schedule planner. Overlays CTEC summaries and analytics onto schedule cards and the section detail panel.

It also reaches `northwestern.bluera.com` and Northwestern SSO hosts to fetch CTEC reports.

## Commands

```bash
npm run build          # Build Chrome + Firefox into dist/<target>/
npm run build:chrome   # Chrome only
npm run build:firefox  # Firefox only
npm run dev            # Watch mode (Chrome)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src eslint-rules — must be 0 errors
npm run test           # vitest run (jsdom env)
npm run test:watch     # vitest watch mode
```

**Always run `npm run build:chrome` after every change** and confirm it passes. Load `dist/chrome` as an unpacked extension. CI (`.github/workflows/ci.yml`) runs typecheck, lint, test, and both target builds on every push to main and every PR — keep all five green.

## Top-level layout

- `src/background.ts` — service worker. Used for things content scripts can't do directly (e.g. cross-origin fetches).
- `src/content/index.ts` — entry for both CAESAR and Paper.nu. Registers the lookup message handler and starts the augmentation runner.
- `src/content/framework/` — cross-cutting content-script primitives only: the `Augmentation` interface, `AugmentationRunner` (load + debounced mutation re-runs), the shared `el()` / `ensureStyle()` DOM builders in `dom.ts`, and the `createActionButton` / `bindActionButton` factory + styles in `action-button.ts`. The legacy `TemplateAugmentation` abstract class was deleted in Wave 4 — every plugin needed richer state than it modeled. Domain-specific runtimes (e.g. `createPsCellGridRuntime`) live with their domain module, not here.
- `src/content/augmentations/` — one folder per feature. Registered in `registry.ts`.
- `src/content/ctec-index/` — shared CTEC index module (`storage.ts`, `helpers.ts`, `types.ts`, `constants.ts`). Sits outside `augmentations/` because it isn't a registered plugin; `ctec-links` and `paper-ctec` consume it. See "Shared CTEC index" below.
- `src/content/nu-careers.ts` — snapshot of which CAESAR career (school) catalogues each subject, plus `resolveCareerCandidates(subject, catalogNumber)` for ordering them by likelihood (UGRD-first for sub-400, TGS-first for 400+). Consumed by `peoplesoft/context.ts` (Sharper Search Details by class number), `class-search/caesar-search/flow.ts` (Sharper Search course discovery + Add-to-cart) and `ctec-links/fetcher.ts` (CTEC fanout). Without this, lookups would be locked to UGRD + TGS only — Law/SPS/Kellogg-grad/etc. classes would never resolve.
- `src/content/course-history/` — `chrome.storage.local`-backed snapshot of the user's CAESAR Course History (Academic Records → Course History). Populated opportunistically by an AJAX fetch (`SSR_CRSE_HIST_FL`) on every CAESAR page load when the cache is older than 1hr. Read by the popup's "My courses" panel and by the prereq-filter augmentation (which uses Taken/In Progress/Transferred status to score eligibility).
- `src/content/prereqs/` — runtime prereq parser + cache + eligibility evaluator. Ports `__fixtures__/prereqs-parsed.json`'s schema 1:1 (`types.ts`); `parser/` is a recursive-descent regex parser ported from a reference Python implementation with 100% golden-file parity. `cache.ts` parses every `PaperCourse.prereqs` from paper.nu's `plan.json` once per `info.plan` revision, persists to `chrome.storage.local` with a 75-day TTL safety net. `eligibility.ts` is a pure evaluator over `PrereqNode + course-history` returning `{state, missing, notes}`. Consumed only by `prereq-filter`. Fixture under `__fixtures__/` is loaded only by `parser.spec.ts` and is asserted out of the production bundle by `scripts/build.mjs`.
- `src/content/peoplesoft/` — typed wrapper around CAESAR's PeopleSoft AJAX (context, http, params, parsers, lookup, traffic mutex). Also home to `ps-cell-grid.ts` — `createPsCellGridRuntime`, the composable runtime that handles page-id gating, header / cell injection, in-flight dedupe, retry, ticker lifecycle, and lossless cleanup for any plugin that grafts extra columns onto a PeopleSoft grid (today seats-notes + ctec-links).
- `src/content/cart-cache/` — shared `chrome.storage.local`-backed snapshot of the user's CAESAR shopping cart and current enrollment, keyed by `STRM` (term). class-search and paper-ctec read it to render persistent "In cart" / "Enrolled" badges on Add-to-cart buttons (instead of a transient "Added!" flash) and write to it optimistically when their flow successfully adds. The `CartPageHydrator` augmentation (registered, no user toggle) parses `#SSR_REGFORM_VW$scroll$0` + `#STDNT_ENRL_SSVW$scroll$0` whenever the user lands on the live cart page and replaces the term's entry — this is the only path that drops sections. `reconcile.ts` runs once per CAESAR content-script load when the cache is older than 1hr: background-fetches `CART_URL`, parses, writes. Aborts silently on login-page response.
- `src/content/settings.ts` — feature-toggle state, backed by `chrome.storage.local`. Defaults are on unless overridden in `DEFAULT_FEATURE_STATES`.
- `src/content/messaging.ts`, `src/content/remote-fetch.ts` — message plumbing and background-mediated fetches.
- `src/content/design/` — design system. `tokens.ts` declares every `--bc-*` CSS custom property and the per-theme override blocks: `default` (legacy NU purple, kept selectable in the popup) and `pencil` (Ticonderoga cream + eraser pink, the new default). `components.ts` declares every higher-level `.bc-*` class built from those tokens, including pencil-specific accents (`.bc-card--paper`, `.bc-btn--pencil`, `.bc-mark`, `.bc-scribble`, `.bc-stamp`, `.bc-divider--dashed`). `index.ts` runs theme bootstrap and exposes `BC_THEMES` + `THEME_LABELS`. Style modules consume vars/classes — never embed raw color literals. To switch the look-and-feel, edit a token block or add a new `[data-bc-theme="X"]` block. The popup exposes a theme dropdown that writes to `chrome.storage.local`. Paper.nu's `.dark` class is mirrored onto `<html data-bc-mode="dark">` so each theme owns its dark variant. Web fonts ship as woff2 in `src/assets/fonts/`; `tokensCss()` emits `@font-face` blocks via a URL-resolver argument so the same code path works for popup (`chrome.runtime.getURL`) and content scripts. SVG-emitting JS in `paper-ctec/{chart-histogram,hours-density,modal/*,analytics-preview}.ts` now sets fills and strokes via `el.style.{fill,stroke} = "var(--bc-color-*)"` so chart colors flow with the active theme + dark mirror automatically — no per-attribute CSS overrides needed.
- `src/popup/` — popup UI with toggle switches and "clear CTEC cache" / "clear catalog cache" / "clear cart cache" buttons. The "What's new" panel at the top reads from `src/popup/changelog.json` (see "Changelog" below).
- `src/shared/messages.ts` — typed message contracts shared across contexts.
- `src/shared/log.ts` — debug-gated quiet logging (`logQuiet`, `logDebug`). Production is silent unless the user runs `localStorage.setItem("bc-debug", "1")`. Use `logQuiet(scope, err)` instead of empty `} catch {}` blocks; the eslint config bans bare empty catches.
- `src/manifest.base.json` — base manifest; `scripts/build.mjs` patches it per target.

## Action buttons

Every async-action button (one whose click triggers a network request, computation, or multi-step flow) MUST go through `createActionButton` from `src/content/framework/action-button.ts`. The factory enforces:

- Synchronous `disabled` lock on the very first click — set BEFORE the first `await`, so back-to-back synchronous double-clicks cannot double-fire the action.
- Loading-state visual feedback via `dataset.state="loading"` + a configurable `loadingLabel` (defaults to "Loading…").
- Click-once semantics: while state is non-idle, additional clicks are no-ops, except retryable error states which return to idle on the next click.
- AbortSignal plumbed into `onClick`, fires when `destroy()` runs mid-flight.
- Result-driven state machine: `void` → idle, `{ kind: "success", sticky: true }` → terminal locked, `{ kind: "success" }` → flash then idle, `{ kind: "error", retryable }` → re-enabled for retry, thrown error → retryable error.

Pure-DOM buttons (Cancel, Close, Toggle visibility) can stay as `el(doc, "button", ...)` — they don't have async work to gate. Only buttons whose click handler is `async` (or returns a Promise) need the factory. Fire-and-forget storage writes can opt out by wrapping the call in `void` (e.g. `() => void persistDismissal()`); the lint rule treats `void` as the documented escape hatch.

A few raw `<button>` elements stay outside the factory because a dedicated controller owns the full state machine externally (today: `class-search/views/section-row.ts` Add-to-cart + Details). Those buttons must carry `[ACTION_BUTTON_MARKER_ATTR]: "controller"` so the lint rule recognizes them as the formalized controller-managed exception. The factory's own output uses the value `"1"`.

Enforcement lives in the local ESLint plugin under `eslint-rules/` (rule `bc-rules/no-raw-action-button`). It's an AST rule wired into `npm run lint`. It catches `addEventListener("click", async …)`, `.onclick = async …`, `el(doc, "button", { on: { click: async … } })`, the same patterns with bodies that contain `await` or top-level `.then`/`.catch`/`.finally` chains, and raw `setAttribute("data-bc-action-button", …)` stamps in files that don't import the factory. See the rule's header comment for the full pattern catalogue and known limitations. Adding a new button that does network/storage/multi-step work without going through the factory will fail CI.

## Augmentation pattern

Each feature lives in `src/content/augmentations/<name>/` and exports a plugin instance from `index.ts`. Most use `TemplateAugmentation` (`appliesToPage` → `collectTargets` → `fetchData` → `renderSuccess`/`renderError`). Some (e.g. CTEC links, paper-ctec) implement `Augmentation` directly when they need richer state (in-flight tracking, retry-on-demand, multi-tab UI, etc.).

The runner invokes plugins on initial load and after every DOM mutation (debounced via `requestAnimationFrame`) — needed because PeopleSoft and Paper.nu both navigate via in-place DOM swaps. Each plugin is gated by `isFeatureEnabled(id)`.

When the user toggles a feature off, the runner calls the plugin's optional `cleanup(doc)` method (and skips its `run()` thereafter). `cleanup()` must remove every DOM node, class, dataset marker, and injected style the plugin ever added — host pages must look indistinguishable from the never-installed state. Sub-flag flips (e.g. dense-cards on/off) just trigger another `run()` on the still-enabled plugin; in-place toggles via `classList.toggle(class, enabled)` and signature-based re-render handle these without needing cleanup.

To add a new augmentation:

1. Create `src/content/augmentations/<name>/` with `index.ts` exporting a plugin.
2. Register it in `src/content/augmentations/registry.ts`.
3. Add it (and any sub-toggles) to `FEATURE_SECTIONS` in `src/popup/popup.ts`.
4. Implement `cleanup(doc)` to fully undo every DOM mutation `run()` makes.

## Current augmentations

- `seats-notes` — CAESAR shopping cart: loads class notes, attributes, requirements, seat counts.
- `ctec-links` — CAESAR shopping cart: per-class CTEC evaluation history widget. Fetches via Bluera and writes a shared CTEC index.
- `enrollment-navigation` — CAESAR: smoother navigation across enrollment terms / registration screens.
- `class-search` — CAESAR: replaces the native `SSR_CLSRCH_ENTRY` page with a paper.nu-powered search UI behind a Better/Classic tab toggle (state in `sessionStorage`). Single search box matches paper.nu-style (whitespace-tokenized, `x` digit-wildcard, ranks subject+catalog hits above title hits). Distro / discipline pills filter further. Per-course **Load CAESAR data** button runs CAESAR's catalog search and paints class number + status badges on each section row. Per-section **Details** expands an inline panel with seats, capacity, class attributes, enrollment requirements, and class notes — driven by `lookupClass(classNumber)` and rendered via the same `seats-notes/parser.ts` pipeline (with shared `seats-notes` cache so a section opened here is already warm if the user later visits their cart). Per-section **Add to cart** drives the full Search → Select → Next chain in the background (`caesar-search.ts → addSectionToCart`); the user never leaves the page. Per-section **CTEC chip + Analytics** (under `ctec/`) reuses paper-ctec's analytics modal and chip helpers (`widget-chips.ts`, `ModalController`); coordinator (`ctec/coordinator.ts`) holds its own resolved/inFlight maps so cross-augmentation fetches don't short-circuit each other, while the underlying subject-index cache (read by `ctec-links/reports.ts → fetchCtecReportAggregate`) IS shared so a fetch in either surface warms both. Mount injects paper-ctec's stylesheet (`injectStyles`) for the chip + modal visuals; cleanup removes both `bc-paper-ctec-style` and `bc-paper-ctec-analytics-modal`. Display formatting strips paper.nu's "-0" suffix (`COMP_SCI 333`); the underlying CAESAR catalog field gets the bare number (`333`) with `contains` match, then we disambiguate by parsing the result group title (`COMP_SCI 333-0` vs `333-SG`). Catalog data cached in `chrome.storage.local` keyed off paper.nu's per-source `updated` timestamps (`paper-data.ts`). Requires `unlimitedStorage` since `plan.json` + per-term files exceed the default quota.
- `paper-ctec` — Paper.nu: overlays CTEC summaries on schedule cards and analytics in the section side panel. Has its own sub-toggles (single summary card, dense cards, dense card stars). The analytics modal extracts integer counts from Bluera distribution PNGs (`chart-extract.ts` — background-mediated binary fetch + canvas pixel scan; uses each metric's `responseCount` as the known total) and renders them as inline SVG histograms (`chart-histogram.ts`); falls back to the raw image when extraction fails.
- `prereq-filter` — Paper.nu: eligibility badges + tri-state filter chip on the schedule Search panel, minimal ✓/? badge on schedule-grid cards. Driven by `src/content/prereqs/` (parser + parsed-prereqs cache + pure evaluator) and the `course-history` cache. Search panel: full badge with tooltip listing parser `raw` text and structured `Missing:` list; chip cycles `All` / `Eligible+` / `Eligible only` and persists in `chrome.storage.local`. Schedule grid: terse natural-language tooltip ("Wants: COMP_SCI 211-0…"). Sub-toggle "Treat Unknown as Eligible" (default ON) keeps free-form/standing/placement requirements visible — fail-open. Default-off feature toggle. Cleanup tears down every badge, chip, tooltip, dataset marker, and injected stylesheet.
- `paper-hide-taken` — Paper.nu: hides search-result cards for courses the user has already completed. Reads the `course-history` cache and drops cards whose `(subject, catalog)` shows up with status `Taken` or `Transferred`. Repeatable courses (`PaperCourse.repeatable === true` in plan.json — covers 396/397/399, seminars, independent study) are never filtered. The "Hide Taken" switch mounts into prereq-filter's `SEARCH_ROW_ID` controls row (the two augmentations share that row above the search results list), inserted right after the feature switch so the visible order when searching is `[Hide Taken, Show Only Prereq Fulfilled]`. Visibility is search-state driven: `isUserSearching(doc)` reads the absence of paper.nu's Browse/Filter strip (`.m-4.flex.justify-center.gap-2`) as the "user has typed" signal. The "Prereqs (Beta)" feature toggle is shown only when NOT searching; "Hide Taken" + "Show Only Prereq Fulfilled" only when searching. Default ON. Mount id `paper-hide-taken-mount` is decoupled from the feature flag so flipping the feature off doesn't tear the switch down.
- `paper-combos` — Paper.nu: schedule combinations generator. Reads paper.nu's `data_schedule` from its localforage IndexedDB (same-origin, untouched), groups canvas sections by course, and enumerates every non-overlapping combination (one section per course) via backtracking with a hard cap (5000) and `maxClasses` user input. Sorts combos by mean instruction-rating from the cached CTEC aggregate (`getCachedReportAggregate`); missing data imputed at the neutral midpoint so unrated electives don't sink results. UI: a top-of-grid bar (margined down ~3.25rem to clear paper-ctec's floating status bar) with cycle controls (`← X / Total →`), an avg-rating chip, the max-classes input, and per-course pin chips. Does NOT render its own cards — keeps paper.nu's native ScheduleClass cards intact (color, add-to-cart, paper-ctec chips, etc.) and just toggles `data-bc-paper-combos-hidden="1"` on cards whose section_id isn't in the active combo. Card → section_id resolution: derive expected (day column, hour cell, top%) from each `ComboSection.blocks` entry and match the existing card by that triple plus its `{subject} {number}` text prefix; unmatchable cards (custom sections, partial DOM hydration) stay visible — fail-open. No writes to paper.nu state. Default-off feature toggle.
- `paper-export-helper` — Paper.nu: intercepts clicks on the native "Export schedule to calendar → Download" button and opens a walkthrough modal with per-app import steps (Google Calendar / Apple Calendar / Outlook), a central-time warning, and "Open <calendar>" deep links. The modal's own "Download .ics" CTA re-dispatches a click on the captured button with an `allowNativeClickThrough` flag flipped so the capture-phase interceptor lets the event through to paper.nu's React onClick. Button detection in `detection.ts` anchors on the modal heading text (`/export\s+schedule\s+to\s+calendar/i`) and walks down into the containing `[role="dialog"]` to avoid colliding with unrelated "Download" buttons elsewhere on the page. Last-selected tab persists to `chrome.storage.local` (pre-warmed on construction so the click handler can open the modal synchronously). Default ON.

## Changelog

The popup's "What's new" panel reads from `src/popup/changelog.json`. When you ship a release (i.e. bump `version` in `src/manifest.base.json` and `package.json`), prepend a new entry to the `entries` array. The file's `$exampleSchema` key documents the shape — leave it in place.

**Write for the user, not the commit log.** The audience is a Northwestern student opening the popup, not a developer reading `git log`. Each entry should make it instantly clear what changed and what's now possible.

- **High level only.** Group related commits into one feature-shaped item. Don't list every commit, refactor wave, or internal coordinator rename. If five commits added the schedule combinations bar, that's *one* `feat` line, not five.
- **One sentence is great.** A good item is short and concrete: "Generate every non-overlapping schedule from your planned courses on paper.nu." Not: "Adds new augmentation reading data_schedule from localforage IndexedDB and enumerating combinations via backtracking."
- **No jargon.** Don't mention file paths, type names, render-signature dedupe, mutex queues, or any other internal plumbing. The user does not care that we extracted a coordinator.
- **Skip pure internals.** Refactors, lint-rule additions, dependency bumps, type tightenings, and test-only changes do not belong in the changelog. If the user can't see or feel it, leave it out.
- `kind: "feat"` for things the user can now do; `kind: "fix"` for things that were broken and now aren't.
- Optional `headline` on the latest entry sets the section title; keep it punchy (≤ 6 words).

When in doubt, ask: "Would a student understand and care about this in one read?" If not, rewrite it or drop it.

## Shared CTEC index

`src/content/ctec-index/` is the home of the shared CTEC index module — `storage.ts`, `helpers.ts`, `types.ts`, `constants.ts`. It lives outside `augmentations/` because it isn't a registered plugin; it's a sibling module that augmentations consume. `ctec-links` (and indirectly `paper-ctec` via `ctec-links/reports.ts`) read and write the `chrome.storage.local`-backed index through `readSubjectIndex`/`writeSubjectIndex`. The popup's "Clear CTEC cache" button wipes it.

## User preferences

- Build after every change — `npm run build:chrome` must pass before considering work done.
- Keep solutions minimal — don't add abstractions, error handling, or features beyond what's asked.
- No time estimates.
- Update this file when the structure or feature set changes meaningfully.
