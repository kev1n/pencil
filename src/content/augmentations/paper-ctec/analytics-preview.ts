import { renderSparkline } from "./chart-kit";
import { WIDGET_CLASS } from "./constants";
import {
  computeGlobalMean,
  type ModalDisplayData,
  type ModalTerm
} from "./modal-data";
import { renderHoursDensity, type HoursDensitySeries } from "./hours-density";
import { appendTrendZones, RATING_TREND_ZONES } from "./chart-zones";
import { abbrTerm } from "./term-format";

const PREVIEW_CLASS = `${WIDGET_CLASS}-preview`;
const TRIGGER_CLASS = `${WIDGET_CLASS}-preview-trigger`;

// Small chart over per-term Global means. Visually mirrors the modal's
// Trend card (smooth area + maroon polyline + value labels) but sized for
// the popup so two charts fit in ~320px wide.
function renderGlobalSplineTrend(
  doc: Document,
  trendTerms: ModalTerm[]
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = `${PREVIEW_CLASS}-trend`;

  const entries = trendTerms
    .map((term) => ({ value: computeGlobalMean([term]), term }))
    .filter((entry) => entry.value > 0);

  if (entries.length < 2) {
    const empty = doc.createElement("div");
    empty.className = `${PREVIEW_CLASS}-empty`;
    empty.textContent =
      entries.length === 1
        ? "Only one term on record — no trend to plot."
        : "No global rating available.";
    wrapper.append(empty);
    return wrapper;
  }

  const W = 460;
  const H = 130;
  const PL = 32;
  const PR = 12;
  const PT = 18;
  const PB = 28;

  const values = entries.map((entry) => entry.value);
  // Fixed 1–6 scale + colored zones — same rationale as the modal trend
  // chart (auto-scaling makes courses with very different absolute
  // ratings look identical at a glance).
  const yMin = 1;
  const yMax = 6;
  const range = yMax - yMin;
  const tickValues = [1, 2, 3, 4, 5, 6];
  const xAt = (i: number) =>
    PL + (i / Math.max(1, values.length - 1)) * (W - PL - PR);
  const yAt = (v: number) => H - PB - ((v - yMin) / range) * (H - PT - PB);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", `${PREVIEW_CLASS}-trend-svg`);

  appendTrendZones(doc, svg, RATING_TREND_ZONES, PL, W - PR, yAt);

  for (const yv of tickValues) {
    const line = doc.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(PL));
    line.setAttribute("x2", String(W - PR));
    line.setAttribute("y1", String(yAt(yv)));
    line.setAttribute("y2", String(yAt(yv)));
    line.style.stroke = "var(--bc-color-chart-trend-axis)";
    svg.append(line);

    const tick = doc.createElementNS(SVG_NS, "text");
    tick.setAttribute("x", String(PL - 4));
    tick.setAttribute("y", String(yAt(yv) + 3));
    tick.style.fill = "var(--bc-color-chart-trend-text)";
    tick.setAttribute("font-size", "9");
    tick.setAttribute("text-anchor", "end");
    tick.textContent = String(yv);
    svg.append(tick);
  }

  const points = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  renderSparkline(doc, svg, points, {
    strokeColor: "var(--bc-color-accent)",
    strokeWidth: 1.6,
    dotRadius: 2.6,
    dotStrokeWidth: 1.4
  });

  values.forEach((v, i) => {
    const termLabel = doc.createElementNS(SVG_NS, "text");
    termLabel.setAttribute("x", String(xAt(i)));
    termLabel.setAttribute("y", String(H - 10));
    termLabel.style.fill = "var(--bc-color-chart-trend-text-strong)";
    termLabel.setAttribute("font-size", "9");
    termLabel.setAttribute("text-anchor", "middle");
    termLabel.textContent = abbrTerm(entries[i]?.term.term ?? "");
    svg.append(termLabel);
  });

  wrapper.append(svg);
  return wrapper;
}

