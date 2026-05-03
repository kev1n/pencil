import { runPeopleSoftTask } from "../../peoplesoft";
import { fetchPeopleSoft, fetchPeopleSoftGet } from "../../peoplesoft/http";
import { extractHiddenInputs } from "../../peoplesoft/params";
import { extractErrorMessage } from "../../peoplesoft/parsers";
import {
  DEFAULT_CAREER_FIELD,
  DEFAULT_CLASS_FIELD,
  DEFAULT_INSTITUTION_FIELD,
  DEFAULT_TERM_FIELD,
  decodeEntities,
  resolveActionUrl,
  SEARCH_ENDPOINT,
  SEARCH_ENTRY_URL
} from "../../peoplesoft/shared";
import type { LookupClassSuccess } from "../../../shared/messages";

import { bareCatalogNumber, formatCatalogForDisplay } from "./catalog-format";

// CAESAR row, parsed from the search results page. We keep enough info to
// render a "live status" badge inline AND to drive the add-to-cart chain.
export type CaesarSection = {
  classNumber: string;
  sectionLabel: string; // e.g. "1-LEC", "01-TUT"
  sectionNumber: string; // e.g. "1", "01"
  component: string; // "LEC", "DIS", "LAB", "TUT", "SEM", ...
  daysTime: string;
  room: string;
  instructor: string;
  meetingDates: string;
  grading: string;
  status: CaesarStatus;
  selectActionId: string; // SSR_PB_SELECT$N
  // CAESAR omits the Select button when the user already has the section in
  // their shopping cart — the actions cell is empty. We surface that here
  // so cart-add can short-circuit with a clear message instead of issuing
  // a doomed POST.
  selectAvailable: boolean;
  rowIndex: number; // N
};

export type CaesarStatus = "Open" | "Closed" | "Wait List" | "Unknown";

export type CaesarCourseGroup = {
  courseId: string; // "COMP_SCI  111-0 - Fundamentals of Computer Programming"
  catalog: string; // "111-0"
  title: string; // "Fundamentals of Computer Programming"
  sections: CaesarSection[];
};

export type CaesarSearchResult = {
  groups: CaesarCourseGroup[];
};

export type CaesarSearchInput = {
  termId: string;
  career: string;
  institution: string;
  subject: string;
  bareCatalog: string; // bare number — NOT the full "111-0"
};

export type CartFlowResult =
  | {
      ok: true;
      classNumber: string;
      sectionLabel: string;
      courseTitle: string;
      // Raw SSR_CLSRCH_DTL HTML from the cart chain's MTG_CLASSNAME step.
      // Includes capacity, enrollment totals, class notes, etc. Caller
      // pipes this through seats-notes' parser to populate the shared
      // cache so the shopping-cart augmentation sees the data without
      // any extra fetches.
      detailHtml: string;
      // Same payload, pre-shaped as a LookupClassResponse so the caller
      // can hand it straight to `toSeatsNotesResult` without rebuilding
      // a synthetic search/detail pair.
      seatsNotesPayload: LookupClassSuccess;
      // Parsed groups from the class-number search response. Always
      // contains the matched group with one section row carrying live
      // status / instructor / room. Caller can stamp this into its
      // live-status cache so badges populate on the section row without
      // a separate "Load CAESAR data" subject search.
      searchGroups: CaesarCourseGroup[];
    }
  | {
      ok: false;
      error: string;
      classNumber?: string;
      // True when CAESAR returned the section row but omitted the Select
      // button — meaning the user already has it in their shopping cart.
      // The UI uses this to render a friendlier "Already in cart" state
      // instead of a generic failure.
      alreadyInCart?: boolean;
      detailHtml?: string;
      seatsNotesPayload?: LookupClassSuccess;
      searchGroups?: CaesarCourseGroup[];
    };

export type CartFlowInput = {
  classNumber: string; // 5-digit CAESAR class number (e.g. "34612")
  termId: string;
  career: string;
  institution: string;
};

const INSTITUTION_DEFAULT = "NWUNV";

