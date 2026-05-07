// Per-section expanded detail panel: header (section label · time · room),
// seat stats grid, class attributes / enrollment requirements / notes blocks,
// and a footer with relative timestamp + Refresh button.
//
// Pure render. The seats-notes parser produces the success shape used here;
// the caller owns the fetch / cache and passes the result + fetched-at + a
// retry callback. Loading and error states are rendered by their own
// exported helpers so the augmentation can swap them in without re-deriving
// the wrapping `<li>` shell.

import { createActionButton } from "../../../framework";
import { el } from "../../../framework/dom";
import type { SeatsNotesResult, SeatsNotesSuccess } from "../../seats-notes/types";

export type SectionDetailHeader = {
  /** "1-LEC" — section + component. */
  sectionLabel: string;
  /** "MoWeFr 11:00am – 11:50am". */
  daysTime: string;
  /** "Tech Lecture Room L168". */
  room: string;
};

// Re-exported under a friendlier alias so callers don't need to reach into
// seats-notes types — the section-detail view is the only consumer in
// class-search and treating `SectionDetailData = SeatsNotesResult` keeps a
// single source of truth for the shape.
export type SectionDetailData = SeatsNotesResult;

export type SectionDetailProps = {
  header: SectionDetailHeader;
  detail: SectionDetailData;
  fetchedAt: number;
  onRefresh(): void;
};

export function renderSectionDetail(
  doc: Document,
  props: SectionDetailProps
): HTMLElement {
  const wrap = el(doc, "div", { class: "bc-cs-detail" });
  wrap.appendChild(buildHeader(doc, props.header));

  if (!props.detail.ok) {
    wrap.appendChild(
      el(doc, "div", {
        class: "bc-cs-detail-error",
        text: props.detail.error ?? "Couldn't load CAESAR detail."
      })
    );
    // Error path keeps the bottom footer — there's no stats grid to attach
    // the refresh control to, so the retry button stays in its own row.
    wrap.appendChild(buildFooter(doc, props.fetchedAt, props.onRefresh));
    return wrap;
  }

  // Success path: refresh control + "loaded X ago" timestamp ride alongside
  // the seat-stats area instead of in a bottom footer, so the refresh
  // affordance sits next to the info it refreshes.
  wrap.appendChild(buildStatsSection(doc, props.detail, props.fetchedAt, props.onRefresh));

  appendDetailBlock(doc, wrap, "Class Attributes", props.detail.classAttributes);
  appendDetailBlock(doc, wrap, "Enrollment Requirements", props.detail.enrollmentRequirements);
  appendDetailBlock(doc, wrap, "Class Notes", props.detail.classNotes);

  if (props.detail.classCapacity === null && hasNoEnrichedFields(props.detail)) {
    wrap.appendChild(
      el(doc, "div", {
        class: "bc-cs-detail-note",
        text:
          "CAESAR did not return a detail panel for this section. Status from search-results page is shown above."
      })
    );
  }

  return wrap;
}

export function renderSectionDetailLoading(doc: Document): HTMLElement {
  return el(doc, "div", { class: "bc-cs-detail bc-cs-detail--loading" }, [
    el(doc, "div", { class: "bc-cs-detail-loading-row" }, [
      el(doc, "span", { class: "bc-cs-spinner" }),
      el(doc, "span", {
        class: "bc-cs-detail-loading-label",
        text: "Fetching seats and notes from CAESAR…"
      })
    ])
  ]);
}

export function renderSectionDetailError(
  doc: Document,
  err: unknown,
  retry: () => void
): HTMLElement {
  const text = err instanceof Error ? err.message : String(err);
  return el(doc, "div", { class: "bc-cs-detail" }, [
    el(doc, "div", { class: "bc-cs-detail-error", text }),
    buildFooter(doc, Date.now(), retry)
  ]);
}

// ── Internals ──────────────────────────────────────────────────────────────

function buildHeader(doc: Document, header: SectionDetailHeader): HTMLElement {
  const headerBits: string[] = [];
  if (header.sectionLabel) headerBits.push(`<strong>${escapeHtml(header.sectionLabel)}</strong>`);
  if (header.daysTime) headerBits.push(escapeHtml(header.daysTime));
  if (header.room) headerBits.push(escapeHtml(header.room));
  return el(doc, "div", {
    class: "bc-cs-detail-header",
    html: headerBits.join(" · ")
  });
}

