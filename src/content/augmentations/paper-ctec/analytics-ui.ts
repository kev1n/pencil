import type {
  CtecAggregateMetric,
  CtecCourseAnalytics,
  CtecCourseAnalyticsEntry
} from "../ctec-links/reports";
import type { CtecReportChart } from "../ctec-navigation/types";
import { PAPER_CTEC_CONFIG } from "./config";
import {
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_TABS_CLASS
} from "./constants";
import {
  formatRatingDetail,
  isRatingPercentMode,
  ratingPercentSignature
} from "./rating-format";
import { buildAnalyticsEntryKey } from "./identity";
import type { PaperCtecSideCardContext } from "./types";
import {
  createIcon,
  createRatingStars,
  guardNestedInteraction,
  preventAndStop,
  stopPropagation
} from "./ui-shared";

type SideCardAnalyticsRenderData = {
  selectedTab: "paper" | "analytics";
  selectedEntryId: string | null;
  recentTerms: number;
  snapshot: CtecCourseAnalytics | null;
  loading: boolean;
  expandedChartKeys: string[];
  commentQuery: string;
  authUrl?: string;
  awaitingAuthRetry?: boolean;
  errorMessage?: string;
  notFound: boolean;
  canLoadMoreTerms: boolean;
  loadMoreBatchSize: number;
  remainingTerms: number;
  parsedTermCount: number;
};

type AnalyticsMetricKind =
  | "instruction"
  | "course"
  | "learned"
  | "challenging"
  | "stimulating"
  | "hours";

