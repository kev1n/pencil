// Pure DOM/sessionStorage helpers for the class-search augmentation:
//   • Page-id detection (is this CAESAR's class-search entry page?).
// • Native form scraping (read career / institution / term defaults
//     from PeopleSoft's <select> elements before we mount our own UI).
//   • Tab persistence (`Sharper Search` vs `Classic CAESAR`, kept in
//     sessionStorage so a tab swap survives PS DOM swaps).
//
// Extracted from augmentation.ts (Wave 5a). No behavior change.

import { logQuiet } from "../../../shared/log";
import { readTermId } from "../../cart-cache/parse-cart-page";
import { SEARCH_ACTION_ID } from "../../peoplesoft/shared";
import type { TabId } from "./types";

const SEARCH_PAGE_ID = "SSR_CLSRCH_ENTRY";
const SEARCH_COMPONENT = "CLASS_SEARCH";
const TAB_STORAGE_KEY = "better-caesar:class-search:active-tab";
export const CART_SEARCH_RETURN_ID = "CLASS_SRCH_WRK2_SSR_PB_CLOSE";

function isCartSearchEntryPage(doc: Document): boolean {
  const form = doc.querySelector('form[name="win0"]#SSR_SSENRL_CART');
  return Boolean(
    form?.querySelector(`#${SEARCH_ACTION_ID}`) &&
    form.querySelector(`#${CART_SEARCH_RETURN_ID}`)
  );
}

/**
 * Recognize the search entry page in both PeopleSoft layouts. In the
 * current layout, the search and results pages share the same form ID,
 * but only the entry page has the term selector and Search action.
 */
export function isSearchEntryPage(doc: Document): boolean {
  if (isCartSearchEntryPage(doc)) return true;
  const pageInfo = doc.getElementById("pt_pageinfo_win0");
  if (pageInfo?.hasAttribute("Component") && pageInfo.hasAttribute("Page")) {
    return (
      pageInfo.getAttribute("Component") === SEARCH_COMPONENT &&
      pageInfo.getAttribute("Page") === SEARCH_PAGE_ID
    );
  }
  const form = doc.querySelector('form[name="win0"]#CLASS_SEARCH');
  return Boolean(
    form?.querySelector('select[name^="CLASS_SRCH_WRK2_STRM"]') &&
    form.querySelector(`#${SEARCH_ACTION_ID}`)
  );
}

export function findNativeSearchContainer(doc: Document): HTMLElement | null {
  return doc.getElementById("win0divPAGECONTAINER") ??
    (isCartSearchEntryPage(doc) ? doc.getElementById("win0divPSPAGECONTAINER") : null);
}

/**
 * Returns the page id from `#pt_pageinfo_win0`'s `Page` attribute, or
 * `null` if the element is absent. Useful for diagnostics.
 */
export function pageIdFromDoc(doc: Document): string | null {
  const pageInfo = doc.getElementById("pt_pageinfo_win0");
  if (!pageInfo) return null;
  return pageInfo.getAttribute("Page");
}

/**
 * Locates a PeopleSoft `<select>` whose `name` starts with the given
 * prefix. PS occasionally suffixes ids (e.g. `$N`) so a prefix match is
 * the safe lookup.
 */
export function findSelectByPrefix(
  doc: Document,
  prefix: string
): HTMLSelectElement | null {
  const selects = doc.querySelectorAll<HTMLSelectElement>("select");
  for (const select of Array.from(selects)) {
    if (select.name?.startsWith(prefix)) return select;
  }
  return null;
}

/**
 * Reads the native career select (e.g. UGRD / TGS / KGSM). Falls back to
 * the `ACAD_CAREER` URL parameter when PS hasn't rendered the dropdown
 * yet (e.g. landing directly on the URL).
 */
export function readCareerFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "SSR_CLSRCH_WRK_ACAD_CAREER");
  if (select?.value) return select.value;
  const url = new URL(window.location.href);
  return url.searchParams.get("ACAD_CAREER");
}

/** Reads the native institution select (always `NWUNV` for Northwestern). */
export function readInstitutionFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "CLASS_SRCH_WRK2_INSTITUTION");
  return select?.value ?? null;
}

/** Reads the native term select (`STRM`, e.g. `4750`). */
export function readTermFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "CLASS_SRCH_WRK2_STRM");
  return select?.value || (isCartSearchEntryPage(doc) ? readTermId(doc) : null);
}

/**
 * Reads the user's last-used tab choice from sessionStorage. Falls back
 * to `"better"` when storage access fails or no value has been written.
 */
export function readActiveTab(): TabId {
  try {
    const raw = window.sessionStorage.getItem(TAB_STORAGE_KEY);
    if (raw === "classic") return "classic";
    return "better";
  } catch {
    return "better";
  }
}

/** Persists the user's tab choice to sessionStorage. */
export function writeActiveTab(tab: TabId): void {
  try {
    window.sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch (err) {
    logQuiet("class-search.writeActiveTab", err);
  }
}
