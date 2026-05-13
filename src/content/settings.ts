import type { CtecAnalyticsStrategy } from "./augmentations/ctec-links/types";

// Storage keys keep the `better-caesar:` prefix from the project's original
// name to preserve every existing install's toggles, caches, and gate state
// across the rename to Pencil. Renaming the prefix would orphan all stored
// state. Keep using `better-caesar:` for new keys too.
export const FEATURES_STORAGE_KEY = "better-caesar:features:v1";
export const RECENT_AGGREGATION_TERMS_STORAGE_KEY =
  "better-caesar:recent-agg-terms:v1";
export const CTEC_STRATEGY_STORAGE_KEY = "better-caesar:ctec-strategy:v1";

export const DEFAULT_CTEC_STRATEGY: CtecAnalyticsStrategy = "combo";
const VALID_CTEC_STRATEGIES: ReadonlySet<CtecAnalyticsStrategy> = new Set([
  "combo",
  "course",
  "instructor"
]);

// Default and bounds for the "recent terms" aggregation knob exposed in
// the popup. Controls how many of a course's most recent loaded terms get
// averaged into the compact card chips and the analytics-modal KPI strip.
// Bounds are sanity guards — in practice users will keep this small (1–10).
export const DEFAULT_RECENT_AGGREGATION_TERMS = 3;
export const MIN_RECENT_AGGREGATION_TERMS = 1;
export const MAX_RECENT_AGGREGATION_TERMS = 50;

const DEFAULT_FEATURE_STATES: Record<string, boolean> = {
  "paper-ctec-compact-card-stars": false,
  "paper-ctec-single-summary-card": true,
  "paper-ctec-rating-percent": false,
  "paper-card-border-on-hover": true,
  // `paper-combos` is the popup-level visibility gate (controls whether
  // the bar mounts at all on paper.nu). Default ON so users discover the
  // toggle on the page itself. The actual feature engagement (cards
  // hidden, combos cycled) is gated by `paper-combos-active`, flipped
  // by the bar's on-page toggle and default OFF.
  "paper-combos": true,
  "paper-combos-active": false,
  // Prereq-filter is experimental and default OFF — the source data
  // (plan.json's course-level `p` field) drops program restrictions,
  // standing rules, co-requisites, and other gates that CAESAR actually
  // enforces, so the eligibility verdicts aren't always trustworthy. When
  // turned on, the in-page row shows both a switch (to turn it back off
  // without opening the popup) and the "Meets prereqs" filter button.
  "prereq-filter": false,
  // Default false — when the "Show Only Prereq Fulfilled" filter is on,
  // courses whose requirements can't be verified automatically (free-form
  // prose, standing rules without an inference path, placement tests)
  // also get hidden alongside hard blocks. Users can flip this on to
  // keep them visible, but the default matches user intent: "show me
  // only what I can definitely take".
  "prereq-filter-unknown-as-eligible": false
};

// In-memory settings loaded from extension storage on startup.
// Defaults to enabled (true) for any unset feature.
let settings: Record<string, boolean> = {};
let recentAggregationTerms: number = DEFAULT_RECENT_AGGREGATION_TERMS;
let ctecStrategy: CtecAnalyticsStrategy = DEFAULT_CTEC_STRATEGY;

void chrome.storage.local
  .get([
    FEATURES_STORAGE_KEY,
    RECENT_AGGREGATION_TERMS_STORAGE_KEY,
    CTEC_STRATEGY_STORAGE_KEY
  ])
  .then((result: Record<string, unknown>) => {
    const rawFeatures = result[FEATURES_STORAGE_KEY];
    if (rawFeatures && typeof rawFeatures === "object") {
      settings = rawFeatures as Record<string, boolean>;
    }
    recentAggregationTerms = sanitizeRecentAggregationTerms(
      result[RECENT_AGGREGATION_TERMS_STORAGE_KEY]
    );
    ctecStrategy = sanitizeCtecStrategy(result[CTEC_STRATEGY_STORAGE_KEY]);
  });

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  const featureChange = changes[FEATURES_STORAGE_KEY];
  if (featureChange) {
    const next = featureChange.newValue;
    settings = next && typeof next === "object"
      ? next as Record<string, boolean>
      : {};
  }

  const recentChange = changes[RECENT_AGGREGATION_TERMS_STORAGE_KEY];
  if (recentChange) {
    recentAggregationTerms = sanitizeRecentAggregationTerms(recentChange.newValue);
  }

  const strategyChange = changes[CTEC_STRATEGY_STORAGE_KEY];
  if (strategyChange) {
    const next = sanitizeCtecStrategy(strategyChange.newValue);
    const changed = next !== ctecStrategy;
    ctecStrategy = next;
    if (changed) {
      for (const listener of ctecStrategyListeners) {
        try {
          listener(next);
        } catch {
          // Listener crashes shouldn't poison the dispatch loop.
        }
      }
    }
  }
});

