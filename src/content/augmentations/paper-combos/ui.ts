import { el } from "../../framework";
import { PAPER_COMBOS_CONFIG } from "./config";
import {
  CARD_PIN_BUTTON_CLASS,
  COURSE_ID_DATASET_ATTR,
  FEATURE_TOGGLE_CLASS,
  ORIGINAL_LEFT_ATTR,
  ORIGINAL_WIDTH_ATTR,
  REAL_CARD_HIDE_ATTR,
  ROOT_ATTR,
  TOP_BAR_ID
} from "./constants";
import type { SortMode } from "./scoring";
import { isSortMode } from "./scoring";
import type { ComboPool, Combination, ComboSection } from "./types";

const HOUR_LABEL_RE = /^(\d{1,2})\s*(AM|PM)\s*$/i;
const ACTION_ATTR = "data-bc-combos-action";

export function parseHourLabel(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.trim().match(HOUR_LABEL_RE);
  if (!m) return null;
  let h = Number.parseInt(m[1], 10);
  const period = m[2].toUpperCase();
  if (Number.isNaN(h) || h < 0 || h > 23) return null;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h;
}

// Reads paper.nu's first hour label from the HoursColumn. Used to map a
// section's start hour to the right cell index in each Day column. Returns
// null when paper.nu's grid hasn't rendered yet.
export function readGridStartHour(grid: HTMLElement): number | null {
  const label = grid.querySelector<HTMLElement>(
    PAPER_COMBOS_CONFIG.selectors.hoursColumnFirstCellLabel
  );
  return parseHourLabel(label?.textContent);
}

export function readDayColumns(grid: HTMLElement): HTMLElement[] {
  const children = Array.from(grid.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement
  );
  // First child is HoursColumn, next 5 are Day0..Day4.
  return children.slice(1, 6);
}

export type TopBarState = {
  enabled: boolean;
  defaultEnabled: boolean;
  total: number;
  cursor: number;
  score: number;
  ratedCount: number;
  totalSections: number;
  maxCredits: number;
  minCredits: number;
  sortMode: SortMode;
  sortLabels: Record<SortMode, string>;
  status?: string;
  truncated: boolean;
  conflictingPins: boolean;
  zoneCount: number;
};

export type TopBarCallbacks = {
  onPrev(): void;
  onNext(): void;
  onMaxChange(value: number): void;
  onMinChange(value: number): void;
  onToggleFeature(next: boolean): void;
};

export type TopBarZoneCallbacks = {
  onClearZones(): void;
  onSortChange(mode: SortMode): void;
};

// Event delegation pattern: callbacks live on the bar element itself,
// not on each rendered child. paper.nu's React reconciler can wipe and
// re-create children — listeners on the parent survive the churn so the
// user's clicks always land on a live handler. The bar's children are
// just markup; their `data-bc-combos-action` attribute drives dispatch.
export function ensureTopBar(
  doc: Document,
  grid: HTMLElement,
  callbacks: TopBarCallbacks
): HTMLElement {
  const existing = doc.getElementById(TOP_BAR_ID);
  if (existing) {
    bindTopBarHandlers(existing, callbacks);
    if (existing.parentElement !== grid.parentElement) {
      grid.parentElement?.insertBefore(existing, grid);
    }
    return existing;
  }
  const bar = doc.createElement("div");
  bar.id = TOP_BAR_ID;
  const parent = grid.parentElement;
  if (parent) {
    parent.insertBefore(bar, grid);
  }
  bindTopBarHandlers(bar, callbacks);
  return bar;
}

type DelegatedHandlers = {
  onClick: (event: MouseEvent) => void;
  onInput: (event: Event) => void;
};

const handlerStore = new WeakMap<HTMLElement, DelegatedHandlers>();
// Zone callbacks can change every render but we don't want to re-bind
// the bar's delegated click listener — keep them in a side-channel map
// the click handler reads at dispatch time.
const zoneCallbackStore = new WeakMap<HTMLElement, TopBarZoneCallbacks>();

