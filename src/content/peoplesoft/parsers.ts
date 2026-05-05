import type { LookupClassSuccess } from "../../shared/messages";
import { decodeEntities, resolveActionUrl } from "./shared";

export function buildLookupSummary(
  requestedClassNumber: string,
  responseText: string
): LookupClassSuccess {
  if (/<PAGE id='NW_TERM_STA1_FL'>/i.test(responseText)) {
    throw new Error(
      "Class search context is missing (term/career/institution). Open Shopping Cart and retry."
    );
  }

  if (/<PAGE id='SSR_SSENRL_CART'>/i.test(responseText) && !/MTG_CLASS_NBR\$0/i.test(responseText)) {
    const msg = extractErrorMessage(responseText);
    if (msg) throw new Error(msg);
    throw new Error("Request returned shopping cart page instead of class search results.");
  }

  const criteriaClassNumber =
    responseText.match(/Class Nbr:\s*'?\s*<strong>(\d+)<\/strong>/i)?.[1] ?? null;

  const firstResultClassNumber =
    responseText.match(/id='MTG_CLASS_NBR\$0'[\s\S]*?>\s*(\d+)\s*<\/a>/i)?.[1] ?? null;

  const nextActionForDetails =
    responseText.match(/submitAction_win0\(document\.win0,'(MTG_CLASSNAME\$0)'\)/i)?.[1] ?? null;

  return {
    ok: true,
    requestedClassNumber,
    criteriaClassNumber,
    firstResultClassNumber,
    nextActionForDetails,
    detailPageId: null,
    detailResponseText: null
  };
}

export function mergeDetailData(
  summary: LookupClassSuccess,
  detailResponseText: string
): LookupClassSuccess {
  return {
    ...summary,
    detailPageId: extractPageId(detailResponseText),
    detailResponseText
  };
}

export function isMatchingClass(summary: LookupClassSuccess, requestedClassNumber: string): boolean {
  if (summary.firstResultClassNumber && summary.firstResultClassNumber === requestedClassNumber) {
    return true;
  }
  if (summary.criteriaClassNumber && summary.criteriaClassNumber === requestedClassNumber) {
    return true;
  }
  return false;
}

function extractPageId(responseText: string): string | null {
  return responseText.match(/<PAGE id='([^']+)'/i)?.[1] ?? null;
}

export function extractErrorMessage(responseText: string): string | null {
  const raw = responseText.match(/<GENMSG[^>]*><!\[CDATA\[(.*?)\]\]><\/GENMSG>/is)?.[1];
  if (!raw) return null;
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return decodeEntities(text);
}

export function extractPostUrl(responseText: string): string | null {
  const postUrl = responseText.match(/postUrl_win0\s*=\s*'([^']+)'/i)?.[1] ?? null;
  if (!postUrl) return null;
  return resolveActionUrl(postUrl);
}

export function extractActionIds(responseText: string, prefix: "MYLINK" | "MYLINK1"): string[] {
  const pattern = new RegExp(
    `submitAction_win0\\(document\\.win0,'(${prefix}\\$\\d+)\\s*'\\)`,
    "gi"
  );
  const unique = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(responseText)) !== null) {
    const actionId = (match[1] ?? "").trim();
    if (!actionId) continue;
    unique.add(actionId);
  }

  return Array.from(unique);
}

export function extractFieldValue(responseText: string, id: string): string {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}\\s*['"][\\s\\S]*?>\\s*([^<]+?)\\s*<`, "i");
  const value = pattern.exec(responseText)?.[1] ?? "";
  return decodeEntities(value);
}

