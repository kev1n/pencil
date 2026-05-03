import { renderMetricDistribution } from "../dist-render";
import { renderHoursDensity } from "../hours-density";
import {
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { stopPropagation } from "../ui-shared";
import { pickSelectedTerm, renderCard } from "./common";
import type { AnalyticsModalCallbacks, AnalyticsModalState } from "./types";

// Terms tab. Term selector dropdown above a single drill-in card whose body
// is a grid of per-metric blocks. Each block packs label + value + delta +
// distribution chart into one unit, so the number and the chart it summarizes
// are side-by-side instead of split across two parallel cards.
export function renderTerms(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const root = doc.createElement("div");
  root.className = "bc-paper-ctec-modal-terms";

  const selectedTerm = pickSelectedTerm(data, state.selectedTermId);
  root.append(renderTermPicker(doc, data, selectedTerm, callbacks));
  if (!selectedTerm) return root;

  const drillCard = renderCard(
    doc,
    selectedTerm.term,
    `${selectedTerm.instructor} · ${selectedTerm.responses} responded`,
    selectedTerm.reportUrl
      ? { label: "↗ Report", href: selectedTerm.reportUrl }
      : undefined
  );
  drillCard.body.append(renderTermMetricBlocks(doc, data, selectedTerm));
  root.append(drillCard.root);

  return root;
}

// <select> picker over the loaded terms, since the heatmap (which used to
// double as the picker) moved to the Overview Global view. Pickers fire
// onTermChange so other tabs see the updated selection.
function renderTermPicker(
  doc: Document,
  data: ModalDisplayData,
  selectedTerm: ModalTerm | null,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-analytics-term-toolbar";

  const selectorWrap = doc.createElement("div");
  selectorWrap.className = "bc-paper-ctec-analytics-term-selector";

  const label = doc.createElement("label");
  label.textContent = "Term";
  selectorWrap.append(label);

  const select = doc.createElement("select");
  select.className = "bc-paper-ctec-analytics-term-select";
  for (const term of data.terms) {
    const option = doc.createElement("option");
    option.value = term.id;
    option.textContent = `${term.term} · ${term.instructor} · ${term.responses} responded`;
    if (selectedTerm?.id === term.id) option.selected = true;
    select.append(option);
  }
  select.addEventListener("click", stopPropagation);
  select.addEventListener("change", () => {
    callbacks.onTermChange(select.value);
  });
  selectorWrap.append(select);
  wrapper.append(selectorWrap);

  return wrapper;
}

// One block per metric: header (label + value + vs-other-terms delta) over
// the distribution chart. Replaces the previous split where numbers and
// charts lived in two adjacent cards.
function renderTermMetricBlocks(
  doc: Document,
  data: ModalDisplayData,
  term: ModalTerm
): HTMLElement {
  const grid = doc.createElement("div");
  grid.className = "bc-paper-ctec-modal-term-blocks";

  const peers = data.terms.filter((t) => t.id !== term.id);
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as ModalMetricKind[]) {
    grid.append(renderTermMetricBlock(doc, term, peers, kind));
  }
  return grid;
}

function renderTermMetricBlock(
  doc: Document,
  term: ModalTerm,
  peers: ModalTerm[],
  kind: ModalMetricKind
): HTMLElement {
  const block = doc.createElement("div");
  block.className = "bc-paper-ctec-modal-term-block";

  const head = doc.createElement("div");
  head.className = "bc-paper-ctec-modal-term-block-head";

  const label = doc.createElement("div");
  label.className = "bc-paper-ctec-modal-term-block-label";
  label.textContent = MODAL_METRIC_LABELS[kind];
  head.append(label);

  const value = term.metrics[kind];
  const valueEl = doc.createElement("div");
  valueEl.className = "bc-paper-ctec-modal-term-block-value";
  if (typeof value === "number") {
    const big = doc.createElement("span");
    big.className = "bc-paper-ctec-modal-term-block-value-num";
    big.textContent = value.toFixed(1);
    const unit = doc.createElement("span");
    unit.className = "bc-paper-ctec-modal-term-block-unit";
    unit.textContent = kind === "hours" ? "h" : "/6";
    valueEl.append(big, unit);
  } else {
    valueEl.textContent = "—";
  }
  head.append(valueEl);

  head.append(renderDelta(doc, value, peers, kind));
  block.append(head);

  const body = doc.createElement("div");
  body.className = "bc-paper-ctec-modal-term-block-chart";
  body.append(
    renderMetricDistribution({
      doc,
      term,
      metric: kind,
      altLabel: `${MODAL_METRIC_LABELS[kind]} chart for ${term.term}`,
      className: "bc-paper-ctec-modal-term-chart-image",
      renderHoursBuckets: (t) =>
        renderHoursDensity(doc, [
          {
            label:
              typeof t.metrics.hours === "number"
                ? `AVG ${t.metrics.hours.toFixed(1)}h`
                : "AVG",
            buckets: t.hoursBuckets,
            mean: t.metrics.hours,
            style: "primary"
          }
        ])
    })
  );
  block.append(body);

  return block;
}

function renderDelta(
  doc: Document,
  value: number | undefined,
  peers: ModalTerm[],
  kind: ModalMetricKind
): HTMLElement {
  const delta = doc.createElement("div");
  delta.className = "bc-paper-ctec-modal-term-block-delta";

  const peerValues = peers
    .map((peer) => peer.metrics[kind])
    .filter((entry): entry is number => typeof entry === "number");
  const peerMean = peerValues.length
    ? peerValues.reduce((sum, v) => sum + v, 0) / peerValues.length
    : null;

  if (peerMean == null || typeof value !== "number") {
    delta.textContent = "only term";
    delta.classList.add("is-muted");
    return delta;
  }

  const d = value - peerMean;
  const positive = kind === "hours" ? d <= 0 : d >= 0;
  if (Math.abs(d) < 0.05) {
    delta.textContent = "— vs other terms";
    delta.classList.add("is-muted");
    return delta;
  }
  delta.classList.add(positive ? "is-positive" : "is-negative");
  const arrow = positive ? "▲" : "▼";
  const note = doc.createElement("span");
  note.className = "bc-paper-ctec-modal-term-block-delta-note";
  note.textContent = " vs other terms";
  delta.append(
    doc.createTextNode(`${arrow} ${Math.abs(d).toFixed(1)}`),
    note
  );
  return delta;
}