function buildStatsGrid(doc: Document, detail: SeatsNotesSuccess): HTMLElement {
  const stats = el(doc, "div", { class: "bc-cs-detail-stats" });
  appendStat(doc, stats, "Capacity", detail.classCapacity);
  appendStat(doc, stats, "Enrolled", detail.enrollmentTotal);
  appendStat(doc, stats, "Open seats", detail.availableSeats);
  appendStat(doc, stats, "Wait cap", detail.waitListCapacity);
  appendStat(doc, stats, "Wait total", detail.waitListTotal);
  return stats;
}

// Wraps the seat-stats grid with a small toolbar above it carrying the
// "Refresh seats" action button + the relative-time stamp. Keeps the refresh
// affordance adjacent to the seat info it refreshes (no more bottom footer
// detached from the stats).
function buildStatsSection(
  doc: Document,
  detail: SeatsNotesSuccess,
  fetchedAt: number,
  onRefresh: () => void
): HTMLElement {
  const section = el(doc, "div", { class: "bc-cs-detail-stats-section" });

  const refresh = createActionButton({
    doc,
    label: "Refresh seats",
    loadingLabel: "Refreshing…",
    className: "bc-cs-detail-refresh",
    onClick: async () => {
      onRefresh();
    }
  });
  const stamp = el(doc, "span", {
    class: "bc-cs-detail-stamp",
    text: `Loaded ${formatRelativeTime(fetchedAt)}`,
    attrs: { title: new Date(fetchedAt).toLocaleString() }
  });
  section.appendChild(
    el(doc, "div", { class: "bc-cs-detail-stats-bar" }, [refresh.element, stamp])
  );

  const stats = buildStatsGrid(doc, detail);
  if (stats.children.length > 0) section.appendChild(stats);

  return section;
}

function buildFooter(
  doc: Document,
  fetchedAt: number,
  onRefresh: () => void
): HTMLElement {
  const stamp = el(doc, "span", {
    class: "bc-cs-detail-stamp",
    text: `Loaded ${formatRelativeTime(fetchedAt)}`,
    attrs: { title: new Date(fetchedAt).toLocaleString() }
  });

  // The detail controller swaps the entire detail row to its loading
  // shell as soon as onRefresh fires, so this button only needs the
  // synchronous-disable contract — once the controller re-renders, the
  // current button is gone.
  const refresh = createActionButton({
    doc,
    label: "Refresh",
    loadingLabel: "Refreshing…",
    className: "bc-cs-detail-refresh",
    onClick: async () => {
      onRefresh();
    }
  });

  return el(doc, "div", { class: "bc-cs-detail-footer" }, [stamp, refresh.element]);
}

function appendStat(
  doc: Document,
  parent: HTMLElement,
  label: string,
  value: string | null
): void {
  if (!value) return;
  parent.appendChild(
    el(doc, "div", { class: "bc-cs-stat" }, [
      el(doc, "div", { class: "bc-cs-stat-value", text: value }),
      el(doc, "div", { class: "bc-cs-stat-label", text: label })
    ])
  );
}

function appendDetailBlock(
  doc: Document,
  parent: HTMLElement,
  label: string,
  text: string | null
): void {
  if (!text) return;
  parent.appendChild(
    el(doc, "div", { class: "bc-cs-detail-block" }, [
      el(doc, "div", { class: "bc-cs-detail-block-label", text: label }),
      el(doc, "div", { class: "bc-cs-detail-block-body", text })
    ])
  );
}

function hasNoEnrichedFields(result: SeatsNotesSuccess): boolean {
  return (
    result.classCapacity === null &&
    result.enrollmentTotal === null &&
    result.availableSeats === null &&
    result.classAttributes === null &&
    result.enrollmentRequirements === null &&
    result.classNotes === null
  );
}

function formatRelativeTime(timestamp: number): string {
  const deltaSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (deltaSec < 5) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.round(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  const deltaDay = Math.round(deltaHr / 24);
  return `${deltaDay}d ago`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
