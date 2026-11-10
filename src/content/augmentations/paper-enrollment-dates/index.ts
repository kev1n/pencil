import { createEnrollmentDatesPopover } from "../../enrollment-dates/popover";
import { enrollmentDatesStyles } from "../../enrollment-dates/styles";
import { el, ensureStyle, type Augmentation } from "../../framework";
import { readActiveTermNameFromDom } from "../paper-ctec/paper-active-term";

const FEATURE_ID = "paper-enrollment-dates";
const POPOVER_ID = "bc-paper-enrollment-dates";
const STYLE_ID = "bc-paper-enrollment-dates-style";

export class PaperEnrollmentDatesAugmentation implements Augmentation {
  readonly id = FEATURE_ID;
  private trigger?: HTMLButtonElement;
  private popover?: HTMLElement;

  run(doc: Document = document): void {
    const { hostname } = doc.location;
    if (hostname !== "paper.nu" && hostname !== "www.paper.nu") return;

    const about = Array.from(doc.querySelectorAll("div.sticky.top-0.z-30.flex.w-full button"))
      .find((button) => button.textContent?.trim() === "About");
    if (about && this.trigger && about.nextElementSibling === this.trigger) return;

    if (this.trigger) this.cleanup(doc);
    if (!about) return;

    ensureStyle(doc, STYLE_ID, `
      ${enrollmentDatesStyles}
      button[popovertarget="${POPOVER_ID}"] {
        align-self: center;
        font: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        padding-inline: 8px;
        white-space: nowrap;
      }
      @media (max-width: 640px) {
        button[popovertarget="${POPOVER_ID}"] {
          white-space: normal;
          line-height: 1.1;
        }
      }
    `);
    const trigger = el(doc, "button", {
      class: about.className,
      text: "Enrollment Dates",
      attrs: { type: "button", popovertarget: POPOVER_ID }
    });
    const popover = createEnrollmentDatesPopover(doc, {
      id: POPOVER_ID,
      trigger,
      readTerm: () => readActiveTermNameFromDom(doc),
      openInNewTab: true
    });
    about.after(trigger);
    doc.body.append(popover);
    this.trigger = trigger;
    this.popover = popover;
  }

  cleanup(doc: Document = document): void {
    this.trigger?.remove();
    this.popover?.remove();
    this.trigger = undefined;
    this.popover = undefined;
    doc.getElementById(STYLE_ID)?.remove();
  }
}

export const paperEnrollmentDatesAugmentation = new PaperEnrollmentDatesAugmentation();
