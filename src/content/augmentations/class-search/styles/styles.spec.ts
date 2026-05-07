import { describe, expect, it } from "vitest";

import { addCtaStyles } from "./add-cta";
import { cardStyles } from "./card";
import { detailStyles } from "./detail";
import { headerStyles } from "./header";
import { classSearchStyles } from "./index";
import { pillsStyles } from "./pills";
import { relatedPickerStyles } from "./related-picker";
import { responsiveStyles } from "./responsive";
import { resultsStyles } from "./results";
import { sectionRowsStyles } from "./section-rows";
import { statusStyles } from "./status";
import { tabsStyles } from "./tabs";

// Smoke-test the zone split: each zone owns specific selectors and the
// concatenated stylesheet contains the union. Catches accidental drops or
// mis-routings during further refactors.
describe("classSearchStyles zone split", () => {
  it("contains every zone's signature selector in the concatenated output", () => {
    const css = classSearchStyles();
    const required = [
      ".bc-cs-root",
      ".bc-cs-header",
      ".bc-cs-tabs",
      ".bc-cs-tab",
      ".bc-cs-card",
      ".bc-cs-form",
      ".bc-cs-toggles",
      ".bc-cs-checkbox",
      ".bc-cs-clear",
      ".bc-cs-status",
      ".bc-cs-spinner",
      ".bc-cs-meta",
      ".bc-cs-results",
      ".bc-cs-empty",
      ".bc-cs-myclasses",
      ".bc-cs-cart-badge",
      ".bc-cs-course",
      ".bc-cs-course-head",
      ".bc-cs-section-list",
      ".bc-cs-section",
      ".bc-cs-status-pill",
      ".bc-cs-details-btn",
      ".bc-cs-add",
      ".bc-cs-related-row",
      ".bc-cs-related-option",
      ".bc-cs-detail-row",
      ".bc-cs-stat",
      ".bc-cs-detail-refresh",
      "@media",
      "@keyframes bc-cs-spin"
    ];
    for (const selector of required) {
      expect(css, `expected concatenated output to contain ${selector}`).toContain(
        selector
      );
    }
  });

  it("routes each selector to exactly one zone (no accidental duplication)", () => {
    // A small spot-check that selectors live in their named home, not bleed
    // into siblings. Zones with shared `.bc-cs-section`-prefixed selectors
    // (e.g. .bc-cs-section vs .bc-cs-section-actions) belong to section-rows.
    expect(headerStyles()).toContain(".bc-cs-header");
    expect(tabsStyles()).toContain(".bc-cs-tabs");
    expect(cardStyles()).toContain(".bc-cs-card");
    expect(pillsStyles()).toContain(".bc-cs-toggles");
    expect(statusStyles()).toContain(".bc-cs-spinner");
    expect(resultsStyles()).toContain(".bc-cs-myclasses");
    expect(resultsStyles()).toContain(".bc-cs-course");
    expect(sectionRowsStyles()).toContain(".bc-cs-section-list");
    expect(addCtaStyles()).toContain(".bc-cs-add");
    expect(relatedPickerStyles()).toContain(".bc-cs-related");
    expect(detailStyles()).toContain(".bc-cs-detail-row");
    expect(responsiveStyles()).toContain("@media");
  });

  it("preserves cascade: responsive rules come last", () => {
    const css = classSearchStyles();
    const responsiveStart = css.indexOf("@media");
    const sectionStart = css.indexOf(".bc-cs-section-list");
    expect(responsiveStart).toBeGreaterThan(sectionStart);
  });

  it("section-row Add button paints persistent cart-state with the canonical mini-viewer tokens", () => {
    // Regression guard for the "In cart" / "Enrolled" badge unification:
    // the add CTA must consume the same paper-soft + success-bg tokens the
    // .bc-cs-myclass-badge mini viewer uses, so both surfaces read as one
    // status-pill family.
    const css = addCtaStyles();
    const inCart = css.match(
      /\.bc-cs-add\[data-state="in-cart"\][^{]*\{[^}]*--bc-color-paper-soft[^}]*--bc-color-paper[^}]*\}/
    );
    const enrolled = css.match(
      /\.bc-cs-add\[data-state="enrolled"\][^{]*\{[^}]*--bc-color-success-bg[^}]*--bc-color-success[^}]*\}/
    );
    expect(inCart, "in-cart rule must use paper-soft + paper tokens").not.toBeNull();
    expect(enrolled, "enrolled rule must use success-bg + success tokens").not.toBeNull();
  });
});