function buildHoursSeries(data: ModalDisplayData): HoursDensitySeries[] {
  const latestTerm = data.terms[0] ?? null;
  const latestHasBuckets = !!latestTerm && latestTerm.hoursBuckets.length > 0;
  const aggHasBuckets = data.aggregateHoursBuckets.length > 0;
  const showBoth =
    data.terms.length >= 2 && latestHasBuckets && aggHasBuckets && !!latestTerm;

  const series: HoursDensitySeries[] = [];
  if (showBoth && latestTerm) {
    const aggMean = data.metrics.hours.mean;
    series.push({
      label: aggMean > 0 ? `AVG ${aggMean.toFixed(1)}h` : "AVG",
      buckets: data.aggregateHoursBuckets,
      mean: aggMean > 0 ? aggMean : undefined,
      style: "secondary"
    });
    const latestMean = latestTerm.metrics.hours;
    const latestAbbr = abbrTerm(latestTerm.term) || "LATEST";
    series.push({
      label:
        typeof latestMean === "number"
          ? `${latestAbbr} ${latestMean.toFixed(1)}h`
          : latestAbbr,
      buckets: latestTerm.hoursBuckets,
      mean: latestMean,
      style: "primary"
    });
  } else if (aggHasBuckets) {
    const aggMean = data.metrics.hours.mean;
    series.push({
      label: aggMean > 0 ? `AVG ${aggMean.toFixed(1)}h` : "AVG",
      buckets: data.aggregateHoursBuckets,
      mean: aggMean > 0 ? aggMean : undefined,
      style: "primary"
    });
  }
  return series;
}

function buildPopupContent(
  doc: Document,
  data: ModalDisplayData | null
): HTMLElement {
  const inner = doc.createElement("div");
  inner.className = `${PREVIEW_CLASS}-inner`;

  if (!data) {
    const empty = doc.createElement("div");
    empty.className = `${PREVIEW_CLASS}-empty`;
    empty.textContent = "CTEC analytics not loaded yet.";
    inner.append(empty);
    return inner;
  }

  const trendSection = doc.createElement("div");
  trendSection.className = `${PREVIEW_CLASS}-section`;
  const trendHeader = doc.createElement("div");
  trendHeader.className = `${PREVIEW_CLASS}-section-title`;
  trendHeader.textContent = `Global trend · ${data.trendTerms.length} ${
    data.trendTerms.length === 1 ? "term" : "terms"
  }`;
  const methodology = doc.createElement("div");
  methodology.className = `${PREVIEW_CLASS}-methodology`;
  methodology.textContent =
    "GBL = average of Instruction, Course, and Learned mean ratings (each 0–6). Excludes Challenge and Interest (descriptive, not quality) and Hours (different scale).";
  trendSection.append(
    trendHeader,
    methodology,
    renderGlobalSplineTrend(doc, data.trendTerms)
  );
  inner.append(trendSection);

  const workloadSeries = buildHoursSeries(data);
  const workloadSection = doc.createElement("div");
  workloadSection.className = `${PREVIEW_CLASS}-section`;
  const workloadHeader = doc.createElement("div");
  workloadHeader.className = `${PREVIEW_CLASS}-section-title`;
  workloadHeader.textContent = "Workload distribution";
  workloadSection.append(workloadHeader);
  if (workloadSeries.length > 0) {
    workloadSection.append(renderHoursDensity(doc, workloadSeries));
  } else {
    const empty = doc.createElement("div");
    empty.className = `${PREVIEW_CLASS}-empty`;
    empty.textContent = "Hours distribution wasn't captured for these terms.";
    workloadSection.append(empty);
  }
  inner.append(workloadSection);

  return inner;
}

