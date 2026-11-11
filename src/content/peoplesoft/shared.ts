export const SEARCH_ENDPOINT = "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.CLASS_SEARCH.GBL";
export const SEARCH_ENTRY_URL = `${SEARCH_ENDPOINT}?Page=SSR_CLSRCH_ENTRY&Action=U`;
export const SEARCH_ACTION_ID = "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH";
export const DEFAULT_CLASS_FIELD = "SSR_CLSRCH_WRK_CLASS_NBR$8";
export const DEFAULT_TERM_FIELD = "CLASS_SRCH_WRK2_STRM$35$";
export const DEFAULT_CAREER_FIELD = "SSR_CLSRCH_WRK_ACAD_CAREER$2";
export const DEFAULT_INSTITUTION_FIELD = "CLASS_SRCH_WRK2_INSTITUTION$31$";
import { decodeEntities as decodeEntitiesPure } from "../../shared/decode-entities";

export { CAESAR_ORIGIN } from "../../shared/nu-hosts";
import { CAESAR_ORIGIN } from "../../shared/nu-hosts";
import { CAREER_CODES, type CareerCode } from "../nu-careers";

// `CareerCode` and the underlying code list are owned by `nu-careers.ts` —
// peoplesoft re-exports the type so call sites that only import from this
// module don't need to know that. `normalizeCareer` accepts any known code;
// unknown values fall back to null so calls don't end up passing
// `ACAD_CAREER=GARBAGE` to PeopleSoft.
export type { CareerCode };

export type SearchContext = {
  actionUrl: string;
  baseParams: URLSearchParams;
  classFieldName: string;
  termFieldName: string;
  careerFieldName: string;
  institutionFieldName: string;
};

export function resolveActionUrl(pathOrUrl: string): string {
  if (pathOrUrl) return new URL(pathOrUrl, CAESAR_ORIGIN).toString();
  return CAESAR_ORIGIN;
}

// Decodes HTML entities and collapses whitespace runs to single spaces.
// Several PS-parser call sites rely on the trim/collapse behavior, so this
// wrapper keeps that contract while delegating the entity work to the
// pure shared/decode-entities helper.
export function decodeEntities(value: string): string {
  return decodeEntitiesPure(value).replace(/\s+/g, " ").trim();
}

export function sanitizeClassNumber(value: string): string {
  const digits = value.replace(/\D+/g, "");
  return digits.slice(0, 10);
}

export function normalizeCareer(value: string | null | undefined): CareerCode | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (CAREER_CODES as readonly string[]).includes(upper) ? (upper as CareerCode) : null;
}

// CAESAR's Manage Classes page keeps the top bar and the left-hand tab list
// around its content, unlike the bare standalone pages. It cannot be linked
// to a tab, so a link names the tab in its fragment and the bookmarks plugin
// picks it once the page has loaded.
const MANAGE_CLASSES_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_AGSTARTPAGE_NUI.GBL?CONTEXTIDPARAMS=TEMPLATE_ID%3aPTPPNAVCOL&scname=NW_MANAGE_CLASSES_CLASSIC_NAV&PTPPB_GROUPLET_ID=NW_MANAGE_CLASS_CLASSIC&CRefName=NW_MNG_CLS_NAVCOL&AJAXTransfer=Y";
export const TAB_FRAGMENT = "#bc-tab=";
export const MANAGE_CLASSES_TABS = {
  search: "ADMN_S201708141120276178777428",
  cart: "ADMN_S201708141117213461104159",
  dates: "ADMN_S201708141138231091952269"
} as const;
export const manageClassesTabUrl = (tab: string): string => `${MANAGE_CLASSES_URL}${TAB_FRAGMENT}${tab}`;