// ────────────────────────────────────────────────────────────────────────────
// Public API

// Display-only search. Runs CAESAR's catalog search for `subject` + bare
// number, returns parsed groups. Each call advances PeopleSoft state by one
// step but the user never sees it because we never touch the live form.
export async function searchCaesarCatalog(
  input: CaesarSearchInput
): Promise<CaesarSearchResult> {
  return runPeopleSoftTask(
    "user",
    () => searchCaesarCatalogInternal(input),
    { owner: "class-search-discover" }
  );
}

// Drives the full Search → Select → Next chain to put a section in the cart.
// Always restarts from the entry page so the wizard's state matches.
export async function addSectionToCart(input: CartFlowInput): Promise<CartFlowResult> {
  return runPeopleSoftTask(
    "user",
    () => addSectionToCartInternal(input),
    { owner: "class-search-add" }
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Implementation

type FailExtras = {
  classNumber?: string;
  alreadyInCart?: boolean;
  detailHtml?: string;
  seatsNotesPayload?: LookupClassSuccess;
  searchGroups?: CaesarCourseGroup[];
};

function fail(error: string, extras: FailExtras = {}): CartFlowResult {
  return { ok: false, error, ...extras };
}

async function searchCaesarCatalogInternal(
  input: CaesarSearchInput
): Promise<CaesarSearchResult> {
  const entryHtml = await fetchPeopleSoftGet(resolveActionUrl(SEARCH_ENTRY_URL));
  const entryDoc = parseAjaxFragment(entryHtml);
  const baseParams = serializeFormFromDoc(entryDoc);
  if (!baseParams.has("ICSID")) {
    throw new Error("Missing PeopleSoft session — try refreshing the page.");
  }

  const searchParams = buildSearchPostParams(baseParams, input);
  const searchHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), searchParams);
  if (looksLikeError(searchHtml)) {
    throw new Error(extractErrorMessage(searchHtml) ?? "CAESAR search returned an error.");
  }

  const groups = parseCaesarGroups(searchHtml);
  return { groups };
}

