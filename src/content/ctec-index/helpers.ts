import { decodeEntities } from "../peoplesoft/shared";
import { extractActionIds, extractFieldValue } from "../peoplesoft/parsers";
import { BLUERA_ORIGIN, CAESAR_ORIGIN } from "../../shared/nu-hosts";
import { DEFAULT_CAREER_CODE, PAGE_ID } from "./constants";
import type { CtecCourseSeed, CtecIndexedEntry, CtecRowSeed } from "./types";

export function normalizeCareerCode(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "TGS") return "TGS";
  return DEFAULT_CAREER_CODE;
}

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

export function buildSubjectResultsUrl(subjectCode: string, careerCode: string): string {
  const url = new URL(
    "/psc/csnu/EMPLOYEE/SA/c/NWCT.NW_CT_PUB_RSLT_FL.GBL",
    CAESAR_ORIGIN
  );
  url.searchParams.set("Page", PAGE_ID);
  url.searchParams.set("NW_CTEC_SRCH_CHOIC", "C");
  url.searchParams.set("ACAD_CAREER", normalizeCareerCode(careerCode));
  url.searchParams.set("SUBJECT", subjectCode);
  url.searchParams.set("NoCrumbs", "yes");
  url.searchParams.set("PortalKeyStruct", "yes");
  return url.toString();
}

export function extractBlueraUrl(responseText: string): string | null {
  const doPortalMatch =
    responseText.match(/DoPortalUrl\('((?:\\'|[^'])+)'\)/i)?.[1] ??
    responseText.match(/DoPortalUrl\("((?:\\"|[^"])+)"\)/i)?.[1] ??
    null;

  const rawValue = doPortalMatch
    ? doPortalMatch
    : responseText.match(/window\.open\('((?:\\'|[^'])+)'/i)?.[1] ?? null;
  if (!rawValue) return null;

  const unescaped = rawValue.replace(/\\'/g, "'").replace(/\\"/g, '"');
  const decoded = decodeEntities(unescaped);
  const trimmed = decoded.trim();
  if (!trimmed) return null;

  // Extract SelectedIDforPrint and build a direct Bluera URL,
  // bypassing the PeopleSoft portal redirect from DoPortalUrl.
  const selectedId = trimmed.match(/[?&]SelectedIDforPrint=([^&]+)/i)?.[1] ?? null;
  if (selectedId) {
    return `${BLUERA_ORIGIN}/northwestern/rpvf-eng.aspx?lang=eng&redi=1&SelectedIDforPrint=${selectedId}&ReportType=2&regl=en-US`;
  }

  try {
    return new URL(trimmed, CAESAR_ORIGIN).toString();
  } catch {
    return trimmed;
  }
}

export function extractActionId(link: HTMLAnchorElement): string | null {
  if (link.id.startsWith("MYLINK1$")) return link.id.trim();

  const href = link.getAttribute("href") ?? "";
  const match = href.match(/submitAction_win0\(document\.win0,'([^']+)'\)/i)?.[1] ?? null;
  return match?.trim() ?? null;
}

export function collectClassRowsFromText(responseText: string): CtecRowSeed[] {
  const actionIds = extractActionIds(responseText, "MYLINK1");
  const rows: CtecRowSeed[] = [];

  for (const actionId of actionIds) {
    const index = actionId.match(/\$(\d+)$/)?.[1] ?? null;
    if (!index) continue;

    rows.push({
      actionId,
      term: extractFieldValue(responseText, `MYDESCR2$${index}`),
      description: extractFieldValue(responseText, `MYDESCR$${index}`),
      instructor: extractFieldValue(responseText, `CTEC_INSTRUCTOR$${index}`)
    });
  }

  return rows;
}

export function collectCourseRows(doc: Document): CtecCourseSeed[] {
  const rows = doc.querySelectorAll<HTMLTableRowElement>("tr.ps_grid-row[id^='NW_CT_PV_DRV$0_row_']");
  const seeds: CtecCourseSeed[] = [];

  for (const row of Array.from(rows)) {
    const link = row.querySelector<HTMLAnchorElement>("a[id^='MYLINK$']");
    if (!link) continue;

    const actionId = extractActionId(link);
    if (!actionId) continue;

    const description = cleanText(row.querySelector<HTMLElement>("[id^='MYLABEL$']")?.textContent);
    seeds.push({ actionId, description });
  }

  return seeds;
}

// Identity is blueraUrl when present (each CTEC has a unique URL),
// otherwise (term, description, instructor). actionId is excluded —
// PeopleSoft recycles `MYLINK1$N` indices per response, so including it
// would let a stale re-fetch create a duplicate row instead of merging.
export function dedupeEntries(entries: CtecIndexedEntry[]): CtecIndexedEntry[] {
  const byUrl = new Map<string, CtecIndexedEntry>();
  const byNatural = new Map<string, CtecIndexedEntry>();

  for (const entry of entries) {
    const bucket = entry.blueraUrl ? byUrl : byNatural;
    const key = entry.blueraUrl ?? naturalKey(entry);
    const existing = bucket.get(key);
    if (!existing || (!hasParsedSummary(existing) && hasParsedSummary(entry))) {
      bucket.set(key, entry);
    }
  }

  return [...byUrl.values(), ...byNatural.values()];
}

function naturalKey(entry: CtecIndexedEntry): string {
  return [
    normalizeSearch(entry.term),
    normalizeSearch(entry.description),
    normalizeSearch(entry.instructor)
  ].join("|");
}

function hasParsedSummary(entry: CtecIndexedEntry): boolean {
  return entry.reportSummary !== undefined;
}
