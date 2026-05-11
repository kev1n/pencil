// Storage keys keep the `better-caesar:` prefix from the project's original
// name to preserve every existing install's toggles, caches, and gate state
// across the rename to Pencil. Renaming the prefix would orphan all stored
// state. Keep using `better-caesar:` for new keys too.
export const FEATURES_STORAGE_KEY = "better-caesar:features:v1";
export const RECENT_AGGREGATION_TERMS_STORAGE_KEY =
  "better-caesar:recent-agg-terms:v1";

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

void chrome.storage.local
  .get([FEATURES_STORAGE_KEY, RECENT_AGGREGATION_TERMS_STORAGE_KEY])
  .then((result: Record<string, unknown>) => {
    const rawFeatures = result[FEATURES_STORAGE_KEY];
    if (rawFeatures && typeof rawFeatures === "object") {
      settings = rawFeatures as Record<string, boolean>;
    }
    recentAggregationTerms = sanitizeRecentAggregationTerms(
      result[RECENT_AGGREGATION_TERMS_STORAGE_KEY]
    );
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
});

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