export function renderSideCardAnalytics(
  context: PaperCtecSideCardContext,
  data: SideCardAnalyticsRenderData,
  onSelectTab: (tab: "paper" | "analytics") => void,
  onSelectTerm: (term: string) => void,
  onToggleChart: (chartKey: string) => void,
  onLogin: () => void,
  onLoadMoreTerms: () => void,
  onRefresh: () => void
): void {
  const header = ensureSideCardHeader(context.panel);
  const tabsRoot = ensureSideCardTabs(context.panel, header);
  const panelRoot = ensureSideCardAnalyticsPanel(context.panel, tabsRoot);

  renderSideCardTabs(tabsRoot, data.selectedTab, onSelectTab);
  applySideCardMode(context.panel, header, tabsRoot, panelRoot, data.selectedTab);

  const signature = buildSideCardAnalyticsSignature(data);
  if (panelRoot.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  panelRoot.replaceChildren();
  if (data.selectedTab !== "analytics") {
    panelRoot.dataset.bcPaperCtecSignature = signature;
    return;
  }

  const body = context.panel.ownerDocument.createElement("div");
  body.className = "bc-paper-ctec-analytics-body";

  const head = context.panel.ownerDocument.createElement("div");
  head.className = "bc-paper-ctec-analytics-head";

  const title = context.panel.ownerDocument.createElement("div");
  title.className = "bc-paper-ctec-analytics-title";
  title.textContent = "Better CAESAR CTEC Analytics";
  head.append(title);
  body.append(head);

  if (data.authUrl) {
    body.append(
      makeAnalyticsCallout(
        context.panel.ownerDocument,
        data.awaitingAuthRetry
          ? "Waiting for Northwestern login to resume the remaining CTEC history."
          : "Northwestern login is required to finish loading older CTEC terms.",
        "is-warn",
        data.authUrl,
        data.awaitingAuthRetry ? "Open again" : "Open login",
        onLogin
      )
    );
  } else if (data.errorMessage) {
    body.append(
      makeAnalyticsCallout(
        context.panel.ownerDocument,
        data.errorMessage,
        "is-warn"
      )
    );
  } else if (data.loading && !data.snapshot?.allFetched) {
    body.append(
      makeAnalyticsCallout(
        context.panel.ownerDocument,
        "Loading the remaining CTEC terms…",
        "is-muted"
      )
    );
  }

  if (!data.snapshot || data.parsedTermCount === 0) {
    if (data.notFound) {
      body.append(
        makeAnalyticsCallout(
          context.panel.ownerDocument,
          "No CTEC reports were found for this section.",
          "is-muted"
        )
      );
    } else if (!data.authUrl && !data.errorMessage) {
      // Nothing loaded yet → the load-more CTA is the primary action, so it
      // anchors at the top by itself.
      body.append(
        renderLoadMorePrompt(
          context.panel.ownerDocument,
          data,
          onLoadMoreTerms,
          /* hasParsed */ false
        )
      );
    }
    panelRoot.append(body);
    panelRoot.dataset.bcPaperCtecSignature = signature;
    return;
  }

  if (!data.authUrl && !data.errorMessage) {
    body.append(renderRefreshToolbar(context.panel.ownerDocument, data, onRefresh));
  }

  body.append(renderAnalyticsAggregate(context.panel.ownerDocument, data.snapshot));

  // Load-more lives inside renderSelectedTermAnalytics, anchored just above
  // the student comments so it stays reachable without scrolling past a wall
  // of comments.
  const loadMorePrompt =
    !data.authUrl && !data.errorMessage && (data.canLoadMoreTerms || data.loading)
      ? renderLoadMorePrompt(
          context.panel.ownerDocument,
          data,
          onLoadMoreTerms,
          /* hasParsed */ true
        )
      : null;

  body.append(
    renderSelectedTermAnalytics(
      context.panel.ownerDocument,
      data.snapshot,
      data.selectedEntryId,
      data.expandedChartKeys,
      data.commentQuery,
      onSelectTerm,
      onToggleChart,
      loadMorePrompt
    )
  );

  panelRoot.append(body);
  panelRoot.dataset.bcPaperCtecSignature = signature;
}

function renderRefreshToolbar(
  doc: Document,
  data: SideCardAnalyticsRenderData,
  onRefresh: () => void
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-analytics-refresh-toolbar";

  const row = doc.createElement("div");
  row.className = "bc-paper-ctec-analytics-refresh-row";

  const copy = doc.createElement("div");
  copy.className = "bc-paper-ctec-analytics-refresh-copy";
  copy.textContent = "Check for newly-published CTECs";
  row.append(copy);

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "bc-paper-ctec-analytics-refresh-btn";
  button.disabled = data.loading;
  button.title =
    "Re-fetch this course's CTEC list from Northwestern. Use this when newly-published evaluations should appear (CTECs from a recent term may not show until weeks after the term ends).";
  button.textContent = data.loading ? "Refreshing…" : "↻ Refresh";
  button.addEventListener("pointerdown", (event) => {
    if (button.disabled) return;
    preventAndStop(event);
    onRefresh();
  });
  button.addEventListener("click", preventAndStop);
  row.append(button);

  const explainer = doc.createElement("div");
  explainer.className = "bc-paper-ctec-analytics-refresh-explainer";
  explainer.textContent =
    "Refresh re-fetches this course's CTEC list to pick up newly-published evaluations (e.g. last term's reports that weren't out when you first loaded). Only re-checks this one course, not the whole subject.";

  wrapper.append(row, explainer);
  return wrapper;
}

function renderLoadMorePrompt(
  doc: Document,
  data: SideCardAnalyticsRenderData,
  onLoadMoreTerms: () => void,
  hasParsed: boolean
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-analytics-load-more";

  const copy = doc.createElement("div");
  copy.className = "bc-paper-ctec-analytics-load-more-copy";

  if (data.loading) {
    copy.textContent = hasParsed
      ? `Loading the next ${data.loadMoreBatchSize} CTEC term${data.loadMoreBatchSize === 1 ? "" : "s"}…`
      : `Loading the most recent ${data.loadMoreBatchSize} CTEC term${data.loadMoreBatchSize === 1 ? "" : "s"}…`;
  } else if (hasParsed) {
    copy.textContent = data.remainingTerms > 0
      ? `${data.remainingTerms} earlier term${data.remainingTerms === 1 ? "" : "s"} not yet loaded.`
      : "All available CTEC terms are loaded.";
  } else {
    copy.textContent = "CTEC term reports load on demand to keep traffic low.";
  }
  wrapper.append(copy);

  const showButton = !data.loading && (hasParsed ? data.canLoadMoreTerms : true);
  if (showButton) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "bc-paper-ctec-analytics-load-more-btn";
    const batchLabel = data.remainingTerms > 0
      ? Math.min(data.loadMoreBatchSize, data.remainingTerms)
      : data.loadMoreBatchSize;
    button.textContent = hasParsed
      ? `Load next ${batchLabel} term${batchLabel === 1 ? "" : "s"}`
      : `Load ${batchLabel} most recent term${batchLabel === 1 ? "" : "s"}`;
    button.addEventListener("pointerdown", (event) => {
      preventAndStop(event);
      onLoadMoreTerms();
    });
    button.addEventListener("click", preventAndStop);
    wrapper.append(button);
  }

  return wrapper;
}

function ensureSideCardHeader(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardHeader);
}

