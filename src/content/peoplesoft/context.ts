import { type LookupClassMessage } from "../../shared/messages";
import {
  CAESAR_ORIGIN,
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

export async function initializeSearchContext(): Promise<SearchContext> {
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
  return buildSearchContextFromForm(form);
}

function buildSearchContextFromForm(form: HTMLFormElement): SearchContext {
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
): Array<"UGRD" | "TGS"> {
  const normalizedContext = normalizeCareer(contextCareer);
  const normalizedHint = normalizeCareer(message.careerHint ?? null);
  const candidates: Array<"UGRD" | "TGS"> = [];

  const push = (value: "UGRD" | "TGS" | null) => {
    if (!value) return;
    if (!candidates.includes(value)) candidates.push(value);
  };

  push(normalizedHint);
  push(normalizedContext);
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
