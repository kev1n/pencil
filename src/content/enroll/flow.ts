// Registering for classes: CAESAR's own three steps (pick classes in the
// cart, confirm, results), run in the background. Shared by the Paper.nu
// Register button and Pencil's own apps.
import {
  buildActionParams,
  looksLikeError,
  serializeFormFromDoc
} from "../augmentations/class-search/caesar-search/forms";
import { parseAjaxFragment } from "../augmentations/class-search/caesar-search/parser";
import { CaesarAuthRequiredError, INSTITUTION_DEFAULT } from "../augmentations/class-search/caesar-search/types";
import { parseCartPage, parseClassText } from "../cart-cache/parse-cart-page";
import { replaceTermFromCartPage } from "../cart-cache/storage";
import { CART_URL } from "../cart-cache/reconcile";
import { runPeopleSoftTask } from "../peoplesoft";
import { fetchPeopleSoft, fetchPeopleSoftGet } from "../peoplesoft/http";
import { extractErrorMessage } from "../peoplesoft/parsers";
import { resolveActionUrl } from "../peoplesoft/shared";

// The cart page for a term. CAESAR picks the term itself unless the address
// names one, and naming one needs the student's career too, which the page
// CAESAR picks states. A sign-in page comes back as it is, for the caller
// to tell apart.
export async function cartPage(termId?: string | null, get: (url: string) => Promise<string> = fetchPeopleSoftGet): Promise<string> {
  const html = await get(CART_URL);
  const key = /PIA_KEYSTRUCT\s*=\s*\{[^}]*\}/.exec(html)?.[0] ?? "";
  const career = /ACAD_CAREER:"(\w+)"/.exec(key)?.[1];
  if (!termId || !career || /STRM:"(\d+)"/.exec(key)?.[1] === termId) return html;
  return get(`${CART_URL}&ACAD_CAREER=${career}&INSTITUTION=${INSTITUTION_DEFAULT}&STRM=${termId}`);
}

const CART_ENDPOINT = "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL";

// What CAESAR says at the top of a page when it won't go on.
export function pageMessage(doc: Document): string | null {
  const text = [...doc.querySelectorAll("[id^='DERIVED_SASSMSG_ERROR_TEXT']")]
    .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  return text || null;
}

function cellText(row: Element, idStart: string): string {
  return (row.querySelector(`[id^='${idStart}']`)?.textContent ?? "").replace(/\s+/g, " ").trim();
}

// One class in the cart. A discussion or lab that comes with a lecture has
// no tick box of its own on CAESAR's page: `pickable` is false for it.
export type CartRow = { classNumber: string; label: string; when: string; pickable: boolean };

// The cart for a term, read fresh from CAESAR, or CAESAR's reason for not
// showing one. Also brings the saved cart up to date.
export async function loadCartRows(termId: string): Promise<{ rows: CartRow[]; message: string | null }> {
  const html = await cartPage(termId);
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.querySelector("input[name='ICSID']")) throw new CaesarAuthRequiredError();
  const parsed = parseCartPage(doc, html);
  if (parsed) replaceTermFromCartPage(parsed.termId, parsed.cart, parsed.enrolled);
  const rows: CartRow[] = [];
  for (const cell of doc.querySelectorAll("[id^='win0divP_CLASS_NAME$']")) {
    const n = cell.id.slice("win0divP_CLASS_NAME$".length);
    const text = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
    const classNumber = parseClassText(text)?.classNumber;
    if (!classNumber) continue;
    rows.push({
      classNumber,
      label: text.replace(/\s*\(\d+\)$/, "").replace(/_/g, " "),
      when: (doc.getElementById(`DERIVED_REGFRM1_SSR_MTG_SCHED_LONG$${n}`)?.textContent ?? "").replace(/\s+/g, " ").trim(),
      pickable: Boolean(doc.getElementById(`P_SELECT$${n}`))
    });
  }
  return { rows, message: pageMessage(doc) };
}

// One class as CAESAR lists it on the confirm step.
export type EnrollLine = { label: string; title: string; when: string; units: string };
// One class's outcome on the results step.
export type EnrollResult = { label: string; ok: boolean; message: string };

export type EnrollOutcome =
  | { kind: "done"; results: EnrollResult[] }
  | { kind: "refused"; message: string };

function linesOf(doc: Document): EnrollLine[] {
  const lines: EnrollLine[] = [];
  for (const row of doc.querySelectorAll("tr[id^='trSSR_SS_ERD_VW$0_row']")) {
    const label = cellText(row, "win0divR_CLASS_NAME$");
    if (!label) continue;
    lines.push({
      label,
      title: cellText(row, "P_CLASS_DESCR$"),
      when: cellText(row, "DERIVED_REGFRM1_SSR_MTG_SCHED_LONG$"),
      units: cellText(row, "SSR_SS_ERD_VW_UNT_TAKEN$")
    });
  }
  return lines;
}

