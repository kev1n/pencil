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
  status?: string;
  truncated: boolean;
  conflictingPins: boolean;
  zoneCount: number;
};

export type TopBarCallbacks = {
  onPrev(): void;
  onNext(): void;
  onMaxChange(value: number): void;
  onToggleFeature(next: boolean): void;
};

export type TopBarZoneCallbacks = {
  onClearZones(): void;
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
    if (!(target instanceof HTMLInputElement)) return;
    if (target.getAttribute(ACTION_ATTR) !== "max") return;
    const next = Number.parseFloat(target.value);
    if (Number.isFinite(next)) callbacks.onMaxChange(next);
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

  const maxInput = el(doc, "input", {
    attrs: {
      type: "number",
      min: "0.5",
      step: "0.5",
      value: String(state.maxCredits),
      [ACTION_ATTR]: "max"
    }
  });

  const maxControl = el(doc, "label", { class: "bc-paper-combos-max" }, [
    "Max credits",
    maxInput
  ]);

  bar.appendChild(cycle);
  if (rating) bar.appendChild(rating);
  bar.appendChild(maxControl);

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
  for (const [card, sectionId] of cardMap) {
    if (activeIds.has(sectionId)) {
      card.removeAttribute(REAL_CARD_HIDE_ATTR);
      widenCardToFull(card);
      const section = pool.byId.get(sectionId);
      if (section) {
        ensurePinButton(card, section, pinnedSectionIds.has(sectionId));
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

const ZONE_CLASS = "bc-paper-combos-zone";
const ZONE_REMOVE_BUTTON_CLASS = "bc-paper-combos-zone-remove";
const ZONE_PREVIEW_CLASS = "bc-paper-combos-zone-preview";
const ZONE_ID_ATTR = "data-bc-zone-id";

// Convert a clientY pixel coordinate into "minutes since midnight"
// using the day column's hour cells as the time axis. The column has
// (1 day-label cell) + (endHour - startHour) hour cells, all the same
// height. Clamps to the column's visible time range.
function clientYToMinutes(
  clientY: number,
  dayColumn: HTMLElement,
  startHour: number
): number | null {
  const cells = Array.from(dayColumn.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement
  );
  if (cells.length < 2) return null;
  const firstHourCell = cells[1];
  const lastHourCell = cells[cells.length - 1];
  const firstRect = firstHourCell.getBoundingClientRect();
  const lastRect = lastHourCell.getBoundingClientRect();
  const totalHeight = lastRect.bottom - firstRect.top;
  if (totalHeight <= 0) return null;
  const hourCount = cells.length - 1;
  const offsetY = clientY - firstRect.top;
  const clamped = Math.max(0, Math.min(totalHeight, offsetY));
  const totalMinutes = hourCount * 60;
  return startHour * 60 + (clamped / totalHeight) * totalMinutes;
}

// Find the zero-indexed day (0=Mon..4=Fri) for a column, given the grid
// element. The grid's first child is HoursColumn, then days 0..4.
function findDayIndex(grid: HTMLElement, dayColumn: HTMLElement): number {
  const idx = Array.from(grid.children).indexOf(dayColumn);
  return idx - 1;
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
  const mm = m.toString().padStart(2, "0");
  return `${h}:${mm} ${period}`;
}

export type DragZone = {
  id: string;
  day: number;
  startMin: number;
  endMin: number;
};

export type ZoneDragCallbacks = {
  onZoneCreate(zone: DragZone): void;
  onZoneRemove(zoneId: string): void;
};

// Renders any persisted zones into the appropriate day columns. Each
// zone gets an absolutely-positioned <div> inside its day column with a
// remove button. Idempotent — clears stale zones first, then re-stamps
// the live set so the count and positions match `zones` exactly.
export function renderZones(
  doc: Document,
  grid: HTMLElement,
  zones: readonly DragZone[]
): void {
  // Wipe any pre-existing zone overlays so the new state is authoritative.
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
    const dayCol = dayColumns[zone.day];
    if (!dayCol) continue;
    const cells = Array.from(dayCol.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement
    );
    const hourCount = Math.max(0, cells.length - 1);
    if (hourCount === 0) continue;
    const totalMinutes = hourCount * 60;
    const fromMin = zone.startMin - startHour * 60;
    const toMin = zone.endMin - startHour * 60;
    if (toMin <= 0 || fromMin >= totalMinutes) continue;
    const clampedFrom = Math.max(0, fromMin);
    const clampedTo = Math.min(totalMinutes, toMin);
    const topPct = (clampedFrom / totalMinutes) * 100;
    const heightPct = ((clampedTo - clampedFrom) / totalMinutes) * 100;

    // Position the overlay relative to the day column's first hour cell
    // (skip the day-label cell at children[0]) so percentages match the
    // hour-grid axis exactly.
    const overlay = el(doc, "div", {
      class: ZONE_CLASS,
      attrs: { [ZONE_ID_ATTR]: zone.id },
      style: {
        position: "absolute",
        top: `calc(${topPct}% * ${hourCount} / ${cells.length} + ${100 / cells.length}%)`,
        left: "0",
        right: "0",
        height: `calc(${heightPct}% * ${hourCount} / ${cells.length})`
      }
    }, [
      el(doc, "span", { class: "bc-paper-combos-zone-label" }, [
        `${formatTime(zone.startMin)} – ${formatTime(zone.endMin)}`
      ]),
      el(doc, "button", {
        class: ZONE_REMOVE_BUTTON_CLASS,
        attrs: {
          type: "button",
          "aria-label": "Remove blocked time",
          [ZONE_ID_ATTR]: zone.id
        }
      }, ["×"])
    ]);

    // Day column needs `position: relative` so our absolute child anchors
    // correctly. paper.nu doesn't set this on the column wrapper, so we
    // do it here (idempotent).
    if (dayCol.style.position !== "relative") {
      dayCol.style.position = "relative";
    }
    dayCol.appendChild(overlay);
  }
}

type DragState = {
  startClientY: number;
  startMin: number;
  day: number;
  preview: HTMLElement;
  // Track whether the user has actually dragged (vs just clicked) so
  // mouseup can distinguish a click-on-empty-space (no-op) from a real
  // drag (creates zone).
  dragged: boolean;
};

// Attach mousedown to the grid; on a real drag-on-day-column, build a
// preview rectangle and stream its size with mousemove. On mouseup with
// enough drag distance, persist a zone via the supplied callback.
// Returns a detach function the caller invokes on cleanup.
export function attachZoneDragHandlers(
  doc: Document,
  grid: HTMLElement,
  callbacks: ZoneDragCallbacks
): () => void {
  let drag: DragState | null = null;

  const onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Click on an existing zone's remove button → delete that zone.
    const removeBtn = target.closest<HTMLElement>(`.${ZONE_REMOVE_BUTTON_CLASS}`);
    if (removeBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = removeBtn.getAttribute(ZONE_ID_ATTR);
      if (id) callbacks.onZoneRemove(id);
      return;
    }

    // Click anywhere else on a zone (not the X) → also delete (zones
    // should be cheap to remove since they accumulate).
    const zoneEl = target.closest<HTMLElement>(`.${ZONE_CLASS}`);
    if (zoneEl) {
      event.preventDefault();
      event.stopPropagation();
      const id = zoneEl.getAttribute(ZONE_ID_ATTR);
      if (id) callbacks.onZoneRemove(id);
      return;
    }

    // Skip if the click is on a paper.nu schedule card — don't fight
    // paper.nu's own click → open-detail handler.
    if (target.closest("div.absolute.z-10.rounded-lg")) return;

    const dayColumn = (() => {
      let node: Element | null = target;
      while (node && node.parentElement !== grid) {
        node = node.parentElement;
      }
      return node instanceof HTMLElement ? node : null;
    })();
    if (!dayColumn) return;
    const dayIdx = findDayIndex(grid, dayColumn);
    if (dayIdx < 0 || dayIdx > 4) return;

    const startHour = readGridStartHour(grid);
    if (startHour === null) return;

    const startMin = clientYToMinutes(event.clientY, dayColumn, startHour);
    if (startMin === null) return;

    event.preventDefault();

    const preview = doc.createElement("div");
    preview.className = ZONE_PREVIEW_CLASS;
    preview.style.position = "absolute";
    preview.style.left = "0";
    preview.style.right = "0";
    preview.style.top = "0";
    preview.style.height = "0";
    preview.style.pointerEvents = "none";
    if (dayColumn.style.position !== "relative") {
      dayColumn.style.position = "relative";
    }
    dayColumn.appendChild(preview);

    drag = {
      startClientY: event.clientY,
      startMin,
      day: dayIdx,
      preview,
      dragged: false
    };
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (!drag) return;
    const dayColumn = readDayColumns(grid)[drag.day];
    if (!dayColumn) return;
    const startHour = readGridStartHour(grid);
    if (startHour === null) return;
    const currentMin = clientYToMinutes(event.clientY, dayColumn, startHour);
    if (currentMin === null) return;

    if (Math.abs(event.clientY - drag.startClientY) > 4) {
      drag.dragged = true;
    }

    const cells = Array.from(dayColumn.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement
    );
    const hourCount = Math.max(0, cells.length - 1);
    if (hourCount === 0) return;
    const totalMinutes = hourCount * 60;
    const fromAbs = Math.min(drag.startMin, currentMin);
    const toAbs = Math.max(drag.startMin, currentMin);
    const fromOffset = fromAbs - startHour * 60;
    const toOffset = toAbs - startHour * 60;
    const topPct = (fromOffset / totalMinutes) * 100;
    const heightPct = ((toOffset - fromOffset) / totalMinutes) * 100;

    drag.preview.style.top = `calc(${topPct}% * ${hourCount} / ${cells.length} + ${100 / cells.length}%)`;
    drag.preview.style.height = `calc(${heightPct}% * ${hourCount} / ${cells.length})`;
  };

  const onMouseUp = (event: MouseEvent): void => {
    if (!drag) return;
    const captured = drag;
    drag = null;
    captured.preview.remove();

    if (!captured.dragged) return;

    const dayColumn = readDayColumns(grid)[captured.day];
    if (!dayColumn) return;
    const startHour = readGridStartHour(grid);
    if (startHour === null) return;
    const endMin = clientYToMinutes(event.clientY, dayColumn, startHour);
    if (endMin === null) return;

    const fromMin = snapMinutes(Math.min(captured.startMin, endMin));
    const toMin = snapMinutes(Math.max(captured.startMin, endMin));
    if (toMin - fromMin < 15) return; // Below threshold — ignore taps.

    callbacks.onZoneCreate({
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      day: captured.day,
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
      drag.preview.remove();
      drag = null;
    }
  };
}
