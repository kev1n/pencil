// The app wears the extension's design system: the same tokens, components
// and analytics-sheet styles, in the "bright" (Pencil) theme. App screens
// are written against the --bc-* tokens, so a token change restyles the
// extension and the app together.
import { injectStyles as injectCtecStyles } from "@ext/content/augmentations/paper-ctec/styles";
import { injectPrereqFilterStyles } from "@ext/content/augmentations/prereq-filter/styles";
import { applyTheme, injectDesignSystem } from "@ext/content/design";
import { isMac, NUSession } from "./native";

const fonts = import.meta.glob("../../../src/assets/fonts/*.woff2", {
  eager: true,
  query: "?url",
  import: "default"
}) as Record<string, string>;

function fontUrl(filename: string): string {
  const hit = Object.entries(fonts).find(([path]) => path.endsWith(`/${filename}`));
  return hit ? hit[1] : filename;
}

export type Appearance = "system" | "light" | "dark";
const APPEARANCE_KEY = "pencil-appearance";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

export function appearance(): Appearance {
  const saved = localStorage.getItem(APPEARANCE_KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

function applyAppearance(): void {
  const choice = appearance();
  const dark = choice === "dark" || (choice === "system" && systemDark.matches);
  // Each theme owns its dark variant, switched by this attribute.
  if (dark) document.documentElement.setAttribute("data-bc-mode", "dark");
  else document.documentElement.removeAttribute("data-bc-mode");
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  // The Mac window's frame follows along.
  if (isMac) void (NUSession as unknown as { appearance(o: { mode: Appearance }): Promise<void> }).appearance({ mode: choice }).catch(() => undefined);
}

export function setAppearance(choice: Appearance): void {
  localStorage.setItem(APPEARANCE_KEY, choice);
  applyAppearance();
}

export function bootstrapDesign(): void {
  injectDesignSystem(fontUrl);
  injectCtecStyles();
  injectPrereqFilterStyles(document);
  applyTheme("bright");
  applyAppearance();
  systemDark.addEventListener("change", applyAppearance);
}