function bindTopBarHandlers(
  bar: HTMLElement,
  callbacks: TopBarCallbacks
): void {
  const previous = handlerStore.get(bar);
  if (previous) {
    bar.removeEventListener("click", previous.onClick);
    bar.removeEventListener("input", previous.onInput);
  }

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest<HTMLElement>(`[${ACTION_ATTR}]`);
    if (!actionEl) return;
    if (actionEl.hasAttribute("disabled")) return;
    const action = actionEl.getAttribute(ACTION_ATTR);
    switch (action) {
      case "prev":
        callbacks.onPrev();
        break;
      case "next":
        callbacks.onNext();
        break;
      case "toggle": {
        const next = actionEl.dataset.on !== "true";
        callbacks.onToggleFeature(next);
        break;
      }
      case "clear-zones":
        zoneCallbackStore.get(bar)?.onClearZones();
        break;
    }
  };

  const onInput = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      const action = target.getAttribute(ACTION_ATTR);
      const next = Number.parseFloat(target.value);
      if (!Number.isFinite(next)) return;
      if (action === "max") callbacks.onMaxChange(next);
      else if (action === "min") callbacks.onMinChange(next);
      return;
    }
    if (target instanceof HTMLSelectElement) {
      if (target.getAttribute(ACTION_ATTR) !== "sort") return;
      const value = target.value;
      if (isSortMode(value)) {
        zoneCallbackStore.get(bar)?.onSortChange(value);
      }
    }
  };

  bar.addEventListener("click", onClick);
  bar.addEventListener("input", onInput);
  handlerStore.set(bar, { onClick, onInput });
}

function formatRating(score: number): string {
  return score.toFixed(2);
}

export function renderTopBar(
  doc: Document,
  bar: HTMLElement,
  state: TopBarState,
  zoneCallbacks: TopBarZoneCallbacks
): void {
  zoneCallbackStore.set(bar, zoneCallbacks);
  bar.replaceChildren();
  bar.dataset.enabled = String(state.enabled);

  // Toggle pill is always present so users can enable/disable the
  // feature in-place from the schedule page itself. The pill carries
  // its own state in `data-on` so the delegated click handler reads
  // the live value rather than a stale closure capture.
  const toggle = el(doc, "button", {
    class: FEATURE_TOGGLE_CLASS,
    attrs: {
      type: "button",
      "aria-pressed": String(state.enabled),
      "aria-label": state.enabled
        ? "Turn schedule combinations off"
        : "Turn schedule combinations on",
      [ACTION_ATTR]: "toggle"
    },
    dataset: { on: String(state.enabled) }
  }, [
    el(doc, "span", { class: "bc-paper-combos-toggle-track" }, [
      el(doc, "span", { class: "bc-paper-combos-toggle-thumb" })
    ]),
    el(doc, "span", { class: "bc-paper-combos-toggle-label" }, [
      "Schedule combinations"
    ])
  ]);

  bar.appendChild(toggle);

  if (!state.enabled) {
    // Off state: just the toggle + a brief hint. No cycle / rating /
    // max input — clutter-free until the user opts in.
    bar.appendChild(
      el(doc, "span", { class: "bc-paper-combos-toggle-hint" }, [
        "Cycle non-overlapping schedules of your canvas classes."
      ])
    );
    return;
  }

  // Cycle buttons are intentionally always clickable. When `total <= 1`
  // they no-op in the augmentation's cyclePrev/Next handlers — but the
  // browser still fires the click event so the user gets feedback (and
  // we don't run into the trap where a disabled button silently swallows
  // the only interaction in the bar).
  const cycle = el(doc, "div", { class: "bc-paper-combos-cycle" }, [
    el(doc, "button", {
      attrs: {
        type: "button",
        "aria-label": "Previous combination",
        [ACTION_ATTR]: "prev"
      }
    }, ["←"]),
    el(doc, "span", { class: "bc-paper-combos-counter" }, [
      state.total === 0
        ? "0 / 0"
        : `${state.cursor + 1} / ${state.total}${state.truncated ? "+" : ""}`
    ]),
    el(doc, "button", {
      attrs: {
        type: "button",
        "aria-label": "Next combination",
        [ACTION_ATTR]: "next"
      }
    }, ["→"])
  ]);

  // Rating chip only appears when at least one section in the active
  // combo has a cached CTEC mean. With zero coverage there's nothing
  // honest to show, and a placeholder "no CTEC" pill is just clutter.
  const rating = state.ratedCount > 0
    ? el(doc, "span", {
        class: "bc-paper-combos-rating",
        dataset: { rated: String(state.ratedCount) }
      }, [
        `★ ${formatRating(state.score)}`
      ])
    : null;

  const minInput = el(doc, "input", {
    attrs: {
      type: "number",
      min: "0",
      step: "0.5",
      value: String(state.minCredits),
      [ACTION_ATTR]: "min",
      "aria-label": "Minimum credits"
    }
  });

  const maxInput = el(doc, "input", {
    attrs: {
      type: "number",
      min: "0.5",
      step: "0.5",
      value: String(state.maxCredits),
      [ACTION_ATTR]: "max",
      "aria-label": "Maximum credits"
    }
  });

  // Single combined "Min N – Max M" control. Per-input labels make it
  // unambiguous which side is the floor vs ceiling; the dash between
  // them ties the two halves into one logical range.
  const creditsControl = el(doc, "div", { class: "bc-paper-combos-credits" }, [
    el(doc, "label", { class: "bc-paper-combos-credits-pair" }, [
      el(doc, "span", { class: "bc-paper-combos-credits-label" }, ["Min"]),
      minInput
    ]),
    el(doc, "span", { class: "bc-paper-combos-credits-sep" }, ["–"]),
    el(doc, "label", { class: "bc-paper-combos-credits-pair" }, [
      el(doc, "span", { class: "bc-paper-combos-credits-label" }, ["Max"]),
      maxInput
    ])
  ]);

  // Sort dropdown — fires on change so picking an option re-sorts the
  // combo list immediately. Native <select> for accessibility + zero
  // custom dropdown code.
  const sortSelect = doc.createElement("select");
  sortSelect.className = "bc-paper-combos-sort-select";
  sortSelect.setAttribute(ACTION_ATTR, "sort");
  sortSelect.setAttribute("aria-label", "Sort combinations");
  for (const [value, label] of Object.entries(state.sortLabels)) {
    const option = doc.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value === state.sortMode) option.selected = true;
    sortSelect.appendChild(option);
  }

  const sortControl = el(doc, "label", { class: "bc-paper-combos-sort" }, [
    el(doc, "span", {}, ["Sort"]),
    sortSelect
  ]);

  // Left cluster: status info (what's currently showing).
  bar.appendChild(cycle);
  if (rating) bar.appendChild(rating);
  // Auto-margin spacer pushes the right cluster — sort, credits, clear —
  // to the bar's far end so the toolbar reads as two visual groups.
  bar.appendChild(el(doc, "span", { class: "bc-paper-combos-spacer" }));
  // Right cluster: settings + actions.
  bar.appendChild(sortControl);
  bar.appendChild(creditsControl);

  // Clear-zones button only appears when at least one zone exists.
  if (state.zoneCount > 0) {
    const noun = state.zoneCount === 1 ? "block" : "blocks";
    bar.appendChild(
      el(doc, "button", {
        class: "bc-paper-combos-clear-zones",
        attrs: {
          type: "button",
          [ACTION_ATTR]: "clear-zones",
          "aria-label": "Clear all blocked time zones"
        }
      }, [`Clear ${state.zoneCount} ${noun}`])
    );
  }

  if (state.status) {
    bar.appendChild(
      el(doc, "div", { class: "bc-paper-combos-status" }, [state.status])
    );
  }

  // defaultEnabled isn't user-visible but reading it here keeps it from
  // being flagged as unused — the augmentation passes it so the bar can
  // surface a "feature now opt-out" hint in the future.
  void state.defaultEnabled;
}

