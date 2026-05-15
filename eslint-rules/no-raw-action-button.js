// AST-based replacement for the regex script in scripts/check-action-buttons.mjs.
//
// Enforces the rule that every async-action button — one whose click triggers
// a network request, fetch, multi-step flow, or otherwise yields control to a
// Promise chain — must go through `createActionButton` (or `bindActionButton`)
// from `framework/action-button.ts`.
//
// What it flags:
//
//   1. `addEventListener("click", async (...) => { ... })` — async handler.
//   2. `addEventListener("click", (...) => { await ... })` — body awaits.
//   3. `addEventListener("click", (...) => somePromiseExpr.then(...))`
//   4. `addEventListener("click", (...) => somePromiseExpr.catch/finally(...))`
//   5. `el.onclick = async (...) => { ... }` (and the same Promise variants).
//   6. `el(doc, "button", { on: { click: async ... } })` and Promise variants.
//   7. Files that stamp `data-bc-action-button` on a raw element via
//      `setAttribute("data-bc-action-button", ...)` without importing
//      `createActionButton`, `bindActionButton`, or `ACTION_BUTTON_MARKER_ATTR`.
//
// What it allows:
//
//   • Any handler that uses the `void <expr>` operator on its top-level call
//     (the documented "fire-and-forget; rejection swallowed by intent" escape
//     hatch — see `src/popup/sections/feature-toggles.ts` for an example).
//   • The factory file itself + its spec.
//   • Buttons created via `el(doc, "button", { ..., attrs: {
//     [ACTION_BUTTON_MARKER_ATTR]: "controller" } })` — the controller-managed
//     exception (see `src/content/augmentations/class-search/views/section-row.ts`).
//     The marker value `"controller"` formalizes "this raw element delegates
//     its full state machine to a dedicated controller; trust the pattern."
//     Marker value `"1"` is the factory's own output.
//   • `eslint-disable` line/file comments (handled natively by ESLint).
//
// Limitations (documented honestly so future engineers know):
//
//   • Cannot detect every possible Promise-returning call. Heuristic:
//     async/await syntactic markers + immediate `.then`/`.catch`/`.finally`
//     chains. A handler like `() => { doSync(); somePromiseFn(); }` (two
//     statements; second one's promise dropped, no chain method) passes the
//     rule but is still a bug — neither statement is syntactically
//     identifiable as Promise-returning.
//   • Cannot follow function-reference handlers across files:
//     `addEventListener("click", handler)` where `handler` is imported
//     elsewhere bypasses the AST scope check. The bare-async case (`const
//     handler = async () => { ... }; addEventListener("click", handler)`) IS
//     caught when `handler` is declared in the same file (we resolve the
//     identifier through the local scope).
//   • The "raw factory marker" check (rule #7) only watches direct
//     `setAttribute("data-bc-action-button", ...)` calls and
//     `data-bc-action-button="..."` literal-string property keys. It does NOT
//     chase computed property keys like `attrs[someVar]` or string
//     template-built attribute names; those would be a wildly indirect way to
//     do the same thing and aren't worth the false-positive risk.

const FACTORY_IMPORT_NAMES = new Set([
  "createActionButton",
  "bindActionButton",
  "ACTION_BUTTON_MARKER_ATTR"
]);

const PROMISE_CHAIN_METHODS = new Set(["then", "catch", "finally"]);

// Marker attribute literal — kept here as a string instead of imported so the
// rule itself stays pure JS with no TS dependency.
const MARKER_ATTR = "data-bc-action-button";
const CONTROLLER_VALUE = "controller";

/**
 * Detect whether an Identifier was declared as `const x = async () => { ... }`
 * (or `let`/`var`) within the file's scope. Returns `true` when the binding
 * resolves to an async function, `false` otherwise (including unresolved).
 */
