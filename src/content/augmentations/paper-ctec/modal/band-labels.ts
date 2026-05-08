// Qualitative descriptors for the KPI cards. Each metric maps a numeric
// score to one of five phrases the user can read without recalling the
// rating scale: "5.4" alone is opaque; "5.4 — Great instruction" is not.
//
// Index 0 = lowest band (1–2 for ratings, 0–4 for hours);
// index 4 = highest band. Hours bands map to a coarser 4-unit step so
// the same array shape works for both scales.

import type { ModalMetricKind } from "../modal-data";

const METRIC_BAND_LABELS: Record<
  ModalMetricKind | "global",
  [string, string, string, string, string]
> = {
  instruction: [
    "Bad instruction",
    "Poor instruction",
    "Mixed instruction",
    "Good instruction",
    "Great instruction"
  ],
  course: [
    "Bad course",
    "Poor course",
    "Mixed course",
    "Good course",
    "Great course"
  ],
  learned: [
    "Learned nothing",
    "Learned little",
    "Some takeaways",
    "Learned plenty",
    "Learned a lot"
  ],
  challenging: [
    "Very easy",
    "Easy",
    "Moderate",
    "Challenging",
    "Very challenging"
  ],
  stimulating: [
    "Very dull",
    "Dull",
    "Mildly engaging",
    "Engaging",
    "Captivating"
  ],
  hours: [
    "Light workload",
    "Mild workload",
    "Modest workload",
    "Heavy workload",
    "Very heavy load"
  ],
  global: [
    "Bad course",
    "Poor course",
    "Mixed course",
    "Good course",
    "Great course"
  ]
};

export function bandLabelFor(
  kind: ModalMetricKind | "global",
  value: number
): string | null {
  if (!Number.isFinite(value)) return null;
  const isHours = kind === "hours";
  const stepBase = isHours ? 0 : 1;
  const stepSize = isHours ? 4 : 1;
  const index = Math.min(
    4,
    Math.max(0, Math.floor((value - stepBase) / stepSize))
  );
  return METRIC_BAND_LABELS[kind][index] ?? null;
}
