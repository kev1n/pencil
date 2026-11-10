import { CAESAR_ORIGIN } from "../../shared/nu-hosts";
import { withSilentAuthRecovery } from "../auth/silent-recovery";
import { CaesarAuthRequiredError, isCaesarAuthRequiredError } from "../augmentations/class-search/caesar-search/types";
import { runPeopleSoftTask } from "../peoplesoft";
import { fetchPeopleSoftGetResult, fetchPeopleSoftResult, type PeopleSoftTextResponse } from "../peoplesoft/http";
import { buildActionParams, serializeForm } from "../peoplesoft/params";
import {
  CONTINUE_BUTTON_SELECTOR,
  getTermLabelForRadio,
  normalizeText,
  pickDefaultRadio,
  readCurrentTermSignature,
  TERM_RADIO_SELECTOR
} from "../augmentations/enrollment-navigation/term-picker";
import { readAppointments, type Appointment } from "./appointments";

export const APPOINTMENTS_URL =
  `${CAESAR_ORIGIN}/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_APPT.GBL?Action=A`;

const DATES_FIELD = "divNW_DERIVED_SS3_HTMLAREA";
const DATES_AREA = `[id$="${DATES_FIELD}"]`;

type RegistrationWindows = { heading: string; windows: string[] };
export type EnrollmentDates = RegistrationWindows & { appointments: Appointment[] };

function readDates(area: ParentNode | null): RegistrationWindows | null {
  const heading = area?.querySelector("h2, h3, h4")?.textContent?.trim();
  const windows = Array.from(area?.querySelectorAll("li") ?? [], (item) =>
    (item.textContent ?? "").replace(/\s+/g, " ").trim()
  ).filter(Boolean);
  return heading && windows.length > 0 ? { heading, windows } : null;
}

function buildPreview(
  dates: RegistrationWindows | null,
  appointments: Appointment[],
  term?: string
): EnrollmentDates | null {
  if (dates) return { ...dates, appointments };
  if (!appointments.length) return null;
  return { heading: term || "Registration appointments", windows: [], appointments };
}

function termKey(label: string): string {
  return normalizeText(label).toLowerCase();
}

function isAppointmentResponse(response: PeopleSoftTextResponse): boolean {
  const final = new URL(response.finalUrl);
  if (response.status === 401 || response.status === 403 ||
      final.hostname === "prd-nusso.it.northwestern.edu" ||
      final.hostname === "fed.it.northwestern.edu") {
    throw new CaesarAuthRequiredError();
  }
  return response.status === 200 && final.origin === CAESAR_ORIGIN;
}

export async function loadEnrollmentDates(doc: Document, requestedTerm?: string | null): Promise<EnrollmentDates | null> {
  const isCaesarPage = doc.location.origin === CAESAR_ORIGIN;
  if (isCaesarPage && !requestedTerm) {
    const onPage = buildPreview(readDates(doc.querySelector(DATES_AREA)), readAppointments(doc));
    if (onPage) return onPage;
  }
  const currentTerm = isCaesarPage ? readCurrentTermSignature(doc)?.term : undefined;
  const parser = new DOMParser();

  return withSilentAuthRecovery(() => runPeopleSoftTask("background", async () => {
    const initial = await fetchPeopleSoftGetResult(APPOINTMENTS_URL, { timeoutMs: 7000 });
    if (!isAppointmentResponse(initial)) return null;
    const page = parser.parseFromString(initial.text, "text/html");
    if (page.querySelector('input[type="password"]')) throw new CaesarAuthRequiredError();
    const dates = buildPreview(readDates(page.querySelector(DATES_AREA)), readAppointments(page));
    if (dates) {
      if (!requestedTerm) return dates;
      const term = readCurrentTermSignature(page)?.term;
      const headingWords = termKey(dates.heading).split(/\W+/);
      return termKey(term ?? "") === termKey(requestedTerm) ||
        termKey(requestedTerm).split(" ").every((word) => headingWords.includes(word))
        ? dates : null;
    }

    const form = page.querySelector<HTMLFormElement>('form[name="win0"]#SSR_SSENRL_APPT');
    const next = form?.querySelector(CONTINUE_BUTTON_SELECTOR);
    if (!form || !next?.id) return null;
    const radios = Array.from(form.querySelectorAll<HTMLInputElement>(TERM_RADIO_SELECTOR))
      .filter((radio) => !radio.disabled && radio.name);
    const targetTerm = termKey(requestedTerm ?? currentTerm ?? "");
    const matchingRadio = radios.find((radio) => termKey(getTermLabelForRadio(page, radio)) === targetTerm);
    const selected = requestedTerm ? matchingRadio : matchingRadio ?? pickDefaultRadio(page, radios);
    if (!selected) return null;
    for (const radio of radios) radio.checked = radio === selected;
    const params = buildActionParams(serializeForm(form), next.id);
    if (!params.has("ICSID")) throw new CaesarAuthRequiredError();
    const action = new URL(form.getAttribute("action") || initial.finalUrl, initial.finalUrl);
    if (action.origin !== CAESAR_ORIGIN) return null;

    const response = await fetchPeopleSoftResult(action.href, params, { timeoutMs: 7000 });
    if (!isAppointmentResponse(response)) return null;
    const rendered = parser.parseFromString(response.text, "text/html");
    let generalDates = readDates(rendered.querySelector(DATES_AREA));
    let appointments = readAppointments(rendered);
    const fields = parser.parseFromString(response.text, "application/xml").querySelectorAll("FIELD");
    for (const field of fields) {
      const html = field.textContent ?? "";
      const isDatesField = field.getAttribute("id")?.endsWith(DATES_FIELD);
      if (!isDatesField && !html.includes(DATES_FIELD) && !html.includes("STDNT_ENRL_A_VW$scroll$0")) continue;
      const fragment = parser.parseFromString(html, "text/html");
      generalDates ??= readDates(isDatesField ? fragment.body : fragment.querySelector(DATES_AREA));
      if (!appointments.length) appointments = readAppointments(fragment);
    }
    return buildPreview(generalDates, appointments, getTermLabelForRadio(page, selected));
  }, { owner: "enrollment-dates" }), isCaesarAuthRequiredError);
}
