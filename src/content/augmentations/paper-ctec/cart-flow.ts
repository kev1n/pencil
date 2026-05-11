import {
  addSectionToCart,
  matchCaesarGroup,
  matchCaesarSection,
  searchCaesarCatalog,
  type CartFlowResult
} from "../class-search/caesar-search";
import { isCaesarAuthRequiredError } from "../class-search/caesar-search/types";
import {
  withAuthRecovery,
  type AuthRecovery
} from "../class-search/auth-recovery";
import { bareCatalogNumber } from "../class-search/catalog-format";
import {
  getDataMapInfo,
  getTermCourses,
  type PaperSection,
  type PaperTermCourse
} from "../class-search/paper-data";
import type { CtecLinkParams } from "../ctec-links/types";
import { buildInstructorLastNameLabel } from "./identity";
import { getActivePaperTermId } from "./paper-active-term";

export type CartChipResult =
  | {
      ok: true;
      classNumber: string;
      sectionLabel: string;
      termId: string;
    }
  | {
      ok: false;
      error: string;
      alreadyInCart?: boolean;
      classNumber?: string;
    };

const INSTITUTION_DEFAULT = "NWUNV";

// End-to-end cart-add flow driven from a paper.nu schedule chip. The chip
// only knows subject + catalog + instructor + topic, so we:
//   1. Assume the user is planning the latest paper.nu term (info.latest).
//   2. Find the matching section in that term's cached course data using
//      subject/catalog and the chip's last-name instructor label.
//   3. Run a CAESAR catalog search to resolve the 5-digit class number.
//   4. Drive CAESAR's Search → Select → Next chain via background fetches.
//
// This avoids any new permissions and reuses paper-data's existing cache
// so we never touch paper.nu's IndexedDB.
//
// CAESAR auth is handled the same way class-search's add-to-cart on the
// CAESAR page handles it: `withAuthRecovery` runs the silent SSO walk
// (Layer 1 + 2) before falling back to a popup tab, and re-runs the whole
// cart chain after recovery succeeds. The same `withAuthRecovery` helper
// also fires for `searchCaesarCatalog` since both share `getEntryFormState()`.
export async function addChipSectionToCart(
  authRecovery: AuthRecovery,
  params: CtecLinkParams,
  titleHint: string,
  onProgress?: (message: string) => void
): Promise<CartChipResult> {
  try {
    const result = await withAuthRecovery(
      authRecovery,
      isCaesarAuthRequiredError,
      () => addChipSectionToCartCore(params, titleHint, onProgress)
    );
    if (result === null) {
      // User canceled the popup or it couldn't open — withAuthRecovery
      // already toasted; surface a clean error so the chip resets.
      return { ok: false, error: "CAESAR sign-in was canceled." };
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function addChipSectionToCartCore(
  params: CtecLinkParams,
  titleHint: string,
  onProgress?: (message: string) => void
): Promise<CartChipResult> {
  onProgress?.("Loading paper.nu term data…");
  const info = await getDataMapInfo();
  const { termId } = await getActivePaperTermId();
  if (!termId) {
    return { ok: false, error: "Couldn't determine the active paper.nu term." };
  }

  const courses = await getTermCourses(termId);
  const match = findSection(courses, params, titleHint);
  if (!match) {
    return {
      ok: false,
      error: `No section of ${params.subject} ${params.catalogNumber} taught by ${params.instructor || "this instructor"} found in ${info.terms[termId]?.name ?? termId}.`
    };
  }

  onProgress?.(`Searching CAESAR for ${params.subject} ${params.catalogNumber}…`);
  const search = await searchCaesarCatalog({
    termId,
    institution: INSTITUTION_DEFAULT,
    subject: params.subject,
    bareCatalog: bareCatalogNumber(params.catalogNumber)
  });

  // CTEC links carry only the bare number ("105"); paper.nu's resolved
  // section knows the full catalog including the suffix ("105-8"). Use
  // the resolved value so `matchCaesarGroup` lands on the right group.
  const group = matchCaesarGroup(search.groups, match.catalog ?? params.catalogNumber);
  const caesarSection = group
    ? matchCaesarSection(group, match.section, match.component)
    : null;
  if (!caesarSection) {
    return {
      ok: false,
      error: `CAESAR didn't return section ${match.section}-${match.component} for ${params.subject} ${params.catalogNumber} in ${info.terms[termId]?.name ?? termId}.`
    };
  }

  onProgress?.(`Adding #${caesarSection.classNumber}…`);
  const result: CartFlowResult = await addSectionToCart({
    classNumber: caesarSection.classNumber,
    termId,
    institution: INSTITUTION_DEFAULT,
    subject: params.subject,
    bareCatalog: bareCatalogNumber(params.catalogNumber)
  });

  if (result.ok) {
    return {
      ok: true,
      classNumber: result.classNumber,
      sectionLabel: result.sectionLabel,
      termId
    };
  }
  if ("needsRelatedSection" in result) {
    // paper-ctec's cart flow can't show an inline picker — bail with a
    // pointer to the class-search UI which has the picker wired up.
    return {
      ok: false,
      error: `${params.subject} ${params.catalogNumber} requires picking a discussion/lab. Add it from Class Search.`,
      classNumber: result.classNumber
    };
  }
  return {
    ok: false,
    error: result.error,
    alreadyInCart: result.alreadyInCart,
    classNumber: result.classNumber ?? caesarSection.classNumber
  };
}

// Resolves a chip's identity (subject + catalog + instructor + topic) to a
// concrete paper.nu section + termId, without touching CAESAR. Used by the
// cart-cache integration so chips can render "in cart" / "enrolled" badges
// on initial mount based purely on local data + the persisted cache.
//
// Returns null when paper.nu data hasn't loaded yet, the active term can't
// be resolved, or no section matches the chip identity.
export type ResolvedChipSection = {
  termId: string;
  subject: string;
  catalog: string;
  sectionLabel: string;     // "1-LEC" — matches CAESAR cart cache convention
};

export async function resolveChipSection(
  params: CtecLinkParams,
  titleHint: string
): Promise<ResolvedChipSection | null> {
  try {
    const { termId } = await getActivePaperTermId();
    if (!termId) return null;
    const courses = await getTermCourses(termId);
    const found = findSectionWithCourse(courses, params, titleHint);
    if (!found) return null;
    return {
      termId,
      subject: params.subject,
      // CTEC links only carry the bare catalog (`extractSubjectAndCatalog`
      // captures `\d{3}`), so a chip for CHEM 105-8 has params.catalogNumber
      // = "105". Use the resolved paper.nu course's catalog instead — that
      // keeps the suffix (e.g. "105-8") so the cache signature matches the
      // cart-page hydrator's parse of "CHEM 105-8-05".
      catalog: found.course.catalog,
      sectionLabel: `${found.section.section}-${found.section.component}`
    };
  } catch {
    return null;
  }
}

function findSectionWithCourse(
  courses: PaperTermCourse[],
  params: CtecLinkParams,
  titleHint: string
): { course: PaperTermCourse; section: PaperSection } | null {
  const section = findSection(courses, params, titleHint);
  if (!section) return null;
  for (const course of courses) {
    if (course.sections.includes(section)) return { course, section };
  }
  return null;
}

// Picks the section a chip represents from paper.nu's course data. We have
// to disambiguate because a course can have many sections; we use the same
// last-name instructor label the rest of the augmentation uses (so "Smith,
// Jones" matches "Jones, Smith" too) and topic if the chip carries one.
// Falls back to LEC over discussion/lab when multiple sections still tie.
function findSection(
  courses: PaperTermCourse[],
  params: CtecLinkParams,
  titleHint: string
): PaperSection | null {
  const targetCatalog = params.catalogNumber.toLowerCase();
  const matchingCourses = courses.filter(
    (c) =>
      c.subject === params.subject &&
      sameCatalog(c.catalog.toLowerCase(), targetCatalog)
  );
  if (matchingCourses.length === 0) return null;

  const wantInstructor = sortedLower(params.instructor);
  const wantTopic = extractTopic(titleHint);

  const candidates: PaperSection[] = [];
  for (const course of matchingCourses) {
    for (const section of course.sections) {
      const label = buildInstructorLastNameLabel(
        (section.instructors ?? [])
          .map((i) => i.name?.trim() ?? "")
          .filter(Boolean)
      );
      if (sortedLower(label) !== wantInstructor) continue;
      if (wantTopic && section.topic && section.topic.trim() !== wantTopic) continue;
      candidates.push(section);
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const lec = candidates.find((s) => s.component === "LEC");
  return lec ?? candidates[0]!;
}

function sortedLower(value: string): string {
  return value
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

function sameCatalog(a: string, b: string): boolean {
  if (a === b) return true;
  // Tolerate paper.nu's "111" vs CAESAR-style "111-0".
  if (a.replace(/-0$/, "") === b.replace(/-0$/, "")) return true;
  // CTEC links strip catalog suffixes ("CHEM 105" instead of "CHEM 105-8")
  // because the regex in ctec-links/helpers.ts only captures three digits.
  // Treat bare-vs-suffixed as a match when the bare numbers agree;
  // findSection's instructor + topic filters disambiguate from there.
  const bareA = a.split("-")[0] ?? "";
  const bareB = b.split("-")[0] ?? "";
  if (bareA && bareA === bareB && (a === bareA || b === bareB)) return true;
  return false;
}

// titleHint is "{topic} - {subtitle}" when a topic exists, otherwise the
// subtitle alone. Pull the topic back out so we can disambiguate sections.
function extractTopic(titleHint: string): string | null {
  if (!titleHint) return null;
  const idx = titleHint.indexOf(" - ");
  if (idx <= 0) return null;
  return titleHint.slice(0, idx).trim();
}

