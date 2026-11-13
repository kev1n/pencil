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
  refreshTermCourses,
  type PaperTermCourse,
  type PaperSection
} from "../class-search/paper-data";
import { extractLastNameTokens } from "../ctec-links/helpers";
import { lookupClass } from "../../peoplesoft";
import { initCartCache, lookupBySignature } from "../../cart-cache";
import { toSeatsNotesResult } from "../seats-notes/parser";
import {
  initStorage as initSeatsNotesStorage,
  knownClassNumber,
  readCachedEntry,
  rememberClassNumber,
  writeCachedEntry
} from "../seats-notes/storage";
import type { SeatsNotesSuccess } from "../seats-notes/types";
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
    const { termId, termName, section } = await resolveScheduledChip(params, titleHint, true);
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

// The section Paper.nu's Section Info panel is about, for a class that is
// not on the schedule: found in the term's catalog by its number and kind.
async function resolvePanelSection(
  params: CtecLinkParams,
  hint: { section?: string; component?: string }
): Promise<{ termId: string; termName: string; section: PaperSection }> {
  const activeTerm = readActiveTermNameFromDom(document);
  const schedule = await readPaperScheduleSnapshot();
  if (!activeTerm || !schedule) throw new Error("Couldn't tell which term Paper.nu is showing. Reload Paper.nu and try again.");
  const termName = (await getDataMapInfo(schedule.termId)).terms[schedule.termId]?.name;
  if (termName !== activeTerm) throw new Error("The saved schedule doesn't match this tab's term. Reload Paper.nu and try again.");
  const wantCatalog = formatCatalogForDisplay(params.catalogNumber);
  const wantKind = (hint.component ?? "").slice(0, 3).toUpperCase();
  const matches = (await getTermCourses(schedule.termId))
    .flatMap((course) => course.sections)
    .filter(
      (section) =>
        section.subject === params.subject &&
        formatCatalogForDisplay(section.number ?? section.catalog) === wantCatalog &&
        section.section === hint.section &&
        (!wantKind || section.component.toUpperCase() === wantKind)
    );
  const [section] = matches;
  if (matches.length !== 1 || !section) throw new Error(`Couldn't identify this section of ${params.subject} ${params.catalogNumber} in ${termName}.`);
  return { termId: schedule.termId, termName, section };
}

export type ChipClassDetails =
  | { ok: true; details: SeatsNotesSuccess; fetchedAt: number }
  | { ok: false; error: string };

