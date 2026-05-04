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
  institution: string;
  subject: string;
  bareCatalog: string; // bare number — NOT the full "111-0"
};

// Row from a related-component picker page (the page CAESAR shows after
// SELECT for courses that require pairing a discussion/lab/recitation).
export type RelatedSectionOption = {
  rowIndex: number;
  classNumber: string;
  section: string;
  schedule: string;
  room: string;
  instructor: string;
  status: CaesarStatus;
};

export type CartFlowResult =
  | {
      ok: true;
      classNumber: string;
      sectionLabel: string;
      courseTitle: string;
      // Parsed groups from the class-number search response. Always
      // contains the matched group with one section row carrying live
      // status / instructor / room. Caller stamps this into its
      // live-status cache so badges populate on the section row without
      // a separate "Load CAESAR data" subject search.
      searchGroups: CaesarCourseGroup[];
    }
  | {
      ok: false;
      // CAESAR is asking the user to pick a discussion/lab/recitation
      // before the add can finish. The picker UI calls
      // `continueCartAddWithRelated` with a chosen rowIndex.
      needsRelatedSection: true;
      classNumber: string;
      courseTitle: string;
      relatedOptions: RelatedSectionOption[];
      // Serialized URLSearchParams of the related-component page's hidden
      // inputs. Caller hands this back to continue the wizard.
      continuationFormState: string;
      sectionLabel: string;
      searchGroups: CaesarCourseGroup[];
    }
  | {
      ok: false;
      error: string;
      classNumber?: string;
      // True when CAESAR returned the section row but omitted the Select
      // button — meaning the user already has it in their shopping cart.
      alreadyInCart?: boolean;
      searchGroups?: CaesarCourseGroup[];
    };

export type CartFlowInput = {
  classNumber: string; // 5-digit CAESAR class number (e.g. "34612")
  termId: string;
  institution: string;
  bareCatalog: string; // drives career fallback order (TGS-first for 4xx)
};

export type CartFlowContinuationInput = {
  continuationFormState: string;
  selectedRowIndex: number;
  classNumber: string;
  sectionLabel: string;
  courseTitle: string;
  searchGroups: CaesarCourseGroup[];
};

const INSTITUTION_DEFAULT = "NWUNV";

// ────────────────────────────────────────────────────────────────────────────
// Public API

// Display-only search. Runs CAESAR's catalog search for `subject` + bare
// number, returns parsed groups. `getEntryFormState()` always fetches a
// fresh entry page, so the server's ICStateNum is reset to a known-good
// value at the start of every operation.
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
export async function addSectionToCart(input: CartFlowInput): Promise<CartFlowResult> {
  return runPeopleSoftTask(
    "user",
    () => addSectionToCartInternal(input),
    { owner: "class-search-add" }
  );
}

// Continue a cart-add that paused on the related-component picker. Takes the
// `continuationFormState` returned by the previous call plus the row index
// the user picked, completes the wizard, and returns the same shape as
// `addSectionToCart`.
export async function continueCartAddWithRelated(
  input: CartFlowContinuationInput
): Promise<CartFlowResult> {
  return runPeopleSoftTask(
    "user",
    () => continueCartAddWithRelatedInternal(input),
    { owner: "class-search-add-related" }
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Implementation

type FailExtras = {
  classNumber?: string;
  alreadyInCart?: boolean;
  searchGroups?: CaesarCourseGroup[];
};

function fail(error: string, extras: FailExtras = {}): CartFlowResult {
  return { ok: false, error, ...extras };
}

async function searchCaesarCatalogInternal(
  input: CaesarSearchInput
): Promise<CaesarSearchResult> {
  const careers = careerOrderFor(input.bareCatalog);
  let lastError: string | null = null;
  let lastGroups: CaesarCourseGroup[] = [];

  for (let i = 0; i < careers.length; i += 1) {
    // `getEntryFormState()` re-GETs the entry page on every call, so each
    // loop iteration starts from a fresh ICStateNum — no inter-attempt
    // reset needed.
    const baseParams = await getEntryFormState();
    if (!baseParams.has("ICSID")) {
      throw new Error("Missing PeopleSoft session — try refreshing the page.");
    }

    const searchParams = buildSearchPostParams(baseParams, input, careers[i]!);
    const searchHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), searchParams);
    if (looksLikeError(searchHtml)) {
      lastError = extractErrorMessage(searchHtml) ?? "CAESAR search returned an error.";
      continue;
    }

    const groups = parseCaesarGroups(searchHtml);
    if (groups.length > 0) return { groups };
    lastGroups = groups;
  }

  if (lastError && lastGroups.length === 0) {
    // Only surface the error when no career produced rows. An empty result
    // (no error, no rows) is just "course not on CAESAR for this term".
    throw new Error(lastError);
  }
  return { groups: lastGroups };
}