function ensureSideCardTabs(panel: HTMLElement, header: HTMLElement | null): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`.${SIDECARD_TABS_CLASS}`);
  if (existing) {
    insertAfter(panel, existing, header);
    return existing;
  }

  const tabsRoot = panel.ownerDocument.createElement("div");
  tabsRoot.className = SIDECARD_TABS_CLASS;
  tabsRoot.setAttribute("role", "tablist");

  insertAfter(panel, tabsRoot, header);
  return tabsRoot;
}

function ensureSideCardAnalyticsPanel(panel: HTMLElement, tabsRoot: HTMLElement): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`.${SIDECARD_ANALYTICS_PANEL_CLASS}`);
  if (existing) {
    insertAfter(panel, existing, tabsRoot);
    return existing;
  }

  const root = panel.ownerDocument.createElement("section");
  root.className = SIDECARD_ANALYTICS_PANEL_CLASS;
  insertAfter(panel, root, tabsRoot);
  return root;
}

function insertAfter(panel: HTMLElement, node: HTMLElement, reference: HTMLElement | null): void {
  if (!reference || reference.parentElement !== panel) {
    if (node.parentElement === panel && panel.firstElementChild === node) {
      return;
    }
    panel.prepend(node);
    return;
  }

  if (node.parentElement === panel && reference.nextSibling === node) {
    return;
  }

  panel.insertBefore(node, reference.nextSibling);
}

function buildSideCardAnalyticsSignature(data: SideCardAnalyticsRenderData): string {
  const snapshot = data.snapshot;
  const entrySignature = snapshot
    ? snapshot.entries
        .map((entry) => {
          const metrics = buildMetricSignature(entry);
          const charts = entry.charts.map((chart) => chart.imageUrl).join(",");
          const comments = entry.commentGroups
            .map((group) => `${group.prompt}:${group.comments.length}`)
            .join(",");
          return [
            entry.term,
            entry.status,
            entry.url ?? "",
            metrics,
            charts,
            comments
          ].join(":");
        })
        .join("|")
    : "";

  return [
    data.selectedTab,
    data.selectedEntryId ?? "",
    data.recentTerms,
    data.loading ? "1" : "0",
    data.expandedChartKeys.join(","),
    data.authUrl ?? "",
    data.awaitingAuthRetry ? "1" : "0",
    data.errorMessage ?? "",
    snapshot?.allFetched ? "1" : "0",
    snapshot?.recentAggregate.evaluationCount ?? 0,
    snapshot?.recentAggregate.aggregateEvaluationCount ?? 0,
    snapshot?.recentAggregate.windowTerms.join(",") ?? "",
    data.parsedTermCount,
    data.remainingTerms,
    data.canLoadMoreTerms ? "1" : "0",
    data.notFound ? "1" : "0",
    ratingPercentSignature(),
    entrySignature
  ].join("||");
}

function buildMetricSignature(entry: CtecCourseAnalyticsEntry): string {
  return [
    entry.metrics.instruction?.mean,
    entry.metrics.instruction?.responseCount,
    entry.metrics.course?.mean,
    entry.metrics.course?.responseCount,
    entry.metrics.learned?.mean,
    entry.metrics.learned?.responseCount,
    entry.metrics.challenging?.mean,
    entry.metrics.challenging?.responseCount,
    entry.metrics.stimulating?.mean,
    entry.metrics.stimulating?.responseCount,
    entry.metrics.hours?.mean,
    entry.metrics.hours?.responseCount
  ]
    .map((value) => value ?? "")
    .join(",");
}

function renderSideCardTabs(
  tabsRoot: HTMLElement,
  selectedTab: "paper" | "analytics",
  onSelectTab: (tab: "paper" | "analytics") => void
): void {
  if (tabsRoot.dataset.bcPaperCtecSelectedTab === selectedTab && tabsRoot.childElementCount === 2) {
    return;
  }

  tabsRoot.replaceChildren();

  const tabs: Array<{ key: "paper" | "analytics"; label: string }> = [
    { key: "paper", label: "Paper.nu" },
    { key: "analytics", label: "CTEC Analytics" }
  ];

  for (const tab of tabs) {
    const button = tabsRoot.ownerDocument.createElement("button");
    button.type = "button";
    button.className = `bc-paper-ctec-side-tab${tab.key === selectedTab ? " is-active" : ""}`;
    button.textContent = tab.label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", tab.key === selectedTab ? "true" : "false");
    const activateTab = (event: Event) => {
      preventAndStop(event);
      onSelectTab(tab.key);
    };
    button.addEventListener("pointerdown", activateTab);
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      activateTab(event);
    });
    button.addEventListener("click", preventAndStop);
    tabsRoot.append(button);
  }

  tabsRoot.dataset.bcPaperCtecSelectedTab = selectedTab;
}

