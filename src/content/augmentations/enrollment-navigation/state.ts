// State persistence for the enrollment-navigation augmentation.
//
// Two storage layers, both keyed off the user's session:
// - localStorage: long-lived `EnrollmentContext` (ACAD_CAREER / INSTITUTION /
//   STRM / EMPLID) recovered from URLs and inline scripts. Lets us rebuild
//   the term-selector URL when the user lands somewhere that's missing the
//   needed query params.
// - sessionStorage: per-tab sentinels for the auto-Continue flow. The
//   "submitted URL" sentinel survives PS's full-page reloads so a fresh
//   content-script instance won't re-fire Continue and loop. The "target
//   term" sentinel carries the user's selection across the term-selector
//   navigation triggered by the in-page dropdown.

import { logQuiet } from "../../../shared/log";

export type EnrollmentContext = {
  ACAD_CAREER: string;
  INSTITUTION: string;
  STRM: string;
  EMPLID?: string;
};

const CONTEXT_STORAGE_KEY = "better-caesar:enrollment-context:v1";
const TARGET_TERM_VALUE_KEY = "better-caesar:target-term-value";
// Persisted in sessionStorage so the auto-Continue de-dup survives the full
// page reload that PS triggers when Continue is a classic form submit. Without
// this, a fresh content-script instance has no memory of the prior click and
// re-fires it, looping if PS posts back to the same URL.
const SUBMITTED_URL_KEY = "better-caesar:enrollment-nav:submitted-url";

export function persistContext(context: EnrollmentContext): void {
  try {
    window.localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch (err) {
    logQuiet("enrollment-nav.persistContext", err);
  }
}

export function readStoredContext(): EnrollmentContext | null {
  try {
    const raw = window.localStorage.getItem(CONTEXT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EnrollmentContext>;
    if (!parsed.ACAD_CAREER || !parsed.INSTITUTION || !parsed.STRM) return null;

    return {
      ACAD_CAREER: parsed.ACAD_CAREER,
      INSTITUTION: parsed.INSTITUTION,
      STRM: parsed.STRM,
      EMPLID: parsed.EMPLID,
    };
  } catch {
    return null;
  }
}

export function parseContext(pathOrUrl: string): EnrollmentContext | null {
  let url: URL;
  try {
    url = new URL(pathOrUrl, window.location.origin);
  } catch {
    return null;
  }

  const ACAD_CAREER = url.searchParams.get("ACAD_CAREER") ?? "";
  const INSTITUTION = url.searchParams.get("INSTITUTION") ?? "";
  const STRM = url.searchParams.get("STRM") ?? "";
  const EMPLID = url.searchParams.get("EMPLID") ?? "";

  if (!ACAD_CAREER || !INSTITUTION || !STRM) return null;
  return {
    ACAD_CAREER,
    INSTITUTION,
    STRM,
    ...(EMPLID ? { EMPLID } : {}),
  };
}

export function extractContextFromHtml(html: string): EnrollmentContext | null {
  const pattern = /(?:strCurrUrl|sHistURL|refererURL)\s*=\s*['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const candidate = match[1]?.trim();
    if (!candidate) continue;
    const context = parseContext(candidate);
    if (context) return context;
  }

  return null;
}

export function readContextFromCandidates(
  candidates: Array<string | null | undefined>,
): EnrollmentContext | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const context = parseContext(candidate);
    if (context) return context;
  }
  return null;
}

export function setTargetTermSelection(value: string): void {
  try {
    window.sessionStorage.setItem(TARGET_TERM_VALUE_KEY, value);
  } catch (err) {
    logQuiet("enrollment-nav.setTargetTermSelection", err);
  }
}

export function getTargetTermSelection(): string | null {
  try {
    return window.sessionStorage.getItem(TARGET_TERM_VALUE_KEY);
  } catch {
    return null;
  }
}

export function clearTargetTermSelection(): void {
  try {
    window.sessionStorage.removeItem(TARGET_TERM_VALUE_KEY);
  } catch (err) {
    logQuiet("enrollment-nav.clearTargetTermSelection", err);
  }
}

export function readSubmittedUrl(): string | null {
  try {
    return window.sessionStorage.getItem(SUBMITTED_URL_KEY);
  } catch {
    return null;
  }
}

export function writeSubmittedUrl(url: string): void {
  try {
    window.sessionStorage.setItem(SUBMITTED_URL_KEY, url);
  } catch (err) {
    logQuiet("enrollment-nav.writeSubmittedUrl", err);
  }
}

export function clearSubmittedUrl(): void {
  try {
    window.sessionStorage.removeItem(SUBMITTED_URL_KEY);
  } catch (err) {
    logQuiet("enrollment-nav.clearSubmittedUrl", err);
  }
}
