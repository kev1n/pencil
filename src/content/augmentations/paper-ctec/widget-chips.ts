import type { CtecAggregateMetric } from "../ctec-links/reports";
import { isFeatureEnabled } from "../../settings";
import { PAPER_CTEC_CONFIG } from "./config";
import { COMPACT_CARD_STARS_FEATURE_ID, WIDGET_CLASS } from "./constants";
import { formatChipRating, formatRatingDetail } from "./rating-format";
import type { PaperCtecWidgetData } from "./types";
import {
  createIcon,
  createRatingStars,
  type IconName
} from "./ui-shared";

type CompactChipTone = {
  lightBackground: string;
  darkBackground: string;
  lightBorder: string;
  darkBorder: string;
  lightText: string;
  darkText: string;
};

type WidgetAggregate = Extract<PaperCtecWidgetData, { state: "found" }>["aggregate"];

// Generic icon-plus-text chip used by the widget summary for state messages
// (loading, no CTEC, error). Different from the metric chips below.
export function makeChip(
  icon: IconName,
  text: string,
  extraClass = "",
  title?: string
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip${extraClass ? ` ${extraClass}` : ""}`;
  if (title) chip.title = title;
  chip.append(createIcon(icon), document.createTextNode(text));
  return chip;
}

// Builds the GBL (Global) chip from the aggregate. Mirrors the modal's
// Global KPI: simple average of the response-weighted Instruction / Course
// / Learned means (skipping any metric that's missing). Returns null when
// none of the three contribute. Honors the stars-mode toggle just like
// metricChip so the schedule-card chip set stays visually consistent.
export function globalChip(aggregate: WidgetAggregate): HTMLElement | null {
  const components: Array<{ label: string; mean: number; n: number }> = [];
  for (const [kind, label] of [
    ["instruction", "Instruction"],
    ["course", "Course"],
    ["learned", "Learned"]
  ] as const) {
    const m = aggregate.metrics[kind];
    if (m && Number.isFinite(m.mean)) {
      components.push({ label, mean: m.mean, n: m.evaluationCount });
    }
  }
  if (components.length === 0) return null;

  const overallMean =
    components.reduce((sum, c) => sum + c.mean, 0) / components.length;

  const tooltipParts = [
    `Global ${formatRatingDetail(overallMean)} — avg of ${components
      .map((c) => `${c.label} ${formatRatingDetail(c.mean)}`)
      .join(", ")}.`
  ];
  const tooltip = tooltipParts.join(" ");

  const starMode = isFeatureEnabled(COMPACT_CARD_STARS_FEATURE_ID);
  if (starMode) {
    return makeMetricStarsChip("GBL", overallMean, tooltip);
  }

  const tone = buildCompactChipTone(
    overallMean,
    PAPER_CTEC_CONFIG.aggregate.ratingScaleMax,
    false
  );
  return makeMetricValueChip("GBL", formatChipRating(overallMean), "", tooltip, tone);
}

// Builds the chip for one CTEC metric (Inst/CRSE/LRN/Hrs/...). Picks
// stars-mode when the COMPACT_CARD_STARS_FEATURE_ID toggle is on for rating
// metrics, value-mode otherwise. Hours never use stars (they're not a
// 0-N rating).
export function metricChip(
  shortLabel: string,
  label: string,
  metric: CtecAggregateMetric | undefined,
  aggregate: WidgetAggregate,
  scale: "rating" | "hours"
): HTMLElement | null {
  if (!metric) return null;

  const starMode = isFeatureEnabled(COMPACT_CARD_STARS_FEATURE_ID);
  if (scale === "rating" && starMode) {
    return makeMetricStarsChip(
      shortLabel,
      metric.mean,
      buildMetricChipTooltip(label, metric, aggregate)
    );
  }

  const tone = !starMode
    ? scale === "hours"
      ? buildCompactChipTone(metric.mean, PAPER_CTEC_CONFIG.aggregate.hoursGraphMax, true)
      : buildCompactChipTone(metric.mean, PAPER_CTEC_CONFIG.aggregate.ratingScaleMax, false)
    : undefined;

  const value = scale === "rating"
    ? formatChipRating(metric.mean)
    : metric.mean.toFixed(1);

  return makeMetricValueChip(
    shortLabel,
    value,
    "",
    buildMetricChipTooltip(label, metric, aggregate),
    tone
  );
}

function makeMetricValueChip(
  label: string,
  value: string,
  extraClass = "",
  title?: string,
  tone?: CompactChipTone
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip${extraClass ? ` ${extraClass}` : ""}`;
  if (title) chip.title = title;
  if (tone) applyCompactChipTone(chip, tone);

  const chipLabel = document.createElement("span");
  chipLabel.className = `${WIDGET_CLASS}-chip-label`;
  chipLabel.textContent = label;

  const chipValue = document.createElement("span");
  chipValue.className = `${WIDGET_CLASS}-chip-value`;
  chipValue.textContent = value;

  chip.append(chipLabel, chipValue);
  return chip;
}

