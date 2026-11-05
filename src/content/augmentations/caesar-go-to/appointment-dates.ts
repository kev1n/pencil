import { CAESAR_ORIGIN } from "../../../shared/nu-hosts";
import { runPeopleSoftTask } from "../../peoplesoft";
import { fetchPeopleSoftGetResult, fetchPeopleSoftResult } from "../../peoplesoft/http";
import { buildActionParams, serializeForm } from "../../peoplesoft/params";
import {
  CONTINUE_BUTTON_SELECTOR,
  getTermLabelForRadio,
  pickDefaultRadio,
  readCurrentTermSignature,
  TERM_RADIO_SELECTOR
} from "../enrollment-navigation/term-picker";

export const APPOINTMENTS_URL =
  `${CAESAR_ORIGIN}/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_APPT.GBL?Action=A`;

const DATES_FIELD = "divNW_DERIVED_SS3_HTMLAREA";
const DATES_AREA = `[id$="${DATES_FIELD}"]`;

export type EnrollmentDates = { heading: string; windows: string[] };

function readDates(area: ParentNode | null): EnrollmentDates | null {
  const heading = area?.querySelector("h2, h3, h4")?.textContent?.trim();
  const windows = Array.from(area?.querySelectorAll("li") ?? [], (item) =>
    (item.textContent ?? "").replace(/\s+/g, " ").trim()
  ).filter(Boolean);
  return heading && windows.length > 0 ? { heading, windows } : null;
}

export async function loadEnrollmentDates(doc: Document): Promise<EnrollmentDates | null> {
  const onPage = readDates(doc.querySelector(DATES_AREA));
  if (onPage) return onPage;
  const currentTerm = readCurrentTermSignature(doc)?.term;
  const parser = new DOMParser();

  return runPeopleSoftTask("background", async () => {
    const initial = await fetchPeopleSoftGetResult(APPOINTMENTS_URL, { timeoutMs: 7000 });
    if (initial.status !== 200) return null;
    const page = parser.parseFromString(initial.text, "text/html");
    const dates = readDates(page.querySelector(DATES_AREA));
    if (dates) return dates;

    const form = page.querySelector<HTMLFormElement>('form[name="win0"]#SSR_SSENRL_APPT');
    const next = form?.querySelector(CONTINUE_BUTTON_SELECTOR);
    if (!form || !next?.id) return null;
    const radios = Array.from(form.querySelectorAll<HTMLInputElement>(TERM_RADIO_SELECTOR))
      .filter((radio) => !radio.disabled && radio.name);
    const selected = radios.find((radio) => getTermLabelForRadio(page, radio) === currentTerm) ??
      pickDefaultRadio(page, radios);
    if (!selected) return null;
    for (const radio of radios) radio.checked = radio === selected;
    const params = buildActionParams(serializeForm(form), next.id);
    if (!params.has("ICSID")) return null;
    const action = new URL(form.getAttribute("action") || initial.finalUrl, initial.finalUrl);
    if (action.origin !== CAESAR_ORIGIN) return null;

    const response = await fetchPeopleSoftResult(action.href, params, { timeoutMs: 7000 });
    if (response.status !== 200) return null;
    const rendered = readDates(parser.parseFromString(response.text, "text/html").querySelector(DATES_AREA));
    if (rendered) return rendered;
    const fields = parser.parseFromString(response.text, "application/xml").querySelectorAll("FIELD");
    for (const field of fields) {
      const html = field.textContent ?? "";
      const isDatesField = field.getAttribute("id")?.endsWith(DATES_FIELD);
      if (!isDatesField && !html.includes(DATES_FIELD)) continue;
      const fragment = parser.parseFromString(html, "text/html");
      const dates = readDates(isDatesField ? fragment.body : fragment.querySelector(DATES_AREA));
      if (dates) return dates;
    }
    return null;
  }, { owner: "caesar-bookmarks:enrollment-dates" });
}