// Subscribers fire on every strategy mutation — including same-tab writes,
// because chrome.storage.onChanged fires for own-tab writes too. Used by
// chip / class-search coordinators to invalidate their resolved aggregates
// (which are keyed on (subject, catalog, instructor) only, not strategy)
// and re-derive from the per-strategy cache slice. Returns an unsubscribe
// fn so callers can detach on cleanup().
const ctecStrategyListeners = new Set<(strategy: CtecAnalyticsStrategy) => void>();
export function subscribeCtecStrategy(
  listener: (strategy: CtecAnalyticsStrategy) => void
): () => void {
  ctecStrategyListeners.add(listener);
  return () => {
    ctecStrategyListeners.delete(listener);
  };
}

function sanitizeRecentAggregationTerms(value: unknown): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(numeric)) return DEFAULT_RECENT_AGGREGATION_TERMS;
  const floored = Math.floor(numeric);
  return Math.max(
    MIN_RECENT_AGGREGATION_TERMS,
    Math.min(MAX_RECENT_AGGREGATION_TERMS, floored)
  );
}

export function isFeatureEnabled(id: string): boolean {
  return settings[id] ?? DEFAULT_FEATURE_STATES[id] ?? true;
}

export function getDefaultFeatureEnabled(id: string): boolean {
  return DEFAULT_FEATURE_STATES[id] ?? true;
}

export function getRecentAggregationTerms(): number {
  return recentAggregationTerms;
}

// Persist a single feature toggle. Reads the current map, sets `id` to
// `value`, writes back. Used by in-page UI that lets the user disable a
// feature without opening the popup (e.g. the prereq-filter row's switch).
export async function setFeatureEnabled(id: string, value: boolean): Promise<void> {
  const current = (await chrome.storage.local.get(FEATURES_STORAGE_KEY)) as Record<string, unknown>;
  const prev = current[FEATURES_STORAGE_KEY];
  const map: Record<string, boolean> = prev && typeof prev === "object"
    ? { ...(prev as Record<string, boolean>) }
    : {};
  map[id] = value;
  await chrome.storage.local.set({ [FEATURES_STORAGE_KEY]: map });
}

function sanitizeCtecStrategy(value: unknown): CtecAnalyticsStrategy {
  if (typeof value === "string" && VALID_CTEC_STRATEGIES.has(value as CtecAnalyticsStrategy)) {
    return value as CtecAnalyticsStrategy;
  }
  return DEFAULT_CTEC_STRATEGY;
}

export function getCtecStrategy(): CtecAnalyticsStrategy {
  return ctecStrategy;
}

// Persists the user's chosen analytics lens. Updates the in-memory cache
// synchronously so callers reading `getCtecStrategy()` on the next render
// see the new value immediately; the async write to chrome.storage.local
// fires-and-forgets (the onChanged listener will reconcile if another tab
// raced us). Default lens is "combo" — same-(course, instructor) — which
// preserves pre-feature behavior for anyone who never opens the selector.
export function setCtecStrategy(strategy: CtecAnalyticsStrategy): void {
  if (strategy === ctecStrategy) return;
  ctecStrategy = strategy;
  void chrome.storage.local.set({ [CTEC_STRATEGY_STORAGE_KEY]: strategy });
  // Fire listeners directly for same-tab writes. The onChanged handler
  // would otherwise see ctecStrategy already equal to next and suppress
  // its own dispatch — leaving chip / class-search coordinators with
  // stale resolved-Map entries from the prior lens.
  for (const listener of ctecStrategyListeners) {
    try {
      listener(strategy);
    } catch {
      // Listener crashes shouldn't poison the dispatch loop.
    }
  }
}