// Per-card preview controller. Owns the popup element + a refcount of
// active triggers (chips currently being hovered/focused). Lazy-builds the
// content the first time a chip is hovered so chips that never get hovered
// don't pay the build cost. Each renderWidget call hands in a fresh
// `getData` closure (captures the latest snapshot) and resets the build
// cache so the next hover reflects current data.
type PreviewController = {
  attachTrigger: (chip: HTMLElement) => void;
  refreshData: (getData: () => ModalDisplayData | null) => void;
  destroy: () => void;
};

function createPreviewController(card: HTMLElement): PreviewController {
  const doc = card.ownerDocument;
  let popup: HTMLElement | null = null;
  const active = new Set<HTMLElement>();
  let built = false;
  let dataSource: () => ModalDisplayData | null = () => null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelHide = () => {
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const ensurePopup = () => {
    if (popup) return popup;
    const el = doc.createElement("div");
    el.className = PREVIEW_CLASS;
    // Treat the popup itself as an active trigger so moving the mouse
    // from the chip onto the popup keeps it open. Without this, the
    // chip's mouseleave fires the moment the cursor crosses into the
    // popup and the user never gets to read the charts.
    el.addEventListener("mouseenter", () => {
      cancelHide();
      active.add(el);
      el.classList.add("is-visible");
    });
    el.addEventListener("mouseleave", () => {
      active.delete(el);
      scheduleHide();
    });
    popup = el;
    return el;
  };

  const buildIfNeeded = () => {
    if (built) return;
    const inner = buildPopupContent(doc, dataSource());
    ensurePopup().replaceChildren(inner);
    built = true;
  };

  const show = (chip: HTMLElement) => {
    cancelHide();
    active.add(chip);
    buildIfNeeded();
    const el = ensurePopup();
    if (el.parentElement !== card) card.appendChild(el);
    el.classList.add("is-visible");
  };

  // Defer hiding so the cursor can cross the gap between the chip and
  // popup without the popup snapping shut. The popup's own mouseenter
  // cancels the timer, keeping it open as long as the cursor lands.
  const scheduleHide = () => {
    if (active.size > 0 || !popup) return;
    cancelHide();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (active.size === 0 && popup) {
        popup.classList.remove("is-visible");
      }
    }, 200);
  };

  const hide = (chip: HTMLElement) => {
    active.delete(chip);
    scheduleHide();
  };

  const attachTrigger = (chip: HTMLElement) => {
    if (chip.dataset.bcPaperCtecPreviewBound === "1") return;
    chip.dataset.bcPaperCtecPreviewBound = "1";
    chip.classList.add(TRIGGER_CLASS);
    chip.removeAttribute("title");
    for (const el of Array.from(chip.querySelectorAll<HTMLElement>("[title]"))) {
      el.removeAttribute("title");
    }
    chip.addEventListener("mouseenter", () => show(chip));
    chip.addEventListener("mouseleave", () => hide(chip));
    chip.addEventListener("focus", () => show(chip));
    chip.addEventListener("blur", () => hide(chip));
  };

  const refreshData = (getData: () => ModalDisplayData | null) => {
    dataSource = getData;
    built = false;
  };

  const destroy = () => {
    popup?.remove();
    popup = null;
    active.clear();
    built = false;
  };

  return { attachTrigger, refreshData, destroy };
}

// Module-level WeakMap so each card has at most one preview controller
// alive at a time. renderWidget gets called repeatedly by the framework
// (every DOM mutation) — this lets it ask for "the controller for this
// card" without rebuilding listeners and popups on each tick.
const controllers = new WeakMap<HTMLElement, PreviewController>();

export function getOrCreatePreviewController(card: HTMLElement): PreviewController {
  const existing = controllers.get(card);
  if (existing) return existing;
  const fresh = createPreviewController(card);
  controllers.set(card, fresh);
  return fresh;
}

export function destroyPreviewController(card: HTMLElement): void {
  const existing = controllers.get(card);
  if (!existing) return;
  existing.destroy();
  controllers.delete(card);
}
