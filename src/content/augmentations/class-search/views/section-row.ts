// Per-section row inside a course card: section number / component / time
// pattern / instructor / room / live-status cell, plus Details + Add buttons.
//
// Pure render. The view registers the Add button via a callback so the
// augmentation's CartButtonRegistry can paint badges on cache changes; the
// onAddToCart / onToggleDetails callbacks fire on click.

import { ACTION_BUTTON_MARKER_ATTR } from "../../../framework";
import { el } from "../../../framework/dom";
import { CTEC_HOST_CLASS } from "../ctec/view";
import {
  formatInstructors,
  formatMeetingPattern,
  formatRoom,
  meetingPatternCount
} from "../filter";
import type { PaperSection } from "../paper-data";

export type SectionRowProps = {
  section: PaperSection;
  /** Stable signature for cart-cache lookup. Augmentation builds this from
   *  the registry's encodeSigKey so the view doesn't have to know the
   *  separator convention. */
  sigKey: string;
  /** Called with (button, sigKey) on render so the augmentation can paint
   *  the initial cart-cache state and wire the registry. Skipped when
   *  `showActions` is false (no Add button gets built). */
  registerAddButton(button: HTMLButtonElement, sigKey: string): void;
  /** Called with the freshly-built CTEC host element so the augmentation
   *  can bind it to the CtecCoordinator. Skipped when `showActions` is
   *  false (related-component rows mirror their LEC's CTEC) or when the
   *  section has no instructor (CTEC needs an instructor to match). */
  registerCtecHost?(host: HTMLElement): void;
  onAddToCart(): void;
  onToggleDetails(): void;
  /** When false, renders an empty actions cell with no Details / Add
   *  buttons. Used for DIS / LAB rows of a course that has a LEC: CAESAR
   *  adds those via the lecture's related-section picker, so direct
   *  buttons are misleading (the click would either re-trigger the LEC
   *  flow or fail). The empty cell keeps the row's grid column reserved
   *  so LEC and related rows stay visually aligned. */
  showActions: boolean;
};

export function renderSectionRow(
  doc: Document,
  props: SectionRowProps
): HTMLLIElement {
  const { section } = props;
  const li = el(doc, "li", {
    class: "bc-cs-section",
    dataset: {
      sectionNumber: section.section,
      component: section.component
    }
  });

  li.append(
    buildIdCell(doc, section),
    buildComponentCell(doc, section),
    buildTimeCell(doc, section),
    buildInstructorCell(doc, section),
    buildRoomCell(doc, section),
    buildCtecCell(doc, props),
    buildLiveCell(doc),
    buildActionsCell(doc, props)
  );

  return li;
}

function buildCtecCell(doc: Document, props: SectionRowProps): HTMLElement {
  const host = el(doc, "div", {
    class: `bc-cs-section-ctec ${CTEC_HOST_CLASS}`,
    dataset: { state: "idle" }
  });
  // No CTEC for related-component rows (DIS / LAB sit under their LEC and
  // we'd be fetching the same instructor twice) or rows where we suppress
  // actions (same reason).
  if (props.showActions && props.registerCtecHost) {
    props.registerCtecHost(host);
  }
  return host;
}

function buildIdCell(doc: Document, section: PaperSection): HTMLElement {
  return el(doc, "div", { class: "bc-cs-section-id", text: section.section });
}

function buildComponentCell(doc: Document, section: PaperSection): HTMLElement {
  return el(doc, "div", {
    class: "bc-cs-section-component",
    text: section.component
  });
}

