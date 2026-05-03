import { normalizeSearch } from "../ctec-navigation/helpers";
import type { CtecIndexedEntry } from "../ctec-navigation/types";
import { INSTRUCTOR_SELECTOR, NOT_FOUND_ACTION_ID } from "./constants";

export function termToSortKey(term: string): number {
  // Handles both "Fall 2023" and "2023 Fall" (CTEC uses year-first format).
  const seasonMap: Record<string, number> = { Fall: 0, Winter: 1, Spring: 2, Summer: 3 };
  let year = 0;
  let s = 0;
  for (const part of term.trim().split(/\s+/)) {
    const n = parseInt(part, 10);
    if (!isNaN(n) && n > 1000) {
      year = n;
    } else if (part in seasonMap) {
      s = seasonMap[part] ?? 0;
    }
  }
  if (!year) return 0;
  // Fall Y → Y*4+0; Winter/Spring/Summer Y → (Y-1)*4+s  (so Winter 2024 > Fall 2023)
  const adjustedYear = s === 0 ? year : year - 1;
  return adjustedYear * 4 + s;
}

export function normalizeInstructor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Extract the last-name token from each comma-separated name in an instructor string.
// "John Hartman,Stacey Wolcott" → ["hartman", "wolcott"]
export function extractLastNameTokens(instructor: string): string[] {
  return instructor
    .split(",")
    .map((n) => {
      const parts = normalizeInstructor(n.trim()).split(" ").filter((t) => t.length > 0);
      return parts[parts.length - 1] ?? "";
    })
    .filter((t) => t.length > 1);
}

// Regex matching catalog number as a standalone token in normalized text.
// e.g. catalog "395" matches "comm st 395 0 21" but NOT "comm st 3950".
// Used only for sentinel entries; real entries use the stricter section-
// prefix check below.
function catalogTokenRegex(catalogNumber: string): RegExp {
  return new RegExp(`(?:^|\\s)${catalogNumber}(?:\\s|$)`);
}

// Matches the FIRST section identifier in a CTEC description — the
// "<catalog>-<part>(-<sub>)?" pattern that appears at the head of every
// real CTEC row (e.g. "PSYCH 110-0-25" → captures "110"; "Spring 2024
// 211-0-21 Title" → captures "211"). The leading `(?:^|[^0-9])` guard
// ensures we don't pick up a digit group glued to other digits.
const SECTION_ID_PATTERN = /(?:^|[^0-9])(\d+)-\d+(?:-\d+)?/;

export function entryMatchesCourse(
  entry: CtecIndexedEntry,
  subject: string,
  catalogNumber: string,
  instructor: string
): boolean {
  // The subject check is intentionally omitted: entries come from readSubjectIndex(subject)
  // which already scopes to the correct subject. CTEC descriptions often omit the subject
  // prefix (e.g. "395-0-21 Topics in..." rather than "COMM_ST 395-0-21 Topics in..."),
  // so a subject check against searchText would produce false negatives.
  void subject;

  if (entry.actionId === NOT_FOUND_ACTION_ID) {
    // Sentinel: synthetic entry whose description is "<subject> <catalog>"
    // (no section identifier). Match against the normalized searchText
    // since there's nothing else to check.
    if (!catalogTokenRegex(catalogNumber).test(entry.searchText)) return false;
  } else {
    // Real entries: the catalog must appear as the leading digit group of
    // the SECTION identifier in the raw description. This avoids the
    // leak where a catalog substring shows up elsewhere — e.g. a 211 entry
    // whose title mentions "111" (a year, room, related course number, or
    // a section number like "211-0-111") would otherwise match a catalog
    // 111 lookup. The section identifier is structurally stable across
    // CTEC rows; substrings in titles/years are not.
    const sectionMatch = entry.description.match(SECTION_ID_PATTERN);
    if (!sectionMatch || sectionMatch[1] !== catalogNumber) return false;
  }

  if (!instructor) return true;
  const lastNames = extractLastNameTokens(instructor);
  if (lastNames.length === 0) return true;
  // Compare against EVERY last-name token in the entry's instructor field
  // (CTEC sometimes lists co-instructors comma-separated, in unstable
  // order). Previously we only checked the trailing token, which both
  // missed legitimate co-taught matches AND let multi-instructor entries
  // for the wrong course slip through when the co-instructor's surname
  // happened to match.
  const entryLastNames = extractLastNameTokens(entry.instructor);
  if (entryLastNames.length === 0) return false;
  return lastNames.some((ln) => entryLastNames.includes(ln));
}

// Used by fetcher to find the matching course row in the CTEC subject page.
// The page is already filtered by subject (subject is in the URL), so descriptions
// appear as "395-0: Title" without a subject prefix — catalog match only.
export function courseDescMatchesCatalog(description: string, catalogNumber: string): boolean {
  return catalogTokenRegex(catalogNumber).test(normalizeSearch(description));
}

export function extractSubjectAndCatalog(
  linkText: string
): { subject: string; catalogNumber: string } | null {
  // Match "COMP_SCI 439-0 (12345)" or "ECON 201-6 (22345)"
  const match = linkText.trim().match(/^([A-Z][A-Z_ ]*?)\s+(\d{3})/i);
  if (!match) return null;
  const subject = (match[1] ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  const catalogNumber = (match[2] ?? "").trim();
  if (!subject || !catalogNumber) return null;
  return { subject, catalogNumber };
}

export function extractInstructorFromRow(row: HTMLTableRowElement): string {
  const el = row.querySelector<HTMLElement>(INSTRUCTOR_SELECTOR);
  return el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function isAuthResponse(html: string): boolean {
  const normalized = html.toLowerCase();
  return (
    normalized.includes("northwestern sso") ||
    normalized.includes("northwestern online passport") ||
    normalized.includes("ads-fed.northwestern.edu") ||
    normalized.includes("/adfs/ls") ||
    normalized.includes("fed.it.northwestern.edu") ||
    normalized.includes("shibboleth") ||
    normalized.includes("netid or email address") ||
    normalized.includes("trouble logging in?") ||
    (normalized.includes("sign in") && normalized.includes("password"))
  );
}