// Always GET the entry page — never read the live `document.forms.win0`.
// The live form's ICSID/ICStateNum are frozen at page-load and our XHR
// POSTs advance the server's session past them. A fresh GET resets the
// server back to a known-good state and returns matching hidden inputs,
// so every operation begins with a clean ICStateNum regardless of what
// happened in earlier operations or other tabs.
async function getEntryFormState(): Promise<URLSearchParams> {
  const entryHtml = await fetchPeopleSoftGet(resolveActionUrl(SEARCH_ENTRY_URL));
  return serializeFormFromDoc(parseAjaxFragment(entryHtml));
}

async function addSectionToCartInternal(input: CartFlowInput): Promise<CartFlowResult> {
  try {
    const classNumber = input.classNumber.trim();
    if (!classNumber) {
      return { ok: false, error: "Missing CAESAR class number — load CAESAR data first." };
    }

    // Step 1: POST class-number search → search results page. Loop the
    // career candidates so 4xx classes (catalogued under TGS) resolve
    // even when the user's class-search dropdown is set to UGRD.
    const careers = careerOrderFor(input.bareCatalog);
    let searchHtml: string | null = null;
    let groups: CaesarCourseGroup[] = [];
    let match: { group: CaesarCourseGroup; section: CaesarSection } | null = null;
    let lastError: string | null = null;

    for (let i = 0; i < careers.length; i += 1) {
      // `getEntryFormState()` re-GETs the entry page each call, so server
      // state is fresh on every iteration without a manual reset.
      const baseParams = await getEntryFormState();
      if (!baseParams.has("ICSID")) {
        return { ok: false, error: "Missing PeopleSoft session — try refreshing the page." };
      }
      const searchPost = buildClassNumberSearchParams(baseParams, {
        termId: input.termId,
        career: careers[i]!,
        institution: input.institution,
        classNumber
      });
      const html = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), searchPost);
      if (looksLikeError(html)) {
        lastError = extractErrorMessage(html) ?? "CAESAR search returned an error.";
        continue;
      }
      const candidateGroups = parseCaesarGroups(html);
      const candidateMatch = locateByClassNumber(candidateGroups, classNumber);
      if (candidateMatch) {
        searchHtml = html;
        groups = candidateGroups;
        match = candidateMatch;
        break;
      }
      groups = candidateGroups;
    }

    if (!match || !searchHtml) {
      return fail(
        lastError ?? `Couldn't find class #${classNumber} on CAESAR for this term.`,
        { classNumber, searchGroups: groups }
      );
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

    // Step 2: POST SSR_PB_SELECT$N → "Confirm Your Selection". This is the
    // wizard path; MTG_CLASSNAME shows a non-wizard detail page that has
    // no NEXT button, so it can't be used to advance the cart-add chain.
    const searchState = extractHiddenInputs(searchHtml);
    const selectParams = buildActionParams(searchState, match.section.selectActionId);
    const confirmHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), selectParams);
    if (looksLikeError(confirmHtml)) {
      return fail(extractErrorMessage(confirmHtml) ?? "CAESAR rejected the section selection.", {
        classNumber: match.section.classNumber,
        searchGroups: groups
      });
    }

    // Required-related-component branch: CAESAR served the discussion/lab
    // picker. Surface the options to the caller and pause the wizard until
    // the user picks one — `continueCartAddWithRelated` resumes from here.
    const relatedOptions = parseRelatedComponentOptions(confirmHtml);
    if (relatedOptions && relatedOptions.length > 0) {
      return {
        ok: false,
        needsRelatedSection: true,
        classNumber: match.section.classNumber,
        sectionLabel: match.section.sectionLabel,
        courseTitle: match.group.title,
        relatedOptions,
        continuationFormState: extractHiddenInputs(confirmHtml).toString(),
        searchGroups: groups
      };
    }

    // Step 3: POST DERIVED_CLS_DTL_NEXT_PB → cart landing page.
    const nextActionId = findNextActionId(confirmHtml);
    if (!nextActionId) {
      return fail("Section needs extra confirmation in CAESAR. Use Classic Search for this one.", {
        classNumber: match.section.classNumber,
        searchGroups: groups
      });
    }
    const confirmState = extractHiddenInputs(confirmHtml);
    const finalParams = buildActionParams(confirmState, nextActionId);
    const finalHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), finalParams);
    if (looksLikeError(finalHtml)) {
      return fail(extractErrorMessage(finalHtml) ?? "CAESAR refused to add the class.", {
        classNumber: match.section.classNumber,
        searchGroups: groups
      });
    }

    const success = isCartLandingPage(finalHtml, match.section.classNumber);
    if (!success.ok) {
      return fail(success.reason, {
        classNumber: match.section.classNumber,
        searchGroups: groups
      });
    }

    return {
      ok: true,
      classNumber: match.section.classNumber,
      sectionLabel: match.section.sectionLabel,
      courseTitle: match.group.title,
      searchGroups: groups
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function continueCartAddWithRelatedInternal(
  input: CartFlowContinuationInput
): Promise<CartFlowResult> {
  try {
    const baseState = new URLSearchParams(input.continuationFormState);
    if (!baseState.has("ICSID")) {
      return fail("CAESAR session expired — try adding again.", {
        classNumber: input.classNumber,
        searchGroups: input.searchGroups
      });
    }

    // Step A: POST DERIVED_CLS_DTL_NEXT_PB with the chosen radio.
    // CAESAR's grid radios share `name='SSR_CLS_TBL_R1$sels$0'` but the
    // wire format observed sends `name='SSR_CLS_TBL_R1$sels$<row>$$0'` with
    // the same numeric value. We send both to be safe; PeopleSoft tolerates
    // the redundancy.
    const params = buildActionParams(baseState, "DERIVED_CLS_DTL_NEXT_PB");
    params.set("SSR_CLS_TBL_R1$sels$0", String(input.selectedRowIndex));
    params.set(
      `SSR_CLS_TBL_R1$sels$${input.selectedRowIndex}$$0`,
      String(input.selectedRowIndex)
    );
    let currentHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), params);
    if (looksLikeError(currentHtml)) {
      return fail(
        extractErrorMessage(currentHtml) ?? "CAESAR rejected the related-component pick.",
        { classNumber: input.classNumber, searchGroups: input.searchGroups }
      );
    }

    // Steps B+: walk DERIVED_CLS_DTL_NEXT_PB hops (Class Preferences page,
    // then final commit). Bound the loop so a wizard glitch can't spin.
    const MAX_HOPS = 3;
    let hops = 0;
    while (hops < MAX_HOPS) {
      const nextActionId = findNextActionId(currentHtml);
      if (!nextActionId) break;
      hops += 1;
      const state = extractHiddenInputs(currentHtml);
      const nextParams = buildActionParams(state, nextActionId);
      const nextHtml = await fetchPeopleSoft(resolveActionUrl(SEARCH_ENDPOINT), nextParams);
      if (looksLikeError(nextHtml)) {
        return fail(extractErrorMessage(nextHtml) ?? "CAESAR refused to add the class.", {
          classNumber: input.classNumber,
          searchGroups: input.searchGroups
        });
      }
      currentHtml = nextHtml;
    }

    const success = isCartLandingPage(currentHtml, input.classNumber);
    if (!success.ok) {
      return fail(success.reason, {
        classNumber: input.classNumber,
        searchGroups: input.searchGroups
      });
    }

    return {
      ok: true,
      classNumber: input.classNumber,
      sectionLabel: input.sectionLabel,
      courseTitle: input.courseTitle,
      searchGroups: input.searchGroups
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
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

// Parse the related-component picker page (SSR_CLS_RELCOMP / SSR_SSENRL_RC).
// Returns null when the response isn't that page. We locate the picker via
// the radio inputs in the `SSR_CLS_TBL_R1` grid and read each row's data
// from its `<tr>` so we don't depend on the wizard's dynamic positional
// suffixes (e.g. `$190$`).
function parseRelatedComponentOptions(html: string): RelatedSectionOption[] | null {
  const doc = parseAjaxFragment(html);
  const radios = doc.querySelectorAll<HTMLInputElement>(
    "input[type='radio'][id^='SSR_CLS_TBL_R1$sels$']"
  );
  if (radios.length === 0) return null;

  const options: RelatedSectionOption[] = [];
  for (const radio of Array.from(radios)) {
    const idMatch = /\$sels\$(\d+)\$\$\d+$/.exec(radio.id);
    if (!idMatch) continue;
    const rowIndex = Number(idMatch[1]);

    const tr = radio.closest("tr");
    if (!tr) continue;
    const cells = Array.from(tr.querySelectorAll<HTMLElement>("td"));
    const cellText = (n: number) =>
      decodeEntities((cells[n]?.textContent ?? "").trim()).replace(/\s+/g, " ");

    // Column order on CAESAR: radio | Class Nbr | Section | Schedule | Room | Instructor | Status.
    const classNumber = cellText(1);
    const section = cellText(2);
    const schedule = cellText(3);
    const room = cellText(4);
    const instructor = cellText(5);
    const statusImg = cells[6]?.querySelector<HTMLImageElement>("img");
    const status = statusFromAlt(statusImg?.getAttribute("alt"));

    if (!classNumber) continue;
    options.push({ rowIndex, classNumber, section, schedule, room, instructor, status });
  }
  return options.length > 0 ? options : null;
}

function statusFromAlt(alt: string | null | undefined): CaesarStatus {
  const a = (alt ?? "").toLowerCase();
  if (a.includes("open")) return "Open";
  if (a.includes("closed")) return "Closed";
  if (a.includes("wait")) return "Wait List";
  return "Unknown";
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
    selectAvailable: selectButton !== null
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

function buildSearchPostParams(
  base: URLSearchParams,
  input: CaesarSearchInput,
  career: string
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

  setAllWithPrefix(params, "CLASS_SRCH_WRK2_INSTITUTION", input.institution || INSTITUTION_DEFAULT);
  setAllWithPrefix(params, "CLASS_SRCH_WRK2_STRM", input.termId);
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_SUBJECT_SRCH", input.subject);
  // CAESAR's catalog field stores the bare number; using "contains" lets us
  // recover both "111-0" and variants ("111-SG"); we filter to the exact one
  // by reading the result group titles.
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_CATALOG_NBR", input.bareCatalog);
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_SSR_EXACT_MATCH1", "C");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_ACAD_CAREER", career);
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$", "N");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_CLASS_NBR", "");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_DESCR", "");
  setAllWithPrefix(params, "SSR_CLSRCH_WRK_LAST_NAME", "");

  return params;
}

// 400-level NU classes are catalogued under TGS even when undergrads can
// take them (see project memory). For everything else, undergrad-first
// matches the typical case. Two-element list so a wrong first guess always
// has a fallback.
function careerOrderFor(bareCatalog: string): string[] {
  const num = parseInt(bareCatalog, 10);
  const gradFirst = Number.isFinite(num) && num >= 400;
  return gradFirst ? ["TGS", "UGRD"] : ["UGRD", "TGS"];
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
