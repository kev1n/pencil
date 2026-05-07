import { el } from "../../framework";
import { PAPER_COMBOS_CONFIG } from "./config";
import {
  CARD_PIN_BUTTON_CLASS,
  COURSE_ID_DATASET_ATTR,
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
  total: number;
  cursor: number;
  score: number;
  ratedCount: number;
  totalSections: number;
  maxClasses: number;
  maxAllowed: number;
  status?: string;
  truncated: boolean;
  conflictingPins: boolean;
};

export type TopBarCallbacks = {
  onPrev(): void;
  onNext(): void;
  onMaxChange(value: number): void;
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
    }
  };

  const onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.getAttribute(ACTION_ATTR) !== "max") return;
    const next = Number.parseInt(target.value, 10);
    if (Number.isFinite(next)) callbacks.onMaxChange(next);
  };

  bar.addEventListener("click", onClick);
  bar.addEventListener("input", onInput);
  handlerStore.set(bar, { onClick, onInput });
}

function formatRating(score: number, ratedCount: number): string {
  if (ratedCount === 0) return "no CTEC";
  return score.toFixed(2);
}

export function renderTopBar(
  doc: Document,
  bar: HTMLElement,
  state: TopBarState
): void {
  bar.replaceChildren();
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

  const rating = el(doc, "span", {
    class: "bc-paper-combos-rating",
    dataset: { rated: String(state.ratedCount) }
  }, [
    `★ ${formatRating(state.score, state.ratedCount)}`
  ]);

  const maxInput = el(doc, "input", {
    attrs: {
      type: "number",
      min: "1",
      max: String(Math.max(1, state.maxAllowed)),
      step: "1",
      value: String(state.maxClasses),
      [ACTION_ATTR]: "max"
    }
  });

  const maxControl = el(doc, "label", { class: "bc-paper-combos-max" }, [
    "Max",
    maxInput
  ]);

  bar.append(cycle, rating, maxControl);

  if (state.status) {
    bar.appendChild(
      el(doc, "div", { class: "bc-paper-combos-status" }, [state.status])
    );
  }
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

// Pin button mounts inside `.relative` (the inner positioning context
// paper.nu uses for the trash icon, etc.) so it sticks to the card even
// when paper.nu re-renders the text container. Idempotent: re-uses the
// existing button if one's already there.
function ensurePinButton(
  card: HTMLElement,
  section: ComboSection,
  isPinned: boolean
): void {
  const positioner = card.querySelector<HTMLElement>(":scope > .relative");
  if (!positioner) return;

  let button = positioner.querySelector<HTMLButtonElement>(
    `:scope > .${CARD_PIN_BUTTON_CLASS}`
  );
  if (!button) {
    const doc = card.ownerDocument;
    button = doc.createElement("button");
    button.type = "button";
    button.className = CARD_PIN_BUTTON_CLASS;
    button.setAttribute("aria-label", "Pin section to lock it in every combination");
    button.textContent = "📌";
    positioner.appendChild(button);
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
