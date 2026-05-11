import { type LookupClassMessage } from "../../shared/messages";
import { resolveCareerCandidates } from "../nu-careers";
import {
  CAESAR_ORIGIN,
  type CareerCode,
  DEFAULT_CAREER_FIELD,
  DEFAULT_CLASS_FIELD,
  DEFAULT_INSTITUTION_FIELD,
  DEFAULT_TERM_FIELD,
  SEARCH_ENDPOINT,
  SEARCH_ENTRY_URL,
  type SearchContext,
  normalizeCareer,
  resolveActionUrl
} from "./shared";
import { fetchPeopleSoftGet } from "./http";

export async function initializeSearchContext(
  overrides: { termId?: string } = {}
): Promise<SearchContext> {
  // Always GET fresh — never trust the live form. The live form's
  // ICSID/ICStateNum are frozen at page-load while our XHR POSTs advance
  // the server's session past them, so reusing the live form's state
  // breaks on the second call from the same page.
  const html = await fetchPeopleSoftGet(resolveActionUrl(SEARCH_ENTRY_URL));
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const form = doc.forms.namedItem("win0");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Class search form not found while initializing context.");
  }
  return buildSearchContextFromForm(form, overrides);
}

function buildSearchContextFromForm(
  form: HTMLFormElement,
  overrides: { termId?: string }
): SearchContext {
  const classFieldName = findFieldName(form, "SSR_CLSRCH_WRK_CLASS_NBR") ?? DEFAULT_CLASS_FIELD;
  const termFieldName = findFieldName(form, "CLASS_SRCH_WRK2_STRM") ?? DEFAULT_TERM_FIELD;
  const careerFieldName = findFieldName(form, "SSR_CLSRCH_WRK_ACAD_CAREER") ?? DEFAULT_CAREER_FIELD;
  const institutionFieldName =
    findFieldName(form, "CLASS_SRCH_WRK2_INSTITUTION") ?? DEFAULT_INSTITUTION_FIELD;

  const baseParams = serializeForm(form);
  const contextCodes = readContextCodes();
  if (contextCodes.institution) baseParams.set(institutionFieldName, contextCodes.institution);
  if (contextCodes.term) baseParams.set(termFieldName, contextCodes.term);
  if (contextCodes.career) baseParams.set(careerFieldName, contextCodes.career);
  // Caller-provided term wins over both URL-derived and form-default values
  // — the Sharper Search UI runs from the entry page (no STRM in the URL),
  // so without this override the lookup falls back to whatever term CAESAR
  // happens to render the entry form with (typically the current term, not
  // the one the user selected in our UI).
  if (overrides.termId) baseParams.set(termFieldName, overrides.termId);

  const openOnlyField =
    findFieldName(form, "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$") ?? "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$3";
  baseParams.set(openOnlyField, "N");

  return {
    actionUrl: resolveActionUrl(SEARCH_ENDPOINT),
    baseParams,
    classFieldName,
    termFieldName,
    careerFieldName,
    institutionFieldName
  };
}

export function readContextCodes(): {
  term: string | null;
  career: string | null;
  institution: string | null;
} {
  const candidates = [window.location.href, ...extractUrlsFromInlineScripts()];

  for (const rawUrl of candidates) {
    try {
      const url = new URL(rawUrl, CAESAR_ORIGIN);
      const term = url.searchParams.get("STRM");
      const career = url.searchParams.get("ACAD_CAREER");
      const institution = url.searchParams.get("INSTITUTION");
      if (term || career || institution) {
        return { term, career, institution };
      }
    } catch {
      continue;
    }
  }

  return { term: null, career: null, institution: null };
}

export function buildCareerCandidates(
  message: LookupClassMessage,
  contextCareer: string | null
): CareerCode[] {
  const normalizedContext = normalizeCareer(contextCareer);
  const normalizedHint = normalizeCareer(message.careerHint);
  const candidates: CareerCode[] = [];

  const push = (value: CareerCode | null) => {
    if (!value) return;
    if (!candidates.includes(value)) candidates.push(value);
  };

  push(normalizedHint);
  push(normalizedContext);

  // When the caller knows the course identifier, use nu-careers to pull in
  // the schools that actually catalogue this subject (Law, SPS, Kellogg
  // grad, etc.). The resolver already terminates with ["UGRD","TGS"] for
  // unknown subjects, so we get a sensible fallback for free.
  if (message.subjectHint && message.catalogHint) {
    for (const career of resolveCareerCandidates(message.subjectHint, message.catalogHint)) {
      push(career);
    }
  }

  // Last-resort fallback when the caller couldn't supply identifier hints
  // (e.g. seats-notes when the cart row label fails to parse).
  push("UGRD");
  push("TGS");
  return candidates;
}

function extractUrlsFromInlineScripts(): string[] {
  const urls = new Set<string>();
  const scriptEls = document.querySelectorAll("script:not([src])");
  const pattern = /(?:strCurrUrl|sHistURL)\s*=\s*'([^']+)'/g;

  for (const script of Array.from(scriptEls)) {
    const source = script.textContent ?? "";
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const value = match[1]?.trim();
      if (!value) continue;
      urls.add(value);
    }
  }

  return Array.from(urls);
}

function findFieldName(form: HTMLFormElement, fieldPrefix: string): string | null {
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
    if (element.name.startsWith(fieldPrefix)) return element.name;
  }
  return null;
}

function serializeForm(form: HTMLFormElement): URLSearchParams {
  const params = new URLSearchParams();

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
        if (element.checked) {
          params.set(element.name, element.value || "Y");
        } else if (element.name.includes("$chk")) {
          params.set(element.name, "");
        }
        continue;
      }
    }

    params.set(element.name, element.value ?? "");
  }

  return params;
}
