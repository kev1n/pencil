import type { CtecIndexedEntry } from "../../ctec-index/types";
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

// Sentinel-only fallback. Real entries match via descriptionMatchesCatalog;
// sentinels carry "<subject> <catalog>" in description with no section ID.
// catalogNumber may include a sequence suffix ("205-3"); searchText is
// normalized (non-alphanumerics → space), so collapse the hyphen to match.
function catalogTokenRegex(catalogNumber: string): RegExp {
  const normalized = catalogNumber.replace(/-/g, " ");
  return new RegExp(`(?:^|\\s)${normalized}(?:\\s|$)`);
}

// Matches the leading catalog identifier in a CTEC description, capturing
// the optional single-digit sequence suffix that distinguishes sibling
// sequence courses like GEN_ENG 205-1 / 205-2 / 205-3:
//   "GEN_ENG 205-3-22 Engineering Analysis III" → "205-3"
//   "COMP_SCI 211-22 Fundamentals"              → "211"
//   "GEN_ENG 205-3 Engineering Analysis III"    → "205-3"  (course row)
//   "COMP_SCI 211 Fundamentals"                 → "211"    (course row)
// The single-digit sequence has a `(?!\d)` lookahead so that a 2+-digit
// section ID (e.g. `-22`) doesn't get partially consumed as `-2`.
const CATALOG_ID_PATTERN = /(?:^|[^0-9])(\d+(?:-\d(?!\d))?)/;

export function descriptionMatchesCatalog(
  description: string,
  catalogNumber: string
): boolean {
  const match = description.match(CATALOG_ID_PATTERN);
  return !!match && match[1] === catalogNumber;
}

// Any-overlap match across all comma-separated last names in either
// string. CTEC lists co-instructors in unstable order, so trailing-token-
// only would miss legitimate matches and admit wrong-course collisions.
export function instructorMatches(
  rowInstructor: string,
  requestedInstructor: string
): boolean {
  const requested = extractLastNameTokens(requestedInstructor);
  if (requested.length === 0) return true;
  const rowLast = extractLastNameTokens(rowInstructor);
  if (rowLast.length === 0) return false;
  return requested.some((ln) => rowLast.includes(ln));
}

export function entryMatchesCourse(
  entry: CtecIndexedEntry,
  subject: string,
  catalogNumber: string,
  instructor: string
): boolean {
  // Subject is implicit in readSubjectIndex(subject); descriptions often
  // omit the prefix, so checking it here would produce false negatives.
  void subject;

  if (entry.actionId === NOT_FOUND_ACTION_ID) {
    if (!catalogTokenRegex(catalogNumber).test(entry.searchText)) return false;
  } else if (!descriptionMatchesCatalog(entry.description, catalogNumber)) {
    return false;
  }

  return instructorMatches(entry.instructor, instructor);
}

export function extractSubjectAndCatalog(
  linkText: string
): { subject: string; catalogNumber: string } | null {
  // Captures the 3-digit catalog with an optional single-digit sequence
  // suffix (e.g. "205-3" for GEN_ENG 205-3). The `(?!\d)` lookahead keeps
  // a section ID like "-22" out of the capture. Paper.nu's `-0` default
  // suffix is stripped so downstream callers compare against the bare
  // form ("439" rather than "439-0").
  // Matches: "COMP_SCI 439-0 (12345)" → "439"
  //          "GEN_ENG 205-3 (12345)"  → "205-3"
  //          "COMP_SCI 211-22"        → "211"   (sequence not consumed)
  const match = linkText.trim().match(/^([A-Z][A-Z_ ]*?)\s+(\d{3}(?:-\d(?!\d))?)/i);
  if (!match) return null;
  const subject = (match[1] ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  const catalogNumber = (match[2] ?? "").trim().replace(/-0$/, "");
  if (!subject || !catalogNumber) return null;
  return { subject, catalogNumber };
}

// Discussion / lab sub-rows render the class label inside a
// <span class="PSHYPERLINKDISABLED"> instead of an <a>. Their CTEC is
// shared with the parent lecture, so we inject the cell (so the row's
// border / alternating background stays continuous) but suppress the
// Load CTEC button + cache short-circuit on these rows.
export function isDisabledClassRow(row: Element): boolean {
  return (
    row.querySelector(
      "span.PSHYPERLINKDISABLED[id^='P_CLASS_NAME$span$'], span.PSHYPERLINKDISABLED[id^='E_CLASS_NAME$span$']"
    ) !== null
  );
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
