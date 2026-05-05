// Vitest spec for bc-rules/no-raw-action-button. Wraps the RuleTester from
// ESLint into individual `it()` cases so the suite shows up in vitest's run
// totals (rather than the rule being only validated by an out-of-band node
// invocation).
//
// The valid/invalid cases mirror the patterns in the rule's header docblock.
// Pattern catalogue:
//   1. Raw async addEventListener click → fail
//   2. Promise-chain addEventListener click → fail
//   3. el(...) "button" with async on.click → fail
//   4. Raw data-bc-action-button stamp without factory import → fail
//   5. Properly migrated factory usage → pass
//   6. Sanctioned controller-managed marker → pass
//   7. void-wrapped fire-and-forget → pass

import { Linter } from "eslint";
// eslint plugin in JS — the spec is a thin wrapper, no TS shape needed.
// @ts-expect-error - JS module without types
import rule from "./no-raw-action-button.js";
import { describe, expect, it } from "vitest";

type LintCase = {
  name: string;
  code: string;
  filename?: string;
};

const linter = new Linter();
const PLUGIN = { rules: { "no-raw-action-button": rule } };

function lint(code: string, filename = "src/example.ts"): Linter.LintMessage[] {
  return linter.verify(
    code,
    [
      {
        files: ["**/*.ts"],
        plugins: { "bc-rules": PLUGIN as any },
        rules: { "bc-rules/no-raw-action-button": "error" },
        languageOptions: { ecmaVersion: 2024, sourceType: "module" }
      }
    ],
    { filename }
  );
}

const valid: LintCase[] = [
  {
    name: "plain non-async click handler",
    code: `
      const btn = document.createElement("button");
      btn.addEventListener("click", () => { btn.classList.toggle("on"); });
    `
  },
  {
    name: "void-wrapped fire-and-forget arrow body",
    code: `
      const btn = document.createElement("button");
      btn.addEventListener("click", () => void persistDismissal());
    `
  },
  {
    name: "void-wrapped fire-and-forget inside block body",
    code: `
      const btn = document.createElement("button");
      btn.addEventListener("click", () => {
        syncWork();
        void persistDismissal();
      });
    `
  },
  {
    name: "factory import unlocks setAttribute marker stamp",
    code: `
      import { createActionButton } from "./framework";
      const btn = document.createElement("button");
      btn.setAttribute("data-bc-action-button", "1");
      void createActionButton;
    `
  },
  {
    name: "controller-managed marker via computed key",
    code: `
      import { ACTION_BUTTON_MARKER_ATTR } from "./framework";
      function el(_doc, _tag, _props) { return null; }
      const detailsBtn = el(document, "button", {
        attrs: { type: "button", [ACTION_BUTTON_MARKER_ATTR]: "controller" },
        on: { click: async () => { await fetch("/"); } }
      });
      void detailsBtn;
    `
  },
  {
    name: "controller-managed marker via literal key",
    code: `
      import { ACTION_BUTTON_MARKER_ATTR } from "./framework";
      function el(_doc, _tag, _props) { return null; }
      const x = el(document, "button", {
        attrs: { "data-bc-action-button": "controller" },
        on: { click: async () => { await fetch("/"); } }
      });
      void x;
    `
  },
  {
    name: "non-button el() call is not inspected",
    code: `
      function el(_doc, _tag, _props) { return null; }
      const div = el(document, "div", {
        on: { click: async () => { await fetch("/"); } }
      });
      void div;
    `
  },
  {
    name: "factory file itself is allowlisted",
    filename: "src/content/framework/action-button.ts",
    code: `
      const button = document.createElement("button");
      button.addEventListener("click", () => { void runOnce(); });
      async function runOnce() { await fetch("/"); }
    `
  },
  {
    name: "bindActionButton import also unlocks setAttribute marker stamp",
    code: `
      import { bindActionButton } from "./framework";
      const btn = document.createElement("button");
      btn.setAttribute("data-bc-action-button", "1");
      void bindActionButton;
    `
  }
];

type InvalidCase = LintCase & { messageId: string };

const invalid: InvalidCase[] = [
  {
    name: "raw async addEventListener",
    messageId: "asyncListener",
    code: `
      const btn = document.createElement("button");
      btn.addEventListener("click", async () => { await fetch("/"); });
    `
  },
  {
    name: "async function() expression listener",
    messageId: "asyncListener",
    code: `
      const btn = document.createElement("button");
      btn.addEventListener("click", async function() { await fetch("/"); });
    `
  },
  {
    name: "promise chain in arrow body",
    messageId: "promiseListener",
    code: `
      const btn = document.createElement("button");
      btn.addEventListener("click", () => fetch("/").then((r) => r));
    `
  },
  {
    name: "promise chain in block body",
    messageId: "promiseListener",
    code: `
      const btn = document.createElement("button");
      btn.addEventListener("click", () => {
        fetch("/").then((r) => r);
      });
    `
  },
  {
    name: "async onclick assignment",
    messageId: "asyncOnclick",
    code: `
      const btn = document.createElement("button");
      btn.onclick = async () => { await fetch("/"); };
    `
  },
  {
    name: "promise-chain onclick assignment",
    messageId: "promiseOnclick",
    code: `
      const btn = document.createElement("button");
      btn.onclick = () => fetch("/").catch(() => {});
    `
  },
  {
    name: "el(...) button with async on.click and no controller marker",
    messageId: "asyncElButton",
    code: `
      function el(_doc, _tag, _props) { return null; }
      const x = el(document, "button", {
        on: { click: async () => { await fetch("/"); } }
      });
      void x;
    `
  },
  {
    name: "el(...) button with promise-chain on.click",
    messageId: "promiseElButton",
    code: `
      function el(_doc, _tag, _props) { return null; }
      const x = el(document, "button", {
        on: { click: () => fetch("/").then(() => {}) }
      });
      void x;
    `
  },
  {
    name: "setAttribute marker stamp without factory import",
    messageId: "rawMarkerStamp",
    code: `
      const btn = document.createElement("button");
      btn.setAttribute("data-bc-action-button", "1");
    `
  },
  {
    name: "object-literal marker without factory import",
    messageId: "rawMarkerStamp",
    code: `
      const props = { attrs: { "data-bc-action-button": "1" } };
      void props;
    `
  },
  {
    name: "identifier-resolved async handler",
    messageId: "asyncListener",
    code: `
      const handler = async () => { await fetch("/"); };
      const btn = document.createElement("button");
      btn.addEventListener("click", handler);
    `
  }
];

describe("bc-rules/no-raw-action-button", () => {
  describe("valid", () => {
    for (const c of valid) {
      it(c.name, () => {
        const messages = lint(c.code, c.filename);
        expect(messages).toEqual([]);
      });
    }
  });

  describe("invalid", () => {
    for (const c of invalid) {
      it(c.name, () => {
        const messages = lint(c.code, c.filename);
        const ours = messages.filter((m) => m.ruleId === "bc-rules/no-raw-action-button");
        expect(ours.length).toBeGreaterThanOrEqual(1);
        expect(ours[0].messageId).toBe(c.messageId);
      });
    }
  });
});
