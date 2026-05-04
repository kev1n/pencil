import type { LookupClassMessage, LookupClassResponse, LookupClassSuccess } from "../../shared/messages";
import { buildCareerCandidates, initializeSearchContext, readContextCodes } from "./context";
import { fetchPeopleSoft } from "./http";
import { buildLookupSummary, isMatchingClass, mergeDetailData } from "./parsers";
import { buildDetailParams, buildSearchParams } from "./params";
import { sanitizeClassNumber } from "./shared";
import { isRetryablePeopleSoftTaskError, runPeopleSoftTask, type PeopleSoftTaskPriority } from "./traffic";

export async function lookupClass(
  message: LookupClassMessage,
  options?: { priority?: PeopleSoftTaskPriority; owner?: string }
): Promise<LookupClassResponse> {
  return runPeopleSoftTask(
    options?.priority ?? "background",
    () => lookupClassInternal(message),
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