// Map each rendered paper.nu schedule card to the section_id it represents.
// paper.nu places one card per (section_id, meeting_pattern, day) inside
// the hour cell that matches the section's start hour, with `top` set to
// the start-minute fraction. We resolve identity by matching that triple
// (day, hour cell, top%) plus the card's leading "{subject} {number}" text
// — the only data paper.nu actually stamps onto the card DOM. Cards we
// can't match (custom sections, partial DOM hydration) stay untouched —
// they remain visible regardless of combo membership.
function buildCardSectionMap(
  grid: HTMLElement,
  pool: ComboPool,
  startHour: number
): Map<HTMLElement, string> {
  const result = new Map<HTMLElement, string>();
  const dayColumns = readDayColumns(grid);

  for (const section of pool.byId.values()) {
    const expectedTitlePrefix = `${section.subject} ${section.number}`;
    for (const block of section.blocks) {
      const dayCol = dayColumns[block.day];
      if (!dayCol) continue;
      const cellIdx = block.start.h - startHour + 1;
      const cell = dayCol.children[cellIdx];
      if (!(cell instanceof HTMLElement)) continue;

      const candidates = cell.querySelectorAll<HTMLElement>(
        "div.absolute.z-10.rounded-lg"
      );
      for (const card of Array.from(candidates)) {
        if (result.has(card)) continue;
        const topPct = Number.parseFloat(card.style.top || "0");
        if (!Number.isFinite(topPct)) continue;
        const cardMinutes = Math.round((topPct * 60) / 100);
        if (Math.abs(cardMinutes - block.start.m) > 1) continue;

        const titleP = card.querySelector<HTMLElement>("p");
        const titleText = (titleP?.textContent ?? "").trim();
        if (!titleText.startsWith(expectedTitlePrefix)) continue;

        result.set(card, section.sectionId);
        break;
      }
    }
  }

  return result;
}

