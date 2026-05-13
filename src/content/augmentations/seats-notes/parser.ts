import { decodeEntities as decodeEntitiesPure } from "../../../shared/decode-entities";
import type { LookupClassResponse } from "../../../shared/messages";
import type {
  CombinedSectionRow,
  SeatsNotesFailure,
  SeatsNotesResult,
  SeatsNotesSuccess
} from "./types";

export function toSeatsNotesResult(response: LookupClassResponse): SeatsNotesResult {
  if (!response.ok) return { ok: false, error: response.error };

  const detailText = response.detailResponseText;
  if (!detailText || response.detailPageId !== "SSR_CLSRCH_DTL") {
    return {
      ok: true,
      requestedClassNumber: response.requestedClassNumber,
      criteriaClassNumber: response.criteriaClassNumber,
      classCapacity: null,
      enrollmentTotal: null,
      availableSeats: null,
      waitListCapacity: null,
      waitListTotal: null,
      classAttributes: null,
      enrollmentRequirements: null,
      classNotes: null,
      isCombinedSection: false,
      combinedSectionRows: []
    };
  }

  const isCombinedSection = /Combined Section Capacity/i.test(detailText);
  const success: SeatsNotesSuccess = {
    ok: true,
    requestedClassNumber: response.requestedClassNumber,
    criteriaClassNumber: response.criteriaClassNumber,
    classCapacity: extractTextById(detailText, "SSR_CLS_DTL_WRK_ENRL_CAP"),
    enrollmentTotal: extractTextById(detailText, "SSR_CLS_DTL_WRK_ENRL_TOT"),
    availableSeats: extractTextById(detailText, "SSR_CLS_DTL_WRK_AVAILABLE_SEATS"),
    waitListCapacity: extractTextById(detailText, "SSR_CLS_DTL_WRK_WAIT_CAP"),
    waitListTotal: extractTextById(detailText, "SSR_CLS_DTL_WRK_WAIT_TOT"),
    classAttributes: extractLongTextById(detailText, "SSR_CLS_DTL_WRK_SSR_CRSE_ATTR_LONG"),
    enrollmentRequirements: extractEnrollmentRequirements(detailText),
    classNotes: extractLongTextById(detailText, "DERIVED_CLSRCH_SSR_CLASSNOTE_LONG"),
    isCombinedSection,
    combinedSectionRows: isCombinedSection ? extractCombinedSectionRows(detailText) : []
  };

  return success;
}

export function toFailure(error: unknown): SeatsNotesFailure {
  const text = error instanceof Error ? error.message : "Unknown error.";
  return { ok: false, error: text };
}

// Parses CAESAR's "Combined Section" grid (#SCTN_CMBND$scroll$0). Each row's
// CLASS_NAME cell looks like "COMP_SCI 346-0-1\n\nLEC (16045)".
function extractCombinedSectionRows(responseText: string): CombinedSectionRow[] {
  const rows: CombinedSectionRow[] = [];
  const classNamePattern = /id=['"]CLASS_NAME\$(\d+)['"][^>]*>\s*([^<]+?)\s*<\/span>/gi;
  // Each per-row extractor scans a bounded window, not the whole response —
  // keeps the parser O(N) over the grid even with many cross-listed sections.
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = classNamePattern.exec(responseText)) !== null) matches.push(match);

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const index = m[1]!;
    const parsed = parseClassNameCell(decodeEntities(m[2] ?? ""));
    if (!parsed) continue;
    const windowStart = m.index;
    const windowEnd = matches[i + 1]?.index ?? responseText.length;
    const window = responseText.slice(windowStart, windowEnd);
    rows.push({
      classNumber: parsed.classNumber,
      label: parsed.label,
      component: parsed.component,
      status: extractStatusAlt(window),
      enrolled: extractTextById(window, `DERIVED_CLS_CMB_ENRL_TOT$${index}`),
      waitlist: extractTextById(window, `DERIVED_CLS_CMB_WAIT_TOT$${index}`)
    });
  }
  return rows;
}

