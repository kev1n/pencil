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
  "paper-card-border-on-hover": true
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