// CAESAR's own page for the section a chip or panel stands for, in the term
// being planned: units, grading basis, seats, requirements, notes. Saved in
// the seats-notes cache, so a class looked at before answers without a
// request unless `force` asks for a fresh copy.
export async function loadChipClassDetails(
  authRecovery: AuthRecovery,
  source: { params: CtecLinkParams; titleHint: string; section?: string; component?: string },
  force = false
): Promise<ChipClassDetails> {
  const { params } = source;
  try {
    const { termId, termName, section } = await resolveScheduledChip(params, source.titleHint, true).catch((error: unknown) => {
      if (!source.section) throw error;
      return resolvePanelSection(params, source);
    });
    const bare = bareCatalogNumber(params.catalogNumber);
    // CAESAR's class page is one request that carries seats and every other
    // fact. Finding the class number first costs a catalog search, so that
    // is skipped when the number is already known for this section.
    const answer = await withAuthRecovery(authRecovery, isCaesarAuthRequiredError, async () => {
      await Promise.all([initSeatsNotesStorage(), initCartCache()]);
      let classNumber =
        knownClassNumber(termId, section.section_id) ??
        lookupBySignature(termId, section.subject, section.number ?? section.catalog, `${section.section}-${section.component}`)?.entry.classNumber;
      if (!classNumber) {
        const search = await searchCaesarCatalog({ termId, institution: INSTITUTION_DEFAULT, subject: params.subject, bareCatalog: bare });
        const group = matchCaesarGroup(search.groups, section.number ?? section.catalog);
        classNumber = (group ? matchCaesarSection(group, section.section, section.component) : null)?.classNumber;
        if (!classNumber) throw new Error(`CAESAR didn't return this section in ${termName}.`);
      }
      rememberClassNumber(termId, section.section_id, classNumber);
      const saved = readCachedEntry(classNumber);
      if (!force && saved?.result.ok && saved.result.facts) return saved;
      const result = toSeatsNotesResult(
        await lookupClass(
          { type: "lookup-class", classNumber, careerHint: Number.parseInt(bare, 10) >= 400 ? "TGS" : "UGRD", termId },
          { priority: "background", owner: "paper-ctec-class-info", label: `Class details for ${classNumber}` }
        )
      );
      const entry = { result, fetchedAt: Date.now() };
      if (result.ok) writeCachedEntry(classNumber, entry);
      return entry;
    });
    if (answer === null) return { ok: false, error: "CAESAR sign-in was canceled." };
    return answer.result.ok
      ? { ok: true, details: answer.result, fetchedAt: answer.fetchedAt }
      : { ok: false, error: answer.result.error };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
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
  titleHint: string,
  refreshOnMiss = false
): Promise<{ termId: string; termName: string; section: PaperSection }> {
  // The saved schedule is shared across tabs. Verify that it belongs to
  // the term displayed in this tab before looking up any section.
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
  if (sectionIds.length === 0) {
    throw new Error("Paper.nu hasn't saved any sections for this schedule yet. Wait a moment and try again.");
  }

  const scheduled = new Set(sectionIds);
  let matches = matchingScheduledSections(await getTermCourses(termId), scheduled, params, titleHint);
  // Paper.nu may have loaded a newer catalog than Pencil has cached.
  // Refresh only on a user click and continue to require a unique match.
  if (matches.length === 0 && refreshOnMiss) {
    matches = matchingScheduledSections(await refreshTermCourses(termId), scheduled, params, titleHint);
  }
  if (readActiveTermNameFromDom(document) !== activeTerm) {
    throw new Error("Paper.nu is switching terms. Wait for the schedule to load and try again.");
  }
  const [section] = matches;
  if (matches.length !== 1 || !section) {
    throw new Error(`Couldn't identify one section of ${params.subject} ${params.catalogNumber} on your ${termName} schedule. Use CAESAR Class Search to add it.`);
  }
  return { termId, termName, section };
}

function matchingScheduledSections(
  courses: PaperTermCourse[],
  scheduled: ReadonlySet<string>,
  params: CtecLinkParams,
  titleHint: string
): PaperSection[] {
  const wantCatalog = formatCatalogForDisplay(params.catalogNumber);
  const wantTitle = normalizeTitle(titleHint);
  const matches = new Map<string, PaperSection>();
  for (const course of courses) {
    for (const section of course.sections) {
      if (!scheduled.has(section.section_id) || section.subject !== params.subject) continue;
      if (formatCatalogForDisplay(section.number ?? section.catalog) !== wantCatalog) continue;
      const title = section.topic ? `${section.topic} - ${section.title}` : section.title;
      if (normalizeTitle(title) !== wantTitle) continue;
      matches.set(section.section_id, section);
    }
  }

  const candidates = [...matches.values()];
  if (candidates.length <= 1) return candidates;

  // Instructor text can differ between Paper.nu's card and the cached
  // catalog. Use it only to disambiguate multiple saved sections.
  const wantInstructor = sortedLower(params.instructor);
  const withMatchingInstructor = candidates.filter((section) => {
    const names = (section.instructors ?? []).map((i) => i.name ?? "").filter(Boolean);
    const withInitials = buildInstructorLastNameLabel(names);
    const lastNames = extractLastNameTokens(withInitials).join(",");
    return wantInstructor === sortedLower(withInitials) || wantInstructor === sortedLower(lastNames);
  });
  return withMatchingInstructor.length ? withMatchingInstructor : candidates;
}

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sortedLower(value: string): string {
  return value.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).sort().join(",");
}