function parseClassNameCell(
  raw: string
): { classNumber: string; label: string; component: string | null } | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const classNumMatch = /\((\d+)\)\s*$/.exec(collapsed);
  if (!classNumMatch) return null;
  const head = collapsed.slice(0, classNumMatch.index).trim();
  const tokens = head.split(/\s+/);
  if (tokens.length < 2) return null;
  const component = /^[A-Z]{2,4}$/.test(tokens[tokens.length - 1]!)
    ? tokens.pop()!
    : null;
  return { classNumber: classNumMatch[1]!, label: tokens.join(" "), component };
}

function extractStatusAlt(window: string): string | null {
  const m = /<img[^>]*alt=['"]([^'"]+)['"]/i.exec(window);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

function extractEnrollmentRequirements(responseText: string): string | null {
  // Try the plain-text span version first (appears in SSR_CLSRCH_DTL Enrollment Information group).
  const span = extractLongTextById(responseText, "SSR_CLS_DTL_WRK_SSR_REQUISITE_LONG");
  if (span) return span;

  // Fall back to the HTML area version (DERIVED_CLS_DTL_SSR_REQUISITE_LONG, dynamic ID suffix).
  return extractHtmlAreaNearId(responseText, "DERIVED_CLS_DTL_SSR_REQUISITE_LONG");
}

function extractHtmlAreaNearId(responseText: string, partialId: string): string | null {
  // Find the first element whose id begins with this partial id (handles $246$ style suffixes).
  const escapedId = partialId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const idPattern = new RegExp(`<(\\w+)\\b[^>]*id=['"](?:win0div)?${escapedId}[^'"]*['"][^>]*>`, "i");
  const idMatch = idPattern.exec(responseText);
  if (!idMatch) return null;

  // Bound the scan to the matching closing tag — PS field boundary, not next block.
  const tagName = idMatch[1].toLowerCase();
  const containerStart = idMatch.index + idMatch[0].length;
  const tagPattern = new RegExp(`<(/?)${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = containerStart;
  let depth = 1;
  let containerEnd = -1;
  let tag: RegExpExecArray | null;
  while ((tag = tagPattern.exec(responseText)) !== null) {
    if (tag[1] === "/") {
      depth--;
      if (depth === 0) {
        containerEnd = tag.index;
        break;
      }
    } else {
      depth++;
    }
  }
  if (containerEnd < 0) return null;

  const container = responseText.slice(containerStart, containerEnd);
  const areaPattern = /<!--\s*Begin HTML Area[^>-]*-->([\s\S]*?)<!--\s*End HTML Area\s*-->/i;
  const areaMatch = areaPattern.exec(container);
  if (!areaMatch) return null;

  const raw = areaMatch[1] ?? "";
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const items: string[] = [];
  let liMatch: RegExpExecArray | null;
  while ((liMatch = liPattern.exec(raw)) !== null) {
    const text = (liMatch[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) items.push(decodeEntities(text));
  }

  return items.length > 0 ? items.join(" | ") : null;
}

function extractTextById(responseText: string, id: string): string | null {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}['"][\\s\\S]*?>\\s*([^<]+?)\\s*<`, "i");
  const value = pattern.exec(responseText)?.[1];
  return normalizeText(value);
}

function extractLongTextById(responseText: string, id: string): string | null {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}['"][^>]*>([\\s\\S]*?)<\\/span>`, "i");
  const raw = pattern.exec(responseText)?.[1];
  if (!raw) return null;

  const normalized = raw
    .replace(/<br\s*\/?>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return decodeEntities(normalized);
}

function normalizeText(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = decodeEntities(value);
  return normalized.length > 0 ? normalized : null;
}

function decodeEntities(value: string): string {
  return decodeEntitiesPure(value).replace(/\s+/g, " ").trim();
}