function identifierResolvesToAsync(context, node) {
  if (node.type !== "Identifier") return false;
  const scope = context.sourceCode
    ? context.sourceCode.getScope(node)
    : context.getScope();
  let cursor = scope;
  while (cursor) {
    const variable = cursor.variables.find((v) => v.name === node.name);
    if (variable) {
      for (const def of variable.defs) {
        const init =
          def.node.type === "VariableDeclarator"
            ? def.node.init
            : def.node.type === "FunctionDeclaration"
              ? def.node
              : null;
        if (!init) continue;
        if (init.async === true) return true;
      }
      return false;
    }
    cursor = cursor.upper;
  }
  return false;
}

/**
 * Walks an AST node looking for an `AwaitExpression`. Stops descending into
 * nested function bodies (an inner function's `await` is its own concern).
 */
function bodyHasAwait(node) {
  if (!node) return false;
  let found = false;
  function visit(n) {
    if (!n || found) return;
    if (Array.isArray(n)) {
      for (const child of n) visit(child);
      return;
    }
    if (typeof n !== "object" || !n.type) return;
    if (n.type === "AwaitExpression") {
      found = true;
      return;
    }
    if (
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression" ||
      n.type === "FunctionDeclaration"
    ) {
      // Nested function — don't peek inside.
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      visit(n[key]);
    }
  }
  visit(node);
  return found;
}

/**
 * True when `expr` is a member-call ending in `.then(...)`, `.catch(...)`, or
 * `.finally(...)` — i.e. an inline Promise chain.
 */
function isPromiseChainCall(expr) {
  if (!expr || expr.type !== "CallExpression") return false;
  const callee = expr.callee;
  if (!callee || callee.type !== "MemberExpression") return false;
  if (callee.computed) return false;
  const prop = callee.property;
  if (!prop || prop.type !== "Identifier") return false;
  return PROMISE_CHAIN_METHODS.has(prop.name);
}

/**
 * Inspect a click-handler function node. Returns one of:
 *   - "async"    : declared with the `async` keyword.
 *   - "await"    : body contains an AwaitExpression (caught by bodyHasAwait).
 *   - "promise"  : an ExpressionStatement (or arrow body expr) is a Promise
 *                  chain (.then/.catch/.finally).
 *   - null       : looks safe (sync callback or `void`-wrapped fire-and-forget).
 */
function classifyHandler(handler) {
  if (!handler) return null;
  if (
    handler.type !== "ArrowFunctionExpression" &&
    handler.type !== "FunctionExpression"
  ) {
    return null;
  }
  if (handler.async) return "async";

  // Concise arrow body: `() => expr`.
  if (handler.type === "ArrowFunctionExpression" && handler.body.type !== "BlockStatement") {
    const expr = handler.body;
    // `void something()` — the documented escape hatch.
    if (expr.type === "UnaryExpression" && expr.operator === "void") return null;
    if (isPromiseChainCall(expr)) return "promise";
    if (bodyHasAwait(expr)) return "await";
    return null;
  }

  // Block body — check each top-level ExpressionStatement for promise chain
  // calls; descend through the whole body for AwaitExpression.
  if (bodyHasAwait(handler.body)) return "await";
  if (handler.body.type === "BlockStatement") {
    for (const stmt of handler.body.body) {
      if (stmt.type !== "ExpressionStatement") continue;
      const expr = stmt.expression;
      // Top-level `void promise()` — explicit fire-and-forget.
      if (expr.type === "UnaryExpression" && expr.operator === "void") continue;
      if (isPromiseChainCall(expr)) return "promise";
    }
  }
  return null;
}

/**
 * Collect every name imported into the current Program node. We only care
 * about whether the file references the factory's exports — string literals
 * comparing import sources are too fragile (relative paths, re-export hops).
 */
function collectImportedNames(program) {
  const names = new Set();
  for (const node of program.body) {
    if (node.type !== "ImportDeclaration") continue;
    for (const spec of node.specifiers) {
      if (spec.type === "ImportSpecifier") {
        names.add(spec.imported.name);
      } else if (
        spec.type === "ImportDefaultSpecifier" ||
        spec.type === "ImportNamespaceSpecifier"
      ) {
        names.add(spec.local.name);
      }
    }
  }
  return names;
}

