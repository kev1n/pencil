#!/usr/bin/env node
// Enforces the rule that every async-action button (one whose click triggers
// a network request, fetch, multi-step flow, or otherwise yields control to
// a Promise chain) must go through `createActionButton` from
// `framework/action-button.ts`.
//
// What it flags:
//   - `addEventListener("click", async ...)` outside the factory itself.
//   - `el(doc, "button", { on: { click: async ... } })` patterns.
//   - `<button>.onclick = async ...` patterns.
//
// What it allows:
//   - The action-button factory file itself + its spec.
//   - Buttons that don't have any async work (Cancel, Close, Toggle visibility,
//     anchor-style links). These appear as non-async click handlers; the
//     script doesn't flag them.
//   - Any file that imports `createActionButton` — if you're using the
//     factory, the script trusts you (covers cases where the factory's
//     onClick still appears in source as `async (ctx) => { ... }`).
//
// Run via `npm run lint:buttons`. Wired into `npm run lint`.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SCAN_ROOT = join(REPO_ROOT, "src");

const ALLOWLIST = new Set([
  "src/content/framework/action-button.ts",
  "src/content/framework/action-button.spec.ts"
]);

// Only scan TypeScript source under src/. Skip .spec.ts (test files often
// stub click handlers in ways that look async).
function shouldScan(absPath) {
  if (!absPath.endsWith(".ts") && !absPath.endsWith(".tsx")) return false;
  if (absPath.endsWith(".d.ts")) return false;
  if (absPath.endsWith(".spec.ts")) return false;
  const rel = relative(REPO_ROOT, absPath);
  if (ALLOWLIST.has(rel)) return false;
  return true;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const violations = [];

const ASYNC_CLICK_LISTENER = /addEventListener\(\s*["']click["']\s*,\s*async\b/;
const ASYNC_ONCLICK = /\.onclick\s*=\s*async\b/;
// `el(doc, "button", { ..., on: { click: async ... } })` — multi-line tolerant.
// Detects an async arrow inside an `on: { click:` block.
const EL_BUTTON_ASYNC_CLICK =
  /el\([^,]+,\s*["']button["'][\s\S]*?on:\s*\{[\s\S]*?click\s*:\s*async\b/;

for (const file of walk(SCAN_ROOT)) {
  if (!shouldScan(file)) continue;
  const src = readFileSync(file, "utf8");

  // If the file imports createActionButton, trust it.
  if (
    src.includes("createActionButton") &&
    /import\s*\{[^}]*createActionButton/m.test(src)
  ) {
    continue;
  }

  const rel = relative(REPO_ROOT, file);
  if (ASYNC_CLICK_LISTENER.test(src)) {
    violations.push(`${rel}: addEventListener("click", async …) — use createActionButton`);
  }
  if (ASYNC_ONCLICK.test(src)) {
    violations.push(`${rel}: .onclick = async … — use createActionButton`);
  }
  if (EL_BUTTON_ASYNC_CLICK.test(src)) {
    violations.push(`${rel}: el(doc, "button", { on: { click: async … } }) — use createActionButton`);
  }
}

if (violations.length > 0) {
  console.error("Action-button enforcement failed:");
  for (const v of violations) console.error(`  ${v}`);
  console.error("");
  console.error("Every async-action button must use createActionButton from");
  console.error("framework/action-button.ts. See CLAUDE.md → 'Action buttons'.");
  process.exit(1);
}

console.log("lint:buttons clean");
