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

export type CareerCode = "UGRD" | "TGS";

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

export function normalizeCareer(value: string | null): CareerCode | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === "UGRD" || upper === "TGS") return upper;
  return null;
}