/**
 * For an `el(doc, "button", { ..., attrs: { [ACTION_BUTTON_MARKER_ATTR]: "controller" } })`
 * call, returns true when the on-call attrs object stamps the marker with
 * value `"controller"` — formalizing the controller-managed exception.
 */
function elCallHasControllerMarker(callExpr) {
  if (!callExpr || callExpr.type !== "CallExpression") return false;
  if (callExpr.arguments.length < 3) return false;
  const propsArg = callExpr.arguments[2];
  if (!propsArg || propsArg.type !== "ObjectExpression") return false;
  const attrsProp = propsArg.properties.find(
    (p) =>
      p.type === "Property" &&
      ((p.key.type === "Identifier" && p.key.name === "attrs") ||
        (p.key.type === "Literal" && p.key.value === "attrs"))
  );
  if (!attrsProp || attrsProp.value.type !== "ObjectExpression") return false;
  for (const prop of attrsProp.value.properties) {
    if (prop.type !== "Property") continue;
    let isMarkerKey = false;
    // `[ACTION_BUTTON_MARKER_ATTR]: "controller"` (computed Identifier key)
    if (prop.computed && prop.key.type === "Identifier" && prop.key.name === "ACTION_BUTTON_MARKER_ATTR") {
      isMarkerKey = true;
    } else if (
      !prop.computed &&
      prop.key.type === "Literal" &&
      prop.key.value === MARKER_ATTR
    ) {
      // `"data-bc-action-button": "controller"` (string-literal key)
      isMarkerKey = true;
    }
    if (!isMarkerKey) continue;
    if (prop.value.type === "Literal" && prop.value.value === CONTROLLER_VALUE) {
      return true;
    }
  }
  return false;
}

/**
 * For an `el(doc, "button", { ..., on: { click: handler } })` call, locates
 * the click handler node. Returns the handler node, or null.
 */
function elCallClickHandler(callExpr) {
  if (!callExpr || callExpr.type !== "CallExpression") return null;
  if (callExpr.arguments.length < 3) return null;
  // First positional arg can be anything; second must be the literal "button".
  const tagArg = callExpr.arguments[1];
  if (!tagArg || tagArg.type !== "Literal" || tagArg.value !== "button") return null;
  const propsArg = callExpr.arguments[2];
  if (!propsArg || propsArg.type !== "ObjectExpression") return null;
  const onProp = propsArg.properties.find(
    (p) =>
      p.type === "Property" &&
      ((p.key.type === "Identifier" && p.key.name === "on") ||
        (p.key.type === "Literal" && p.key.value === "on"))
  );
  if (!onProp || onProp.value.type !== "ObjectExpression") return null;
  const clickProp = onProp.value.properties.find(
    (p) =>
      p.type === "Property" &&
      ((p.key.type === "Identifier" && p.key.name === "click") ||
        (p.key.type === "Literal" && p.key.value === "click"))
  );
  if (!clickProp) return null;
  return clickProp.value;
}

const meta = {
  type: "problem",
  docs: {
    description:
      "Async-action buttons must use createActionButton/bindActionButton from framework/action-button.ts."
  },
  schema: [],
  messages: {
    asyncListener:
      "addEventListener(\"click\", async …) — async-action buttons must use createActionButton from framework/action-button.ts.",
    awaitListener:
      "addEventListener(\"click\", … await …) — handler awaits a Promise; use createActionButton or wrap a fire-and-forget call in `void`.",
    promiseListener:
      "addEventListener(\"click\", … .then/.catch/.finally) — handler returns a Promise chain; use createActionButton or wrap with `void`.",
    asyncOnclick:
      "el.onclick = async … — async-action buttons must use createActionButton from framework/action-button.ts.",
    awaitOnclick:
      "el.onclick = (…) => await … — handler awaits a Promise; use createActionButton or wrap with `void`.",
    promiseOnclick:
      "el.onclick = (…) => …then(…) — handler returns a Promise chain; use createActionButton or wrap with `void`.",
    asyncElButton:
      "el(doc, \"button\", { on: { click: async … } }) — use createActionButton.",
    awaitElButton:
      "el(doc, \"button\", { on: { click: (…) => await … } }) — use createActionButton or wrap with `void`.",
    promiseElButton:
      "el(doc, \"button\", { on: { click: (…) => …then(…) } }) — use createActionButton or wrap with `void`.",
    rawMarkerStamp:
      "Stamping `data-bc-action-button` directly bypasses the createActionButton/bindActionButton factory. Import the factory from framework/action-button.ts and use it instead."
  }
};