function resultsOf(doc: Document): EnrollResult[] {
  const results: EnrollResult[] = [];
  for (const row of doc.querySelectorAll("tr[id^='trSSR_SS_ERD_ER$0_row']")) {
    const label = cellText(row, "win0divR_CLASS_NAME$") || cellText(row, "R_CLASS_NAME$");
    const message = cellText(row, "win0divDERIVED_REGFRM1_SS_MESSAGE_LONG$") || cellText(row, "DERIVED_REGFRM1_SS_MESSAGE_LONG$");
    const status = row.querySelector("img[alt]")?.getAttribute("alt") ?? "";
    if (!label && !message) continue;
    results.push({ label: label.replace(/\s*\((\d+)\)$/, " ($1)"), message: message.replace(/^(Error|Message):\s*/i, ""), ok: /success/i.test(status) || (!status && /success|has been added|enrolled/i.test(message)) });
  }
  return results;
}

// Walks the steps for these classes: tick them in the cart, read CAESAR's
// confirm step, check it lists what was picked and nothing else, then press
// Finish Enrolling and read the results.
async function walk(termId: string, classNumbers: string[]): Promise<EnrollOutcome> {
  const refused = (message: string) => ({ kind: "refused" as const, message });
  const cartHtml = await cartPage(termId, fetchPeopleSoftGet);
  const cart = new DOMParser().parseFromString(cartHtml, "text/html");
  // No page session means CAESAR sent its sign-in page instead.
  if (!cart.querySelector("input[name='ICSID']")) throw new CaesarAuthRequiredError();

  // Tick the wanted classes, untick the rest.
  const params = serializeFormFromDoc(cart);
  const found = new Set<string>();
  for (const box of cart.querySelectorAll<HTMLInputElement>("input[type='checkbox'][id^='P_SELECT$']")) {
    const n = box.id.slice("P_SELECT$".length);
    const number = parseClassText(cellText(cart.body, `win0divP_CLASS_NAME$${n}`))?.classNumber;
    const wanted = Boolean(number && classNumbers.includes(number));
    if (wanted) found.add(number!);
    params.set(`P_SELECT$chk$${n}`, wanted ? "Y" : "N");
    if (wanted) params.set(`P_SELECT$${n}`, "Y");
    else params.delete(`P_SELECT$${n}`);
  }
  if (found.size === 0) return refused(pageMessage(cart) ?? "CAESAR’s shopping cart doesn’t have these classes for this term.");
  // A discussion or lab has no tick box of its own: it goes with its lecture.
  const listed = new Set(
    [...cart.querySelectorAll("[id^='win0divP_CLASS_NAME$']")].map((cell) => parseClassText((cell.textContent ?? "").replace(/\s+/g, " ").trim())?.classNumber)
  );
  if (classNumbers.some((number) => !listed.has(number))) return refused("Some of these classes are no longer in your CAESAR shopping cart. Refresh and try again.");

  const post = (endpoint: string, state: URLSearchParams, action: string) => fetchPeopleSoft(resolveActionUrl(endpoint), buildActionParams(state, action));
  const startXml = await post(CART_ENDPOINT, params, "DERIVED_REGFRM1_LINK_ADD_ENRL");
  if (looksLikeError(startXml)) return refused(extractErrorMessage(startXml) ?? "CAESAR wouldn’t start enrollment.");
  // CAESAR answers by sending the browser on to the confirm step.
  const onward = /document\.location='([^']+SSR_SSENRL_ADD\.GBL[^']*)'/.exec(startXml)?.[1]?.replace(/\/csnu_\d+\//, "/csnu/");
  if (!onward) return refused(pageMessage(parseAjaxFragment(startXml)) ?? "CAESAR didn’t show the confirm step. Try again.");
  const confirmHtml = await fetchPeopleSoftGet(onward);
  const confirm = new DOMParser().parseFromString(confirmHtml, "text/html");
  const submitId = /id='(DERIVED_REGFRM1_SSR_PB_SUBMIT[^']*)'/.exec(confirmHtml)?.[1];
  const lines = linesOf(confirm);
  if (!submitId || lines.length === 0) return refused(pageMessage(confirm) ?? "CAESAR didn’t show the confirm step. Try again.");
  // A line with units is a class picked in its own right; a discussion or
  // lab that comes with one has none.
  const number = (line: EnrollLine) => /\((\d+)\)\s*$/.exec(line.label)?.[1] ?? "";
  const confirmed = new Set(lines.map(number));
  if ([...found].some((n) => !confirmed.has(n)) || lines.some((line) => line.units && !found.has(number(line)))) {
    return refused("CAESAR’s confirm step didn’t match what you picked, so nothing was sent. Refresh and try again.");
  }
  const resultXml = await post(new URL(onward).pathname, serializeFormFromDoc(confirm), submitId);
  if (looksLikeError(resultXml)) return refused(extractErrorMessage(resultXml) ?? "CAESAR returned an error. Check your schedule in CAESAR before trying again.");
  const page = parseAjaxFragment(resultXml);
  const results = resultsOf(page);
  if (results.length > 0) return { kind: "done", results };
  // An answer in a shape this doesn't know: show CAESAR's own words.
  const said = pageMessage(page) ?? (page.body.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  return { kind: "done", results: [{ label: "CAESAR’s answer", ok: false, message: said }] };
}

// Registers for these cart classes.
export function enrollFromCart(termId: string, classNumbers: string[], owner = "enroll"): Promise<EnrollOutcome> {
  return runPeopleSoftTask("user", () => walk(termId, classNumbers), { owner, label: "Enroll" });
}
