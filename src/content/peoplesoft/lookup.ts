import type { LookupClassMessage, LookupClassResponse, LookupClassSuccess } from "../../shared/messages";
import { buildCareerCandidates, initializeSearchContext, readContextCodes } from "./context";
import { fetchPeopleSoft, fetchPeopleSoftGet } from "./http";
import { buildLookupSummary, isMatchingClass, mergeDetailData } from "./parsers";
import { buildDetailParams, buildSearchParams } from "./params";
import { resolveActionUrl, SEARCH_ENTRY_URL, sanitizeClassNumber } from "./shared";
import { isRetryablePeopleSoftTaskError, runPeopleSoftTask, type PeopleSoftTaskPriority } from "./traffic";

export async function lookupClass(
  message: LookupClassMessage,
  options?: { priority?: PeopleSoftTaskPriority; owner?: string; resetContextAfter?: boolean }
): Promise<LookupClassResponse> {
  return runPeopleSoftTask(
    options?.priority ?? "background",
    async () => {
      try {
        return await lookupClassInternal(message);
      } finally {
        // Caller (class-search) is sitting on the search entry page, so
        // `document.forms.win0` carries a static ICStateNum that the
        // server's session left behind once we POSTed. Re-GET the entry
        // URL to snap the server back to that ICStateNum so the next
        // user action keeps working.
        if (options?.resetContextAfter) {
          try {
            await fetchPeopleSoftGet(resolveActionUrl(SEARCH_ENTRY_URL));
          } catch {
            // Best-effort — don't fail the original op on reset trouble.
          }
        }
      }
    },
    { owner: options?.owner }
  );
}

async function lookupClassInternal(message: LookupClassMessage): Promise<LookupClassResponse> {
  const classNumber = sanitizeClassNumber(message.classNumber);
  if (!classNumber) {
    return { ok: false, error: "Enter a numeric class number." };
  }

  const contextCodes = readContextCodes();
  const careers = buildCareerCandidates(message, contextCodes.career);
  let lastSummary: LookupClassSuccess | null = null;

  let attempts = 0;
  while (attempts < 2) {
    attempts += 1;
    try {
      const context = await initializeSearchContext();
      for (const career of careers) {
        const params = buildSearchParams(context, classNumber, career);
        const searchResponseText = await fetchPeopleSoft(context.actionUrl, params);
        const summary = buildLookupSummary(classNumber, searchResponseText);
        lastSummary = summary;

        if (!isMatchingClass(summary, classNumber)) continue;
        if (!summary.nextActionForDetails) return summary;

        const detailParams = buildDetailParams(searchResponseText, summary.nextActionForDetails);
        const detailResponseText = await fetchPeopleSoft(context.actionUrl, detailParams);
        return mergeDetailData(summary, detailResponseText);
      }

      if (lastSummary) return lastSummary;
    } catch (error) {
      if (isRetryablePeopleSoftTaskError(error)) {
        throw error;
      }

      if (attempts >= 2) {
        const text = error instanceof Error ? error.message : "Unknown error.";
        return { ok: false, error: text };
      }
    }
  }

  return { ok: false, error: "Unable to fetch class metadata." };
}