const create = (context) => {
  const filename = context.filename || context.getFilename();
  // Allowlist: the factory file itself + its spec, plus the rule's own spec
  // (which contains intentionally-bad code samples for the inline lint
  // helper). They define and exercise the very pattern this rule enforces.
  if (
    filename.endsWith("/action-button.ts") ||
    filename.endsWith("/action-button.spec.ts") ||
    filename.endsWith("/no-raw-action-button.spec.ts")
  ) {
    return {};
  }

  let importedNames = new Set();

  return {
    Program(node) {
      importedNames = collectImportedNames(node);
    },

    // 1) addEventListener("click", handler)
    "CallExpression[callee.type='MemberExpression'][callee.property.name='addEventListener']"(node) {
      const args = node.arguments;
      if (args.length < 2) return;
      const eventArg = args[0];
      if (!eventArg || eventArg.type !== "Literal" || eventArg.value !== "click") return;
      const handler = args[1];
      let classification = classifyHandler(handler);
      if (!classification && handler && handler.type === "Identifier") {
        if (identifierResolvesToAsync(context, handler)) classification = "async";
      }
      if (!classification) return;
      const messageId =
        classification === "async"
          ? "asyncListener"
          : classification === "await"
            ? "awaitListener"
            : "promiseListener";
      context.report({ node, messageId });
    },

    // 2) el.onclick = handler
    "AssignmentExpression[left.type='MemberExpression'][left.property.name='onclick']"(node) {
      let classification = classifyHandler(node.right);
      if (!classification && node.right.type === "Identifier") {
        if (identifierResolvesToAsync(context, node.right)) classification = "async";
      }
      if (!classification) return;
      const messageId =
        classification === "async"
          ? "asyncOnclick"
          : classification === "await"
            ? "awaitOnclick"
            : "promiseOnclick";
      context.report({ node, messageId });
    },

    // 3) el(doc, "button", { on: { click: handler } })
    "CallExpression[callee.type='Identifier'][callee.name='el']"(node) {
      // Skip controller-managed buttons — formalized exception.
      if (elCallHasControllerMarker(node)) return;
      const handler = elCallClickHandler(node);
      if (!handler) return;
      const classification = classifyHandler(handler);
      if (!classification) return;
      const messageId =
        classification === "async"
          ? "asyncElButton"
          : classification === "await"
            ? "awaitElButton"
            : "promiseElButton";
      context.report({ node: handler, messageId });
    },

    // 4) Manual `setAttribute("data-bc-action-button", ...)` without factory import.
    "CallExpression[callee.type='MemberExpression'][callee.property.name='setAttribute']"(node) {
      const args = node.arguments;
      if (args.length < 1) return;
      const nameArg = args[0];
      if (!nameArg || nameArg.type !== "Literal") return;
      if (nameArg.value !== MARKER_ATTR) return;
      // If the file imports any factory primitive, trust it.
      for (const name of FACTORY_IMPORT_NAMES) {
        if (importedNames.has(name)) return;
      }
      context.report({ node, messageId: "rawMarkerStamp" });
    },

    // 5) ObjectExpression-style attribute literal: `attrs: { "data-bc-action-button": "..." }`
    //    inside any object expression. Catches the same bypass as #4 but via
    //    the el-builder shorthand.
    Property(node) {
      if (node.computed) return;
      if (node.key.type !== "Literal") return;
      if (node.key.value !== MARKER_ATTR) return;
      for (const name of FACTORY_IMPORT_NAMES) {
        if (importedNames.has(name)) return;
      }
      context.report({ node, messageId: "rawMarkerStamp" });
    }
  };
};

const rule = { meta, create };

export default rule;
