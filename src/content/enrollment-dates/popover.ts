import { logQuiet } from "../../shared/log";
import { isCaesarAuthRequiredError } from "../augmentations/class-search/caesar-search/types";
import { createActionButton, el } from "../framework";
import { CaesarConnectionError } from "../peoplesoft/connection";
import { formatAppointmentTime, googleCalendarUrl, type Appointment } from "./appointments";
import { APPOINTMENTS_URL, loadEnrollmentDates } from "./appointment-dates";

function renderAppointments(doc: Document, appointments: Appointment[]): HTMLElement {
  const host = el(doc, "div");
  // Personal appointment times and Calendar links live in a closed shadow root.
  const root = host.attachShadow({ mode: "closed" });
  root.append(
    el(doc, "style", { text: `
      :host { display: block; }
      h3 { margin: 0; color: var(--bc-color-text-muted); font-size: 12px; font-weight: 600; }
      article { padding: 10px 0; }
      article + article { border-top: 1px solid var(--bc-color-border); }
      strong { display: block; font-size: 14px; }
      p { margin: 1px 0 0; }
      .ends { color: var(--bc-color-text-muted); font-size: 12px; }
      a { display: inline-block; margin-top: 4px; color: var(--bc-color-accent); font-size: 12px; text-underline-offset: 3px; }
    ` }),
    el(doc, "h3", { text: "Your registration appointments" }),
    ...appointments.map((appointment) => el(doc, "article", {}, [
      el(doc, "strong", { text: appointment.label }),
      el(doc, "p", { text: formatAppointmentTime(appointment.startsAt) }),
      appointment.endsAt === null ? null :
        el(doc, "p", { class: "ends", text: `Closes ${formatAppointmentTime(appointment.endsAt)}` }),
      el(doc, "a", {
        text: "Add to Google Calendar ↗",
        attrs: {
          href: googleCalendarUrl(appointment), target: "_blank", rel: "noopener noreferrer",
          "aria-label": `Add ${appointment.label} to Google Calendar`
        }
      })
    ]))
  );
  return host;
}

type PopoverOptions = {
  id: string;
  trigger: HTMLElement;
  readTerm?: () => string | null;
  openInNewTab?: boolean;
};

export function createEnrollmentDatesPopover(
  doc: Document,
  { id, trigger, readTerm, openInNewTab }: PopoverOptions
): HTMLElement {
  const content = el(doc, "div", { attrs: { "aria-live": "polite" } });
  const popover = el(doc, "section", {
    class: "bc-enrollment-dates",
    attrs: { id, popover: "auto", "aria-label": "Enrollment Dates" }
  }, [
    el(doc, "h2", { text: "Enrollment Dates" }),
    content,
    el(doc, "a", {
      text: openInNewTab ? "Open Enrollment Dates in CAESAR ↗" : "Open Enrollment Dates →",
      attrs: {
        href: APPOINTMENTS_URL,
        target: openInNewTab ? "_blank" : undefined,
        rel: openInNewTab ? "noopener noreferrer" : undefined
      }
    })
  ]);

  let pending: { term: string | null | undefined } | undefined;

  async function refresh(): Promise<void> {
    const term = readTerm?.();
    if (pending && pending.term === term) return;
    const request = { term };
    pending = request;
    content.textContent = "Loading registration dates…";
    try {
      const dates = await loadEnrollmentDates(doc, term);
      if (pending !== request) return;
      if (!dates) {
        content.textContent = term
          ? `CAESAR didn’t return dates for ${term}. Check that term on the full page.`
          : "CAESAR didn’t return registration dates. Check your quarter on the full page.";
        return;
      }
      content.replaceChildren(dates.appointments.length
        ? renderAppointments(doc, dates.appointments)
        : el(doc, "p", { class: "bc-dates-note", text: "No assigned appointments are listed for this quarter." }));
      if (dates.windows.length) {
        content.append(el(doc, "details", {
          class: "bc-dates-windows", attrs: { open: dates.appointments.length ? undefined : "" }
        }, [
          el(doc, "summary", { text: dates.heading }),
          el(doc, "ul", {}, dates.windows.map((text) => el(doc, "li", { text })))
        ]));
      }
    } catch (error: unknown) {
      logQuiet("enrollment-dates", error);
      if (pending !== request) return;
      let message = "Couldn’t load enrollment dates. Try again in a moment.";
      if (isCaesarAuthRequiredError(error)) {
        message = "Sign in to CAESAR using the link below, then try again here.";
      } else if (error instanceof CaesarConnectionError) {
        message = "Couldn’t reach CAESAR. If you just connected to VPN, try again or check that CAESAR opens below.";
      }
      const retry = createActionButton({
        doc,
        label: "Try again",
        className: "bc-btn bc-btn--secondary bc-btn--sm",
        onClick: refresh
      });
      content.replaceChildren(el(doc, "p", { class: "bc-dates-note", text: message }), retry.element);
    } finally {
      if (pending === request) pending = undefined;
    }
  }

  popover.addEventListener("toggle", () => {
    if (!popover.matches(":popover-open")) return;
    const bounds = trigger.getBoundingClientRect();
    const width = doc.documentElement.clientWidth;
    const top = Math.ceil(bounds.bottom) + 6;
    popover.style.top = `${top}px`;
    popover.style.maxHeight = `calc(100dvh - ${top + 12}px)`;
    popover.style.right = `${Math.max(12, Math.min(width - bounds.right, width - popover.offsetWidth - 12))}px`;
    void refresh();
  });
  return popover;
}