function applySideCardMode(
  panel: HTMLElement,
  header: HTMLElement | null,
  tabsRoot: HTMLElement,
  analyticsRoot: HTMLElement,
  selectedTab: "paper" | "analytics"
): void {
  analyticsRoot.hidden = selectedTab !== "analytics";

  for (const child of Array.from(panel.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === header || child === tabsRoot || child === analyticsRoot) continue;

    const shouldHide = selectedTab === "analytics";
    if (child.hidden !== shouldHide) {
      child.hidden = shouldHide;
    }
  }
}

function makeAnalyticsCallout(
  doc: Document,
  message: string,
  tone: "is-warn" | "is-muted",
  href?: string,
  actionLabel?: string,
  onAction?: () => void
): HTMLElement {
  const callout = doc.createElement("div");
  callout.className = `bc-paper-ctec-analytics-callout ${tone}`;

  const copy = doc.createElement("div");
  copy.textContent = message;
  callout.append(copy);

  if (href && actionLabel) {
    const action = doc.createElement("a");
    action.href = href;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = actionLabel;
    action.addEventListener("click", (event) => {
      stopPropagation(event);
      onAction?.();
    });
    callout.append(action);
  }

  return callout;
}

function renderAnalyticsAggregate(doc: Document, snapshot: CtecCourseAnalytics): HTMLElement {
  const section = doc.createElement("section");
  const terms = snapshot.recentAggregate.windowTerms;

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-section-title";
  title.textContent = terms.length > 0 ? `AGGREGATE (${terms.join(", ")})` : "AGGREGATE";
  section.append(title);

  const teachingCards = [
    analyticsAggregateScalarCard(doc, "Instruction", snapshot.recentAggregate.metrics.instruction),
    analyticsAggregateScalarCard(doc, "Course", snapshot.recentAggregate.metrics.course)
  ].filter((card): card is HTMLElement => !!card);

  const learningCards = [
    analyticsAggregateScalarCard(doc, "Learned", snapshot.recentAggregate.metrics.learned),
    analyticsAggregateScalarCard(doc, "Challenge", snapshot.recentAggregate.metrics.challenging),
    analyticsAggregateScalarCard(doc, "Interest", snapshot.recentAggregate.metrics.stimulating)
  ].filter((card): card is HTMLElement => !!card);

  const hoursCard = analyticsAggregateHoursCard(doc, snapshot.recentAggregate.metrics.hours);

  if (teachingCards.length === 0 && learningCards.length === 0 && !hoursCard) {
    section.append(
      makeAnalyticsCallout(
        doc,
        "No parsed summary metrics are available yet for the recent CTEC window.",
        "is-muted"
      )
    );
    return section;
  }

  if (teachingCards.length > 0) {
    section.append(renderMetricGroup(doc, "Teaching", teachingCards));
  }
  if (learningCards.length > 0) {
    section.append(renderMetricGroup(doc, "Learning", learningCards));
  }
  if (hoursCard) {
    section.append(renderMetricGroup(doc, "Workload", [hoursCard]));
  }
  return section;
}

function analyticsAggregateScalarCard(
  doc: Document,
  label: string,
  metric?: CtecAggregateMetric
): HTMLElement | null {
  if (!metric) return null;

  return createScalarMetricCard(
    doc,
    label,
    metric.mean,
    `${label} ${formatRatingDetail(metric.mean)} across ${metric.evaluationCount} recent term${
      metric.evaluationCount === 1 ? "" : "s"
    }.`
  );
}

function analyticsAggregateHoursCard(
  doc: Document,
  metric?: CtecAggregateMetric
): HTMLElement | null {
  if (!metric) return null;
  return createHoursMetricCard(
    doc,
    "Hours / week",
    metric.mean,
    `${metric.mean.toFixed(1)} average hours per week across ${metric.evaluationCount} recent term${
      metric.evaluationCount === 1 ? "" : "s"
    }.`
  );
}

