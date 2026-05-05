// ESLint v9 flat config. Three layers:
//   1. typescript-eslint recommended (parsing + sane defaults)
//   2. project-wide rules: no-empty (no silent catches), no-empty-function,
//      no-console (only log.ts, background.ts, build-config.d.ts are exempt)
//   3. raw color-literal ban for src/content/** (except design/tokens.ts,
//      which legitimately defines them).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import noOnlyTests from "eslint-plugin-no-only-tests";

// Hex color = exactly 3, 4, 6, or 8 hex chars. Restricting to those lengths
// avoids false-positives like `#1234` in user-facing text.
const HEX_COLOR_LENGTHS = "(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})";

const colorRuleSelectors = [
  {
    selector: `Literal[value=/^#${HEX_COLOR_LENGTHS}$/]`,
    message:
      "Raw hex color literal — use a --bc-* CSS variable from src/content/design/tokens.ts."
  },
  {
    selector: "CallExpression[callee.name=/^rgba?$/]",
    message:
      "rgb()/rgba() function call — use a --bc-* CSS variable from src/content/design/tokens.ts."
  },
  {
    // CSS-value context: hex must follow `:` (CSS property separator), `,`
    // (multi-value), `(` (inside fn), or `=` (attribute selector). Space
    // alone isn't enough — that false-positives on user text like "Added #1234".
    selector: `TemplateElement[value.raw=/[:(,=]\\s*#${HEX_COLOR_LENGTHS}\\b|\\brgba?\\(/]`,
    message:
      "Raw color literal in template string — use a --bc-* CSS variable from src/content/design/tokens.ts."
  }
];

export default [
  {
    ignores: ["dist/**", "node_modules/**", "scripts/**", "*.config.*", "vitest.setup.ts"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "no-only-tests": noOnlyTests
    },
    languageOptions: {
      globals: {
        // Browser + extension globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        navigator: "readonly",
        location: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        fetch: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        DOMException: "readonly",
        DOMParser: "readonly",
        XMLHttpRequest: "readonly",
        XMLSerializer: "readonly",
        MutationObserver: "readonly",
        IntersectionObserver: "readonly",
        ResizeObserver: "readonly",
        Element: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLAnchorElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLSpanElement: "readonly",
        HTMLLabelElement: "readonly",
        HTMLOptionElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLDocument: "readonly",
        HTMLTableElement: "readonly",
        HTMLTableRowElement: "readonly",
        HTMLTableCellElement: "readonly",
        HTMLTableSectionElement: "readonly",
        HTMLStyleElement: "readonly",
        HTMLScriptElement: "readonly",
        HTMLTemplateElement: "readonly",
        Image: "readonly",
        ShadowRoot: "readonly",
        ShadowRootInit: "readonly",
        Document: "readonly",
        Node: "readonly",
        NodeFilter: "readonly",
        NodeList: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        EventTarget: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        FocusEvent: "readonly",
        InputEvent: "readonly",
        SVGElement: "readonly",
        SVGSVGElement: "readonly",
        getComputedStyle: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        queueMicrotask: "readonly",
        structuredClone: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        atob: "readonly",
        btoa: "readonly",
        // Web Worker / extension specifics
        chrome: "readonly",
        importScripts: "readonly",
        self: "readonly",
        globalThis: "readonly",
        // Build-time defines from scripts/build.mjs
        __BC_BUCKET_SCHEDULE_URL__: "readonly"
      }
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: false }],
      "@typescript-eslint/no-empty-function": "error",
      "no-only-tests/no-only-tests": "error",
      // Console use is forbidden in production code; specific files unblock it.
      "no-console": "error",
      // Tame the most common churn-noise. None of these block correctness.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true
        }
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty-pattern": "off",
      "no-useless-escape": "off",
      "no-cond-assign": "off",
      "no-control-regex": "off",
      "no-misleading-character-class": "off",
      "no-prototype-builtins": "off",
      "no-fallthrough": "off",
      "no-irregular-whitespace": "off",
      "no-self-assign": "off",
      "no-undef": "off",
      "no-empty-character-class": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-namespace": "off"
    }
  },
  {
    // Only these files may use console.* directly.
    files: [
      "src/shared/log.ts",
      "src/background.ts",
      "src/build-config.d.ts"
    ],
    rules: {
      "no-console": "off"
    }
  },
  {
    // Tests can reuse `let` patterns and console mocks.
    files: ["src/**/*.spec.ts", "src/**/__tests__/**/*.ts"],
    rules: {
      "no-console": "off"
    }
  },
  {
    // Color-literal ban: anywhere under src/content/** EXCEPT design/tokens.ts
    // (the source of truth) and tokens.spec.ts (which asserts on those values).
    files: ["src/content/**/*.ts"],
    ignores: ["src/content/design/tokens.ts", "src/content/design/tokens.spec.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...colorRuleSelectors]
    }
  }
];