function makeMetricStarsChip(
  label: string,
  value: number,
  title?: string
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip`;
  if (title) chip.title = title;

  const chipLabel = document.createElement("span");
  chipLabel.className = `${WIDGET_CLASS}-chip-label`;
  chipLabel.textContent = label;

  const chipStars = document.createElement("span");
  chipStars.className = `${WIDGET_CLASS}-chip-stars`;
  chipStars.append(createRatingStars(document, value));

  chip.append(chipLabel, chipStars);
  return chip;
}

function applyCompactChipTone(chip: HTMLElement, tone: CompactChipTone): void {
  chip.style.setProperty("--bc-paper-ctec-chip-bg", tone.lightBackground);
  chip.style.setProperty("--bc-paper-ctec-chip-bg-dark", tone.darkBackground);
  chip.style.setProperty("--bc-paper-ctec-chip-border", tone.lightBorder);
  chip.style.setProperty("--bc-paper-ctec-chip-border-dark", tone.darkBorder);
  chip.style.setProperty("--bc-paper-ctec-chip-fg", tone.lightText);
  chip.style.setProperty("--bc-paper-ctec-chip-fg-dark", tone.darkText);
}

// Picks an HSL hue for a metric value within its scale. Shared by the
// compact card chips and the analytics-modal KPI numbers so both surfaces
// use the same color palette. `invert` flips the score so high hours map
// to "bad" tones. Tone scales come from PAPER_CTEC_CONFIG.ui so designers
// can adjust the palette in one place.
export function pickMetricHue(value: number, max: number, invert: boolean): number {
  const normalized = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const score = invert ? 1 - normalized : normalized;
  const scale = invert
    ? PAPER_CTEC_CONFIG.ui.hoursChipTones
    : PAPER_CTEC_CONFIG.ui.ratingChipTones;
  return (
    scale.find((step) => score >= step.minScore)?.hue ??
    scale[scale.length - 1]?.hue ??
    4
  );
}

function buildCompactChipTone(
  value: number,
  max: number,
  invert: boolean
): CompactChipTone {
  const hue = pickMetricHue(value, max, invert);

  return {
    lightBackground: `hsla(${hue}, 96%, 68%, 0.98)`,
    darkBackground: `hsla(${hue}, 78%, 32%, 0.94)`,
    lightBorder: `hsla(${hue}, 82%, 24%, 0.38)`,
    darkBorder: `hsla(${hue}, 90%, 78%, 0.28)`,
    lightText: `hsl(${hue}, 62%, 18%)`,
    darkText: "#f9fafb"
  };
}

function buildAggregateScopeText(aggregate: WidgetAggregate): string {
  if (!aggregate.maxEntriesUsed || aggregate.aggregateEvaluationCount >= aggregate.evaluationCount) {
    return "all matching evaluations";
  }

  return `the latest ${aggregate.aggregateEvaluationCount} matching evaluation${
    aggregate.aggregateEvaluationCount === 1 ? "" : "s"
  }`;
}

function buildMetricChipTooltip(
  label: string,
  metric: CtecAggregateMetric,
  aggregate: WidgetAggregate
): string {
  const scope = buildAggregateScopeText(aggregate);
  return `${label} ${formatRatingDetail(metric.mean)} across ${metric.evaluationCount} matching term${
    metric.evaluationCount === 1 ? "" : "s"
  } in ${scope}.`;
}
