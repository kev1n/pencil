import type { LookupClassSuccess } from "../../shared/messages";
import { decodeEntities } from "./shared";

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

  const firstResultCourseTitle =
    responseText.match(
      /SSR_CLSRSLT_WRK_GROUPBOX2GP\$0'[^>]*>[\s\S]*?&nbsp;([^<]+?)&nbsp;<\/DIV>/i
    )?.[1] ?? null;

  const firstResultSection =
    responseText.match(/id='MTG_CLASSNAME\$0'[\s\S]*?>\s*([^<]+?)\s*<br/i)?.[1] ?? null;

  const nextActionForDetails =
    responseText.match(/submitAction_win0\(document\.win0,'(MTG_CLASSNAME\$0)'\)/i)?.[1] ?? null;

  return {
    ok: true,
    requestedClassNumber,
    criteriaClassNumber,
    firstResultClassNumber,
    firstResultCourseTitle,
    firstResultSection,
    firstResultInstructor: extractTextById(responseText, "MTG_INSTR$0"),
    firstResultDaysTimes: extractTextById(responseText, "MTG_DAYTIME$0"),
    firstResultRoom: extractTextById(responseText, "MTG_ROOM$0"),
    firstResultMeetingDates: extractTextById(responseText, "MTG_TOPIC$0"),
    firstResultGrading: extractTextById(responseText, "NW_DERIVED_SS3_DESCR$0"),
    firstResultStatus: extractStatusText(responseText),
    nextActionForDetails,
    searchPageId: extractPageId(responseText),
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

function extractTextById(responseText: string, id: string): string | null {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}['"][\\s\\S]*?>\\s*([^<]+?)\\s*<`, "i");
  const value = pattern.exec(responseText)?.[1];
  if (!value) return null;
  return decodeEntities(value);
}

function extractStatusText(responseText: string): string | null {
  const match = responseText.match(
    /id=['"]DERIVED_CLSRCH_SSR_STATUS_LONG\$0['"][\s\S]*?alt=["']([^"']+)["']/i
  )?.[1];

  if (!match) return null;
  return decodeEntities(match);
}
