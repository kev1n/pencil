// =============================================================================
// Design tokens. Every color, radius, shadow, type size, and motion timing
// the extension uses is declared here as a CSS custom property. To change
// the look-and-feel: edit a value below, or add a new theme override block.
//
// Themes (each theme owns a light + dark variant):
//   default — original NU purple (kept as a legacy option in the popup)
//   pencil  — pencil.nu sketchbook palette (eraser pink + Ticonderoga cream)
//
// Selectors:
//   :root                                       — base shape/motion tokens
//   :root, [data-bc-theme="default"]            — default light values
//   [data-bc-theme="default"][data-bc-mode="dark"]  — default dark overrides
//   [data-bc-theme="pencil"]                    — pencil light values
//   [data-bc-theme="pencil"][data-bc-mode="dark"]   — pencil dark overrides
//
// Theme authors override only the vars they want to change; anything they
// leave alone falls back to the default values. The `--bc-*` namespace is
// reserved for this file — never define one elsewhere.
//
// Each theme is declared as a `Theme` data record consumed by `themeBlock()`.
// Mechanical alpha-ladders (`--bc-color-accent-fill-*`, `--bc-color-accent-
// border-*`, `--bc-color-warn-rose-*`, `--bc-color-ink-fill-*`,
// `--bc-color-ink-border-12`) derive from RGB tuples + per-step alpha maps;
// everything else is a flat `tokens: Record<varName, value>`.
//
// Web fonts ship as woff2 in src/assets/fonts/. The `@font-face` URLs are
// substituted at injection time via the resolver passed into tokensCss():
// the popup uses a relative path; content scripts use chrome.runtime.getURL.
// =============================================================================

export type FontUrlResolver = (filename: string) => string;

export function tokensCss(fontUrl?: FontUrlResolver): string {
  return [
    fontFaces(fontUrl ?? ((f) => `../assets/fonts/${f}`)),
    base(),
    themeBlock(":root,\n[data-bc-theme=\"default\"]", DEFAULT_LIGHT_THEME),
    themeBlock("[data-bc-theme=\"default\"][data-bc-mode=\"dark\"]", DEFAULT_DARK_THEME),
    themeBlock("[data-bc-theme=\"pencil\"]", PENCIL_LIGHT_THEME),
    themeBlock("[data-bc-theme=\"pencil\"][data-bc-mode=\"dark\"]", PENCIL_DARK_THEME)
  ].join("\n");
}