// Snapshot the original `left`/`width` paper.nu set on the card before we
// override them, so we can faithfully restore the split layout if/when
// the card stops being part of the active combo. Idempotent — once
// snapshotted, we don't re-snapshot from our own override.
function captureOriginalLayout(card: HTMLElement): void {
  if (!card.hasAttribute(ORIGINAL_LEFT_ATTR)) {
    card.setAttribute(ORIGINAL_LEFT_ATTR, card.style.left || "");
  }
  if (!card.hasAttribute(ORIGINAL_WIDTH_ATTR)) {
    card.setAttribute(ORIGINAL_WIDTH_ATTR, card.style.width || "");
  }
}

function widenCardToFull(card: HTMLElement): void {
  captureOriginalLayout(card);
  card.style.left = "0%";
  card.style.width = "100%";
}

function restoreOriginalLayout(card: HTMLElement): void {
  const origLeft = card.getAttribute(ORIGINAL_LEFT_ATTR);
  const origWidth = card.getAttribute(ORIGINAL_WIDTH_ATTR);
  if (origLeft !== null) {
    card.style.left = origLeft;
    card.removeAttribute(ORIGINAL_LEFT_ATTR);
  }
  if (origWidth !== null) {
    card.style.width = origWidth;
    card.removeAttribute(ORIGINAL_WIDTH_ATTR);
  }
}

// Pin button mounts as a direct child of the outer `.absolute` card,
// sibling to paper-ctec's analytics-anchor (which overhangs at
// `bottom: -15px`). That places the pin just above the analytics
// pill in the bottom-right and lets it escape the dense-card
// overflow:hidden the same way paper-ctec's actions wrapper does.
// Idempotent: re-uses the existing button if one's already there.
function ensurePinButton(
  card: HTMLElement,
  section: ComboSection,
  isPinned: boolean
): void {
  let button = card.querySelector<HTMLButtonElement>(
    `:scope > .${CARD_PIN_BUTTON_CLASS}`
  );
  if (!button) {
    const doc = card.ownerDocument;
    button = doc.createElement("button");
    button.type = "button";
    button.className = CARD_PIN_BUTTON_CLASS;
    button.setAttribute("aria-label", "Pin section to lock it in every combination");
    button.textContent = "📌";
    card.appendChild(button);
  }

  button.dataset.pinned = String(isPinned);
  button.setAttribute(COURSE_ID_DATASET_ATTR, section.courseId);
  button.dataset.bcCombosCardSection = section.sectionId;
  button.title = isPinned
    ? `Pinned ${section.subject} ${section.number} ${section.section} — click to unpin`
    : `Pin ${section.subject} ${section.number} ${section.section} into every combination`;
}

function removePinButton(card: HTMLElement): void {
  const button = card.querySelector<HTMLElement>(`.${CARD_PIN_BUTTON_CLASS}`);
  if (button) button.remove();
}

export function unhideRealCards(doc: Document): void {
  const cards = doc.querySelectorAll<HTMLElement>(
    `[${REAL_CARD_HIDE_ATTR}], [${ORIGINAL_LEFT_ATTR}], [${ORIGINAL_WIDTH_ATTR}]`
  );
  for (const card of Array.from(cards)) {
    card.removeAttribute(REAL_CARD_HIDE_ATTR);
    restoreOriginalLayout(card);
  }
  removeAllPinButtons(doc);
}

export function removeAllPinButtons(doc: Document): void {
  const buttons = doc.querySelectorAll<HTMLElement>(`.${CARD_PIN_BUTTON_CLASS}`);
  for (const button of Array.from(buttons)) {
    button.remove();
  }
}

