# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Keeping this file fresh

This file is a living document. Update it as the repo evolves — when adding/removing augmentations, changing host permissions, restructuring folders, or shifting conventions. Keep entries **high level**: directory roles, plugin patterns, and where things live. Avoid pinning specific DOM selectors, regexes, or detailed flow steps — those drift fast and belong in code comments or the augmentation's own files.

## What this is

A Manifest V3 Chrome/Firefox extension that augments two sites for Northwestern students:

- **CAESAR** (`caesar.ent.northwestern.edu`) — course registration. Adds seat/notes details, CTEC evaluation links, CTEC navigation indexing, and enrollment-term navigation.
- **Paper.nu** (`paper.nu`, `www.paper.nu`) — schedule planner. Overlays CTEC summaries and analytics onto schedule cards and the section detail panel.

It also reaches `northwestern.bluera.com` and Northwestern SSO hosts to fetch CTEC reports.

## Commands

```bash
npm run build          # Build Chrome + Firefox into dist/<target>/
npm run build:chrome   # Chrome only
npm run build:firefox  # Firefox only
npm run dev            # Watch mode (Chrome)
npm run typecheck      # tsc --noEmit
```

**Always run `npm run build:chrome` after every change** and confirm it passes. Load `dist/chrome` as an unpacked extension. There are no tests.

## Top-level layout

- `src/background.ts` — service worker. Used for things content scripts can't do directly (e.g. cross-origin fetches).
- `src/content/index.ts` — entry for both CAESAR and Paper.nu. Registers the lookup message handler and starts the augmentation runner.
- `src/content/framework/` — `Augmentation` interface, `TemplateAugmentation` base class, and the `AugmentationRunner` (load + debounced mutation re-runs).
- `src/content/augmentations/` — one folder per feature. Registered in `registry.ts`.
- `src/content/peoplesoft/` — typed wrapper around CAESAR's PeopleSoft AJAX (context, http, params, parsers, lookup, traffic mutex).
- `src/content/settings.ts` — feature-toggle state, backed by `chrome.storage.local`. Defaults are on unless overridden in `DEFAULT_FEATURE_STATES`.
- `src/content/messaging.ts`, `src/content/remote-fetch.ts` — message plumbing and background-mediated fetches.
- `src/popup/` — popup UI with toggle switches and a "clear CTEC cache" button.
- `src/shared/messages.ts` — typed message contracts shared across contexts.
- `src/manifest.base.json` — base manifest; `scripts/build.mjs` patches it per target.

## Augmentation pattern

Each feature lives in `src/content/augmentations/<name>/` and exports a plugin instance from `index.ts`. Most use `TemplateAugmentation` (`appliesToPage` → `collectTargets` → `fetchData` → `renderSuccess`/`renderError`). Some (e.g. CTEC links, paper-ctec) implement `Augmentation` directly when they need richer state (in-flight tracking, retry-on-demand, multi-tab UI, etc.).

The runner invokes plugins on initial load and after every DOM mutation (debounced via `requestAnimationFrame`) — needed because PeopleSoft and Paper.nu both navigate via in-place DOM swaps. Each plugin is gated by `isFeatureEnabled(id)`.

To add a new augmentation:

1. Create `src/content/augmentations/<name>/` with `index.ts` exporting a plugin.
2. Register it in `src/content/augmentations/registry.ts`.
3. Add it (and any sub-toggles) to `FEATURE_SECTIONS` in `src/popup/popup.ts`.

## Current augmentations

- `seats-notes` — CAESAR shopping cart: loads class notes, attributes, requirements, seat counts.
- `ctec-links` — CAESAR shopping cart: per-class CTEC evaluation history widget. Fetches via Bluera and writes a shared CTEC index.
- `ctec-navigation` — CAESAR CTEC pages: indexes subject results so future lookups can hit cache.
- `enrollment-navigation` — CAESAR: smoother navigation across enrollment terms / registration screens.
- `paper-ctec` — Paper.nu: overlays CTEC summaries on schedule cards and analytics in the section side panel. Has its own sub-toggles (single summary card, dense cards, dense card stars).

## Shared CTEC index

`ctec-navigation/storage.ts` owns a `chrome.storage.local`-backed CTEC index with an in-memory write-through cache. Both `ctec-navigation` and `ctec-links` (and indirectly `paper-ctec` via `ctec-links/reports.ts`) read and write it. The popup's "Clear CTEC cache" button wipes it.

## User preferences

- Build after every change — `npm run build:chrome` must pass before considering work done.
- Keep solutions minimal — don't add abstractions, error handling, or features beyond what's asked.
- No time estimates.
- Update this file when the structure or feature set changes meaningfully.
