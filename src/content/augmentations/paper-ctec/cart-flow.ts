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
import { bareCatalogNumber, formatCatalogForDisplay } from "../class-search/catalog-format";
import {
  getDataMapInfo,
  getTermCourses,
  type PaperSection
} from "../class-search/paper-data";
import { extractLastNameTokens } from "../ctec-links/helpers";
import type { CtecLinkParams } from "../ctec-links/types";
import { readPaperScheduleSnapshot } from "../paper-combos/data";
import { buildInstructorLastNameLabel } from "./identity";
import { readActiveTermNameFromDom } from "./paper-active-term";

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
      termId?: string;
      sectionLabel?: string;
    };

const INSTITUTION_DEFAULT = "NWUNV";

// Resolve the saved schedule before contacting CAESAR. A sign-in retry
// keeps the original selection even if the user opens another term.
export async function addChipSectionToCart(
  authRecovery: AuthRecovery,
  params: CtecLinkParams,
  titleHint: string,
  onProgress?: (message: string) => void
): Promise<CartChipResult> {
  try {
    onProgress?.("Loading paper.nu term data…");
    const { termId, termName, section } = await resolveScheduledChip(params, titleHint);
    const result = await withAuthRecovery(
      authRecovery,
      isCaesarAuthRequiredError,
      () => addChipSectionToCartCore(params, termId, termName, section, onProgress)
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
  termId: string,
  termName: string,
  match: PaperSection,
  onProgress?: (message: string) => void
): Promise<CartChipResult> {
  onProgress?.(`Searching CAESAR for ${params.subject} ${params.catalogNumber}…`);
  const search = await searchCaesarCatalog({
    termId,
    institution: INSTITUTION_DEFAULT,
    subject: params.subject,
    bareCatalog: bareCatalogNumber(params.catalogNumber)
  });

  // Cross-listed sections can carry a different catalog from their parent course.
  const group = matchCaesarGroup(search.groups, match.number ?? match.catalog);
  const caesarSection = group
    ? matchCaesarSection(group, match.section, match.component)
    : null;
  if (!caesarSection) {
    return {
      ok: false,
      error: `CAESAR didn't return section ${match.section}-${match.component} for ${params.subject} ${params.catalogNumber} in ${termName}.`
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
    classNumber: result.classNumber ?? caesarSection.classNumber,
    termId,
    sectionLabel: caesarSection.sectionLabel
  };
}

export type ResolvedChipSection = {
  termId: string;
  subject: string;
  catalog: string;
  sectionLabel: string;
};

export async function resolveChipSection(
  params: CtecLinkParams,
  titleHint: string
): Promise<ResolvedChipSection | null> {
  try {
    const { termId, section } = await resolveScheduledChip(params, titleHint);
    return {
      termId,
      subject: section.subject,
      catalog: section.number ?? section.catalog,
      sectionLabel: `${section.section}-${section.component}`
    };
  } catch {
    return null;
  }
}

async function resolveScheduledChip(
  params: CtecLinkParams,
  titleHint: string
): Promise<{ termId: string; termName: string; section: PaperSection }> {
  // Paper.nu keeps the term control in the DOM when the Search pane is
  // hidden. Verify this tab's term because the saved schedule is shared
  // across tabs. Only consider sections on the matching schedule.
  const activeTerm = readActiveTermNameFromDom(document);
  if (!activeTerm) {
    throw new Error("Couldn't verify the schedule's term. Open Search in Paper.nu and try again.");
  }
  const schedule = await readPaperScheduleSnapshot();
  if (!schedule) {
    throw new Error("Couldn't read the active paper.nu schedule. Reload Paper.nu and try again.");
  }
  const { termId, sectionIds } = schedule;
  const info = await getDataMapInfo(termId);
  const termName = info.terms[termId]?.name;
  if (!termName) {
    throw new Error("Paper.nu hasn't published course data for this schedule's term.");
  }
  if (activeTerm !== termName) {
    throw new Error("The saved schedule doesn't match this tab's term. Reload Paper.nu and try again.");
  }
  const courses = await getTermCourses(termId);
  if (readActiveTermNameFromDom(document) !== activeTerm) {
    throw new Error("Paper.nu is switching terms. Wait for the schedule to load and try again.");
  }

  const scheduled = new Set(sectionIds);
  const wantCatalog = formatCatalogForDisplay(params.catalogNumber);
  const wantInstructor = sortedLower(params.instructor);
  const matches = new Map<string, PaperSection>();
  for (const course of courses) {
    for (const section of course.sections) {
      if (!scheduled.has(section.section_id) || section.subject !== params.subject) continue;
      if (formatCatalogForDisplay(section.number ?? section.catalog) !== wantCatalog) continue;
      const names = (section.instructors ?? []).map((i) => i.name ?? "").filter(Boolean);
      const withInitials = buildInstructorLastNameLabel(names);
      // Canvas cards show last names only. That is safe for cart matching
      // only when a single section on the saved schedule fits the card.
      const lastNames = extractLastNameTokens(withInitials).join(",");
      if (wantInstructor !== sortedLower(withInitials) && wantInstructor !== sortedLower(lastNames)) continue;
      const title = section.topic ? `${section.topic} - ${section.title}` : section.title;
      if (title.trim() !== titleHint.trim()) continue;
      matches.set(section.section_id, section);
    }
  }

  const [section] = matches.values();
  if (matches.size !== 1 || !section) {
    throw new Error(`Couldn't identify one section of ${params.subject} ${params.catalogNumber} on your ${termName} schedule. Use CAESAR Class Search to add it.`);
  }
  return { termId, termName, section };
}

function sortedLower(value: string): string {
  return value.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).sort().join(",");
}