function buildTimeCell(doc: Document, section: PaperSection): HTMLElement {
  const cell = el(doc, "div", { class: "bc-cs-section-time" });
  if (section.start_date && section.end_date) {
    cell.appendChild(
      el(doc, "div", {
        class: "bc-cs-section-time-dates",
        text: formatDateRange(section.start_date, section.end_date)
      })
    );
  }
  const patterns = meetingPatternCount(section);
  for (let i = 0; i < patterns; i += 1) {
    cell.appendChild(
      el(doc, "div", {
        class: "bc-cs-section-time-pattern",
        text: formatMeetingPattern(section, i)
      })
    );
  }
  return cell;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatDateRange(start: string, end: string): string {
  const startParts = parseIsoDate(start);
  const endParts = parseIsoDate(end);
  if (!startParts || !endParts) return `${start} – ${end}`;
  const sameYear = startParts.year === endParts.year;
  const startLabel = `${MONTH_LABELS[startParts.month]} ${startParts.day}`;
  const endLabel = `${MONTH_LABELS[endParts.month]} ${endParts.day}`;
  if (sameYear) {
    return `${startLabel} – ${endLabel}, ${endParts.year}`;
  }
  return `${startLabel}, ${startParts.year} – ${endLabel}, ${endParts.year}`;
}

function parseIsoDate(input: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIdx < 0 || monthIdx > 11) return null;
  return { year, month: monthIdx, day };
}

function buildInstructorCell(doc: Document, section: PaperSection): HTMLElement {
  return el(doc, "div", {
    class: "bc-cs-section-instructor",
    text: formatInstructors(section)
  });
}

function buildRoomCell(doc: Document, section: PaperSection): HTMLElement {
  const patterns = meetingPatternCount(section);
  const rooms = new Set<string>();
  for (let i = 0; i < patterns; i += 1) {
    const room = formatRoom(section, i);
    if (room) rooms.add(room);
  }
  return el(doc, "div", {
    class: "bc-cs-section-room",
    text: rooms.size > 0 ? Array.from(rooms).join(" · ") : ""
  });
}

function buildLiveCell(doc: Document): HTMLElement {
  return el(doc, "div", {
    class: "bc-cs-section-live",
    dataset: { role: "live" }
  });
}

function buildActionsCell(doc: Document, props: SectionRowProps): HTMLElement {
  if (!props.showActions) {
    // Empty cell — preserves the row's actions column so LEC + related
    // rows stay visually aligned (each row is its own CSS grid; styles
    // pin a min-width on `.bc-cs-section-actions` to reserve the
    // column when the cell has no children).
    return el(doc, "div", {
      class: "bc-cs-section-actions",
      dataset: { hidden: "true" }
    });
  }
  // Both buttons delegate their click semantics to dedicated controllers
  // (createSectionDetailController, createAddToCartController) which own
  // their full state machine — sync-disable on click, re-entry guard,
  // multi-step pickers, optimistic cart-cache writes. Those controllers
  // are exhaustively tested. We mark the elements with the action-button
  // attribute and the formalized "controller" sentinel value so the
  // `bc-rules/no-raw-action-button` ESLint rule recognizes them as the
  // controller-managed exception (rather than the factory's "1" output)
  // and the default `[data-state="…"]` styling from
  // `framework/styles/action-button.ts` applies.
  const detailsBtn = el(doc, "button", {
    class: "bc-cs-details-btn",
    text: "Details",
    attrs: { type: "button", [ACTION_BUTTON_MARKER_ATTR]: "controller" },
    on: { click: props.onToggleDetails }
  });

  const addBtn = el(doc, "button", {
    class: "bc-cs-add",
    text: "Add to cart",
    attrs: { type: "button", [ACTION_BUTTON_MARKER_ATTR]: "controller" },
    dataset: { sigKey: props.sigKey },
    on: { click: props.onAddToCart }
  });
  // Registry callback fires synchronously with the addBtn ref so the
  // augmentation can apply the initial cart-cache badge before the row
  // mounts to the DOM.
  props.registerAddButton(addBtn, props.sigKey);

  return el(doc, "div", { class: "bc-cs-section-actions" }, [addBtn, detailsBtn]);
}

/**
 * Replace `button` content with an inline spinner + label so the loading
 * indicator lives inside the button (no detached "Loading…" text). Used by
 * the Details and Add-to-cart controllers; `textContent` of the resulting
 * button still equals `label`, since the spinner span has no text.
 */
export function paintButtonLoading(
  doc: Document,
  button: HTMLButtonElement,
  label: string
): void {
  const spinner = el(doc, "span", { class: "bc-cs-btn-spinner" });
  button.replaceChildren(spinner, doc.createTextNode(label));
}
