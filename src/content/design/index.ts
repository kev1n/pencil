// =============================================================================
// better-caesar design system — public API.
//
// Everything that affects how the extension *looks* lives in this directory:
//   tokens.ts      — every CSS custom property (--bc-*) and theme overrides
//   components.ts  — every higher-level .bc-* class built from those tokens
//   index.ts       — bootstrap (theme apply, dark mirror, storage)
//
// Other style modules consume these vars/classes and should not embed raw
// color literals. To revisit the look-and-feel: edit tokens.ts, or add a
// new `[data-bc-theme="X"]` override block. Live-switch via the theme
// dropdown in the popup; the html `data-bc-theme` attribute drives everything.
//
// Mode: paper.nu drives a global `.dark` class on <html>. We mirror that
// onto `data-bc-mode="dark"` so each theme owns its dark variant via
// `[data-bc-theme="X"][data-bc-mode="dark"]` rather than depending on the
// global class. CAESAR + the popup never get the .dark class so they only
// see the light-mode vars.
// =============================================================================

import { componentsCss } from "./components";
import { tokensCss, type FontUrlResolver } from "./tokens";

const STYLE_ID = "bc-design-system";
const THEME_STORAGE_KEY = "better-caesar:theme:v1";

export const BC_THEMES = ["default", "pencil", "bright"] as const;
export type BcTheme = typeof BC_THEMES[number];
// People with no saved choice (fresh installs and anyone who never opened
// the theme dropdown) get "bright", the pencil.nu website's look. The
// Northwestern purple and sketchbook themes stay selectable in the popup.
export const DEFAULT_THEME: BcTheme = "bright";

// Friendly labels for the popup dropdown. BC_THEMES order is the dropdown
// order; the select shows whichever theme is active.
export const THEME_LABELS: Record<BcTheme, string> = {
  default: "Northwestern purple",
  pencil: "Sketchbook",
  bright: "Pencil"
};

let darkObserver: MutationObserver | null = null;

// Content scripts resolve font URLs through chrome.runtime.getURL so the
// woff2 files in dist/<target>/assets/fonts/ resolve from any host page.
function contentScriptFontUrl(filename: string): string {
  return chrome.runtime.getURL(`assets/fonts/${filename}`);
}

export function injectDesignSystem(fontUrl?: FontUrlResolver): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `${tokensCss(fontUrl ?? contentScriptFontUrl)}\n${componentsCss()}`;
  (document.head ?? document.documentElement).appendChild(style);
}

export function applyTheme(theme: BcTheme): void {
  document.documentElement.setAttribute("data-bc-theme", theme);
}

// Paper.nu attaches its `.dark` class to a div inside the React tree, NOT
// to <html>. Watch for any `.dark` element anywhere in the document and
// mirror onto <html data-bc-mode="dark"> so the theme's dark vars activate
// across the whole tree (including modals and toasts mounted on document.body
// outside the React subtree).
export function startDarkModeMirror(): void {
  if (darkObserver) return;
  const root = document.documentElement;
  syncDarkMode(root);
  darkObserver = new MutationObserver(() => syncDarkMode(root));
  darkObserver.observe(root, {
    attributes: true,
    attributeFilter: ["class"],
    subtree: true
  });
}

function syncDarkMode(root: HTMLElement): void {
  if (document.querySelector(".dark")) {
    root.setAttribute("data-bc-mode", "dark");
  } else {
    root.removeAttribute("data-bc-mode");
  }
}

export async function bootstrapTheme(fontUrl?: FontUrlResolver): Promise<void> {
  injectDesignSystem(fontUrl);
  startDarkModeMirror();
  const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
  const value = stored[THEME_STORAGE_KEY];
  applyTheme(isBcTheme(value) ? value : DEFAULT_THEME);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const change = changes[THEME_STORAGE_KEY];
    if (!change) return;
    applyTheme(isBcTheme(change.newValue) ? change.newValue : DEFAULT_THEME);
  });
}

export async function setStoredTheme(theme: BcTheme): Promise<void> {
  await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
}

export async function getStoredTheme(): Promise<BcTheme> {
  const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
  const value = stored[THEME_STORAGE_KEY];
  return isBcTheme(value) ? value : DEFAULT_THEME;
}

export function bcThemeStorageKey(): string {
  return THEME_STORAGE_KEY;
}

function isBcTheme(value: unknown): value is BcTheme {
  return typeof value === "string" && (BC_THEMES as readonly string[]).includes(value);
}