// -----------------------------------------------------------------------------
// @font-face declarations — woff2 only, latin subset only. Files live in
// src/assets/fonts/ and are copied to dist/<target>/assets/fonts/ by build.mjs.
// -----------------------------------------------------------------------------
function fontFaces(url: FontUrlResolver): string {
  const face = (
    family: string,
    weight: number,
    file: string,
    style = "normal"
  ): string => `
@font-face {
  font-family: "${family}";
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url("${url(file)}") format("woff2");
}`;
  return [
    face("Special Elite", 400, "special-elite-regular.woff2"),
    face("Caveat", 400, "caveat-regular.woff2"),
    face("Caveat", 600, "caveat-600.woff2"),
    face("Caveat", 700, "caveat-700.woff2"),
    face("Inter", 400, "inter-regular.woff2"),
    face("Inter", 500, "inter-500.woff2"),
    face("Inter", 600, "inter-600.woff2"),
    face("Inter", 700, "inter-700.woff2"),
    face("JetBrains Mono", 400, "jetbrains-mono-regular.woff2"),
    face("JetBrains Mono", 500, "jetbrains-mono-500.woff2")
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Base — values shared across all themes (shape tokens, motion). Themes can
// override but rarely need to.
// -----------------------------------------------------------------------------
function base(): string {
  return `
:root {
  /* Radii */
  --bc-radius-xs: 2px;
  --bc-radius-sm: 4px;
  --bc-radius-md: 6px;
  --bc-radius-lg: 8px;
  --bc-radius-xl: 10px;
  --bc-radius-2xl: 12px;
  --bc-radius-3xl: 14px;
  --bc-radius-pill: 999px;
  --bc-radius-circle: 50%;

  /* Type sizes */
  --bc-font-9: 9px;
  --bc-font-10: 10px;
  --bc-font-11: 11px;
  --bc-font-12: 12px;
  --bc-font-13: 13px;
  --bc-font-14: 14px;
  --bc-font-15: 15px;
  --bc-font-16: 16px;
  --bc-font-18: 18px;
  --bc-font-20: 20px;
  --bc-font-22: 22px;
  --bc-font-24: 24px;
  --bc-font-26: 26px;
  --bc-font-28: 28px;
  --bc-font-36: 36px;

  /* Type weights */
  --bc-fw-regular: 400;
  --bc-fw-medium: 500;
  --bc-fw-semibold: 600;
  --bc-fw-bold: 700;
  --bc-fw-extrabold: 800;

  /* Default weight for display-font surfaces (.bc-paper-ctec-modal-title,
     .bc-paper-ctec-modal-card-title, etc.). Defaults to semibold so
     Northwestern-theme headers (rendered in Inter via inherited stack)
     get enough presence; the pencil theme overrides to regular to keep
     Special Elite at its native single weight. */
  --bc-fw-display: var(--bc-fw-semibold);

  /* Motion */
  --bc-tx-fast: 80ms;
  --bc-tx-base: 120ms;
  --bc-tx-slow: 220ms;
  --bc-easing: ease;

  /* Static (theme-invariant) colors — used when sitting on an inline-set
     saturated background (e.g. heatmap cells), where the text color must
     stay near-white regardless of light/dark theme. */
  --bc-color-on-saturated: #ffffff;

  /* Heatmap shader RGB tuples. JS reads these at render time and
     interpolates an alpha for each cell (so cell intensity scales with
     value while the hue follows the theme). Two scales: ratings (Inst /
     Course / Learn / Global) and hours. */
  --bc-color-heatmap-rating-rgb: 102, 2, 60;
  --bc-color-heatmap-hours-rgb: 162, 28, 175;

  /* Letter-spacing */
  --bc-ls-tight: -0.02em;
  --bc-ls-snug: -0.01em;
  --bc-ls-wide: 0.02em;
  --bc-ls-wider: 0.03em;
  --bc-ls-widest: 0.04em;
  --bc-ls-caps: 0.06em;
  --bc-ls-caps-wide: 0.08em;
  --bc-ls-caps-widest: 0.1em;

  /* Font stacks. Body/mono are the general workhorses across every theme.
     Display/hand default to inherit so the Northwestern (default) theme
     leaves headers and accents in whatever font the surrounding host page
     uses (CAESAR's Helvetica/Arial, Paper.nu's system stack, the popup's
     own family, etc.) — applying font-family: var(--bc-font-display)
     becomes a no-op. The pencil theme overrides --bc-font-display and
     --bc-font-hand in its own block to bring back the typewriter +
     handwriting flair. The system fallbacks on body let CAESAR / Paper.nu
     render with native fonts before the woff2 finishes loading. */
  --bc-font-body: "Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --bc-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --bc-font-display: inherit;
  --bc-font-hand: inherit;
}
`;
}

// -----------------------------------------------------------------------------
// Theme record + renderer
// -----------------------------------------------------------------------------
//
// Each Theme declares the four mechanical alpha-ladder RGB tuples plus the
// per-step alpha maps, then the rest of the tokens as a flat name→value
// record. `themeBlock(selector, theme)` materializes the CSS rule.
//
// Ladder keys are the suffixes of the emitted variable names — e.g. the
// `accentFill["12"]` entry in default-light produces
// `--bc-color-accent-fill-12: rgba(102, 2, 60, 0.12);`. This makes
// per-theme alpha tweaks (default-dark drops `fill-15` from 0.15 → 0.16,
// pencil-light bumps `fill-08` from 0.08 → 0.10, etc.) explicit without
// needing 12 hand-written rgba() lines.

type RgbTuple = readonly [number, number, number];

interface Theme {
  /** Accent ladder RGB (drives `--bc-color-accent-fill-*` + `-border-*`). */
  accentRgb: RgbTuple;
  accentFill: Record<string, string>; // step suffix → alpha string ("0.12")
  accentBorder: Record<string, string>;

  /** Warn-rose ladder RGB (drives `--bc-color-warn-rose-*`). */
  warnRoseRgb: RgbTuple;
  warnRoseFill: Record<string, string>;
  warnRoseBorder: Record<string, string>;

  /** Ink-fill ladder RGB (drives `--bc-color-ink-fill-*`). */
  inkFillRgb: RgbTuple;
  inkFill: Record<string, string>;

  /** `--bc-color-ink-border-12` carries its own RGB across themes. */
  inkBorder12: string;

  /**
   * Everything else as `varName → value` (where varName is the FULL
   * `--bc-...` name). Order is preserved verbatim in the emitted CSS.
   */
  tokens: Record<string, string>;
}

function rgba(rgb: RgbTuple, alpha: string): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function ladderLines(prefix: string, rgb: RgbTuple, alphas: Record<string, string>): string[] {
  return Object.entries(alphas).map(
    ([step, alpha]) => `  --bc-color-${prefix}-${step}: ${rgba(rgb, alpha)};`
  );
}

function themeBlock(selector: string, theme: Theme): string {
  const lines: string[] = [];
  lines.push(...ladderLines("accent-fill", theme.accentRgb, theme.accentFill));
  lines.push(...ladderLines("accent-border", theme.accentRgb, theme.accentBorder));
  lines.push(...ladderLines("warn-rose-fill", theme.warnRoseRgb, theme.warnRoseFill));
  lines.push(...ladderLines("warn-rose-border", theme.warnRoseRgb, theme.warnRoseBorder));
  lines.push(...ladderLines("ink-fill", theme.inkFillRgb, theme.inkFill));
  lines.push(`  --bc-color-ink-border-12: ${theme.inkBorder12};`);
  for (const [name, value] of Object.entries(theme.tokens)) {
    lines.push(`  ${name}: ${value};`);
  }
  return `\n${selector} {\n${lines.join("\n")}\n}\n`;
}

// -----------------------------------------------------------------------------
// Default theme — light values. CAESAR + the popup always show this; paper.nu
// shows it when its .dark class is absent.
// -----------------------------------------------------------------------------
const DEFAULT_LIGHT_THEME: Theme = {
  accentRgb: [102, 2, 60],
  accentFill: {
    "04": "0.04", "05": "0.05", "06": "0.06", "08": "0.08", "10": "0.10",
    "12": "0.12", "15": "0.15", "18": "0.18", "22": "0.22", "24": "0.24",
    "32": "0.32", "45": "0.45"
  },
  accentBorder: {
    "08": "0.08", "12": "0.12", "14": "0.14", "18": "0.18",
    "22": "0.22", "28": "0.28", "32": "0.32", "45": "0.45"
  },
  warnRoseRgb: [190, 24, 93],
  warnRoseFill: { "12": "0.12", "20": "0.20" },
  warnRoseBorder: { "28": "0.28", "32": "0.32" },
  inkFillRgb: [15, 23, 42],
  inkFill: { "04": "0.04", "06": "0.06", "08": "0.08", "025": "0.025" },
  inkBorder12: "rgba(17, 24, 39, 0.12)",
  tokens: {
    "--bc-color-accent": "#66023c",
    "--bc-color-accent-hover": "#500030",
    "--bc-color-accent-pressed": "#3f0126",
    "--bc-color-accent-on": "#ffffff",
    "--bc-color-accent-soft": "#66023c",
    "--bc-color-accent-soft-hover": "#500030",
    "--bc-color-accent-soft-on": "#ffffff",
    "--bc-color-accent-surface-faint": "#fff7fb",
    "--bc-color-accent-surface-soft": "#fdeef5",
    "--bc-color-accent-surface-tint": "#faf3f7",
    "--bc-color-accent-surface-tile": "#f6ecf2",
    "--bc-color-accent-surface-tile-2": "#f1ebef",
    "--bc-color-accent-surface-row": "#faf7f9",
    "--bc-color-accent-surface-row-border": "#f0e4eb",
    "--bc-color-accent-mid-border": "#d8b6c8",
    "--bc-color-warn-rose-text": "#9f1239",
    "--bc-color-warn-rose-text-deep": "#881337",
    "--bc-color-paper": "#4e2a84",
    "--bc-color-paper-deep": "#3a1f63",
    "--bc-color-paper-soft": "#f3eef9",
    "--bc-color-bg": "#ffffff",
    "--bc-color-bg-app": "#f3f4f6",
    "--bc-color-bg-muted": "#fafafa",
    "--bc-color-bg-inset": "var(--bc-color-accent-surface-row)",
    "--bc-color-surface-hover": "#f7f7f8",
    "--bc-color-surface-hover-strong": "#f3f3f5",
    "--bc-color-surface-soft": "#f9fafb",
    "--bc-color-border": "#e6e6ea",
    "--bc-color-border-strong": "#d1d5db",
    "--bc-color-border-divider": "#e5e7eb",
    "--bc-color-surface-translucent-86": "rgba(255, 251, 253, 0.86)",
    "--bc-color-surface-translucent-72": "rgba(255, 255, 255, 0.72)",
    "--bc-color-surface-translucent-62": "rgba(255, 255, 255, 0.62)",
    "--bc-color-surface-translucent-56": "rgba(255, 255, 255, 0.56)",
    "--bc-color-surface-translucent-84": "rgba(255, 255, 255, 0.84)",
    "--bc-color-surface-translucent-88": "rgba(255, 255, 255, 0.88)",
    "--bc-color-surface-translucent-92": "rgba(255, 255, 255, 0.92)",
    "--bc-color-surface-translucent-98": "rgba(255, 255, 255, 0.98)",
    "--bc-color-surface-warm-grad-top": "rgba(255, 250, 252, 0.98)",
    "--bc-color-text": "#1f2937",
    "--bc-color-text-strong": "#111827",
    "--bc-color-text-soft": "#4b5563",
    "--bc-color-text-muted": "#6b7280",
    "--bc-color-text-subtle": "#9ca3af",
    "--bc-color-text-mauve": "#7a596a",
    "--bc-color-text-mauve-soft": "#6b5a65",
    "--bc-color-text-mauve-warm": "#5b4451",
    "--bc-color-text-mauve-deep": "#2f1f29",
    "--bc-color-text-mauve-panel": "#3f3340",
    "--bc-color-text-mauve-pale": "#c9b4bf",
    "--bc-color-text-mauve-cool": "#9b6b81",
    "--bc-color-text-mauve-axis": "#9b8290",
    "--bc-color-text-mauve-axis-strong": "#7a596a",
    "--bc-color-text-body-warm": "#4b3a44",
    "--bc-color-text-mauve-cool-alt": "#6b5a65",
    "--bc-color-text-on-tooltip": "#f9fafb",
    "--bc-color-text-on-histogram": "#3a2730",
    "--bc-color-success": "#15803d",
    "--bc-color-success-bg": "#dcfce7",
    "--bc-color-success-bg-soft": "#ecfdf5",
    "--bc-color-success-border": "#abefc6",
    "--bc-color-success-text": "#054f31",
    "--bc-color-success-deep": "#047857",
    "--bc-color-success-distro-text": "#065f46",
    "--bc-color-success-distro-bg": "#ecfdf5",
    "--bc-color-warn": "#b45309",
    "--bc-color-warn-bg": "#fef3c7",
    "--bc-color-warn-bg-soft": "#fffaeb",
    "--bc-color-warn-bg-page": "#fff7ed",
    "--bc-color-warn-border": "#fedf89",
    "--bc-color-warn-border-page": "#fdba74",
    "--bc-color-warn-text": "#93370d",
    "--bc-color-warn-text-page": "#7c2d12",
    "--bc-color-warn-text-discipline": "#92400e",
    "--bc-color-danger": "#b91c1c",
    "--bc-color-danger-bg": "#fee2e2",
    "--bc-color-danger-bg-soft": "#fef3f2",
    "--bc-color-danger-bg-pill": "#fdecec",
    "--bc-color-danger-border": "#fecdca",
    "--bc-color-danger-text": "#912018",
    "--bc-color-danger-text-pill": "#b03d3d",
    "--bc-color-danger-deep": "#b91c1c",
    "--bc-color-danger-rose": "#9f1239",
    "--bc-color-info-bg": "#eef2ff",
    "--bc-color-info-border": "#c7d2fe",
    "--bc-color-info-text": "#1e1b4b",
    "--bc-color-info-text-deep": "#3730a3",
    "--bc-color-highlight": "#fef08a",
    "--bc-color-highlight-text": "#713f12",
    "--bc-color-highlight-mark": "rgba(254, 240, 138, 0.7)",
    "--bc-color-star-base": "#c9b4bf",
    "--bc-color-star-fill": "#d97706",
    "--bc-color-hours-grad-start": "#a21caf",
    "--bc-color-hours-grad-end": "#db2777",
    "--bc-color-chart-trend-axis": "#f1ebef",
    "--bc-color-chart-trend-text": "#9b8290",
    "--bc-color-chart-trend-text-strong": "#7a596a",
    "--bc-color-chart-axis-cool": "#475569",
    "--bc-color-ink": "#1f2937",
    "--bc-color-ink-deep": "#0f172a",
    "--bc-color-ink-text": "#1f2937",
    "--bc-color-ink-text-on-light": "#f9fafb",
    "--bc-color-ink-instructor-pill-bg": "rgba(17, 24, 39, 0.06)",
    "--bc-shadow-elev-1": "0 1px 2px rgba(15, 23, 42, 0.04)",
    "--bc-shadow-elev-2": "0 2px 8px rgba(15, 23, 42, 0.05)",
    "--bc-shadow-card-soft": "0 -1px 2px rgba(15, 23, 42, 0.04)",
    "--bc-shadow-button": "0 2px 6px rgba(15, 23, 42, 0.18)",
    "--bc-shadow-button-hover": "0 3px 8px rgba(15, 23, 42, 0.22)",
    "--bc-shadow-add-cta": "0 2px 6px rgba(102, 2, 60, 0.22)",
    "--bc-shadow-modal": "0 1px 2px rgba(0, 0, 0, 0.06), 0 30px 60px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.04)",
    "--bc-shadow-modal-status": "0 1px 2px rgba(0, 0, 0, 0.04)",
    "--bc-shadow-auth-card": "0 28px 60px rgba(15, 23, 42, 0.32)",
    "--bc-shadow-side-panel": "0 10px 28px rgba(102, 2, 60, 0.08)",
    "--bc-shadow-tooltip": "0 8px 24px rgba(0, 0, 0, 0.18)",
    "--bc-shadow-kpi-active-ring": "0 0 0 3px rgba(102, 2, 60, 0.08)",
    "--bc-shadow-toggle-knob": "0 1px 3px rgba(0, 0, 0, 0.25)",
    "--bc-shadow-input-focus-ring": "0 0 0 3px rgba(102, 2, 60, 0.18)",
    "--bc-shadow-input-focus-inner": "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
    "--bc-color-overlay-modal": "rgba(15, 23, 42, 0.55)",
    "--bc-color-overlay-auth": "rgba(15, 23, 42, 0.6)",
    "--bc-color-overlay-on-light": "rgba(15, 23, 42, 0.08)",
    "--bc-color-flash-pill-bg": "rgba(255, 255, 255, 0.65)",
    "--bc-color-flash-action-bg": "rgba(255, 255, 255, 0.7)",
    "--bc-color-flash-action-bg-hover": "rgba(255, 255, 255, 1)",
    "--bc-color-sentiment-pos-fg": "#15803d",
    "--bc-color-sentiment-pos-bg": "#ecfdf5",
    "--bc-color-sentiment-neg-fg": "#9f1239",
    "--bc-color-sentiment-neg-bg": "#fff1f2",
    "--bc-color-sentiment-mix-fg": "#a16207",
    "--bc-color-sentiment-mix-bg": "#fefce8",
    "--bc-color-sentiment-neu-fg": "#7a596a",
    "--bc-color-sentiment-neu-bg": "#f6ecf2",
    "--bc-color-sentiment-all-dot": "#d8b6c8",
    "--bc-color-kpi-fg-dark": "#f9fafb",
    "--bc-color-panel-grad-top": "rgba(255, 250, 252, 0.98)",
    "--bc-color-panel-grad-bottom": "rgba(255, 255, 255, 0.98)",
    "--bc-color-card-outline": "rgba(17, 24, 39, 0.7)",
    "--bc-color-card-divider-soft": "rgba(17, 24, 39, 0.12)",
    "--bc-color-cart-bg": "#1f2937",
    "--bc-color-cart-bg-hover": "#0f172a",
    "--bc-color-cart-border": "rgba(15, 23, 42, 0.45)",
    "--bc-color-cart-border-hover": "rgba(15, 23, 42, 0.7)",
    "--bc-color-cart-text": "#f9fafb",
    "--bc-color-cart-success-bg": "#047857",
    "--bc-color-cart-success-border": "rgba(4, 120, 87, 0.65)",
    "--bc-color-cart-success-text": "#ecfdf5",
    "--bc-color-cart-error-bg": "#b91c1c",
    "--bc-color-cart-error-border": "rgba(185, 28, 28, 0.7)",
    "--bc-color-cart-error-text": "#fef2f2",
    "--bc-color-cart-loading-bg": "#4b5563",
    "--bc-color-cart-loading-border": "rgba(75, 85, 99, 0.65)",
    "--bc-color-cart-loading-text": "#f3f4f6",
    "--bc-color-comment-highlight-light": "rgba(250, 204, 21, 0.38)",
    "--bc-color-comments-card-bg": "var(--bc-color-surface-hover)",
    "--bc-color-disabled-bg": "#c7c2d6",
    "--bc-color-gate-warn-bg": "#fff7ed",
    "--bc-color-gate-warn-border": "#fdba74",
    "--bc-color-gate-warn-text": "#7c2d12",
    "--bc-color-gate-lock-bg": "#eef2ff",
    "--bc-color-gate-lock-border": "#c7d2fe",
    "--bc-color-gate-lock-text": "#1e1b4b",
    "--bc-color-gate-ok-bg": "#ecfdf5",
    "--bc-color-gate-ok-border": "#a7f3d0",
    "--bc-color-gate-ok-text": "#064e3b",
    "--bc-color-seat-full-bg": "#fde8e8",
    "--bc-color-seat-full-border": "#f4a9a9",
    "--bc-color-seat-full-ink": "#8c1d18",
    "--bc-color-seat-waitlist-bg": "#fff0d9",
    "--bc-color-seat-waitlist-border": "#f1c27a",
    "--bc-color-seat-waitlist-ink": "#8a4b00",
    "--bc-color-seat-info-bg": "#eef2ff",
    "--bc-color-seat-info-border": "#c7d2fe",
    "--bc-color-seat-info-ink": "#3730a3",
    "--bc-color-seat-warn-bg": "#fff1df",
    "--bc-color-seat-warn-border": "#f7c58a",
    "--bc-color-seat-warn-ink": "#94410d",
    "--bc-color-seat-tight-bg": "#fff8d9",
    "--bc-color-seat-tight-border": "#eed46b",
    "--bc-color-seat-tight-ink": "#7a5d00",
    "--bc-color-seat-room-bg": "#eef8d7",
    "--bc-color-seat-room-border": "#bfdc7d",
    "--bc-color-seat-room-ink": "#4d6b00",
    "--bc-color-seat-open-bg": "#e8f5e9",
    "--bc-color-seat-open-border": "#b9ddbc",
    "--bc-color-seat-open-ink": "#1b5e20",
    "--bc-color-seat-warn-row-text": "#8a2e00",
    "--bc-color-seat-warn-row-border": "#d99a66",
    "--bc-color-seat-error-text": "#7a123f",
    "--bc-color-seat-muted-text": "#5c4c56",
    "--bc-color-trend-zone-1": "rgba(220, 38, 38, 0.08)",
    "--bc-color-trend-zone-2": "rgba(234, 88, 12, 0.08)",
    "--bc-color-trend-zone-3": "rgba(202, 138, 4, 0.08)",
    "--bc-color-trend-zone-4": "rgba(101, 163, 13, 0.10)",
    "--bc-color-trend-zone-5": "rgba(22, 163, 74, 0.10)",
    /* Solid-fill counterparts of the trend zones. Same hue family used
       for spline-chart background bands, but at foreground opacity so
       the same red→green semantic encoding can drive the rating
       horizontal-bar fills (and any future tier-aware foreground UI).
       Six tiers (vs. five for the spline backgrounds) so each integer
       rating 1..6 can carry its own color — zone-6 is a deeper emerald
       past zone-5's green so the top bin reads as visually distinct. */
    "--bc-color-trend-zone-1-solid": "rgba(220, 38, 38, 0.85)",
    "--bc-color-trend-zone-2-solid": "rgba(234, 88, 12, 0.85)",
    "--bc-color-trend-zone-3-solid": "rgba(202, 138, 4, 0.85)",
    "--bc-color-trend-zone-4-solid": "rgba(101, 163, 13, 0.85)",
    "--bc-color-trend-zone-5-solid": "rgba(22, 163, 74, 0.85)",
    "--bc-color-trend-zone-6-solid": "rgba(4, 120, 87, 0.92)"
  }
};

// -----------------------------------------------------------------------------
// Default theme — dark variant. Two accent tracks here, faithful to the
// existing design: the modal stack uses lavender (#d8b4fe), and the side-card
// / status bar / auth modal stack uses pink (#fbcfe8).
// -----------------------------------------------------------------------------
const DEFAULT_DARK_THEME: Theme = {
  accentRgb: [252, 165, 207],
  accentFill: {
    "04": "0.06", "05": "0.06", "06": "0.06", "08": "0.08", "10": "0.10",
    "12": "0.12", "15": "0.16", "18": "0.16", "22": "0.22", "24": "0.22",
    "32": "0.30", "45": "0.40"
  },
  accentBorder: {
    "08": "0.12", "12": "0.12", "14": "0.14", "18": "0.18",
    "22": "0.22", "28": "0.30", "32": "0.36", "45": "0.45"
  },
  warnRoseRgb: [251, 113, 133],
  warnRoseFill: { "12": "0.14", "20": "0.22" },
  warnRoseBorder: { "28": "0.30", "32": "0.40" },
  inkFillRgb: [248, 250, 252],
  inkFill: { "04": "0.04", "06": "0.06", "08": "0.08", "025": "0.05" },
  inkBorder12: "rgba(255, 255, 255, 0.14)",
  tokens: {
    "--bc-color-accent": "#d8b4fe",
    "--bc-color-accent-hover": "#c084fc",
    "--bc-color-accent-pressed": "#c084fc",
    "--bc-color-accent-on": "#1f1147",
    "--bc-color-accent-soft": "#fbcfe8",
    "--bc-color-accent-soft-hover": "#f9a8d4",
    "--bc-color-accent-soft-on": "#500030",
    "--bc-color-accent-surface-faint": "rgba(168, 85, 247, 0.08)",
    "--bc-color-accent-surface-soft": "rgba(216, 180, 254, 0.18)",
    "--bc-color-accent-surface-tint": "rgba(252, 165, 207, 0.08)",
    "--bc-color-accent-surface-tile": "rgba(252, 165, 207, 0.14)",
    "--bc-color-accent-surface-tile-2": "rgba(252, 165, 207, 0.10)",
    "--bc-color-accent-surface-row": "rgba(17, 24, 39, 0.30)",
    "--bc-color-accent-surface-row-border": "rgba(252, 165, 207, 0.14)",
    "--bc-color-accent-mid-border": "rgba(252, 165, 207, 0.30)",
    "--bc-color-warn-rose-text": "#fecdd3",
    "--bc-color-warn-rose-text-deep": "#fecdd3",
    "--bc-color-bg": "#262626",
    "--bc-color-bg-app": "#171717",
    "--bc-color-bg-muted": "#171717",
    "--bc-color-bg-inset": "#262626",
    "--bc-color-surface-hover": "#404040",
    "--bc-color-surface-hover-strong": "#525252",
    "--bc-color-surface-soft": "#262626",
    "--bc-color-border": "#404040",
    "--bc-color-border-strong": "#525252",
    "--bc-color-border-divider": "#404040",
    "--bc-color-surface-translucent-86": "rgba(17, 24, 39, 0.26)",
    "--bc-color-surface-translucent-72": "rgba(17, 24, 39, 0.32)",
    "--bc-color-surface-translucent-62": "rgba(17, 24, 39, 0.22)",
    "--bc-color-surface-translucent-56": "rgba(17, 24, 39, 0.22)",
    "--bc-color-surface-translucent-84": "rgba(17, 24, 39, 0.35)",
    "--bc-color-surface-translucent-88": "transparent",
    "--bc-color-surface-translucent-92": "rgba(17, 24, 39, 0.40)",
    "--bc-color-surface-translucent-98": "rgba(31, 24, 29, 0.98)",
    "--bc-color-surface-warm-grad-top": "rgba(31, 24, 29, 0.98)",
    "--bc-color-text": "#fafafa",
    "--bc-color-text-strong": "#f9fafb",
    "--bc-color-text-soft": "#d1d5db",
    "--bc-color-text-muted": "#a3a3a3",
    "--bc-color-text-subtle": "#737373",
    "--bc-color-text-mauve": "#d4b9c5",
    "--bc-color-text-mauve-soft": "#d8c7d0",
    "--bc-color-text-mauve-warm": "#f3e5ed",
    "--bc-color-text-mauve-deep": "#fff6fb",
    "--bc-color-text-mauve-panel": "#f5e7ee",
    "--bc-color-text-mauve-pale": "rgba(255, 227, 238, 0.36)",
    "--bc-color-text-mauve-cool": "#c4b5fd",
    "--bc-color-text-mauve-axis": "#a3a3a3",
    "--bc-color-text-mauve-axis-strong": "#a3a3a3",
    "--bc-color-text-body-warm": "#e8d3dc",
    "--bc-color-text-mauve-cool-alt": "#d8c7d0",
    "--bc-color-text-on-tooltip": "#fafafa",
    "--bc-color-text-on-histogram": "#fafafa",
    "--bc-color-success": "#6ee7b7",
    "--bc-color-success-bg": "rgba(16, 78, 53, 0.32)",
    "--bc-color-success-bg-soft": "rgba(16, 78, 53, 0.32)",
    "--bc-color-success-border": "rgba(110, 231, 183, 0.36)",
    "--bc-color-success-text": "#d1fadf",
    "--bc-color-success-deep": "#6ee7b7",
    "--bc-color-success-distro-text": "#d1fadf",
    "--bc-color-success-distro-bg": "rgba(16, 78, 53, 0.32)",
    "--bc-color-warn": "#fef3c7",
    "--bc-color-warn-bg": "rgba(120, 53, 15, 0.32)",
    "--bc-color-warn-bg-soft": "rgba(120, 53, 15, 0.32)",
    "--bc-color-warn-bg-page": "rgba(120, 53, 15, 0.32)",
    "--bc-color-warn-border": "rgba(254, 223, 137, 0.36)",
    "--bc-color-warn-border-page": "rgba(254, 223, 137, 0.36)",
    "--bc-color-warn-text": "#fef3c7",
    "--bc-color-warn-text-page": "#fef3c7",
    "--bc-color-warn-text-discipline": "#fef3c7",
    "--bc-color-danger": "#fda4af",
    "--bc-color-danger-bg": "rgba(127, 29, 29, 0.32)",
    "--bc-color-danger-bg-soft": "rgba(127, 29, 29, 0.32)",
    "--bc-color-danger-bg-pill": "rgba(127, 29, 29, 0.32)",
    "--bc-color-danger-border": "rgba(254, 205, 202, 0.36)",
    "--bc-color-danger-text": "#fee4e2",
    "--bc-color-danger-text-pill": "#fda4af",
    "--bc-color-danger-deep": "#fda4af",
    "--bc-color-danger-rose": "#fda4af",
    "--bc-color-info-bg": "rgba(168, 85, 247, 0.14)",
    "--bc-color-info-border": "rgba(216, 180, 254, 0.32)",
    "--bc-color-info-text": "#d8b4fe",
    "--bc-color-info-text-deep": "#c4b5fd",
    "--bc-color-highlight": "rgba(254, 240, 138, 0.85)",
    "--bc-color-highlight-text": "#1f1147",
    "--bc-color-highlight-mark": "rgba(254, 240, 138, 0.35)",
    "--bc-color-star-base": "rgba(255, 227, 238, 0.36)",
    "--bc-color-star-fill": "#fbbf24",
    "--bc-color-hours-grad-start": "#d8b4fe",
    "--bc-color-hours-grad-end": "#f9a8d4",
    "--bc-color-chart-trend-axis": "#525252",
    "--bc-color-chart-trend-text": "#a3a3a3",
    "--bc-color-chart-trend-text-strong": "#a3a3a3",
    "--bc-color-chart-axis-cool": "#a3a3a3",
    "--bc-color-ink": "#d8b4fe",
    "--bc-color-ink-deep": "#c084fc",
    "--bc-color-ink-text": "#fafafa",
    "--bc-color-ink-text-on-light": "#1f1147",
    "--bc-color-ink-instructor-pill-bg": "rgba(255, 255, 255, 0.08)",
    "--bc-shadow-elev-1": "0 1px 2px rgba(0, 0, 0, 0.4)",
    "--bc-shadow-elev-2": "0 2px 8px rgba(0, 0, 0, 0.4)",
    "--bc-shadow-card-soft": "0 -1px 2px rgba(0, 0, 0, 0.4)",
    "--bc-shadow-button": "0 2px 6px rgba(0, 0, 0, 0.4)",
    "--bc-shadow-button-hover": "0 3px 8px rgba(0, 0, 0, 0.5)",
    "--bc-shadow-add-cta": "0 2px 6px rgba(216, 180, 254, 0.3)",
    "--bc-shadow-modal": "0 1px 2px rgba(0, 0, 0, 0.4), 0 30px 60px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.04)",
    "--bc-shadow-modal-status": "0 1px 2px rgba(0, 0, 0, 0.4)",
    "--bc-shadow-auth-card": "0 28px 60px rgba(0, 0, 0, 0.6)",
    "--bc-shadow-side-panel": "0 10px 28px rgba(0, 0, 0, 0.22)",
    "--bc-shadow-tooltip": "0 8px 24px rgba(0, 0, 0, 0.45)",
    "--bc-shadow-kpi-active-ring": "0 0 0 3px rgba(216, 180, 254, 0.18)",
    "--bc-shadow-toggle-knob": "0 1px 3px rgba(0, 0, 0, 0.45)",
    "--bc-shadow-input-focus-ring": "0 0 0 3px rgba(216, 180, 254, 0.24)",
    "--bc-shadow-input-focus-inner": "inset 0 1px 2px rgba(0, 0, 0, 0.3)",
    "--bc-color-overlay-modal": "rgba(0, 0, 0, 0.55)",
    "--bc-color-overlay-auth": "rgba(0, 0, 0, 0.6)",
    "--bc-color-overlay-on-light": "rgba(255, 255, 255, 0.08)",
    "--bc-color-panel-grad-top": "rgba(31, 24, 29, 0.98)",
    "--bc-color-panel-grad-bottom": "rgba(23, 18, 22, 0.98)",
    "--bc-color-card-outline": "rgba(248, 250, 252, 0.7)",
    "--bc-color-card-divider-soft": "rgba(255, 255, 255, 0.14)",
    "--bc-color-heatmap-rating-rgb": "216, 180, 254",
    "--bc-color-heatmap-hours-rgb": "252, 165, 207",
    "--bc-color-cart-bg": "#404040",
    "--bc-color-cart-bg-hover": "#525252",
    "--bc-color-cart-border": "#525252",
    "--bc-color-cart-border-hover": "#737373",
    "--bc-color-cart-text": "#fafafa",
    "--bc-color-cart-success-bg": "#047857",
    "--bc-color-cart-success-border": "#10b981",
    "--bc-color-cart-success-text": "#ecfdf5",
    "--bc-color-cart-error-bg": "#b91c1c",
    "--bc-color-cart-error-border": "#ef4444",
    "--bc-color-cart-error-text": "#fef2f2",
    "--bc-color-cart-loading-bg": "#525252",
    "--bc-color-cart-loading-border": "#737373",
    "--bc-color-cart-loading-text": "#f3f4f6",
    "--bc-color-comment-highlight-light": "rgba(250, 204, 21, 0.24)",
    "--bc-color-disabled-bg": "#525252",
    "--bc-color-gate-warn-bg": "rgba(120, 53, 15, 0.32)",
    "--bc-color-gate-warn-border": "rgba(254, 223, 137, 0.36)",
    "--bc-color-gate-warn-text": "#fef3c7",
    "--bc-color-gate-lock-bg": "rgba(168, 85, 247, 0.14)",
    "--bc-color-gate-lock-border": "rgba(216, 180, 254, 0.32)",
    "--bc-color-gate-lock-text": "#d8b4fe",
    "--bc-color-gate-ok-bg": "rgba(16, 78, 53, 0.32)",
    "--bc-color-gate-ok-border": "rgba(110, 231, 183, 0.36)",
    "--bc-color-gate-ok-text": "#d1fadf",
    "--bc-color-trend-zone-1": "rgba(248, 113, 113, 0.16)",
    "--bc-color-trend-zone-2": "rgba(251, 146, 60, 0.16)",
    "--bc-color-trend-zone-3": "rgba(250, 204, 21, 0.16)",
    "--bc-color-trend-zone-4": "rgba(132, 204, 22, 0.18)",
    "--bc-color-trend-zone-5": "rgba(74, 222, 128, 0.18)",
    "--bc-color-trend-zone-1-solid": "rgba(248, 113, 113, 0.90)",
    "--bc-color-trend-zone-2-solid": "rgba(251, 146, 60, 0.90)",
    "--bc-color-trend-zone-3-solid": "rgba(250, 204, 21, 0.90)",
    "--bc-color-trend-zone-4-solid": "rgba(132, 204, 22, 0.90)",
    "--bc-color-trend-zone-5-solid": "rgba(74, 222, 128, 0.90)",
    "--bc-color-trend-zone-6-solid": "rgba(16, 185, 129, 0.95)"
  }
};

// -----------------------------------------------------------------------------
// Pencil theme — light. Mirrors the pencil-landing-page palette: Ticonderoga
// cream paper with eraser-pink accent and graphite ink.
// -----------------------------------------------------------------------------
const PENCIL_LIGHT_THEME: Theme = {
  accentRgb: [208, 95, 120],
  accentFill: {
    "04": "0.05", "05": "0.06", "06": "0.07", "08": "0.10", "10": "0.12",
    "12": "0.14", "15": "0.18", "18": "0.22", "22": "0.26", "24": "0.28",
    "32": "0.36", "45": "0.50"
  },
  accentBorder: {
    "08": "0.14", "12": "0.20", "14": "0.22", "18": "0.28",
    "22": "0.32", "28": "0.40", "32": "0.45", "45": "0.55"
  },
  warnRoseRgb: [190, 24, 93],
  warnRoseFill: { "12": "0.12", "20": "0.20" },
  warnRoseBorder: { "28": "0.28", "32": "0.32" },
  inkFillRgb: [42, 42, 46],
  inkFill: { "04": "0.04", "06": "0.06", "08": "0.08", "025": "0.025" },
  inkBorder12: "rgba(42, 42, 46, 0.12)",
  tokens: {
    "--bc-color-accent": "#d05f78",
    "--bc-color-accent-hover": "#b54e63",
    "--bc-color-accent-pressed": "#99425a",
    "--bc-color-accent-on": "#fffaf3",
    "--bc-color-accent-soft": "#a06a0c",
    "--bc-color-accent-soft-hover": "#815509",
    "--bc-color-accent-soft-on": "#fffaf3",
    "--bc-color-accent-surface-faint": "#fffaf3",
    "--bc-color-accent-surface-soft": "#ece4d6",
    "--bc-color-accent-surface-tint": "#f1eadd",
    "--bc-color-accent-surface-tile": "#ece4d6",
    "--bc-color-accent-surface-tile-2": "#efe8db",
    "--bc-color-accent-surface-row": "#f4ede0",
    "--bc-color-accent-surface-row-border": "#d8cdba",
    "--bc-color-accent-mid-border": "#b8ad97",
    "--bc-color-warn-rose-text": "#9f1239",
    "--bc-color-warn-rose-text-deep": "#881337",
    "--bc-color-paper": "#4e2a84",
    "--bc-color-paper-deep": "#3a1f63",
    "--bc-color-paper-soft": "#f3eef9",
    "--bc-color-bg": "#fdfbf6",
    "--bc-color-bg-app": "#f6ecc0",
    "--bc-color-bg-muted": "#f5f1ea",
    "--bc-color-bg-inset": "#f3ebde",
    "--bc-color-surface-hover": "#f0e9dc",
    "--bc-color-surface-hover-strong": "#e7e0d0",
    "--bc-color-surface-soft": "#faf6ef",
    "--bc-color-border": "#d9cab4",
    "--bc-color-border-strong": "#c8c0a4",
    "--bc-color-border-divider": "#e3d6c4",
    "--bc-color-surface-translucent-86": "rgba(255, 250, 243, 0.86)",
    "--bc-color-surface-translucent-72": "rgba(255, 250, 243, 0.72)",
    "--bc-color-surface-translucent-62": "rgba(255, 250, 243, 0.62)",
    "--bc-color-surface-translucent-56": "rgba(255, 250, 243, 0.56)",
    "--bc-color-surface-translucent-84": "rgba(255, 250, 243, 0.84)",
    "--bc-color-surface-translucent-88": "rgba(255, 250, 243, 0.88)",
    "--bc-color-surface-translucent-92": "rgba(255, 250, 243, 0.92)",
    "--bc-color-surface-translucent-98": "rgba(255, 250, 243, 0.98)",
    "--bc-color-surface-warm-grad-top": "rgba(255, 250, 243, 0.98)",
    "--bc-color-text": "#2a2a2e",
    "--bc-color-text-strong": "#1d1d20",
    "--bc-color-text-soft": "#4a4d52",
    "--bc-color-text-muted": "#7d8088",
    "--bc-color-text-subtle": "#a09a86",
    "--bc-color-text-mauve": "#6b5a55",
    "--bc-color-text-mauve-soft": "#5c4d49",
    "--bc-color-text-mauve-warm": "#4a3d39",
    "--bc-color-text-mauve-deep": "#2a2a2e",
    "--bc-color-text-mauve-panel": "#3a3330",
    "--bc-color-text-mauve-pale": "#c8c0a4",
    "--bc-color-text-mauve-cool": "#8a6f5e",
    "--bc-color-text-mauve-axis": "#9b9080",
    "--bc-color-text-mauve-axis-strong": "#6b5a55",
    "--bc-color-text-body-warm": "#4a3d39",
    "--bc-color-text-mauve-cool-alt": "#6b5a55",
    "--bc-color-text-on-tooltip": "#fffaf3",
    "--bc-color-text-on-histogram": "#2a2a2e",
    "--bc-color-success": "#2a7a4a",
    "--bc-color-success-bg": "#e3f2d9",
    "--bc-color-success-bg-soft": "#effae0",
    "--bc-color-success-border": "#b8d59a",
    "--bc-color-success-text": "#1f5a36",
    "--bc-color-success-deep": "#2a7a4a",
    "--bc-color-success-distro-text": "#1f5a36",
    "--bc-color-success-distro-bg": "#effae0",
    "--bc-color-warn": "#b07a18",
    "--bc-color-warn-bg": "#f5e8c4",
    "--bc-color-warn-bg-soft": "#fbf6e3",
    "--bc-color-warn-bg-page": "#fbf6e3",
    "--bc-color-warn-border": "#e2d2a4",
    "--bc-color-warn-border-page": "#d4a373",
    "--bc-color-warn-text": "#7c5a14",
    "--bc-color-warn-text-page": "#6b4d11",
    "--bc-color-warn-text-discipline": "#8a6512",
    "--bc-color-danger": "#b54e63",
    "--bc-color-danger-bg": "#fbe1e6",
    "--bc-color-danger-bg-soft": "#fdeef1",
    "--bc-color-danger-bg-pill": "#fbe1e6",
    "--bc-color-danger-border": "#f3b9c5",
    "--bc-color-danger-text": "#8a3a4a",
    "--bc-color-danger-text-pill": "#99425a",
    "--bc-color-danger-deep": "#8a3a4a",
    "--bc-color-danger-rose": "#9f1239",
    "--bc-color-info-bg": "#e8e3f0",
    "--bc-color-info-border": "#c4b8d6",
    "--bc-color-info-text": "#2d2347",
    "--bc-color-info-text-deep": "#3d3060",
    "--bc-color-highlight": "#f5e8c4",
    "--bc-color-highlight-text": "#5b4451",
    "--bc-color-highlight-mark": "rgba(245, 200, 66, 0.45)",
    "--bc-color-star-base": "#d9cab4",
    "--bc-color-star-fill": "#d97706",
    "--bc-color-hours-grad-start": "#d05f78",
    "--bc-color-hours-grad-end": "#b08512",
    "--bc-color-chart-trend-axis": "#ead9aa",
    "--bc-color-chart-trend-text": "#9b9080",
    "--bc-color-chart-trend-text-strong": "#6b5a55",
    "--bc-color-chart-axis-cool": "#6b5a55",
    "--bc-color-ink": "#2a2a2e",
    "--bc-color-ink-deep": "#1d1d20",
    "--bc-color-ink-text": "#2a2a2e",
    "--bc-color-ink-text-on-light": "#fffaf3",
    "--bc-color-ink-instructor-pill-bg": "rgba(42, 42, 46, 0.06)",
    "--bc-shadow-elev-1": "0 1px 2px rgba(42, 42, 46, 0.08)",
    "--bc-shadow-elev-2": "0 2px 8px rgba(42, 42, 46, 0.10)",
    "--bc-shadow-card-soft": "0 -1px 2px rgba(42, 42, 46, 0.06)",
    "--bc-shadow-button": "0 2px 6px rgba(42, 42, 46, 0.18)",
    "--bc-shadow-button-hover": "0 3px 8px rgba(42, 42, 46, 0.22)",
    "--bc-shadow-add-cta": "2px 2px 0 #d05f78",
    "--bc-shadow-modal": "0 1px 2px rgba(42, 42, 46, 0.08), 0 30px 60px -10px rgba(42, 42, 46, 0.35), 0 0 0 1px rgba(42, 42, 46, 0.06)",
    "--bc-shadow-modal-status": "0 1px 2px rgba(42, 42, 46, 0.06)",
    "--bc-shadow-auth-card": "0 28px 60px rgba(42, 42, 46, 0.32)",
    "--bc-shadow-side-panel": "0 10px 28px rgba(42, 42, 46, 0.10)",
    "--bc-shadow-tooltip": "0 8px 24px rgba(42, 42, 46, 0.22)",
    "--bc-shadow-kpi-active-ring": "0 0 0 3px rgba(208, 95, 120, 0.14)",
    "--bc-shadow-toggle-knob": "0 1px 3px rgba(42, 42, 46, 0.32)",
    "--bc-shadow-input-focus-ring": "0 0 0 3px rgba(208, 95, 120, 0.24)",
    "--bc-shadow-input-focus-inner": "inset 0 1px 2px rgba(42, 42, 46, 0.06)",
    "--bc-color-overlay-modal": "rgba(42, 42, 46, 0.55)",
    "--bc-color-overlay-auth": "rgba(42, 42, 46, 0.6)",
    "--bc-color-overlay-on-light": "rgba(42, 42, 46, 0.10)",
    "--bc-color-panel-grad-top": "rgba(255, 250, 243, 0.98)",
    "--bc-color-panel-grad-bottom": "rgba(252, 245, 230, 0.98)",
    "--bc-color-card-outline": "rgba(42, 42, 46, 0.7)",
    "--bc-color-card-divider-soft": "rgba(42, 42, 46, 0.12)",
    "--bc-color-cart-bg": "#2a2a2e",
    "--bc-color-cart-bg-hover": "#1d1d20",
    "--bc-color-cart-border": "rgba(42, 42, 46, 0.45)",
    "--bc-color-cart-border-hover": "rgba(42, 42, 46, 0.7)",
    "--bc-color-cart-text": "#fffaf3",
    "--bc-color-cart-success-bg": "#2a7a4a",
    "--bc-color-cart-success-border": "rgba(42, 122, 74, 0.65)",
    "--bc-color-cart-success-text": "#effae0",
    "--bc-color-cart-error-bg": "#b54e63",
    "--bc-color-cart-error-border": "rgba(181, 78, 99, 0.7)",
    "--bc-color-cart-error-text": "#fdeef1",
    "--bc-color-cart-loading-bg": "#6b5a55",
    "--bc-color-cart-loading-border": "rgba(107, 90, 85, 0.65)",
    "--bc-color-cart-loading-text": "#f7f1ea",
    "--bc-color-comment-highlight-light": "rgba(245, 200, 66, 0.22)",
    "--bc-color-comments-card-bg": "#eceae4",
    "--bc-color-heatmap-rating-rgb": "42, 42, 46",
    "--bc-color-heatmap-hours-rgb": "208, 95, 120",
    "--bc-color-disabled-bg": "#d9cab4",
    "--bc-color-gate-warn-bg": "#fdf3c4",
    "--bc-color-gate-warn-border": "#d4a373",
    "--bc-color-gate-warn-text": "#6b4d11",
    "--bc-color-gate-lock-bg": "#e8e3f0",
    "--bc-color-gate-lock-border": "#c4b8d6",
    "--bc-color-gate-lock-text": "#2d2347",
    "--bc-color-gate-ok-bg": "#effae0",
    "--bc-color-gate-ok-border": "#b8d59a",
    "--bc-color-gate-ok-text": "#1f5a36",
    "--bc-color-seat-full-bg": "#fbe1e6",
    "--bc-color-seat-full-border": "#f3b9c5",
    "--bc-color-seat-full-ink": "#8a3a4a",
    "--bc-color-seat-waitlist-bg": "#fbe89a",
    "--bc-color-seat-waitlist-border": "#d4a373",
    "--bc-color-seat-waitlist-ink": "#8a4b00",
    "--bc-color-seat-info-bg": "#e8e3f0",
    "--bc-color-seat-info-border": "#c4b8d6",
    "--bc-color-seat-info-ink": "#3d3060",
    "--bc-color-seat-warn-bg": "#fdf3c4",
    "--bc-color-seat-warn-border": "#d4a373",
    "--bc-color-seat-warn-ink": "#6b4d11",
    "--bc-color-seat-tight-bg": "#fdf3c4",
    "--bc-color-seat-tight-border": "#ead9aa",
    "--bc-color-seat-tight-ink": "#7c5a14",
    "--bc-color-seat-room-bg": "#effae0",
    "--bc-color-seat-room-border": "#b8d59a",
    "--bc-color-seat-room-ink": "#1f5a36",
    "--bc-color-seat-open-bg": "#effae0",
    "--bc-color-seat-open-border": "#b8d59a",
    "--bc-color-seat-open-ink": "#1f5a36",
    "--bc-color-seat-warn-row-text": "#6b4d11",
    "--bc-color-seat-warn-row-border": "#d4a373",
    "--bc-color-seat-error-text": "#8a3a4a",
    "--bc-color-seat-muted-text": "#6b5a55",
    "--bc-color-trend-zone-1": "rgba(220, 38, 38, 0.08)",
    "--bc-color-trend-zone-2": "rgba(234, 88, 12, 0.08)",
    "--bc-color-trend-zone-3": "rgba(202, 138, 4, 0.08)",
    "--bc-color-trend-zone-4": "rgba(101, 163, 13, 0.10)",
    "--bc-color-trend-zone-5": "rgba(22, 163, 74, 0.10)",
    "--bc-color-trend-zone-1-solid": "rgba(220, 38, 38, 0.85)",
    "--bc-color-trend-zone-2-solid": "rgba(234, 88, 12, 0.85)",
    "--bc-color-trend-zone-3-solid": "rgba(202, 138, 4, 0.85)",
    "--bc-color-trend-zone-4-solid": "rgba(101, 163, 13, 0.85)",
    "--bc-color-trend-zone-5-solid": "rgba(22, 163, 74, 0.85)",
    "--bc-color-trend-zone-6-solid": "rgba(4, 120, 87, 0.92)",
    "--bc-font-display": "\"Special Elite\", \"Courier Prime\", ui-monospace, SFMono-Regular, Menlo, monospace",
    "--bc-font-hand": "\"Caveat\", \"Patrick Hand\", ui-rounded, \"Comic Sans MS\", cursive",
    "--bc-fw-display": "var(--bc-fw-regular)"
  }
};

// -----------------------------------------------------------------------------
// Pencil theme — dark. Pencil-landing-page has no dark mode, so this is
// designed from scratch: deep warm graphite paper, cream ink, soft pink accent.
// -----------------------------------------------------------------------------
const PENCIL_DARK_THEME: Theme = {
  accentRgb: [245, 163, 180],
  accentFill: {
    "04": "0.06", "05": "0.07", "06": "0.08", "08": "0.10", "10": "0.12",
    "12": "0.14", "15": "0.18", "18": "0.20", "22": "0.24", "24": "0.26",
    "32": "0.32", "45": "0.42"
  },
  accentBorder: {
    "08": "0.14", "12": "0.16", "14": "0.18", "18": "0.22",
    "22": "0.26", "28": "0.32", "32": "0.40", "45": "0.50"
  },
  warnRoseRgb: [251, 113, 133],
  warnRoseFill: { "12": "0.16", "20": "0.22" },
  warnRoseBorder: { "28": "0.30", "32": "0.40" },
  inkFillRgb: [255, 250, 243],
  inkFill: { "04": "0.05", "06": "0.07", "08": "0.10", "025": "0.04" },
  inkBorder12: "rgba(255, 250, 243, 0.14)",
  tokens: {
    "--bc-color-accent": "#f5a3b4",
    "--bc-color-accent-hover": "#f7b8c5",
    "--bc-color-accent-pressed": "#e88fa3",
    "--bc-color-accent-on": "#2a1d22",
    "--bc-color-accent-soft": "#f5c842",
    "--bc-color-accent-soft-hover": "#ffd864",
    "--bc-color-accent-soft-on": "#2a1d22",
    "--bc-color-accent-surface-faint": "rgba(245, 163, 180, 0.08)",
    "--bc-color-accent-surface-soft": "rgba(245, 200, 66, 0.16)",
    "--bc-color-accent-surface-tint": "rgba(245, 163, 180, 0.10)",
    "--bc-color-accent-surface-tile": "rgba(245, 163, 180, 0.14)",
    "--bc-color-accent-surface-tile-2": "rgba(245, 163, 180, 0.10)",
    "--bc-color-accent-surface-row": "rgba(43, 37, 28, 0.55)",
    "--bc-color-accent-surface-row-border": "rgba(245, 163, 180, 0.16)",
    "--bc-color-accent-mid-border": "rgba(245, 163, 180, 0.32)",
    "--bc-color-warn-rose-text": "#fecdd3",
    "--bc-color-warn-rose-text-deep": "#fecdd3",
    "--bc-color-bg": "#2b251c",
    "--bc-color-bg-app": "#211c14",
    "--bc-color-bg-muted": "#1d1812",
    "--bc-color-bg-inset": "#2b251c",
    "--bc-color-surface-hover": "#3a3225",
    "--bc-color-surface-hover-strong": "#4a3f30",
    "--bc-color-surface-soft": "#2b251c",
    "--bc-color-border": "#4a3f30",
    "--bc-color-border-strong": "#5c4f3c",
    "--bc-color-border-divider": "#4a3f30",
    "--bc-color-surface-translucent-86": "rgba(33, 28, 20, 0.86)",
    "--bc-color-surface-translucent-72": "rgba(33, 28, 20, 0.72)",
    "--bc-color-surface-translucent-62": "rgba(33, 28, 20, 0.62)",
    "--bc-color-surface-translucent-56": "rgba(33, 28, 20, 0.56)",
    "--bc-color-surface-translucent-84": "rgba(33, 28, 20, 0.84)",
    "--bc-color-surface-translucent-88": "rgba(33, 28, 20, 0.88)",
    "--bc-color-surface-translucent-92": "rgba(33, 28, 20, 0.92)",
    "--bc-color-surface-translucent-98": "rgba(33, 28, 20, 0.98)",
    "--bc-color-surface-warm-grad-top": "rgba(43, 37, 28, 0.98)",
    "--bc-color-text": "#f6ecc0",
    "--bc-color-text-strong": "#fffaf3",
    "--bc-color-text-soft": "#e3d6b8",
    "--bc-color-text-muted": "#b3a890",
    "--bc-color-text-subtle": "#8a8068",
    "--bc-color-text-mauve": "#d8c8b0",
    "--bc-color-text-mauve-soft": "#dcc9b6",
    "--bc-color-text-mauve-warm": "#f3e3c8",
    "--bc-color-text-mauve-deep": "#fffaf3",
    "--bc-color-text-mauve-panel": "#f3e3c8",
    "--bc-color-text-mauve-pale": "rgba(246, 236, 192, 0.40)",
    "--bc-color-text-mauve-cool": "#f5a3b4",
    "--bc-color-text-mauve-axis": "#b3a890",
    "--bc-color-text-mauve-axis-strong": "#d8c8b0",
    "--bc-color-text-body-warm": "#f3e3c8",
    "--bc-color-text-mauve-cool-alt": "#dcc9b6",
    "--bc-color-text-on-tooltip": "#fffaf3",
    "--bc-color-text-on-histogram": "#fffaf3",
    "--bc-color-success": "#9be3a8",
    "--bc-color-success-bg": "rgba(31, 90, 54, 0.40)",
    "--bc-color-success-bg-soft": "rgba(31, 90, 54, 0.32)",
    "--bc-color-success-border": "rgba(155, 227, 168, 0.40)",
    "--bc-color-success-text": "#d5f3da",
    "--bc-color-success-deep": "#9be3a8",
    "--bc-color-success-distro-text": "#d5f3da",
    "--bc-color-success-distro-bg": "rgba(31, 90, 54, 0.40)",
    "--bc-color-warn": "#f5c842",
    "--bc-color-warn-bg": "rgba(124, 90, 20, 0.42)",
    "--bc-color-warn-bg-soft": "rgba(124, 90, 20, 0.32)",
    "--bc-color-warn-bg-page": "rgba(124, 90, 20, 0.32)",
    "--bc-color-warn-border": "rgba(245, 200, 66, 0.40)",
    "--bc-color-warn-border-page": "rgba(245, 200, 66, 0.40)",
    "--bc-color-warn-text": "#fbe89a",
    "--bc-color-warn-text-page": "#fbe89a",
    "--bc-color-warn-text-discipline": "#fbe89a",
    "--bc-color-danger": "#f5a3b4",
    "--bc-color-danger-bg": "rgba(138, 58, 74, 0.40)",
    "--bc-color-danger-bg-soft": "rgba(138, 58, 74, 0.32)",
    "--bc-color-danger-bg-pill": "rgba(138, 58, 74, 0.40)",
    "--bc-color-danger-border": "rgba(245, 163, 180, 0.40)",
    "--bc-color-danger-text": "#fbe1e6",
    "--bc-color-danger-text-pill": "#f5a3b4",
    "--bc-color-danger-deep": "#f5a3b4",
    "--bc-color-danger-rose": "#f5a3b4",
    "--bc-color-info-bg": "rgba(196, 184, 214, 0.16)",
    "--bc-color-info-border": "rgba(196, 184, 214, 0.32)",
    "--bc-color-info-text": "#d6cae8",
    "--bc-color-info-text-deep": "#b9a8da",
    "--bc-color-highlight": "rgba(245, 200, 66, 0.85)",
    "--bc-color-highlight-text": "#2a1d10",
    "--bc-color-highlight-mark": "rgba(245, 200, 66, 0.30)",
    "--bc-color-star-base": "rgba(246, 236, 192, 0.32)",
    "--bc-color-star-fill": "#f5c842",
    "--bc-color-hours-grad-start": "#f5a3b4",
    "--bc-color-hours-grad-end": "#f5c842",
    "--bc-color-chart-trend-axis": "#5c4f3c",
    "--bc-color-chart-trend-text": "#b3a890",
    "--bc-color-chart-trend-text-strong": "#d8c8b0",
    "--bc-color-chart-axis-cool": "#b3a890",
    "--bc-color-ink": "#f5a3b4",
    "--bc-color-ink-deep": "#f7b8c5",
    "--bc-color-ink-text": "#fffaf3",
    "--bc-color-ink-text-on-light": "#2a1d22",
    "--bc-color-ink-instructor-pill-bg": "rgba(255, 250, 243, 0.08)",
    "--bc-shadow-elev-1": "0 1px 2px rgba(0, 0, 0, 0.45)",
    "--bc-shadow-elev-2": "0 2px 8px rgba(0, 0, 0, 0.45)",
    "--bc-shadow-card-soft": "0 -1px 2px rgba(0, 0, 0, 0.45)",
    "--bc-shadow-button": "2px 2px 0 rgba(245, 163, 180, 0.85)",
    "--bc-shadow-button-hover": "3px 3px 0 rgba(245, 163, 180, 0.95)",
    "--bc-shadow-add-cta": "2px 2px 0 #f5a3b4",
    "--bc-shadow-modal": "0 1px 2px rgba(0, 0, 0, 0.45), 0 30px 60px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 250, 243, 0.05)",
    "--bc-shadow-modal-status": "0 1px 2px rgba(0, 0, 0, 0.45)",
    "--bc-shadow-auth-card": "0 28px 60px rgba(0, 0, 0, 0.6)",
    "--bc-shadow-side-panel": "0 10px 28px rgba(0, 0, 0, 0.32)",
    "--bc-shadow-tooltip": "0 8px 24px rgba(0, 0, 0, 0.50)",
    "--bc-shadow-kpi-active-ring": "0 0 0 3px rgba(245, 163, 180, 0.20)",
    "--bc-shadow-toggle-knob": "0 1px 3px rgba(0, 0, 0, 0.50)",
    "--bc-shadow-input-focus-ring": "0 0 0 3px rgba(245, 163, 180, 0.30)",
    "--bc-shadow-input-focus-inner": "inset 0 1px 2px rgba(0, 0, 0, 0.32)",
    "--bc-color-overlay-modal": "rgba(0, 0, 0, 0.55)",
    "--bc-color-overlay-auth": "rgba(0, 0, 0, 0.6)",
    "--bc-color-overlay-on-light": "rgba(255, 250, 243, 0.08)",
    "--bc-color-panel-grad-top": "rgba(43, 37, 28, 0.98)",
    "--bc-color-panel-grad-bottom": "rgba(33, 28, 20, 0.98)",
    "--bc-color-card-outline": "rgba(255, 250, 243, 0.7)",
    "--bc-color-card-divider-soft": "rgba(255, 250, 243, 0.14)",
    "--bc-color-heatmap-rating-rgb": "246, 236, 192",
    "--bc-color-heatmap-hours-rgb": "245, 163, 180",
    "--bc-color-on-saturated": "#2a1d22",
    "--bc-color-cart-bg": "#4a3f30",
    "--bc-color-cart-bg-hover": "#5c4f3c",
    "--bc-color-cart-border": "#5c4f3c",
    "--bc-color-cart-border-hover": "#7d6e58",
    "--bc-color-cart-text": "#fffaf3",
    "--bc-color-cart-success-bg": "#2a7a4a",
    "--bc-color-cart-success-border": "#9be3a8",
    "--bc-color-cart-success-text": "#d5f3da",
    "--bc-color-cart-error-bg": "#8a3a4a",
    "--bc-color-cart-error-border": "#f5a3b4",
    "--bc-color-cart-error-text": "#fbe1e6",
    "--bc-color-cart-loading-bg": "#5c4f3c",
    "--bc-color-cart-loading-border": "#7d6e58",
    "--bc-color-cart-loading-text": "#f3e3c8",
    "--bc-color-comment-highlight-light": "rgba(245, 200, 66, 0.28)",
    "--bc-color-comments-card-bg": "#3a3225",
    "--bc-color-disabled-bg": "#5c4f3c",
    "--bc-color-gate-warn-bg": "rgba(124, 90, 20, 0.38)",
    "--bc-color-gate-warn-border": "rgba(245, 200, 66, 0.40)",
    "--bc-color-gate-warn-text": "#fbe89a",
    "--bc-color-gate-lock-bg": "rgba(196, 184, 214, 0.16)",
    "--bc-color-gate-lock-border": "rgba(196, 184, 214, 0.32)",
    "--bc-color-gate-lock-text": "#d6cae8",
    "--bc-color-gate-ok-bg": "rgba(31, 90, 54, 0.38)",
    "--bc-color-gate-ok-border": "rgba(155, 227, 168, 0.40)",
    "--bc-color-gate-ok-text": "#d5f3da",
    "--bc-color-trend-zone-1": "rgba(248, 113, 113, 0.16)",
    "--bc-color-trend-zone-2": "rgba(251, 146, 60, 0.16)",
    "--bc-color-trend-zone-3": "rgba(250, 204, 21, 0.16)",
    "--bc-color-trend-zone-4": "rgba(132, 204, 22, 0.18)",
    "--bc-color-trend-zone-5": "rgba(74, 222, 128, 0.18)",
    "--bc-color-trend-zone-1-solid": "rgba(248, 113, 113, 0.90)",
    "--bc-color-trend-zone-2-solid": "rgba(251, 146, 60, 0.90)",
    "--bc-color-trend-zone-3-solid": "rgba(250, 204, 21, 0.90)",
    "--bc-color-trend-zone-4-solid": "rgba(132, 204, 22, 0.90)",
    "--bc-color-trend-zone-5-solid": "rgba(74, 222, 128, 0.90)",
    "--bc-color-trend-zone-6-solid": "rgba(16, 185, 129, 0.95)"
  }
};