function renderSelectedTermAnalytics(
  doc: Document,
  snapshot: CtecCourseAnalytics,
  selectedEntryId: string | null,
  expandedChartKeys: string[],
  commentQuery: string,
  onSelectTerm: (entryId: string) => void,
  onToggleChart: (chartKey: string) => void,
  loadMorePrompt: HTMLElement | null
): HTMLElement {
  const section = doc.createElement("section");

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-section-title";
  title.textContent = "SELECTED TERM";
  section.append(title);

  // Only entries with parsed reports show in the picker. "pending" entries
  // exist in the index but haven't been fetched yet — they appear once the
  // user clicks "Load next N terms".
  const pickerEntries = snapshot.entries.filter((entry) => entry.status !== "pending");
  if (pickerEntries.length === 0) {
    section.append(
      makeAnalyticsCallout(
        doc,
        "No term-level CTEC records are loaded yet.",
        "is-muted"
      )
    );
    if (loadMorePrompt) section.append(loadMorePrompt);
    return section;
  }

  const selectedEntry = pickerEntries.find(
    (entry) => buildAnalyticsEntryKey(entry) === selectedEntryId
  ) ?? pickerEntries[0]!;

  const toolbar = doc.createElement("div");
  toolbar.className = "bc-paper-ctec-analytics-term-toolbar";

  const selector = doc.createElement("div");
  selector.className = "bc-paper-ctec-analytics-term-selector";

  const selectorLabel = doc.createElement("label");
  selectorLabel.textContent = "Term";

  const select = doc.createElement("select");
  select.className = "bc-paper-ctec-analytics-term-select";
  select.title = "Switch the currently displayed CTEC term.";
  guardNestedInteraction(select);

  for (const entry of pickerEntries) {
    const option = doc.createElement("option");
    option.value = buildAnalyticsEntryKey(entry);
    option.textContent = buildTermSelectorLabel(entry);
    option.selected = buildAnalyticsEntryKey(entry) === buildAnalyticsEntryKey(selectedEntry);
    select.append(option);
  }

  select.onchange = (event) => {
    stopPropagation(event);
    onSelectTerm(select.value);
  };

  selector.append(selectorLabel, select);
  toolbar.append(selector);
  section.append(toolbar);

  const summary = doc.createElement("div");
  summary.className = "bc-paper-ctec-analytics-term-summary";

  const summaryText = doc.createElement("div");
  const summaryTitle = doc.createElement("div");
  summaryTitle.className = "bc-paper-ctec-analytics-term-title";
  summaryTitle.textContent = selectedEntry.term;
  summaryText.append(summaryTitle);

  const summaryMeta = doc.createElement("div");
  summaryMeta.className = "bc-paper-ctec-analytics-term-meta";
  summaryMeta.textContent = buildTermMeta(selectedEntry);
  summaryText.append(summaryMeta);

  summary.append(summaryText);

  if (selectedEntry.url) {
    const link = doc.createElement("a");
    link.className = "bc-paper-ctec-analytics-term-link";
    link.href = selectedEntry.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open report";
    link.addEventListener("click", stopPropagation);
    summary.append(link);
  }

  section.append(summary);

  if (selectedEntry.status === "pending") {
    const note = doc.createElement("div");
    note.className = "bc-paper-ctec-analytics-state-note";
    note.textContent = "Full details for this term are still loading.";
    section.append(note);
    if (loadMorePrompt) section.append(loadMorePrompt);
    return section;
  }

  if (selectedEntry.status === "unavailable") {
    const note = doc.createElement("div");
    note.className = "bc-paper-ctec-analytics-state-note";
    note.textContent = "No parsed CTEC details were available for this term.";
    section.append(note);
    if (loadMorePrompt) section.append(loadMorePrompt);
    return section;
  }

  const metricGrid = renderTermMetricGrid(
    doc,
    selectedEntry,
    new Set(expandedChartKeys),
    onToggleChart
  );
  if (metricGrid) {
    section.append(metricGrid);
  }

  if (!hasTermMetrics(selectedEntry) && selectedEntry.charts.length === 0 && selectedEntry.commentGroups.length === 0) {
    const note = doc.createElement("div");
    note.className = "bc-paper-ctec-analytics-state-note";
    note.textContent = "No parsed CTEC details were available for this term.";
    section.append(note);
    if (loadMorePrompt) section.append(loadMorePrompt);
    return section;
  }

  // Anchor the load-more prompt directly above the comments block so the
  // user can reach it without scrolling past potentially hundreds of student
  // comments. Falls through to end-of-section when no comments exist.
  if (loadMorePrompt) section.append(loadMorePrompt);

  if (selectedEntry.commentGroups.length > 0) {
    section.append(renderTermComments(doc, selectedEntry, commentQuery));
  }

  return section;
}

function buildTermSelectorLabel(entry: CtecCourseAnalyticsEntry): string {
  return entry.instructor ? `${entry.term} · ${entry.instructor}` : entry.term;
}