// Hide every paper.nu card whose section_id is mapped (i.e. came from our
// pool) but isn't part of the active combination. Cards outside the pool
// (custom sections, sections we couldn't resolve) keep their default
// visibility — fail-open keeps the canvas legible if matching breaks.
//
// Visible cards also get widened to full column width: paper.nu's split
// layout shrinks overlapping cards to fit side-by-side, but once we hide
// the conflicting siblings, the survivor should reclaim the full slot.
// Each hidden card's pin button is removed; visible cards get/keep one.
export function applyComboVisibility(
  doc: Document,
  grid: HTMLElement,
  pool: ComboPool,
  combo: Combination,
  pinnedSectionIds: ReadonlySet<string>
): void {
  const startHour = readGridStartHour(grid);
  if (startHour === null) {
    unhideRealCards(doc);
    return;
  }
  const cardMap = buildCardSectionMap(grid, pool, startHour);
  const activeIds = new Set(combo.sectionIds);

  // Pass 1: clear stale hide markers and restore layout on cards no longer
  // in the active combo set OR cards no longer mapped at all (e.g. course
  // removed from canvas).
  const previouslyTouched = doc.querySelectorAll<HTMLElement>(
    `[${REAL_CARD_HIDE_ATTR}], [${ORIGINAL_LEFT_ATTR}]`
  );
  for (const card of Array.from(previouslyTouched)) {
    const sectionId = cardMap.get(card);
    if (!sectionId) {
      card.removeAttribute(REAL_CARD_HIDE_ATTR);
      restoreOriginalLayout(card);
      removePinButton(card);
      continue;
    }
    if (!activeIds.has(sectionId)) {
      // Stays hidden; defer cleanup of layout/pin until pass 2.
      continue;
    }
    card.removeAttribute(REAL_CARD_HIDE_ATTR);
  }

  // Pass 2: stamp visibility, layout, and pin button per mapped card.
  // Pin appears on only the FIRST card per section we encounter (one
  // section can render multiple cards — different meeting patterns or
  // different days). Mirrors paper-ctec's "canonical card" pattern so
  // a 3-day course doesn't sprout 3 pin buttons.
  const sectionsWithPin = new Set<string>();
  for (const [card, sectionId] of cardMap) {
    if (activeIds.has(sectionId)) {
      card.removeAttribute(REAL_CARD_HIDE_ATTR);
      widenCardToFull(card);
      const section = pool.byId.get(sectionId);
      if (!section) continue;
      if (sectionsWithPin.has(sectionId)) {
        // Non-canonical card for this section — strip any stale pin so
        // only the canonical card shows it.
        removePinButton(card);
      } else {
        ensurePinButton(card, section, pinnedSectionIds.has(sectionId));
        sectionsWithPin.add(sectionId);
      }
    } else {
      card.setAttribute(REAL_CARD_HIDE_ATTR, "1");
      // Keep original layout so when this card returns to a future combo
      // the right-half-width snapshot is still authoritative; only the
      // pin button is removed (it'd be invisible anyway).
      removePinButton(card);
    }
  }
}