async function addSectionToCartInternal(input: CartFlowInput): Promise<CartFlowResult> {
  try {
    const classNumber = input.classNumber.trim();
    if (!classNumber) {
      return { ok: false, error: "Missing CAESAR class number — load CAESAR data first." };
    }

    // Step 1: GET the search entry page to seed PeopleSoft session state.
    const entryHtml = await fetchPeopleSoftGet(resolveActionUrl(SEARCH_ENTRY_URL));
    const entryDoc = parseAjaxFragment(entryHtml);
    const baseParams = serializeFormFromDoc(entryDoc);
    if (!baseParams.has("ICSID")) {
      return { ok: false, error: "Missing PeopleSoft session — try refreshing the page." };
    }

    // Step 2: POST class-number search → search results page.
    const searchPost = buildClassNumberSearchParams(baseParams, {
      termId: input.termId,
      career: input.career,
      institution: input.institution,
      classNumber
    });
    const searchHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), searchPost);
    if (looksLikeError(searchHtml)) {
      return fail(extractErrorMessage(searchHtml) ?? "CAESAR search returned an error.", { classNumber });
    }

    const groups = parseCaesarGroups(searchHtml);
    const match = locateByClassNumber(groups, classNumber);
    if (!match) {
      return fail(`Couldn't find class #${classNumber} on CAESAR for this term.`, {
        classNumber,
        searchGroups: groups
      });
    }

    // CAESAR omits the Select button when the section is already in the
    // user's cart. We use that signal as our early "already in cart" exit
    // even though we no longer POST that button — going further would just
    // hit a generic CAESAR error a couple of round-trips later.
    if (!match.section.selectAvailable) {
      return fail(`Class #${classNumber} is already in your shopping cart.`, {
        classNumber,
        alreadyInCart: true,
        searchGroups: groups
      });
    }

    // Step 3: POST MTG_CLASSNAME$N → SSR_CLSRCH_DTL ("Class Detail").
    // Going through the section-name link instead of the row's Select
    // button gets us the canonical SSR_CLSRCH_DTL page in the same hop —
    // that page carries the SSR_CLS_DTL_WRK_* fields the seats-notes
    // parser needs, so we don't have to issue a second GET-entry +
    // search + MTG_CLASSNAME chain to warm the cache afterward.
    const searchState = extractHiddenInputs(searchHtml);
    const mtgActionId = `MTG_CLASSNAME$${match.section.rowIndex}`;
    const detailParams = buildActionParams(searchState, mtgActionId);
    const detailHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), detailParams);
    if (looksLikeError(detailHtml)) {
      return fail(extractErrorMessage(detailHtml) ?? "CAESAR rejected the section selection.", {
        classNumber: match.section.classNumber,
        detailHtml,
        searchGroups: groups
      });
    }

    // Shape the detail page into the LookupClassResponse contract so the
    // caller can pipe it straight through `toSeatsNotesResult`.
    const seatsNotesPayload = buildSeatsNotesPayloadFromDetail(
      match.section.classNumber,
      detailHtml
    );

    // Steps 4+: walk the DERIVED_CLS_DTL_NEXT_PB chain until CAESAR stops
    // offering one. Reaching SSR_CLSRCH_DTL gives us a "Select Class"
    // (NEXT_PB) button that advances to the wizard's "Confirm Your
    // Selection" page; that page also has a NEXT_PB button that finally
    // commits the cart-add. Walking the chain instead of hard-coding two
    // hops keeps us robust if CAESAR ever drops or adds an intermediate
    // step (e.g. preferences) for some sections.
    let currentHtml = detailHtml;
    const MAX_NEXT_HOPS = 3;
    let hops = 0;
    while (hops < MAX_NEXT_HOPS) {
      const nextActionId = findNextActionId(currentHtml);
      if (!nextActionId) break;
      hops += 1;
      const state = extractHiddenInputs(currentHtml);
      const nextParams = buildActionParams(state, nextActionId);
      const nextHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), nextParams);
      if (looksLikeError(nextHtml)) {
        return fail(extractErrorMessage(nextHtml) ?? "CAESAR refused to add the class.", {
          classNumber: match.section.classNumber,
          detailHtml,
          seatsNotesPayload,
          searchGroups: groups
        });
      }
      currentHtml = nextHtml;
    }
    if (hops === 0) {
      return fail("Section needs extra confirmation in CAESAR. Use Classic Search for this one.", {
        classNumber: match.section.classNumber,
        detailHtml,
        seatsNotesPayload,
        searchGroups: groups
      });
    }

    const success = isCartLandingPage(currentHtml, match.section.classNumber);
    if (!success.ok) {
      return fail(success.reason, {
        classNumber: match.section.classNumber,
        detailHtml,
        seatsNotesPayload,
        searchGroups: groups
      });
    }

    return {
      ok: true,
      classNumber: match.section.classNumber,
      sectionLabel: match.section.sectionLabel,
      courseTitle: match.group.title,
      detailHtml,
      seatsNotesPayload,
      searchGroups: groups
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Re-package an SSR_CLSRCH_DTL HTML response into the LookupClassResponse
// shape so the seats-notes parser can consume it without changes. Only
// the fields `toSeatsNotesResult` actually reads need to be populated.
function buildSeatsNotesPayloadFromDetail(
  classNumber: string,
  detailHtml: string
): LookupClassSuccess {
  return {
    ok: true,
    requestedClassNumber: classNumber,
    criteriaClassNumber: classNumber,
    firstResultClassNumber: classNumber,
    firstResultCourseTitle: null,
    firstResultSection: null,
    firstResultInstructor: null,
    firstResultDaysTimes: null,
    firstResultRoom: null,
    firstResultMeetingDates: null,
    firstResultGrading: null,
    firstResultStatus: null,
    nextActionForDetails: null,
    searchPageId: null,
    detailPageId: "SSR_CLSRCH_DTL",
    detailResponseText: detailHtml
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Parsing

// CAESAR's AJAX response is XML with HTML inside CDATA. We pull out the
// PAGECONTAINER FIELD and let the browser's parser do the heavy lifting.
function parseAjaxFragment(payload: string): Document {
  const cdataMatch = /<FIELD\s+id=['"]win0divPAGECONTAINER['"][^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/FIELD>/i.exec(
    payload
  );
  const html = cdataMatch?.[1] ?? payload;
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html");
}

function parseCaesarGroups(searchHtml: string): CaesarCourseGroup[] {
  const doc = parseAjaxFragment(searchHtml);
  const groups: CaesarCourseGroup[] = [];

  const groupHeaders = doc.querySelectorAll<HTMLElement>("[id^='win0divSSR_CLSRSLT_WRK_GROUPBOX2$']");
  for (const header of Array.from(groupHeaders)) {
    if (header.id.startsWith("win0divSSR_CLSRSLT_WRK_GROUPBOX2GP$")) continue;
    const idMatch = /\$(\d+)$/.exec(header.id);
    if (!idMatch) continue;

    const groupTitle =
      header.querySelector<HTMLAnchorElement>("[id^='SSR_CLSRSLT_WRK_GROUPBOX2$']")?.title ??
      "";
    const cleanedTitle = decodeEntities(
      groupTitle.replace(/^Collapse section\s+/i, "").replace(/^Expand section\s+/i, "")
    );
    const parsed = splitCourseIdAndTitle(cleanedTitle);

    const sections: CaesarSection[] = [];
    const rowAnchors = header.querySelectorAll<HTMLElement>("[id^='MTG_CLASS_NBR$']");
    for (const anchor of Array.from(rowAnchors)) {
      const rowMatch = /\$(\d+)$/.exec(anchor.id);
      if (!rowMatch) continue;
      const rowIndex = Number(rowMatch[1]);
      const section = parseSectionRow(doc, rowIndex);
      if (section) sections.push(section);
    }

    if (sections.length === 0) continue;

    groups.push({
      courseId: cleanedTitle,
      catalog: parsed.catalog,
      title: parsed.title,
      sections
    });
  }

  return groups;
}

function parseSectionRow(doc: Document, rowIndex: number): CaesarSection | null {
  const classAnchor = doc.querySelector<HTMLElement>(`#MTG_CLASS_NBR\\$${rowIndex}`);
  if (!classAnchor) return null;
  const classNumber = (classAnchor.textContent ?? "").trim();
  if (!classNumber) return null;

  const sectionEl = doc.querySelector<HTMLElement>(`#MTG_CLASSNAME\\$${rowIndex}`);
  const sectionRaw = (sectionEl?.textContent ?? "").trim();
  const sectionLabel = sectionRaw.split(/\n/)[0]?.trim() ?? "";
  const sectionMatch = /^(\w+?)-(\w+)/.exec(sectionLabel);
  const sectionNumber = sectionMatch?.[1] ?? "";
  const component = sectionMatch?.[2] ?? "";

  const daysTime = textById(doc, `MTG_DAYTIME\\$${rowIndex}`);
  const room = textById(doc, `MTG_ROOM\\$${rowIndex}`);
  const instructor = textById(doc, `MTG_INSTR\\$${rowIndex}`);
  const meetingDates = textById(doc, `MTG_TOPIC\\$${rowIndex}`);
  const grading = textById(doc, `NW_DERIVED_SS3_DESCR\\$${rowIndex}`);
  const status = parseStatus(doc, rowIndex);

  // The Select button is rendered inside `#win0divSSR_PB_SELECT$N`. CAESAR
  // omits it (cell shows just "&nbsp;") when the section is already in the
  // user's shopping cart — we use that absence as our "already in cart"
  // signal further up the call chain.
  const selectButton = doc.querySelector<HTMLElement>(
    `#win0divSSR_PB_SELECT\\$${rowIndex} input[type='button']`
  );

  return {
    classNumber,
    sectionLabel,
    sectionNumber,
    component,
    daysTime,
    room,
    instructor,
    meetingDates,
    grading,
    status,
    selectActionId: `SSR_PB_SELECT$${rowIndex}`,
    selectAvailable: selectButton !== null,
    rowIndex
  };
}

function parseStatus(doc: Document, rowIndex: number): CaesarStatus {
  const statusEl = doc.querySelector<HTMLElement>(
    `#win0divDERIVED_CLSRCH_SSR_STATUS_LONG\\$${rowIndex} img`
  );
  const alt = (statusEl?.getAttribute("alt") ?? "").toLowerCase();
  if (alt.includes("open")) return "Open";
  if (alt.includes("closed")) return "Closed";
  if (alt.includes("wait")) return "Wait List";
  return "Unknown";
}

function textById(doc: Document, escapedId: string): string {
  const el = doc.querySelector<HTMLElement>(`#${escapedId}`);
  if (!el) return "";
  // Replace <br> with newlines first so "MoWeFr 1:00PM - 1:50PM\n" stays
  // legible on consumers that prefer single-line.
  const html = el.innerHTML.replace(/<br\s*\/?>/gi, "\n");
  const tmp = doc.createElement("div");
  tmp.innerHTML = html;
  return decodeEntities(tmp.textContent ?? "").trim();
}

// "COMP_SCI  111-0 - Fundamentals of Computer Programming"
//   → catalog "111-0", title "Fundamentals of Computer Programming"
function splitCourseIdAndTitle(value: string): { catalog: string; title: string } {
  const trimmed = value.trim();
  const match = /^(\S+)\s+(\S+)\s*-\s*(.*)$/.exec(trimmed);
  if (!match) return { catalog: "", title: trimmed };
  return { catalog: match[2] ?? "", title: (match[3] ?? "").trim() };
}

// ────────────────────────────────────────────────────────────────────────────
// Shared matching helpers (exported so both the cart flow in this module AND
// the live-data overlay in augmentation.ts converge on identical semantics).

// Compare a paper.nu catalog against the catalog string CAESAR put on the
// course-group title. Paper.nu may give us "111" (because the user-facing `n`
// field drops the "-0" suffix) while CAESAR labels the group "111-0", or vice
// versa. We try exact first, then both directions of the "-0" tolerance.
export function matchCaesarGroup(
  groups: CaesarCourseGroup[],
  paperCatalog: string
): CaesarCourseGroup | null {
  const wantExact = paperCatalog.toLowerCase();
  const exact = groups.find((g) => g.catalog.toLowerCase() === wantExact);
  if (exact) return exact;

  // Paper.nu side stripped of trailing "-0" (their display form).
  const wantStripped = formatCatalogForDisplay(paperCatalog).toLowerCase();
  // Same paper.nu form with explicit "-0" appended (the CAESAR-canonical form).
  const wantWithZero = `${wantStripped}-0`;

  return (
    groups.find((g) => {
      const have = g.catalog.toLowerCase();
      if (have === wantStripped) return true;
      if (have === wantWithZero) return true;
      // Reverse direction: CAESAR's group catalog has "-0", paper.nu didn't.
      const haveStripped = have.replace(/-0$/, "");
      return haveStripped === wantStripped;
    }) ?? null
  );
}

// Find a section within a CAESAR group by number + component. Both sides
// occasionally pad the section number ("01" vs "1") so we collapse leading
// zeros on each before comparing.
export function matchCaesarSection(
  group: CaesarCourseGroup,
  sectionNumber: string,
  component: string
): CaesarSection | null {
  const wantNum = normalizeSectionNumber(sectionNumber).toLowerCase();
  const wantComp = component.toUpperCase();
  return (
    group.sections.find(
      (s) =>
        normalizeSectionNumber(s.sectionNumber).toLowerCase() === wantNum &&
        s.component.toUpperCase() === wantComp
    ) ?? null
  );
}

// Collapse leading zeros so "01" → "1", "001" → "1". Special-case: a value
// that's purely zeros ("0", "00") collapses to a single "0" — never empty —
// because section "0" is technically distinct from a missing section.
function normalizeSectionNumber(value: string): string {
  if (!value) return value;
  const stripped = value.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

// Class-number search returns a single group with a single row whose class
// number matches exactly. We still walk all groups defensively in case
// CAESAR ever returns a wider result set.
function locateByClassNumber(
  groups: CaesarCourseGroup[],
  classNumber: string
): { group: CaesarCourseGroup; section: CaesarSection } | null {
  const want = classNumber.trim();
  for (const group of groups) {
    for (const section of group.sections) {
      if (section.classNumber === want) return { group, section };
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Form parameter helpers

function buildSearchPostParams(base: URLSearchParams, input: CaesarSearchInput): URLSearchParams {
  const params = new URLSearchParams(base.toString());
  params.set("ICAJAX", "1");
  params.set("ICNAVTYPEDROPDOWN", "0");
  params.set("ICAction", "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH");
  params.set("ICResubmit", "0");
  params.set("ICChanged", "-1");
  params.set("ICActionPrompt", "false");
  params.set("ICBcDomData", "UnknownValue");
  params.set("ICPanelHelpUrl", "");
  params.set("ICPanelName", "");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");

  setAllWithPrefix(params, "CLASS_SRCH_WRK2_INSTITUTION", input.institution || INSTITUTION_DEFAULT);
  setAllWithPrefix(params, "CLASS_SRCH_WRK2_STRM", input.termId);
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_SUBJECT_SRCH", input.subject);
  // CAESAR's catalog field stores the bare number; using "contains" lets us
  // recover both "111-0" and variants ("111-SG"); we filter to the exact one
  // by reading the result group titles.
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_CATALOG_NBR", input.bareCatalog);
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_SSR_EXACT_MATCH1", "C");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_ACAD_CAREER", input.career);
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$", "N");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_CLASS_NBR", "");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_DESCR", "");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_LAST_NAME", "");

  return params;
}

function buildClassNumberSearchParams(
  base: URLSearchParams,
  input: { termId: string; career: string; institution: string; classNumber: string }
): URLSearchParams {
  const params = new URLSearchParams(base.toString());
  params.set("ICAJAX", "1");
  params.set("ICNAVTYPEDROPDOWN", "0");
  params.set("ICAction", "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH");
  params.set("ICResubmit", "0");
  params.set("ICChanged", "-1");
  params.set("ICActionPrompt", "false");
  params.set("ICBcDomData", "UnknownValue");
  params.set("ICPanelHelpUrl", "");
  params.set("ICPanelName", "");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");

  // The class-number input lives in PeopleSoft's "Additional Search
  // Criteria" section, which is collapsed on a fresh entry GET — the
  // field isn't in the form HTML, so prefix discovery finds nothing.
  // Fall back to the canonical positional suffixes from shared.ts.
  const institutionField = findFieldNameInParams(params, "CLASS_SRCH_WRK2_INSTITUTION") ?? DEFAULT_INSTITUTION_FIELD;
  const termField = findFieldNameInParams(params, "CLASS_SRCH_WRK2_STRM") ?? DEFAULT_TERM_FIELD;
  const careerField = findFieldNameInParams(params, "SSR_CLSRCH_WRK_ACAD_CAREER") ?? DEFAULT_CAREER_FIELD;
  const classField = findFieldNameInParams(params, "SSR_CLSRCH_WRK_CLASS_NBR") ?? DEFAULT_CLASS_FIELD;
  const openOnlyField = findFieldNameInParams(params, "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$") ?? "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$3";

  // Wipe any pre-existing values for the criteria we don't want to apply
  // so a leftover value from a previous interaction doesn't leak in.
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_SUBJECT_SRCH", "");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_CATALOG_NBR", "");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_SSR_EXACT_MATCH1", "C");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_DESCR", "");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_LAST_NAME", "");

  params.set(institutionField, input.institution || INSTITUTION_DEFAULT);
  params.set(termField, input.termId);
  params.set(careerField, input.career);
  params.set(openOnlyField, "N");
  params.set(classField, input.classNumber);

  return params;
}

function findFieldNameInParams(params: URLSearchParams, prefix: string): string | null {
  let found: string | null = null;
  params.forEach((_value, key) => {
    if (found === null && key.startsWith(prefix)) found = key;
  });
  return found;
}

function buildActionParams(base: URLSearchParams, actionId: string): URLSearchParams {
  const params = new URLSearchParams(base.toString());
  params.set("ICAJAX", "1");
  params.set("ICNAVTYPEDROPDOWN", "0");
  params.set("ICAction", actionId);
  params.set("ICResubmit", "0");
  params.set("ICActionPrompt", "false");
  params.set("ICBcDomData", "UnknownValue");
  params.set("ICPanelHelpUrl", "");
  params.set("ICPanelName", "");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");
  if (!params.has("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$")) {
    params.set("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$", "");
  }
  return params;
}

function setAllWithPrefix(params: URLSearchParams, prefix: string, value: string): void {
  let touched = false;
  const keys: string[] = [];
  params.forEach((_v, key) => keys.push(key));
  for (const key of keys) {
    if (!key.startsWith(prefix)) continue;
    params.set(key, value);
    touched = true;
  }
  if (!touched) params.set(prefix, value);
}

function serializeFormFromDoc(doc: Document): URLSearchParams {
  const params = new URLSearchParams();
  const form = doc.forms.namedItem("win0");
  if (!(form instanceof HTMLFormElement)) {
    return extractHiddenInputs(doc.body?.innerHTML ?? "");
  }
  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }
    if (!element.name || element.disabled) continue;
    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase();
      if (type === "button" || type === "submit" || type === "reset" || type === "image") continue;
      if (type === "radio") {
        if (element.checked) params.set(element.name, element.value);
        continue;
      }
      if (type === "checkbox") {
        if (element.checked) params.set(element.name, element.value || "Y");
        else if (element.name.includes("$chk")) params.set(element.name, "");
        continue;
      }
    }
    params.set(element.name, element.value ?? "");
  }
  return params;
}

