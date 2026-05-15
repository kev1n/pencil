import { describe, expect, it } from "vitest";

import { tokensCss } from "./tokens";

// Pin every CSS token (selector + varName -> value) the production design
// system emits. Wave 10b refactored tokens.ts from 4 inline theme functions
// to a `Theme` data record + `themeBlock()` renderer; this spec is the
// equivalence guard. If a derivation regresses (or a token gets dropped),
// the corresponding assertion below will fail and pinpoint the variable.

interface ParsedRule {
  selector: string;
  vars: Record<string, string>;
}

function parseTokensCss(css: string): ParsedRule[] {
  // Strip CSS comments so they don't confuse the rule scanner.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: ParsedRule[] = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    if (selector.startsWith("@font-face")) continue;
    const body = m[2];
    const vars: Record<string, string> = {};
    for (const decl of body.split(";")) {
      const t = decl.trim();
      if (!t) continue;
      const colon = t.indexOf(":");
      if (colon < 0) continue;
      const key = t.slice(0, colon).trim();
      if (!key.startsWith("--bc-")) continue;
      vars[key] = t.slice(colon + 1).trim().replace(/\s+/g, " ");
    }
    out.push({ selector, vars });
  }
  return out;
}

describe("tokensCss", () => {
  const css = tokensCss((f) => `TEST/${f}`);
  const rules = parseTokensCss(css);

  it("emits the base + four theme blocks", () => {
    const selectors = rules.map((r) => r.selector);
    expect(selectors).toEqual([
      ":root", // base()
      ':root, [data-bc-theme="default"]',
      '[data-bc-theme="default"][data-bc-mode="dark"]',
      '[data-bc-theme="pencil"]',
      '[data-bc-theme="pencil"][data-bc-mode="dark"]'
    ]);
  });

  it(":root carries the shape/motion + heatmap base tokens", () => {
    const root = rules.find((r) => r.selector === ":root")!.vars;
    expect(root["--bc-radius-sm"]).toBe("4px");
    expect(root["--bc-radius-pill"]).toBe("999px");
    expect(root["--bc-font-12"]).toBe("12px");
    expect(root["--bc-fw-semibold"]).toBe("600");
    expect(root["--bc-tx-fast"]).toBe("80ms");
    expect(root["--bc-color-on-saturated"]).toBe("#ffffff");
    expect(root["--bc-color-heatmap-rating-rgb"]).toBe("102, 2, 60");
    expect(root["--bc-color-heatmap-hours-rgb"]).toBe("162, 28, 175");
  });

  describe("default light theme", () => {
    const sel = ':root, [data-bc-theme="default"]';
    const vars = (): Record<string, string> => rules.find((r) => r.selector === sel)!.vars;

    it("emits the 12-step accent fill ladder over NU purple (102, 2, 60)", () => {
      const v = vars();
      expect(v["--bc-color-accent-fill-04"]).toBe("rgba(102, 2, 60, 0.04)");
      expect(v["--bc-color-accent-fill-12"]).toBe("rgba(102, 2, 60, 0.12)");
      expect(v["--bc-color-accent-fill-15"]).toBe("rgba(102, 2, 60, 0.15)");
      expect(v["--bc-color-accent-fill-18"]).toBe("rgba(102, 2, 60, 0.18)");
      expect(v["--bc-color-accent-fill-32"]).toBe("rgba(102, 2, 60, 0.32)");
      expect(v["--bc-color-accent-fill-45"]).toBe("rgba(102, 2, 60, 0.45)");
    });

    it("emits the 8-step accent border ladder", () => {
      const v = vars();
      expect(v["--bc-color-accent-border-08"]).toBe("rgba(102, 2, 60, 0.08)");
      expect(v["--bc-color-accent-border-22"]).toBe("rgba(102, 2, 60, 0.22)");
      expect(v["--bc-color-accent-border-45"]).toBe("rgba(102, 2, 60, 0.45)");
    });

    it("emits the warn-rose ladder over (190, 24, 93)", () => {
      const v = vars();
      expect(v["--bc-color-warn-rose-fill-12"]).toBe("rgba(190, 24, 93, 0.12)");
      expect(v["--bc-color-warn-rose-fill-20"]).toBe("rgba(190, 24, 93, 0.20)");
      expect(v["--bc-color-warn-rose-border-28"]).toBe("rgba(190, 24, 93, 0.28)");
      expect(v["--bc-color-warn-rose-border-32"]).toBe("rgba(190, 24, 93, 0.32)");
    });

    it("emits the ink-fill ladder over (15, 23, 42)", () => {
      const v = vars();
      expect(v["--bc-color-ink-fill-025"]).toBe("rgba(15, 23, 42, 0.025)");
      expect(v["--bc-color-ink-fill-04"]).toBe("rgba(15, 23, 42, 0.04)");
      expect(v["--bc-color-ink-fill-06"]).toBe("rgba(15, 23, 42, 0.06)");
      expect(v["--bc-color-ink-fill-08"]).toBe("rgba(15, 23, 42, 0.08)");
      expect(v["--bc-color-ink-border-12"]).toBe("rgba(17, 24, 39, 0.12)");
    });

    it("preserves named tokens (accent, surfaces, status, shadows)", () => {
      const v = vars();
      expect(v["--bc-color-accent"]).toBe("#66023c");
      expect(v["--bc-color-accent-on"]).toBe("#ffffff");
      expect(v["--bc-color-bg"]).toBe("#ffffff");
      expect(v["--bc-color-bg-inset"]).toBe("var(--bc-color-accent-surface-row)");
      expect(v["--bc-color-success"]).toBe("#15803d");
      expect(v["--bc-color-danger"]).toBe("#b91c1c");
      expect(v["--bc-color-info-bg"]).toBe("#eef2ff");
      expect(v["--bc-shadow-modal"]).toBe(
        "0 1px 2px rgba(0, 0, 0, 0.06), 0 30px 60px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.04)"
      );
      expect(v["--bc-color-comments-card-bg"]).toBe("var(--bc-color-surface-hover)");
    });
  });

  describe("default dark theme", () => {
    const sel = '[data-bc-theme="default"][data-bc-mode="dark"]';
    const vars = (): Record<string, string> => rules.find((r) => r.selector === sel)!.vars;

    it("uses pink (252, 165, 207) for the accent ladders, with per-step alpha tweaks", () => {
      const v = vars();
      // Mechanical mapping breaks: fill-04 -> 0.06 (not 0.04), fill-15 -> 0.16, etc.
      expect(v["--bc-color-accent-fill-04"]).toBe("rgba(252, 165, 207, 0.06)");
      expect(v["--bc-color-accent-fill-12"]).toBe("rgba(252, 165, 207, 0.12)");
      expect(v["--bc-color-accent-fill-15"]).toBe("rgba(252, 165, 207, 0.16)");
      expect(v["--bc-color-accent-fill-18"]).toBe("rgba(252, 165, 207, 0.16)");
      expect(v["--bc-color-accent-fill-32"]).toBe("rgba(252, 165, 207, 0.30)");
      expect(v["--bc-color-accent-fill-45"]).toBe("rgba(252, 165, 207, 0.40)");
      expect(v["--bc-color-accent-border-08"]).toBe("rgba(252, 165, 207, 0.12)");
      expect(v["--bc-color-accent-border-28"]).toBe("rgba(252, 165, 207, 0.30)");
    });

    it("uses (251, 113, 133) for the warn-rose ladder", () => {
      const v = vars();
      expect(v["--bc-color-warn-rose-fill-12"]).toBe("rgba(251, 113, 133, 0.14)");
      expect(v["--bc-color-warn-rose-border-32"]).toBe("rgba(251, 113, 133, 0.40)");
    });

    it("inverts the ink-fill RGB to (248, 250, 252)", () => {
      const v = vars();
      expect(v["--bc-color-ink-fill-04"]).toBe("rgba(248, 250, 252, 0.04)");
      expect(v["--bc-color-ink-fill-025"]).toBe("rgba(248, 250, 252, 0.05)");
      expect(v["--bc-color-ink-border-12"]).toBe("rgba(255, 255, 255, 0.14)");
    });

    it("flips the heatmap RGB tuples to lavender + pink", () => {
      const v = vars();
      expect(v["--bc-color-heatmap-rating-rgb"]).toBe("216, 180, 254");
      expect(v["--bc-color-heatmap-hours-rgb"]).toBe("252, 165, 207");
    });

    it("preserves the lavender/pink dual-accent design", () => {
      const v = vars();
      expect(v["--bc-color-accent"]).toBe("#d8b4fe");
      expect(v["--bc-color-accent-soft"]).toBe("#fbcfe8");
      expect(v["--bc-color-bg"]).toBe("#262626");
      expect(v["--bc-color-text"]).toBe("#fafafa");
    });
  });

  describe("pencil light theme", () => {
    const sel = '[data-bc-theme="pencil"]';
    const vars = (): Record<string, string> => rules.find((r) => r.selector === sel)!.vars;

    it("emits eraser-pink (208, 95, 120) ladders with per-step alpha tweaks", () => {
      const v = vars();
      expect(v["--bc-color-accent-fill-04"]).toBe("rgba(208, 95, 120, 0.05)");
      expect(v["--bc-color-accent-fill-08"]).toBe("rgba(208, 95, 120, 0.10)");
      expect(v["--bc-color-accent-fill-45"]).toBe("rgba(208, 95, 120, 0.50)");
      expect(v["--bc-color-accent-border-08"]).toBe("rgba(208, 95, 120, 0.14)");
      expect(v["--bc-color-accent-border-45"]).toBe("rgba(208, 95, 120, 0.55)");
    });

    it("uses graphite (42, 42, 46) for the ink-fill ladder", () => {
      const v = vars();
      expect(v["--bc-color-ink-fill-04"]).toBe("rgba(42, 42, 46, 0.04)");
      expect(v["--bc-color-ink-fill-025"]).toBe("rgba(42, 42, 46, 0.025)");
      expect(v["--bc-color-ink-border-12"]).toBe("rgba(42, 42, 46, 0.12)");
    });

    it("paints Ticonderoga cream surfaces with eraser-pink accent", () => {
      const v = vars();
      expect(v["--bc-color-accent"]).toBe("#d05f78");
      expect(v["--bc-color-accent-soft"]).toBe("#a06a0c");
      expect(v["--bc-color-bg"]).toBe("#fdfbf6");
      expect(v["--bc-color-bg-app"]).toBe("#f6ecc0");
      expect(v["--bc-color-comments-card-bg"]).toBe("#eceae4");
      expect(v["--bc-shadow-add-cta"]).toBe("2px 2px 0 #d05f78");
    });
  });

  describe("pencil dark theme", () => {
    const sel = '[data-bc-theme="pencil"][data-bc-mode="dark"]';
    const vars = (): Record<string, string> => rules.find((r) => r.selector === sel)!.vars;

    it("uses softer pink (245, 163, 180) for the accent ladders", () => {
      const v = vars();
      expect(v["--bc-color-accent-fill-04"]).toBe("rgba(245, 163, 180, 0.06)");
      expect(v["--bc-color-accent-fill-45"]).toBe("rgba(245, 163, 180, 0.42)");
      expect(v["--bc-color-accent-border-32"]).toBe("rgba(245, 163, 180, 0.40)");
    });

    it("inverts the ink-fill RGB to cream (255, 250, 243)", () => {
      const v = vars();
      expect(v["--bc-color-ink-fill-04"]).toBe("rgba(255, 250, 243, 0.05)");
      expect(v["--bc-color-ink-fill-025"]).toBe("rgba(255, 250, 243, 0.04)");
      expect(v["--bc-color-ink-border-12"]).toBe("rgba(255, 250, 243, 0.14)");
    });

    it("overrides --bc-color-on-saturated for the warm-cream palette", () => {
      const v = vars();
      // Heatmap cells in pencil-dark are saturated cream + pink, so the
      // on-saturated text needs to be dark to read; this overrides the
      // base() value (#ffffff).
      expect(v["--bc-color-on-saturated"]).toBe("#2a1d22");
    });

    it("keeps the warm graphite paper / cream ink palette", () => {
      const v = vars();
      expect(v["--bc-color-bg"]).toBe("#2b251c");
      expect(v["--bc-color-text"]).toBe("#f6ecc0");
      expect(v["--bc-color-accent"]).toBe("#f5a3b4");
      expect(v["--bc-shadow-add-cta"]).toBe("2px 2px 0 #f5a3b4");
    });
  });

  it("includes all 10 woff2 @font-face declarations", () => {
    const fontFaces = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
    expect(fontFaces.length).toBe(10);
    // resolveFontUrl is wired in
    expect(css).toContain('url("TEST/special-elite-regular.woff2")');
    expect(css).toContain('url("TEST/jetbrains-mono-500.woff2")');
  });
});

