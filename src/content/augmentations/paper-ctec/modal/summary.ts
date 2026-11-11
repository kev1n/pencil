// The numbers half of the sheet: overall rating + hours pair, the five
// rating rows, and the hours-per-week histogram.

import { html, svg, type TemplateResult } from "lit-html";

import { repairLegacyBlueraUrl } from "../../../../shared/nu-hosts";
import { weightedMean } from "../../ctec-links/reports";
import { extractChartFromImage } from "../chart-extract";
import { PAPER_CTEC_CONFIG } from "../config";
import {
  GLOBAL_KPI_METRICS,
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { formatChipRating, isRatingPercentMode } from "../rating-format";
import { pickMetricHue } from "../widget-chips";
import { plural, termLabel, termName, type SheetContext } from "./common";

const RATING_MAX = PAPER_CTEC_CONFIG.aggregate.ratingScaleMax;

const METRIC_QUESTIONS: Record<ModalMetricKind, string> = {
  instruction: "Overall rating of the instruction",
  course: "Overall rating of the course",
  learned: "How much you learned",
  challenging: "How intellectually challenging it was",
  stimulating: "How much it stimulated your interest",
  hours: "Hours per week spent on the course outside class"
};

const OVERALL_TOOLTIP =
  "Average of the Instruction, Course and Learned ratings, each out of 6.";

// Response-weighted mean of one metric across every loaded term: the same
// formula the schedule-card chip uses, so the two agree whenever they cover
// the same terms. Undefined when no term reports the metric.
function meanAcross(terms: ModalTerm[], kind: ModalMetricKind): number | undefined {
  const result = weightedMean(terms, (term) => {
    const value = term.metrics[kind];
    if (typeof value !== "number") return undefined;
    // Terms cached before per-metric counts were kept still count once.
    return { mean: value, responseCount: term.metricResponseCounts[kind] ?? 1 };
  });
  return result.evaluationCount > 0 ? result.mean : undefined;
}

// The value shown right now: the selected term's, the scrubbed term's
// (rating rows only), or the mean across all loaded terms.
function valueFor(
  ctx: SheetContext,
  kind: ModalMetricKind,
  scrub: number | null = null
): number | undefined {
  const { data, term } = ctx;
  if (term) return term.metrics[kind];
  if (scrub != null) return data.trendTerms[scrub]?.metrics[kind];
  return meanAcross(data.terms, kind);
}

const fmt = (value: number | undefined): string =>
  typeof value === "number" ? value.toFixed(1) : "n/a";

// ---------------------------------------------------------------------------
// Overall rating + hours pair
// ---------------------------------------------------------------------------

export function renderSummary(ctx: SheetContext): TemplateResult {
  const parts = GLOBAL_KPI_METRICS.map((kind) => valueFor(ctx, kind)).filter(
    (value): value is number => typeof value === "number"
  );
  const overall = parts.length
    ? parts.reduce((sum, value) => sum + value, 0) / parts.length
    : undefined;
  const hours = valueFor(ctx, "hours");
  const hue =
    typeof overall === "number" ? pickMetricHue(overall, RATING_MAX, false) : null;
  const chipStyle =
    hue == null
      ? ""
      : `--bc-sheet-chip-bg: hsl(${hue} 85% 80%); --bc-sheet-chip-fg: hsl(${hue} 60% 16%);` +
        `--bc-sheet-chip-bg-dark: hsl(${hue} 55% 26%); --bc-sheet-chip-fg-dark: hsl(${hue} 80% 90%);`;

  return html`<section class="bc-sheet-sum">
    <div class="bc-sheet-sum-cell" title=${OVERALL_TOOLTIP}>
      <div class="bc-sheet-sum-big">
        <span
          class=${`bc-sheet-sum-chip${hue == null ? " is-empty" : ""}`}
          style=${chipStyle}
          >${typeof overall === "number" ? formatChipRating(overall) : "n/a"}</span
        >${isRatingPercentMode()
          ? ""
          : html`<span class="bc-sheet-sum-unit">/ ${RATING_MAX}</span>`}
      </div>
      <div class="bc-sheet-sum-label">Overall rating</div>
    </div>
    <div class="bc-sheet-sum-cell" title=${METRIC_QUESTIONS.hours}>
      <div class="bc-sheet-sum-big">
        <span class="bc-sheet-sum-num">${fmt(hours)}</span
        ><span class="bc-sheet-sum-unit">hrs</span>
      </div>
      <div class="bc-sheet-sum-label">Work per week</div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Chart counts, read from the report image when the report didn't carry them
// ---------------------------------------------------------------------------

type Counts =
  | { kind: "counts"; counts: number[] }
  | { kind: "pending" }
  | { kind: "image"; url: string; alt: string }
  | { kind: "none" };

function countsFor(ctx: SheetContext, term: ModalTerm, metric: ModalMetricKind): Counts {
  const chart = term.charts[metric];
  if (!chart) return { kind: "none" };
  if (chart.counts?.length) return { kind: "counts", counts: chart.counts };
  if (!chart.imageUrl) return { kind: "none" };

  const cached = ctx.local.charts.get(chart.imageUrl);
  if (Array.isArray(cached)) return { kind: "counts", counts: cached };
  if (cached === "failed") {
    return {
      kind: "image",
      url: repairLegacyBlueraUrl(chart.imageUrl),
      alt: chart.alt ?? `${MODAL_METRIC_LABELS[metric]} answers, ${termName(term.term)}`
    };
  }
  if (cached === undefined) {
    const url = chart.imageUrl;
    ctx.local.charts.set(url, "pending");
    void extractChartFromImage(url, term.metricResponseCounts[metric] ?? 0).then(
      (result) => {
        ctx.local.charts.set(url, result.ok ? result.data.counts : "failed");
        ctx.rerender();
      }
    );
  }
  return { kind: "pending" };
}

// When a chart can't be read into bars the student still gets the report's
// own picture of it.
function originalCharts(
  images: Array<{ label: string; url: string; alt: string }>
): TemplateResult | string {
  if (images.length === 0) return "";
  return html`<div class="bc-sheet-originals">
    ${images.map(
      (image) => html`<figure class="bc-sheet-original">
        <figcaption>${image.label}, from the original report</figcaption>
        <img src=${image.url} alt=${image.alt} loading="lazy" />
      </figure>`
    )}
  </div>`;
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

// Sparkline / distribution column: 80 x 20, matching the grid's last column.
const W = 80;
const H = 20;
const PX = 3;
const BAR_W = 11;
const BAR_GAP = (W - BAR_W * 6) / 5;

export function renderRatings(ctx: SheetContext): TemplateResult {
  const { data, local } = ctx;
  const oldFirst = data.trendTerms;
  const n = oldFirst.length;
  // With one term loaded there is no trend to draw, so "All terms" shows
  // that term's answers as well.
  const shown = ctx.term ?? (n === 1 ? oldFirst[0]! : null);
  const scrub = shown ? null : local.scrub;
  const x = (i: number): number => PX + (i * (W - PX * 2)) / Math.max(1, n - 1);

  const images: Array<{ label: string; url: string; alt: string }> = [];

  const rows = MODAL_RATING_METRICS.map((kind) => {
    const label = MODAL_METRIC_LABELS[kind];
    const value = valueFor(ctx, kind, scrub);
    const fill =
      typeof value === "number"
        ? `width: ${Math.max(0, Math.min(100, ((value - 1) / (RATING_MAX - 1)) * 100))}%;` +
          `--bc-sheet-fill: hsl(${pickMetricHue(value, RATING_MAX, false)} 78% 44%);` +
          `--bc-sheet-fill-dark: hsl(${pickMetricHue(value, RATING_MAX, false)} 70% 52%);`
        : "width: 0";

    let side: TemplateResult | string = "";
    if (shown) {
      const counts = countsFor(ctx, shown, kind);
      if (counts.kind === "counts") {
        side = distribution(ctx, label, counts.counts);
      } else if (counts.kind === "image") {
        images.push({ label, url: counts.url, alt: counts.alt });
        side = html`<span class="bc-sheet-rate-note">Chart below</span>`;
      } else if (counts.kind === "none") {
        side = html`<span class="bc-sheet-rate-note">No chart</span>`;
      }
    } else {
      side = sparkline(oldFirst, kind, x, scrub);
    }

    return html`<div class="bc-sheet-rate" title=${METRIC_QUESTIONS[kind]}>
      <span class="bc-sheet-rate-label">${label}</span>
      <span class="bc-sheet-rate-bar"
        ><span class="bc-sheet-rate-fill" style=${fill}></span
      ></span>
      <span
        class=${`bc-sheet-rate-val${typeof value === "number" ? "" : " is-empty"}`}
        >${fmt(value)}</span
      >
      ${side}
    </div>`;
  });

  let context: TemplateResult | string;
  if (shown) {
    context = local.peek ?? "Answers 1 to 6";
  } else if (scrub != null && oldFirst[scrub]) {
    const term = oldFirst[scrub]!;
    context = termLabel(
      term.term,
      `${termName(term.term)} · ${plural(term.responses, "response")}`
    );
  } else {
    context = html`${termLabel(oldFirst[0]!.term)}<span class="bc-sheet-ctx-to">to</span
      >${termLabel(oldFirst[n - 1]!.term)}`;
  }

  const indexAt = (event: PointerEvent | MouseEvent): number | null => {
    const spark = (event.target as Element | null)?.closest?.(".bc-sheet-spark");
    if (!spark) return null;
    const rect = spark.getBoundingClientRect();
    const rel = ((event.clientX - rect.left) / rect.width) * W;
    return Math.max(
      0,
      Math.min(n - 1, Math.round(((rel - PX) / (W - PX * 2)) * (n - 1)))
    );
  };
  const setScrub = (next: number | null): void => {
    if (local.scrub === next) return;
    local.scrub = next;
    ctx.rerender();
  };

  return html`<section
    class=${`bc-sheet-sec bc-sheet-rates${scrub != null ? " is-scrub" : ""}`}
    @pointermove=${(event: PointerEvent) => {
      if (!shown) setScrub(indexAt(event));
    }}
    @pointerleave=${() => {
      if (!shown) setScrub(null);
    }}
    @click=${(event: MouseEvent) => {
      if (shown) return;
      const index = indexAt(event);
      const term = index == null ? null : oldFirst[index];
      if (!term) return;
      local.scrub = null;
      ctx.selectTerm(term.id);
    }}
  >
    <div class="bc-sheet-sec-head">
      <h3 class="bc-sheet-sec-title">Ratings</h3>
      <span class="bc-sheet-sec-ctx">${context}</span>
    </div>
    ${rows}
    ${scrub != null
      ? html`<div class="bc-sheet-spark-guide" style=${`right: ${W - x(scrub)}px`}></div>`
      : ""}
    ${originalCharts(images)}
  </section>`;
}

// One metric over the loaded terms, oldest to newest. Each row gets its own
// scale with a fixed minimum span, so a 0.1 wobble stays a wobble.
function sparkline(
  oldFirst: ModalTerm[],
  kind: ModalMetricKind,
  x: (i: number) => number,
  scrub: number | null
): TemplateResult {
  const points = oldFirst
    .map((term, i) => ({ i, value: term.metrics[kind] }))
    .filter((p): p is { i: number; value: number } => typeof p.value === "number");
  if (points.length < 2) return html`<span class="bc-sheet-rate-note"></span>`;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  const half = Math.max(0.5, (max - min) / 2 + 0.1);
  const y = (value: number): number => H / 2 - ((value - mid) / half) * (H / 2 - 3);
  const dot = scrub == null ? undefined : points.find((p) => p.i === scrub);

  return html`<svg
    class="bc-sheet-spark"
    width=${W}
    height=${H}
    viewBox=${`0 0 ${W} ${H}`}
    aria-hidden="true"
  >
    <polyline
      class="bc-sheet-spark-line"
      points=${points.map((p) => `${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")}
    />
    ${dot
      ? svg`<circle class="bc-sheet-spark-dot" r="2.25" cx=${x(dot.i)} cy=${y(dot.value)} />`
      : ""}
  </svg>`;
}

// One term's answers, 1 to 6, as six small bars.
function distribution(
  ctx: SheetContext,
  label: string,
  counts: number[]
): TemplateResult {
  const max = Math.max(1, ...counts);
  const peek = (text: string | null): void => {
    if (ctx.local.peek === text) return;
    ctx.local.peek = text;
    ctx.rerender();
  };
  return html`<svg
    class="bc-sheet-dist"
    width=${W}
    height=${H}
    viewBox=${`0 0 ${W} ${H}`}
    role="img"
    aria-label=${`${label}: ${counts
      .map((count, i) => `${count} answered ${i + 1}`)
      .join(", ")}`}
  >
    ${[1, 2, 3, 4, 5, 6].map((k) => {
      const count = counts[k - 1] ?? 0;
      const height = count ? Math.max(2, (count / max) * (H - 2)) : 1;
      const left = (k - 1) * (BAR_W + BAR_GAP);
      return svg`<g
        class="bc-sheet-dist-k"
        @pointerenter=${() => peek(`${label}: ${count} answered ${k}`)}
        @pointerleave=${() => peek(null)}
      >
        <rect class="bc-sheet-dist-hit" x=${left} y="0" width=${BAR_W} height=${H} />
        <rect
          class=${`bc-sheet-dist-bar${count ? "" : " is-zero"}`}
          x=${left}
          y=${H - height}
          width=${BAR_W}
          height=${height}
          rx="1.5"
          style=${`fill: var(--bc-color-trend-zone-${k}-solid)`}
        />
      </g>`;
    })}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Hours per week
// ---------------------------------------------------------------------------

const HOUR_SHORT = ["3 or less", "4–7", "8–11", "12–15", "16–19", "20+"];

export function renderWorkload(ctx: SheetContext): TemplateResult | string {
  const { data, term } = ctx;
  let buckets = term ? term.hoursBuckets : data.aggregateHoursBuckets;
  let image: { label: string; url: string; alt: string } | null = null;
  let pending = false;

  if (term && buckets.length === 0) {
    const counts = countsFor(ctx, term, "hours");
    pending = counts.kind === "pending";
    if (counts.kind === "counts") {
      buckets = counts.counts.map((count, i) => ({
        label: HOUR_SHORT[i] ?? String(i + 1),
        count
      }));
    } else if (counts.kind === "image") {
      image = { label: "Hours per week", url: counts.url, alt: counts.alt };
    }
  }

  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  let body: TemplateResult | string;
  if (image) {
    body = originalCharts([image]);
  } else if (pending) {
    body = "";
  } else if (total === 0) {
    // All terms with nothing to add up: say nothing rather than draw zeros.
    if (!term) return "";
    body = html`<p class="bc-sheet-empty">
      No hours breakdown for ${termLabel(term.term)}
    </p>`;
  } else {
    const shares = buckets.map((bucket) => bucket.count / total);
    const max = Math.max(...shares) || 1;
    const labels =
      buckets.length === HOUR_SHORT.length
        ? HOUR_SHORT
        : buckets.map((bucket) => bucket.label);
    body = html`<div
      class="bc-sheet-hist"
      style=${`grid-template-columns: repeat(${buckets.length}, 1fr)`}
    >
      ${shares.map((share, i) => {
        const pct = Math.round(share * 100);
        return html`<div
          class="bc-sheet-hist-col"
          title=${`${plural(buckets[i]!.count, "response")}: ${buckets[i]!.label} hours`}
        >
          <span class="bc-sheet-hist-pct">${pct}%</span>
          <div class="bc-sheet-hist-track">
            <div
              class=${`bc-sheet-hist-bar${pct ? "" : " is-zero"}`}
              style=${`height: ${pct ? `${(share / max) * 100}%` : "1px"}`}
            ></div>
          </div>
          <span class="bc-sheet-hist-lab">${labels[i]}</span>
        </div>`;
      })}
    </div>`;
  }

  return html`<section class="bc-sheet-sec bc-sheet-work">
    <div class="bc-sheet-sec-head">
      <h3 class="bc-sheet-sec-title">Hours per week</h3>
      <span class="bc-sheet-sec-ctx">share of responses</span>
    </div>
    ${body}
  </section>`;
}