function buildTermMeta(entry: CtecCourseAnalyticsEntry): string {
  const parts = [entry.description];
  if (entry.instructor) parts.push(entry.instructor);
  return parts.filter(Boolean).join(" · ");
}

function renderTermMetricGrid(
  doc: Document,
  entry: CtecCourseAnalyticsEntry,
  expandedChartKeys: Set<string>,
  onToggleChart: (chartKey: string) => void
): HTMLElement | null {
  const teachingCards = [
    analyticsTermScalarCard(doc, entry, "instruction", "Instruction", entry.metrics.instruction, expandedChartKeys, onToggleChart),
    analyticsTermScalarCard(doc, entry, "course", "Course", entry.metrics.course, expandedChartKeys, onToggleChart)
  ].filter((card): card is HTMLElement => !!card);

  const learningCards = [
    analyticsTermScalarCard(doc, entry, "learned", "Learned", entry.metrics.learned, expandedChartKeys, onToggleChart),
    analyticsTermScalarCard(doc, entry, "challenging", "Challenge", entry.metrics.challenging, expandedChartKeys, onToggleChart),
    analyticsTermScalarCard(doc, entry, "stimulating", "Interest", entry.metrics.stimulating, expandedChartKeys, onToggleChart)
  ].filter((card): card is HTMLElement => !!card);

  const hoursCard = analyticsTermHoursCard(
    doc,
    entry,
    entry.metrics.hours,
    expandedChartKeys,
    onToggleChart
  );

  if (teachingCards.length === 0 && learningCards.length === 0 && !hoursCard) {
    return null;
  }

  const wrapper = doc.createElement("div");
  if (teachingCards.length > 0) {
    wrapper.append(renderSelectedMetricGroup(doc, "Teaching", teachingCards));
  }
  if (learningCards.length > 0) {
    wrapper.append(renderSelectedMetricGroup(doc, "Learning", learningCards));
  }
  if (hoursCard) {
    wrapper.append(renderSelectedMetricGroup(doc, "Workload", [hoursCard]));
  }
  return wrapper;
}

function analyticsTermScalarCard(
  doc: Document,
  entry: CtecCourseAnalyticsEntry,
  kind: AnalyticsMetricKind,
  label: string,
  metric: { mean: number; responseCount: number } | undefined,
  expandedChartKeys: Set<string>,
  onToggleChart: (chartKey: string) => void
): HTMLElement | null {
  if (!metric) return null;

  const chart = findMetricChart(entry, kind);
  const chartKey = buildExpandedChartKey(entry, kind);
  const action = chart
    ? createMetricChartButton(doc, expandedChartKeys.has(chartKey), () => onToggleChart(chartKey))
    : undefined;

  const card = createScalarMetricCard(
    doc,
    label,
    metric.mean,
    `${label} ${formatRatingDetail(metric.mean)} in this term.`,
    action
  );

  if (chart && expandedChartKeys.has(chartKey)) {
    card.append(renderInlineChart(doc, chart));
  }

  return card;
}

function analyticsTermHoursCard(
  doc: Document,
  entry: CtecCourseAnalyticsEntry,
  metric: { mean: number; responseCount: number } | undefined,
  expandedChartKeys: Set<string>,
  onToggleChart: (chartKey: string) => void
): HTMLElement | null {
  if (!metric) return null;

  const chart = findMetricChart(entry, "hours");
  const chartKey = buildExpandedChartKey(entry, "hours");
  const action = chart
    ? createMetricChartButton(doc, expandedChartKeys.has(chartKey), () => onToggleChart(chartKey))
    : undefined;

  const card = createHoursMetricCard(
    doc,
    "Hours / week",
    metric.mean,
    `${metric.mean.toFixed(1)} average hours per week in this term.`,
    action
  );

  if (chart && expandedChartKeys.has(chartKey)) {
    card.append(renderInlineChart(doc, chart));
  }

  return card;
}

function renderMetricGroup(doc: Document, titleText: string, cards: HTMLElement[]): HTMLElement {
  const group = doc.createElement("section");
  group.className = "bc-paper-ctec-analytics-group";

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-group-title";
  title.textContent = titleText;

  const grid = doc.createElement("div");
  grid.className = "bc-paper-ctec-analytics-grid";
  cards.forEach((card) => grid.append(card));

  group.append(title, grid);
  return group;
}

