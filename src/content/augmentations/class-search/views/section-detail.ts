// Per-section expanded detail panel: seat stats grid, class attributes /
// enrollment requirements / notes blocks, and a footer with relative
// timestamp + Refresh button.
//
// The duplicate "section · time · room" header that used to live at the
// top was dropped — the section row already shows that info one line up,
// and re-rendering it inside the detail panel was visual noise.
//
// Pure render. The seats-notes parser produces the success shape used here;
// the caller owns the fetch / cache and passes the result + fetched-at + a
// retry callback. Loading and error states are rendered by their own
// exported helpers so the augmentation can swap them in without re-deriving
// the wrapping `<li>` shell.

import { createActionButton } from "../../../framework";
import { uiIcon } from "../../../design/ui-icons";
import { el } from "../../../framework/dom";
import type { PerSectionSeats } from "../../seats-notes/combined-section";
import type { SeatsNotesResult, SeatsNotesSuccess } from "../../seats-notes/types";

// Re-exported under a friendlier alias so callers don't need to reach into
// seats-notes types — the section-detail view is the only consumer in
// class-search and treating `SectionDetailData = SeatsNotesResult` keeps a
// single source of truth for the shape.
export type SectionDetailData = SeatsNotesResult;

export type SectionDetailProps = {
  detail: SectionDetailData;
  fetchedAt: number;
  onRefresh(): void;
  // Resolved per-section seats for combined sections. Omitted / null on
  // initial paint (resolver hasn't returned yet) and for non-combined
  // sections. When present, the disclaimer is replaced with the real
  // per-section stats.
  perSection?: PerSectionSeats | null;
};

export function renderSectionDetail(
  doc: Document,
  props: SectionDetailProps
): HTMLElement {
  const wrap = el(doc, "div", { class: "bc-cs-detail" });

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

  if (props.detail.isCombinedSection) {
    if (props.perSection) {
      wrap.appendChild(buildPerSectionBlock(doc, props.detail, props.perSection));
    } else {
      const capacity = props.detail.classCapacity?.trim();
      const message = capacity
        ? `Many of these ${capacity} seats may be allocated for another section.`
        : "Many of these seats may be allocated for another section.";
      wrap.appendChild(
        el(doc, "div", { class: "bc-cs-detail-combined-warning" }, [
          el(doc, "span", { class: "bc-cs-detail-combined-warning-icon" }, [
            uiIcon(doc, "alert")
          ]),
          el(doc, "span", { class: "bc-cs-detail-combined-warning-text", text: message })
        ])
      );
    }
  }

  appendDetailBlock(doc, wrap, "Class attributes", props.detail.classAttributes);
  appendDetailBlock(doc, wrap, "Enrollment requirements", props.detail.enrollmentRequirements);
  appendDetailBlock(doc, wrap, "Class notes", props.detail.classNotes);

  if (props.detail.classCapacity === null && hasNoEnrichedFields(props.detail)) {
    wrap.appendChild(
      el(doc, "div", {
        class: "bc-cs-detail-note",
        text:
          "CAESAR has no seat details for this section. Its status is shown above."
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
        text: "Loading seats and notes from CAESAR"
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

function buildPerSectionBlock(
  doc: Document,
  detail: SeatsNotesSuccess,
  perSection: PerSectionSeats
): HTMLElement {
  const block = el(doc, "div", { class: "bc-cs-detail-per-section" });
  block.appendChild(
    el(doc, "div", {
      class: "bc-cs-detail-per-section-headline",
      text: `${perSection.enrolled}/${perSection.capacity} enrolled in this section`
    })
  );
  block.appendChild(
    el(doc, "div", {
      class: "bc-cs-detail-per-section-line",
      text: `${perSection.available} open · pooled ${detail.enrollmentTotal ?? "?"}/${detail.classCapacity ?? "?"}`
    })
  );
  block.appendChild(
    el(doc, "div", {
      class: "bc-cs-detail-per-section-source",
      text:
        "CAESAR counts cross-listed sections together. Pencil worked out this section's share from Paper.nu."
    })
  );
  return block;
}

// Open seats lead the row, on a chip coloured by how full the class is.
function buildStatsGrid(doc: Document, detail: SeatsNotesSuccess): HTMLElement {
  const stats = el(doc, "div", { class: "bc-cs-detail-stats" });
  appendStat(doc, stats, "Open seats", detail.availableSeats, seatTone(detail));
  appendStat(doc, stats, "Capacity", detail.classCapacity);
  appendStat(doc, stats, "Enrolled", detail.enrollmentTotal);
  appendStat(doc, stats, "Waitlist size", detail.waitListCapacity);
  appendStat(doc, stats, "On waitlist", detail.waitListTotal);
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

// How full the class is, as one of the five seat tones the shopping-cart
// cards use, so a class that's tight in the cart reads as tight here too.
function seatTone(detail: SeatsNotesSuccess): SeatTone | null {
  const capacity = parseSeatNumber(detail.classCapacity);
  if (capacity === null || capacity <= 0) return null;
  const available = parseSeatNumber(detail.availableSeats);
  const enrolled = parseSeatNumber(detail.enrollmentTotal);
  if (available !== null) return pressureTone(1 - clamp(available, 0, capacity) / capacity);
  if (enrolled !== null) return pressureTone(clamp(enrolled, 0, capacity) / capacity);
  return null;
}

function parseSeatNumber(input: string | null): number | null {
  if (!input) return null;
  const parsed = Number.parseFloat(input.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

type SeatTone = "full" | "warn" | "tight" | "room" | "open";

function pressureTone(occupancy: number): SeatTone {
  // Mirrors occupancyToTone() in seats-notes/ui.ts. If you adjust the
  // thresholds here, mirror them there.
  if (occupancy >= 0.95) return "full";
  if (occupancy >= 0.8) return "warn";
  if (occupancy >= 0.6) return "tight";
  if (occupancy >= 0.35) return "room";
  return "open";
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
  value: string | null,
  tone: SeatTone | null = null
): void {
  if (!value) return;
  parent.appendChild(
    el(doc, "div", { class: "bc-cs-stat" }, [
      el(doc, "div", {
        class: "bc-cs-stat-value",
        text: value,
        attrs: tone ? { "data-bc-seat-tone": tone } : {}
      }),
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

