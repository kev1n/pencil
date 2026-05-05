// Wave 9 — `parseCtecReportHtmlSafe`. Wraps the existing CTEC report parser
// with zod validation of the returned summary; null pass-through is
// preserved (the caller's "no parse" branch). Lives in a dedicated module
// so production paths (which still call `parseCtecReportHtml` directly)
// don't pull zod into the content bundle.

import { logQuiet } from "../../../shared/log";
import { parseCtecReportHtml } from "./reports";
import { CtecReportSummarySchema, type ParseResult } from "./reports.schemas";
import type { CtecReportSummary } from "../../ctec-index/types";

export function parseCtecReportHtmlSafe(
  html: string,
  url: string
): ParseResult<CtecReportSummary | null> {
  const value = parseCtecReportHtml(html, url);
  if (value === null) return { ok: true, value: null };
  const result = CtecReportSummarySchema.safeParse(value);
  if (!result.success) {
    logQuiet("ctec-links.reports.parseCtecReportHtml", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.data as CtecReportSummary };
}