export function setRootAttribute(doc: Document, on: boolean): void {
  if (on) {
    doc.documentElement.setAttribute(ROOT_ATTR, "1");
  } else {
    doc.documentElement.removeAttribute(ROOT_ATTR);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Prohibited-zone rendering + drag handler
// ─────────────────────────────────────────────────────────────────────
//
// Zones live INSIDE the start-hour cell of their day column, the same
// way paper.nu's ScheduleClass.tsx mounts class cards. Why this matters:
// each hour cell is `position: relative` and `top: ${m/60 * 100}%`
// resolves to "M minutes into this hour". Mounting at the day-column
// level forces fragile calc() math against the day-label-plus-hour-cells
// flex layout AND pollutes `dayColumn.children` so subsequent reads of
// the cell list pick up our own overlays as if they were real cells.
// Mirroring paper.nu's pattern sidesteps both problems.

const ZONE_CLASS = "bc-paper-combos-zone";
const ZONE_REMOVE_BUTTON_CLASS = "bc-paper-combos-zone-remove";
const ZONE_PREVIEW_CLASS = "bc-paper-combos-zone-preview";
const ZONE_ID_ATTR = "data-bc-zone-id";
const SCHEDULE_CARD_SEL = "div.absolute.z-10.rounded-lg";

// Filter to paper.nu's actual hour cells. Skips:
//   - children[0] (day label cell)
//   - any zone or preview overlay we've appended ourselves
// This is the foundation: every measurement and lookup that thinks in
// "hour cells" reads through this so our overlays never poison the math.
function getPaperCells(dayColumn: HTMLElement): HTMLElement[] {
  return Array.from(dayColumn.children).filter(
    (c): c is HTMLElement =>
      c instanceof HTMLElement &&
      !c.classList.contains(ZONE_CLASS) &&
      !c.classList.contains(ZONE_PREVIEW_CLASS)
  );
}

// Convert a viewport Y pixel into "minutes since midnight" using the
// day column's actual hour cells as the time axis (no day-label, no
// overlays). Returns null if the column hasn't rendered or the cursor
// is outside the visible range — the caller treats null as "ignore".
function clientYToMinutes(
  clientY: number,
  dayColumn: HTMLElement,
  startHour: number
): number | null {
  const cells = getPaperCells(dayColumn);
  if (cells.length < 2) return null;
  const firstHourCell = cells[1]; // [0] is day label, [1] is first hour
  const lastHourCell = cells[cells.length - 1];
  const firstRect = firstHourCell.getBoundingClientRect();
  const lastRect = lastHourCell.getBoundingClientRect();
  const totalHeight = lastRect.bottom - firstRect.top;
  if (totalHeight <= 0) return null;
  const hourCount = cells.length - 1;
  const offsetY = clientY - firstRect.top;
  const clamped = Math.max(0, Math.min(totalHeight, offsetY));
  return startHour * 60 + (clamped / totalHeight) * hourCount * 60;
}

// Map a column to its day index (0=Mon..4=Fri). Children[0] of the grid
// is HoursColumn, then days 0..4 follow.
function findDayIndex(grid: HTMLElement, dayColumn: HTMLElement): number {
  return Array.from(grid.children).indexOf(dayColumn) - 1;
}

function snapMinutes(minutes: number, snap = 15): number {
  return Math.round(minutes / snap) * snap;
}

function formatTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = Math.round(minutes - h24 * 60);
  const period = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${period}`;
}

function makeZoneId(): string {
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type DragZone = {
  id: string;
  startDay: number;
  endDay: number;
  startMin: number;
  endMin: number;
};

export type ZoneDragCallbacks = {
  onZoneCreate(zone: DragZone): void;
  onZoneRemove(zoneId: string): void;
};

// Mount one zone (or preview) overlay into the start-hour cell of a day
// column, positioned the same way paper.nu's ScheduleClass renders cards.
// Returns the overlay element (the caller styles + populates it).
function buildZoneInCell(
  doc: Document,
  hourCell: HTMLElement,
  startMinInHour: number,
  durationMinutes: number,
  className: string
): HTMLElement {
  // paper.nu's ScheduleClass formula: top = startDif*100% (where
  // startDif = m/60); height = endDif*100% + 2px*(end_h - start_h).
  // The 2px accounts for hour-cell border-bottoms when the card spans
  // multiple cells. We mirror it for visual parity with class cards.
  const startDif = startMinInHour / 60;
  const endDif = durationMinutes / 60;
  const hoursSpanned = Math.floor(
    (startMinInHour + durationMinutes) / 60 -
      Math.floor(startMinInHour / 60)
  );
  const overlay = doc.createElement("div");
  overlay.className = className;
  overlay.style.position = "absolute";
  overlay.style.top = `${startDif * 100}%`;
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.height = `calc(${endDif * 100}% + ${2 * hoursSpanned}px)`;
  hourCell.appendChild(overlay);
  return overlay;
}

// Mount one segment of a zone (one day's slice) inside that day's
// start-hour cell. Multi-day zones produce one segment per day —
// they all share the zone id so a click on any segment removes the
// whole logical zone.
function mountZoneSegment(
  doc: Document,
  hourCell: HTMLElement,
  zone: DragZone,
  startMinInHour: number,
  duration: number,
  className: string,
  isLeftmost: boolean,
  isRightmost: boolean
): HTMLElement {
  const overlay = buildZoneInCell(doc, hourCell, startMinInHour, duration, className);
  overlay.setAttribute(ZONE_ID_ATTR, zone.id);
  // CSS reads these to drop interior borders/radii so a multi-day zone
  // looks like one continuous box stitched across day columns.
  overlay.setAttribute("data-leftmost", String(isLeftmost));
  overlay.setAttribute("data-rightmost", String(isRightmost));
  if (isLeftmost) {
    overlay.appendChild(
      el(doc, "span", { class: "bc-paper-combos-zone-label" }, [
        `${formatTime(zone.startMin)} – ${formatTime(zone.endMin)}`
      ])
    );
  }
  if (isRightmost) {
    overlay.appendChild(
      el(doc, "button", {
        class: ZONE_REMOVE_BUTTON_CLASS,
        attrs: {
          type: "button",
          "aria-label": "Remove blocked time",
          [ZONE_ID_ATTR]: zone.id
        }
      })
    );
  }
  return overlay;
}

// Render every persisted zone into the right hour cell of every day
// it covers. Idempotent — wipes existing zone overlays first, then
// stamps the live set. Multi-day zones become one segment per day,
// all sharing the zone id; the time label appears on the leftmost
// segment, the X remove button on the rightmost.
export function renderZones(
  doc: Document,
  grid: HTMLElement,
  zones: readonly DragZone[]
): void {
  for (const existing of Array.from(
    grid.querySelectorAll<HTMLElement>(`.${ZONE_CLASS}`)
  )) {
    existing.remove();
  }
  if (zones.length === 0) return;

  const startHour = readGridStartHour(grid);
  if (startHour === null) return;
  const dayColumns = readDayColumns(grid);

  for (const zone of zones) {
    const startDay = Math.max(0, Math.min(4, zone.startDay));
    const endDay = Math.max(startDay, Math.min(4, zone.endDay));
    for (let day = startDay; day <= endDay; day++) {
      const dayCol = dayColumns[day];
      if (!dayCol) continue;
      const cells = getPaperCells(dayCol);
      const hourCount = cells.length - 1;
      if (hourCount <= 0) continue;
      const startCellIdx = Math.floor(zone.startMin / 60) - startHour + 1;
      if (startCellIdx < 1 || startCellIdx > hourCount) continue;
      const hourCell = cells[startCellIdx];
      if (!hourCell) continue;

      const startMinInHour = zone.startMin - (startHour + (startCellIdx - 1)) * 60;
      const duration = zone.endMin - zone.startMin;
      mountZoneSegment(
        doc,
        hourCell,
        zone,
        startMinInHour,
        duration,
        ZONE_CLASS,
        day === startDay,
        day === endDay
      );
    }
  }
}

type DragState = {
  startClientX: number;
  startClientY: number;
  startMin: number;
  startDay: number;
  // Every preview segment we've spawned so far, keyed by day so we
  // can selectively remove segments as the drag's day range shrinks.
  previewSegments: Map<number, HTMLElement>;
  // (day, hourCellIdx) of each preview's current anchor — when the
  // anchor changes (e.g. cursor crosses an hour boundary) we re-mount
  // because paper.nu's positioning model is "% inside this cell".
  previewAnchors: Map<number, { hourCellIdx: number }>;
  dragged: boolean;
};

// Find the day-column index whose horizontal extent covers `clientX`,
// or null if `clientX` is outside the schedule grid's day columns.
// Used during drag to detect cross-day extension.
function dayIndexAtX(grid: HTMLElement, clientX: number): number | null {
  const dayColumns = readDayColumns(grid);
  for (let i = 0; i < dayColumns.length; i++) {
    const rect = dayColumns[i].getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right) return i;
  }
  return null;
}

// Drop every preview segment.
function clearPreviewSegments(state: DragState): void {
  for (const segment of state.previewSegments.values()) {
    segment.remove();
  }
  state.previewSegments.clear();
  state.previewAnchors.clear();
}

// Attach mousedown to the grid + mousemove/up to the document. On a
// real drag (cursor moves > 4px), build preview overlays in every
// day column the drag covers, re-anchoring each as the cursor crosses
// hour boundaries. Mouseup with a final drag duration ≥ 15min commits
// one logical zone spanning all the affected days.
export function attachZoneDragHandlers(
  doc: Document,
  grid: HTMLElement,
  callbacks: ZoneDragCallbacks
): () => void {
  let drag: DragState | null = null;

  const removeIfZoneClick = (target: Element, event: MouseEvent): boolean => {
    const removeBtn = target.closest<HTMLElement>(`.${ZONE_REMOVE_BUTTON_CLASS}`);
    if (removeBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = removeBtn.getAttribute(ZONE_ID_ATTR);
      if (id) callbacks.onZoneRemove(id);
      return true;
    }
    const zoneEl = target.closest<HTMLElement>(`.${ZONE_CLASS}`);
    if (zoneEl) {
      event.preventDefault();
      event.stopPropagation();
      const id = zoneEl.getAttribute(ZONE_ID_ATTR);
      if (id) callbacks.onZoneRemove(id);
      return true;
    }
    return false;
  };

  const onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (removeIfZoneClick(target, event)) return;
    if (target.closest(SCHEDULE_CARD_SEL)) return;

    let node: Element | null = target;
    while (node && node.parentElement !== grid) {
      node = node.parentElement;
    }
    const dayColumn = node instanceof HTMLElement ? node : null;
    if (!dayColumn) return;
    const dayIdx = findDayIndex(grid, dayColumn);
    if (dayIdx < 0 || dayIdx > 4) return;

    const startHour = readGridStartHour(grid);
    if (startHour === null) return;
    const startMin = clientYToMinutes(event.clientY, dayColumn, startHour);
    if (startMin === null) return;

    event.preventDefault();
    drag = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startMin,
      startDay: dayIdx,
      previewSegments: new Map(),
      previewAnchors: new Map(),
      dragged: false
    };
  };

  // Render the preview as a set of per-day segments. Every affected
  // day gets a segment in the appropriate hour cell, sized to the
  // current drag time range. As the drag's day range or hour anchor
  // changes, segments are added, removed, or remounted in lockstep.
  const renderPreviewSegments = (
    state: DragState,
    startDay: number,
    endDay: number,
    fromMin: number,
    toMin: number,
    startHour: number
  ): void => {
    const dayColumns = readDayColumns(grid);
    const duration = Math.max(0, toMin - fromMin);

    // Drop segments for days no longer in the drag range.
    for (const day of Array.from(state.previewSegments.keys())) {
      if (day < startDay || day > endDay) {
        state.previewSegments.get(day)?.remove();
        state.previewSegments.delete(day);
        state.previewAnchors.delete(day);
      }
    }

    for (let day = startDay; day <= endDay; day++) {
      const dayColumn = dayColumns[day];
      if (!dayColumn) continue;
      const cells = getPaperCells(dayColumn);
      const hourCount = cells.length - 1;
      if (hourCount <= 0) continue;
      const startCellIdx = Math.floor(fromMin / 60) - startHour + 1;
      if (startCellIdx < 1 || startCellIdx > hourCount) {
        state.previewSegments.get(day)?.remove();
        state.previewSegments.delete(day);
        state.previewAnchors.delete(day);
        continue;
      }
      const hourCell = cells[startCellIdx];
      const startMinInHour = fromMin - (startHour + (startCellIdx - 1)) * 60;
      const anchor = state.previewAnchors.get(day);
      const existing = state.previewSegments.get(day);

      if (!existing || !anchor || anchor.hourCellIdx !== startCellIdx) {
        // No segment yet, or anchor cell changed — (re)mount.
        if (existing) existing.remove();
        const segment = buildZoneInCell(
          doc,
          hourCell,
          startMinInHour,
          duration,
          ZONE_PREVIEW_CLASS
        );
        segment.style.pointerEvents = "none";
        // Same stitching contract as committed zones — CSS strips
        // interior borders/radii so multi-day previews read as one box.
        segment.setAttribute("data-leftmost", String(day === startDay));
        segment.setAttribute("data-rightmost", String(day === endDay));
        state.previewSegments.set(day, segment);
        state.previewAnchors.set(day, { hourCellIdx: startCellIdx });
        continue;
      }

      // Same anchor — just resize, and refresh leftmost/rightmost in
      // case the drag's day range expanded/shrunk past this segment.
      existing.setAttribute("data-leftmost", String(day === startDay));
      existing.setAttribute("data-rightmost", String(day === endDay));
      const startDif = startMinInHour / 60;
      const endDif = duration / 60;
      const hoursSpanned = Math.floor(
        (startMinInHour + duration) / 60 - Math.floor(startMinInHour / 60)
      );
      existing.style.top = `${startDif * 100}%`;
      existing.style.height = `calc(${endDif * 100}% + ${2 * hoursSpanned}px)`;
    }
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (!drag) return;
    const startHour = readGridStartHour(grid);
    if (startHour === null) return;

    // Y → minutes uses the START day's axis. paper.nu draws every day
    // column with the same hour range, so reading from any column is
    // equivalent — we pick the start column for stability.
    const startDayColumn = readDayColumns(grid)[drag.startDay];
    if (!startDayColumn) return;
    const currentMin = clientYToMinutes(event.clientY, startDayColumn, startHour);
    if (currentMin === null) return;

    // X → day. When the cursor leaves the grid horizontally, fall back
    // to the start day so the preview stays anchored.
    const currentDay = dayIndexAtX(grid, event.clientX) ?? drag.startDay;

    const dx = Math.abs(event.clientX - drag.startClientX);
    const dy = Math.abs(event.clientY - drag.startClientY);
    if (dx > 4 || dy > 4) drag.dragged = true;

    const fromMin = Math.min(drag.startMin, currentMin);
    const toMin = Math.max(drag.startMin, currentMin);
    const fromDay = Math.min(drag.startDay, currentDay);
    const toDay = Math.max(drag.startDay, currentDay);

    renderPreviewSegments(drag, fromDay, toDay, fromMin, toMin, startHour);
  };

  const onMouseUp = (event: MouseEvent): void => {
    if (!drag) return;
    const captured = drag;
    drag = null;
    clearPreviewSegments(captured);
    if (!captured.dragged) return;

    const startHour = readGridStartHour(grid);
    if (startHour === null) return;
    const startDayColumn = readDayColumns(grid)[captured.startDay];
    if (!startDayColumn) return;
    const endMin = clientYToMinutes(event.clientY, startDayColumn, startHour);
    if (endMin === null) return;

    const fromMin = snapMinutes(Math.min(captured.startMin, endMin));
    const toMin = snapMinutes(Math.max(captured.startMin, endMin));
    if (toMin - fromMin < 15) return;

    const currentDay = dayIndexAtX(grid, event.clientX) ?? captured.startDay;
    const fromDay = Math.max(0, Math.min(4, Math.min(captured.startDay, currentDay)));
    const toDay = Math.max(0, Math.min(4, Math.max(captured.startDay, currentDay)));

    callbacks.onZoneCreate({
      id: makeZoneId(),
      startDay: fromDay,
      endDay: toDay,
      startMin: fromMin,
      endMin: toMin
    });
  };

  grid.addEventListener("mousedown", onMouseDown);
  doc.addEventListener("mousemove", onMouseMove);
  doc.addEventListener("mouseup", onMouseUp);

  return () => {
    grid.removeEventListener("mousedown", onMouseDown);
    doc.removeEventListener("mousemove", onMouseMove);
    doc.removeEventListener("mouseup", onMouseUp);
    if (drag) {
      clearPreviewSegments(drag);
      drag = null;
    }
  };
}