function renderSelectedMetricGroup(doc: Document, titleText: string, cards: HTMLElement[]): HTMLElement {
  const group = doc.createElement("section");
  group.className = "bc-paper-ctec-analytics-group";

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-group-title";
  title.textContent = titleText;

  const stack = doc.createElement("div");
  stack.className = "bc-paper-ctec-analytics-metric-stack";
  cards.forEach((card) => stack.append(card));

  group.append(title, stack);
  return group;
}

function createScalarMetricCard(
  doc: Document,
  label: string,
  mean: number,
  tooltip: string,
  action?: HTMLElement
): HTMLElement {
  const card = doc.createElement("div");
  card.className = action ? "bc-paper-ctec-analytics-metric-card" : "bc-paper-ctec-analytics-card";
  card.title = tooltip;

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-card-label";
  title.textContent = label;

  if (action) {
    const top = doc.createElement("div");
    top.className = "bc-paper-ctec-analytics-metric-card-top";
    top.append(title, action);
    card.append(top);
  } else {
    card.append(title);
  }

  const percentMode = isRatingPercentMode();

  const rating = doc.createElement("div");
  rating.className = "bc-paper-ctec-analytics-card-rating";
  if (!percentMode) {
    rating.append(createRatingStars(doc, mean));
  }

  const value = doc.createElement("div");
  value.className = "bc-paper-ctec-analytics-card-value";
  value.textContent = formatRatingDetail(mean);
  rating.append(value);

  card.append(rating);
  return card;
}

function createHoursMetricCard(
  doc: Document,
  label: string,
  mean: number,
  tooltip: string,
  action?: HTMLElement
): HTMLElement {
  const card = doc.createElement("div");
  card.className = action ? "bc-paper-ctec-analytics-metric-card" : "bc-paper-ctec-analytics-card";
  card.title = tooltip;

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-card-label";
  title.textContent = label;

  if (action) {
    const top = doc.createElement("div");
    top.className = "bc-paper-ctec-analytics-metric-card-top";
    top.append(title, action);
    card.append(top);
  } else {
    card.append(title);
  }

  const value = doc.createElement("div");
  value.className = "bc-paper-ctec-analytics-card-hours";
  value.textContent = `${mean.toFixed(1)} h`;

  const track = doc.createElement("div");
  track.className = "bc-paper-ctec-hours-track";

  const fill = doc.createElement("div");
  fill.className = "bc-paper-ctec-hours-fill";
  fill.style.width = `${Math.max(0, Math.min(100, (mean / PAPER_CTEC_CONFIG.aggregate.hoursGraphMax) * 100))}%`;
  track.append(fill);

  const meta = doc.createElement("div");
  meta.className = "bc-paper-ctec-hours-meta";
  const minLabel = doc.createElement("span");
  minLabel.textContent = "0h";
  const maxLabel = doc.createElement("span");
  maxLabel.textContent = `${PAPER_CTEC_CONFIG.aggregate.hoursGraphMax}h+`;
  meta.append(minLabel, maxLabel);

  card.append(value, track, meta);
  return card;
}

function buildExpandedChartKey(entry: CtecCourseAnalyticsEntry, kind: AnalyticsMetricKind): string {
  return `${buildAnalyticsEntryKey(entry)}::${kind}`;
}

function findMetricChart(
  entry: CtecCourseAnalyticsEntry,
  kind: AnalyticsMetricKind
): CtecReportChart | undefined {
  return entry.charts.find((chart) => classifyChartQuestion(chart.question) === kind);
}

function classifyChartQuestion(question: string): AnalyticsMetricKind | null {
  const normalized = question.toLowerCase();
  if (normalized.includes("overall rating of the instruction")) return "instruction";
  if (normalized.includes("overall rating of the course")) return "course";
  if (normalized.includes("estimate how much you learned")) return "learned";
  if (normalized.includes("challenging you intellectually")) return "challenging";
  if (normalized.includes("stimulating your interest in the subject")) return "stimulating";
  if (normalized.includes("average number of hours per week")) return "hours";
  return null;
}

function createMetricChartButton(
  doc: Document,
  expanded: boolean,
  onToggle: () => void
): HTMLElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "bc-paper-ctec-analytics-metric-chart-btn";
  button.title = expanded ? "Hide chart" : "Show chart";
  button.setAttribute("aria-label", expanded ? "Hide chart" : "Show chart");
  button.append(createIcon("chart"));
  button.addEventListener("pointerdown", (event) => {
    preventAndStop(event);
    onToggle();
  });
  button.addEventListener("click", preventAndStop);
  return button;
}

