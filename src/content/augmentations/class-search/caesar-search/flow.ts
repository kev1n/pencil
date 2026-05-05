import { runPeopleSoftTask } from "../../../peoplesoft";
import { fetchPeopleSoft, fetchPeopleSoftGet } from "../../../peoplesoft/http";
import { extractHiddenInputs } from "../../../peoplesoft/params";
import { extractErrorMessage } from "../../../peoplesoft/parsers";
import { resolveActionUrl, SEARCH_ENDPOINT, SEARCH_ENTRY_URL } from "../../../peoplesoft/shared";

import {
  buildActionParams,
  buildClassNumberSearchParams,
  buildSearchPostParams,
  findNextActionId,
  isCartLandingPage,
  looksLikeError,
  serializeFormFromDoc
} from "./forms";
import {
  careerOrderFor,
  locateByClassNumber,
  parseAjaxFragment,
  parseCaesarGroups,
  parseRelatedComponentOptions
} from "./parser";
import {
  CaesarAuthRequiredError,
  LANDING_PAGE_URL,
  type CaesarCourseGroup,
  type CaesarSearchInput,
  type CaesarSearchResult,
  type CaesarSection,
  type CartFlowContinuationInput,
  type CartFlowInput,
  type CartFlowResult
} from "./types";

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
    // `getEntryFormState()` re-GETs the entry page on every call (and
    // re-handshakes through SSO if the session has expired), so each loop
    // iteration starts from a fresh ICStateNum.
    const baseParams = await getEntryFormState();

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
//
// If the first GET comes back without ICSID, the PS session is dead. We
// hit the portal landing page once to give NetID SSO a chance to silently
// re-handshake (works when the IdP cookie is still alive), then re-fetch
// the entry page. If that still has no ICSID, throw `CaesarAuthRequiredError`
// so the caller can open the SSO popup flow.
async function getEntryFormState(): Promise<URLSearchParams> {
  const params = await fetchEntryFormParams();
  if (params.has("ICSID")) return params;

  await fetchPeopleSoftGet(LANDING_PAGE_URL).catch(() => undefined);
  const refreshed = await fetchEntryFormParams();
  if (refreshed.has("ICSID")) return refreshed;

  throw new CaesarAuthRequiredError();
}

async function fetchEntryFormParams(): Promise<URLSearchParams> {
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
      // `getEntryFormState()` re-GETs the entry page each call (and
      // re-handshakes through SSO when the session is dead), so server
      // state is fresh on every iteration. Bubble its `CaesarAuthRequiredError`
      // out of the try/catch so the augmentation can drive the popup.
      const baseParams = await getEntryFormState();
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
        lastError ?? "Couldn't find this class on CAESAR for this term.",
        { classNumber, searchGroups: groups }
      );
    }

    // CAESAR omits the Select button when the section is already in the
    // user's cart. We use that signal as our early "already in cart" exit
    // even though we no longer POST that button — going further would just
    // hit a generic CAESAR error a couple of round-trips later.
    if (!match.section.selectAvailable) {
      return fail("This class is already in your shopping cart.", {
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
    // Bubble auth-required so the augmentation can drive the popup login
    // flow instead of surfacing it as a normal cart-flow error.
    if (error instanceof CaesarAuthRequiredError) throw error;
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
