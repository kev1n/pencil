import { extractHiddenInputs } from "../../../peoplesoft/params";
import {
  DEFAULT_CAREER_FIELD,
  DEFAULT_CLASS_FIELD,
  DEFAULT_INSTITUTION_FIELD,
  DEFAULT_TERM_FIELD
} from "../../../peoplesoft/shared";
import { type CaesarSearchInput, INSTITUTION_DEFAULT } from "./types";

export function buildSearchPostParams(
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

export function buildClassNumberSearchParams(
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

export function findFieldNameInParams(params: URLSearchParams, prefix: string): string | null {
  let found: string | null = null;
  params.forEach((_value, key) => {
    if (found === null && key.startsWith(prefix)) found = key;
  });
  return found;
}

export function buildActionParams(base: URLSearchParams, actionId: string): URLSearchParams {
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

export function setAllWithPrefix(params: URLSearchParams, prefix: string, value: string): void {
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

export function serializeFormFromDoc(doc: Document): URLSearchParams {
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

export function findNextActionId(html: string): string | null {
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

export function looksLikeError(html: string): boolean {
  if (/<PAGE id='NW_TERM_STA1_FL'>/i.test(html)) return true;
  if (/<GENMSG[^>]*>/i.test(html)) return true;
  return false;
}

// Default to success unless we see an intermediate-page id that means the
// wizard stopped early (preferences, related component, bounced back to
// detail). GENMSG/term-status are handled upstream by `looksLikeError`.
export function isCartLandingPage(
  html: string,
  _classNumber: string
): { ok: true } | { ok: false; reason: string } {
  if (/<PAGE id='SSR_SSENRL_PREFS/i.test(html)) {
    return {
      ok: false,
      reason: "CAESAR is asking for enrollment preferences for this section. Use Classic Search to finish."
    };
  }
  if (/<PAGE id='SSR_SSENRL_RC/i.test(html) || /Related\s*Class/i.test(html)) {
    return {
      ok: false,
      reason: "This section requires a related component (e.g. discussion). Use Classic Search to pick one."
    };
  }
  if (/<PAGE id='SSR_CLSRCH_DTL/i.test(html)) {
    return {
      ok: false,
      reason: "CAESAR returned the section detail page instead of confirming the add. Use Classic Search to finish."
    };
  }
  return { ok: true };
}
