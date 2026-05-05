// Per-section row inside a course card: section number / component / time
// pattern / instructor / room / live-status cell, plus Details + Add buttons.
//
// Pure render. The view registers the Add button via a callback so the
// augmentation's CartButtonRegistry can paint badges on cache changes; the
// onAddToCart / onToggleDetails callbacks fire on click.

import { ACTION_BUTTON_MARKER_ATTR } from "../../../framework";
import { el } from "../../../framework/dom";
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
   *  the initial cart-cache state and wire the registry. */
  registerAddButton(button: HTMLButtonElement, sigKey: string): void;
  onAddToCart(): void;
  onToggleDetails(): void;
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
    buildLiveCell(doc),
    buildActionsCell(doc, props)
  );

  return li;
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
  const patterns = meetingPatternCount(section);
  for (let i = 0; i < patterns; i += 1) {
    cell.appendChild(
      el(doc, "div", { text: formatMeetingPattern(section, i) })
    );
  }
  if (section.start_date && section.end_date) {
    cell.appendChild(
      el(doc, "div", {
        class: "bc-cs-mute",
        text: `${section.start_date} – ${section.end_date}`
      })
    );
  }
  return cell;
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

  return el(doc, "div", { class: "bc-cs-section-actions" }, [detailsBtn, addBtn]);
}
