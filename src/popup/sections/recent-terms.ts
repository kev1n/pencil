import {
  DEFAULT_RECENT_AGGREGATION_TERMS,
  MAX_RECENT_AGGREGATION_TERMS,
  MIN_RECENT_AGGREGATION_TERMS,
  RECENT_AGGREGATION_TERMS_STORAGE_KEY
} from "../../content/settings";

// Pure clamp — kept exported for the unit test. Falls back to the default
// when given anything non-finite, then floors and bounds to the [MIN, MAX]
// range. The popup's number input writes back the clamped value so the
// visible value always equals what we persist.
export function clampRecent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RECENT_AGGREGATION_TERMS;
  return Math.max(
    MIN_RECENT_AGGREGATION_TERMS,
    Math.min(MAX_RECENT_AGGREGATION_TERMS, Math.floor(value))
  );
}

export async function initRecentTermsInput(): Promise<void> {
  const root = document.getElementById("recent-terms-row");
  if (!root) return;

  const stored = await chrome.storage.local.get(
    RECENT_AGGREGATION_TERMS_STORAGE_KEY
  ) as Record<string, unknown>;
  const raw = stored[RECENT_AGGREGATION_TERMS_STORAGE_KEY];
  const initial = clampRecent(typeof raw === "number" ? raw : DEFAULT_RECENT_AGGREGATION_TERMS);

  const label = document.createElement("label");
  label.className = "ctec-school-label";
  label.htmlFor = "recent-terms-input";

  const labelTitle = document.createElement("span");
  labelTitle.className = "ctec-school-label-title";
  labelTitle.textContent = "Recent terms aggregation";

  const labelHelp = document.createElement("span");
  labelHelp.className = "ctec-school-label-help";
  labelHelp.textContent =
    "How many of a course's most recent terms get averaged into the schedule-card chips and the analytics KPIs.";

  label.append(labelTitle, labelHelp);

  const input = document.createElement("input");
  input.id = "recent-terms-input";
  input.type = "number";
  input.className = "ctec-school-select";
  input.min = String(MIN_RECENT_AGGREGATION_TERMS);
  input.max = String(MAX_RECENT_AGGREGATION_TERMS);
  input.step = "1";
  input.value = String(initial);
  input.style.maxWidth = "80px";

  const persist = async (): Promise<void> => {
    const next = clampRecent(Number.parseInt(input.value, 10));
    input.value = String(next);
    await chrome.storage.local.set({
      [RECENT_AGGREGATION_TERMS_STORAGE_KEY]: next
    });
  };
  input.addEventListener("change", () => void persist());
  input.addEventListener("blur", () => void persist());

  root.append(label, input);
}