function renderInlineChart(doc: Document, chart: CtecReportChart): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-analytics-inline-chart";

  const head = doc.createElement("div");
  head.className = "bc-paper-ctec-analytics-inline-chart-head";

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-chart-title";
  title.textContent = chart.question;

  head.append(title);

  const image = doc.createElement("img");
  image.className = "bc-paper-ctec-analytics-chart-image";
  image.src = chart.imageUrl;
  image.alt = chart.alt || chart.question;
  image.loading = "lazy";

  wrapper.append(head, image);
  return wrapper;
}

function renderTermComments(
  doc: Document,
  entry: CtecCourseAnalyticsEntry,
  initialQuery: string
): HTMLElement {
  const section = doc.createElement("section");

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-section-title";
  title.textContent = "Student Comments";
  section.append(title);

  const toolbar = doc.createElement("div");
  toolbar.className = "bc-paper-ctec-analytics-comments-toolbar";

  const input = doc.createElement("input");
  input.type = "search";
  input.className = "bc-paper-ctec-analytics-comments-search";
  input.placeholder = "Search student comments";
  input.value = initialQuery;
  input.dataset.bcPaperCtecCommentSearch = "1";
  guardNestedInteraction(input);

  const count = doc.createElement("div");
  count.className = "bc-paper-ctec-analytics-comments-count";

  const groups = doc.createElement("div");
  groups.className = "bc-paper-ctec-analytics-comments";

  const renderComments = (query: string) => {
    groups.replaceChildren();

    const filteredGroups = filterCommentGroups(entry.commentGroups, query);
    const totalMatches = filteredGroups.reduce((sum, group) => sum + group.comments.length, 0);
    count.textContent = query.trim()
      ? `${totalMatches} match${totalMatches === 1 ? "" : "es"}`
      : `${entry.commentGroups.reduce((sum, group) => sum + group.comments.length, 0)} comments`;

    if (filteredGroups.length === 0) {
      const empty = doc.createElement("div");
      empty.className = "bc-paper-ctec-analytics-state-note";
      empty.textContent = "No comments matched that search.";
      groups.append(empty);
      return;
    }

    for (const group of filteredGroups) {
      const wrapper = doc.createElement("div");
      wrapper.className = "bc-paper-ctec-analytics-comment-group";

      const prompt = doc.createElement("div");
      prompt.className = "bc-paper-ctec-analytics-comment-prompt";
      prompt.textContent = group.prompt;
      wrapper.append(prompt);

      const list = doc.createElement("div");
      list.className = "bc-paper-ctec-analytics-comment-list";

      for (const comment of group.comments) {
        const card = doc.createElement("div");
        card.className = "bc-paper-ctec-analytics-comment-card";
        appendHighlightedComment(card, comment, query);
        list.append(card);
      }

      wrapper.append(list);
      groups.append(wrapper);
    }
  };

  input.addEventListener("input", () => {
    renderComments(input.value);
  });

  toolbar.append(input, count);
  section.append(toolbar, groups);
  renderComments(initialQuery);
  return section;
}

function filterCommentGroups(
  groups: CtecCourseAnalyticsEntry["commentGroups"],
  query: string
): CtecCourseAnalyticsEntry["commentGroups"] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return groups;

  return groups
    .map((group) => ({
      ...group,
      comments: group.comments.filter((comment) =>
        comment.toLowerCase().includes(normalizedQuery)
      )
    }))
    .filter((group) => group.comments.length > 0);
}

function appendHighlightedComment(container: HTMLElement, text: string, query: string): void {
  container.replaceChildren();

  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (index > 0) container.append(container.ownerDocument.createElement("br"));
    appendHighlightedInline(container, lines[index] ?? "", query);
  }
}

function appendHighlightedInline(container: HTMLElement, text: string, query: string): void {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    container.append(text);
    return;
  }

  const haystack = text.toLowerCase();
  let start = 0;

  while (start < text.length) {
    const matchIndex = haystack.indexOf(normalizedQuery, start);
    if (matchIndex < 0) {
      container.append(text.slice(start));
      return;
    }

    if (matchIndex > start) {
      container.append(text.slice(start, matchIndex));
    }

    const mark = container.ownerDocument.createElement("mark");
    mark.className = "bc-paper-ctec-comment-highlight";
    mark.textContent = text.slice(matchIndex, matchIndex + normalizedQuery.length);
    container.append(mark);
    start = matchIndex + normalizedQuery.length;
  }
}

function hasTermMetrics(entry: CtecCourseAnalyticsEntry): boolean {
  return Object.values(entry.metrics).some((metric) => !!metric);
}
