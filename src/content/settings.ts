export const FEATURES_STORAGE_KEY = "better-caesar:features:v1";

const DEFAULT_FEATURE_STATES: Record<string, boolean> = {
  "paper-ctec-compact-card-stars": false,
  "paper-ctec-single-summary-card": true,
  "paper-ctec-rating-percent": false,
  "paper-card-border-on-hover": true
};

// In-memory settings loaded from extension storage on startup.
// Defaults to enabled (true) for any unset feature.
let settings: Record<string, boolean> = {};

void chrome.storage.local
  .get(FEATURES_STORAGE_KEY)
  .then((result: Record<string, unknown>) => {
    const raw = result[FEATURES_STORAGE_KEY];
    if (raw && typeof raw === "object") {
      settings = raw as Record<string, boolean>;
    }
  });

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const change = changes[FEATURES_STORAGE_KEY];
  if (!change) return;

  const next = change.newValue;
  settings = next && typeof next === "object"
    ? next as Record<string, boolean>
    : {};
});

export function isFeatureEnabled(id: string): boolean {
  return settings[id] ?? DEFAULT_FEATURE_STATES[id] ?? true;
}

export function getDefaultFeatureEnabled(id: string): boolean {
  return DEFAULT_FEATURE_STATES[id] ?? true;
}
