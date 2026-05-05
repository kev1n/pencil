// Term-selector URL builder + page-id helpers.
//
// CAESAR's term selector lives at SSR_SSENRL_TERM. We need to land on it from
// any of the SSR_SSENRL_* enrollment workflow pages (cart, drop, swap, etc.).
// Three discovery paths, in order:
//   1. We're already on the term page → reuse the current URL.
//   2. Current URL matches the SSR_SSENRL_*.GBL component family → patch
//      query params to ask PS for the term page.
//   3. Fall back to a parsed `EnrollmentContext` (from URL or stored) and
//      synthesize a SSR_SSENRL_CART URL with PAGE=SSR_SSENRL_TERM.

import { logQuiet } from "../../../shared/log";

import { readContextFromCandidates, readStoredContext } from "./state";

const TERM_PAGE_ID = "SSR_SSENRL_TERM";

export function getPageId(doc: Document): string | null {
  const pageInfo = doc.querySelector<HTMLElement>("#pt_pageinfo_win0");
  return pageInfo?.getAttribute("Page") ?? null;
}

export function getComponentId(doc: Document): string | null {
  const pageInfo = doc.querySelector<HTMLElement>("#pt_pageinfo_win0");
  return pageInfo?.getAttribute("Component") ?? null;
}

export function isEnrollmentWorkflowPage(
  doc: Document,
  pageId: string | null,
): boolean {
  if (pageId === TERM_PAGE_ID) return false;

  const component = getComponentId(doc);
  const value = (component ?? pageId ?? "").toUpperCase();
  if (!value.startsWith("SSR_SSENRL_")) return false;

  return (
    value === "SSR_SSENRL_CART" ||
    value === "SSR_SSENRL_DROP" ||
    value === "SSR_SSENRL_SWAP" ||
    value === "SSR_SSENRL_EDIT" ||
    value === "SSR_SSENRL_UPDT" ||
    value === "SSR_SSENRL_APPT"
  );
}

export function extractUrlsFromInlineScripts(doc: Document): string[] {
  const urls = new Set<string>();
  const scriptEls = doc.querySelectorAll("script:not([src])");
  const pattern = /(?:strCurrUrl|sHistURL|refererURL)\s*=\s*['"]([^'"]+)['"]/g;

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

export function buildTermSelectorUrl(doc: Document): string | null {
  const currentPage = getPageId(doc) ?? "";

  if (currentPage === TERM_PAGE_ID) {
    return window.location.href;
  }

  if (isEnrollmentWorkflowPage(doc, currentPage)) {
    try {
      const currentUrl = new URL(window.location.href);
      if (/SSR_SSENRL_[^.]+\.GBL/i.test(currentUrl.pathname)) {
        currentUrl.searchParams.set("Page", currentPage);
        if (!currentUrl.searchParams.get("Action")) {
          currentUrl.searchParams.set("Action", "A");
        }
        if (!currentUrl.searchParams.get("NavColl")) {
          currentUrl.searchParams.set("NavColl", "true");
        }
        if (!currentUrl.searchParams.get("ICAGTarget")) {
          currentUrl.searchParams.set("ICAGTarget", "start");
        }
        if (!currentUrl.searchParams.get("ICAJAXTrf")) {
          currentUrl.searchParams.set("ICAJAXTrf", "true");
        }
        currentUrl.searchParams.set("PAGE", TERM_PAGE_ID);
        return currentUrl.toString();
      }
    } catch (err) {
      // Fall through to alternate discovery paths.
      logQuiet("enrollment-nav.term-url.context-build", err);
    }
  }

  const formAction = doc.querySelector<HTMLFormElement>("form[name='win0']")?.action;
  const candidates = [window.location.href, formAction];
  const context = readContextFromCandidates(candidates) ?? readStoredContext();
  if (!context) return null;

  let fallbackUrl: URL;
  try {
    fallbackUrl = new URL(window.location.href);
  } catch {
    return null;
  }

  if (/SA_LEARNER_SERVICES(?:_2)?\.[^.]+\.GBL/i.test(fallbackUrl.pathname)) {
    fallbackUrl.pathname = fallbackUrl.pathname.replace(
      /SA_LEARNER_SERVICES(?:_2)?\.[^.]+\.GBL/i,
      "SA_LEARNER_SERVICES_2.SSR_SSENRL_CART.GBL",
    );
  }

  fallbackUrl.searchParams.set("Page", "SSR_SSENRL_CART");
  fallbackUrl.searchParams.set("Action", "A");
  fallbackUrl.searchParams.set("ACAD_CAREER", context.ACAD_CAREER);
  fallbackUrl.searchParams.set("INSTITUTION", context.INSTITUTION);
  fallbackUrl.searchParams.set("STRM", context.STRM);
  if (context.EMPLID) {
    fallbackUrl.searchParams.set("EMPLID", context.EMPLID);
  }
  fallbackUrl.searchParams.set("NavColl", "true");
  fallbackUrl.searchParams.set("ICAGTarget", "start");
  fallbackUrl.searchParams.set("ICAJAXTrf", "true");
  fallbackUrl.searchParams.set("PAGE", TERM_PAGE_ID);
  return fallbackUrl.toString();
}