function findNextActionId(html: string): string | null {
  // Preferred: the inline submitAction call wired to the Next button. This is
  // the canonical action id, including any positional `$N$` suffix.
  const direct =
    /submitAction_win0\(document\.win0,'(DERIVED_CLS_DTL_NEXT_PB[^']*)'\)/i.exec(html)?.[1];
  if (direct) return direct;
  // Fallback A: input/element rendered with an explicit name attribute.
  const byName = /name=['"](DERIVED_CLS_DTL_NEXT_PB[^'"]*)['"]/i.exec(html)?.[1];
  if (byName) return byName;
  // Fallback B: some PeopleSoft pages omit `name=` and only carry an `id=`
  // (attribute order varies). Match that form too.
  return /id=['"](DERIVED_CLS_DTL_NEXT_PB[^'"]*)['"]/i.exec(html)?.[1] ?? null;
}

function looksLikeError(html: string): boolean {
  if (/<PAGE id='NW_TERM_STA1_FL'>/i.test(html)) return true;
  if (/<GENMSG[^>]*>/i.test(html)) return true;
  return false;
}

// Default to success unless we see an intermediate-page id that means the
// wizard stopped early (preferences, related component, bounced back to
// detail). GENMSG/term-status are handled upstream by `looksLikeError`.
function isCartLandingPage(
  html: string,
  classNumber: string
): { ok: true } | { ok: false; reason: string } {
  if (/<PAGE id='SSR_SSENRL_PREFS/i.test(html)) {
    return {
      ok: false,
      reason: `CAESAR is asking for enrollment preferences for #${classNumber}. Use Classic Search to finish.`
    };
  }
  if (/<PAGE id='SSR_SSENRL_RC/i.test(html) || /Related\s*Class/i.test(html)) {
    return {
      ok: false,
      reason: `Section #${classNumber} requires a related component (e.g. discussion). Use Classic Search to pick one.`
    };
  }
  if (/<PAGE id='SSR_CLSRCH_DTL/i.test(html)) {
    return {
      ok: false,
      reason: `CAESAR returned the section detail page instead of confirming the add for #${classNumber}. Use Classic Search to finish.`
    };
  }
  return { ok: true };
}
