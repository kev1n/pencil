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
- `src/content/peoplesoft/` — typed wrapper around CAESAR's PeopleSoft AJAX (context, http, params, parsers, lookup, traffic mutex). Also home to `ps-cell-grid.ts` — `createPsCellGridRuntime`, the composable runtime that handles page-id gating, header / cell injection, in-flight dedupe, retry, ticker lifecycle, and lossless cleanup for any plugin that grafts extra columns onto a PeopleSoft grid (today seats-notes + ctec-links).
- `src/content/cart-cache/` — shared `chrome.storage.local`-backed snapshot of the user's CAESAR shopping cart and current enrollment, keyed by `STRM` (term). class-search and paper-ctec read it to render persistent "In cart" / "Enrolled" badges on Add-to-cart buttons (instead of a transient "Added!" flash) and write to it optimistically when their flow successfully adds. The `CartPageHydrator` augmentation (registered, no user toggle) parses `#SSR_REGFORM_VW$scroll$0` + `#STDNT_ENRL_SSVW$scroll$0` whenever the user lands on the live cart page and replaces the term's entry — this is the only path that drops sections. `reconcile.ts` runs once per CAESAR content-script load when the cache is older than 1hr: background-fetches `CART_URL`, parses, writes. Aborts silently on login-page response.
- `src/content/settings.ts` — feature-toggle state, backed by `chrome.storage.local`. Defaults are on unless overridden in `DEFAULT_FEATURE_STATES`.
- `src/content/messaging.ts`, `src/content/remote-fetch.ts` — message plumbing and background-mediated fetches.
- `src/content/design/` — design system. `tokens.ts` declares every `--bc-*` CSS custom property and the per-theme override blocks: `default` (legacy NU purple, kept selectable in the popup) and `pencil` (Ticonderoga cream + eraser pink, the new default). `components.ts` declares every higher-level `.bc-*` class built from those tokens, including pencil-specific accents (`.bc-card--paper`, `.bc-btn--pencil`, `.bc-mark`, `.bc-scribble`, `.bc-stamp`, `.bc-divider--dashed`). `index.ts` runs theme bootstrap and exposes `BC_THEMES` + `THEME_LABELS`. Style modules consume vars/classes — never embed raw color literals. To switch the look-and-feel, edit a token block or add a new `[data-bc-theme="X"]` block. The popup exposes a theme dropdown that writes to `chrome.storage.local`. Paper.nu's `.dark` class is mirrored onto `<html data-bc-mode="dark">` so each theme owns its dark variant. Web fonts ship as woff2 in `src/assets/fonts/`; `tokensCss()` emits `@font-face` blocks via a URL-resolver argument so the same code path works for popup (`chrome.runtime.getURL`) and content scripts. SVG-emitting JS in `paper-ctec/{chart-histogram,hours-density,modal/*,analytics-preview}.ts` now sets fills and strokes via `el.style.{fill,stroke} = "var(--bc-color-*)"` so chart colors flow with the active theme + dark mirror automatically — no per-attribute CSS overrides needed.
- `src/popup/` — popup UI with toggle switches and "clear CTEC cache" / "clear catalog cache" / "clear cart cache" buttons.
- `src/content/access-gate/` — pre-launch rollout gate: HMAC last-name codes (`code.ts`) for individual whitelisting, grad-year buckets (`constants.ts`, `grad-term-fetch.ts`) for staged release, and a remote schedule (`server-client.ts`) that also carries a kill switch + broadcast banner. Schedule URL is build-time-substituted from `BC_BUCKET_SCHEDULE_URL` in `.env`; `scripts/build.mjs` also patches the URL's origin into the manifest's `host_permissions`. The schedule itself is a single `bucket-schedule.json` in the public [kev1n/better-caesar-schedule](https://github.com/kev1n/better-caesar-schedule) repo, served via `raw.githubusercontent.com` (no server, no Docker — `git push` is the deploy). Fails open: when the URL is unreachable past the 30-min cache window, fallback constants flip every bucket to "unlocked" and drop kill / banner so an outage means full use, not a locked-out extension.
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

## Pre-theme gate tokens

`src/content/index.ts` calls `injectGateTokens()` (synchronous, idempotent) at the very top of the content-script bootstrap, before `bootstrapTheme()`. It mounts a dedicated `<style id="bc-gate-tokens">` at the head of `<head>` carrying the `--bc-gate-*` namespace defined in `tokens.ts → gateTokens()`. These vars feed the access-gate banner/toast (Shadow-DOM hosted — custom properties inherit through the host element) and the `injectEarlyTermPageMask()` style, both of which paint on the very first frame while the rest of the design system is still hydrating. Add new pre-bootstrap tokens to that block; don't reach into theme blocks for first-paint surfaces.

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
- `class-search` — CAESAR: replaces the native `SSR_CLSRCH_ENTRY` page with a paper.nu-powered search UI behind a Better/Classic tab toggle (state in `sessionStorage`). Single search box matches paper.nu-style (whitespace-tokenized, `x` digit-wildcard, ranks subject+catalog hits above title hits). Distro / discipline pills filter further. Per-course **Load CAESAR data** button runs CAESAR's catalog search and paints class number + status badges on each section row. Per-section **Details** expands an inline panel with seats, capacity, class attributes, enrollment requirements, and class notes — driven by `lookupClass(classNumber)` and rendered via the same `seats-notes/parser.ts` pipeline (with shared `seats-notes` cache so a section opened here is already warm if the user later visits their cart). Per-section **Add to cart** drives the full Search → Select → Next chain in the background (`caesar-search.ts → addSectionToCart`); the user never leaves the page. Display formatting strips paper.nu's "-0" suffix (`COMP_SCI 333`); the underlying CAESAR catalog field gets the bare number (`333`) with `contains` match, then we disambiguate by parsing the result group title (`COMP_SCI 333-0` vs `333-SG`). Catalog data cached in `chrome.storage.local` keyed off paper.nu's per-source `updated` timestamps (`paper-data.ts`). Requires `unlimitedStorage` since `plan.json` + per-term files exceed the default quota.
- `paper-ctec` — Paper.nu: overlays CTEC summaries on schedule cards and analytics in the section side panel. Has its own sub-toggles (single summary card, dense cards, dense card stars). The analytics modal extracts integer counts from Bluera distribution PNGs (`chart-extract.ts` — background-mediated binary fetch + canvas pixel scan; uses each metric's `responseCount` as the known total) and renders them as inline SVG histograms (`chart-histogram.ts`); falls back to the raw image when extraction fails.

## Shared CTEC index

`src/content/ctec-index/` is the home of the shared CTEC index module — `storage.ts`, `helpers.ts`, `types.ts`, `constants.ts`. It lives outside `augmentations/` because it isn't a registered plugin; it's a sibling module that augmentations consume. `ctec-links` (and indirectly `paper-ctec` via `ctec-links/reports.ts`) read and write the `chrome.storage.local`-backed index through `readSubjectIndex`/`writeSubjectIndex`. The popup's "Clear CTEC cache" button wipes it.

## User preferences

- Build after every change — `npm run build:chrome` must pass before considering work done.
- Keep solutions minimal — don't add abstractions, error handling, or features beyond what's asked.
- No time estimates.
- Update this file when the structure or feature set changes meaningfully.
