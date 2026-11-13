// Everything that needs the student's CAESAR session: open seats, section
// details, the shopping cart, enrollment and course history. Each call runs
// the extension's own request and parsing code.
import { parseCartPage } from "@ext/content/cart-cache/parse-cart-page";
import { CART_URL } from "@ext/content/cart-cache/reconcile";
import {
  CART_CACHE_STORAGE_KEY,
  initCartCache,
  recordOptimisticAdd,
  replaceTermFromCartPage,
  type CartCache
} from "@ext/content/cart-cache";
import {
  COURSE_HISTORY_STORAGE_KEY,
  initCourseHistoryCache,
  parseCourseHistoryAjax,
  writeCourseHistory,
  type CourseHistoryCache,
  type CourseHistoryEntry
} from "@ext/content/course-history";
import { COURSE_HISTORY_PAGE_URL } from "@ext/content/course-history/reconcile";
import {
  CaesarAuthRequiredError,
  matchCaesarGroup,
  matchCaesarSection,
  type CaesarCourseGroup,
  type CaesarSection,
  type CartFlowResult,
  type RelatedSectionOption
} from "@ext/content/augmentations/class-search/caesar-search";
import {
  addSectionToCart,
  continueCartAddWithRelated,
  searchCaesarCatalog
} from "@ext/content/augmentations/class-search/caesar-search/flow";
import { INSTITUTION_DEFAULT } from "@ext/content/augmentations/class-search/caesar-search/types";
import { bareCatalogNumber } from "@ext/content/augmentations/class-search/catalog-format";
import { toSeatsNotesResult } from "@ext/content/augmentations/seats-notes/parser";
import {
  buildPeopleSoftCreditToast,
  initStorage as initSeatsCache,
  readCachedEntry,
  tryConsumePeopleSoftCredit,
  writeCachedEntry
} from "@ext/content/augmentations/seats-notes/storage";
import type { SeatsNotesResult } from "@ext/content/augmentations/seats-notes/types";
import { isRetryablePeopleSoftTaskError, lookupClass } from "@ext/content/peoplesoft";
import { fetchTextViaBackground } from "@ext/content/remote-fetch";
import { signInRedirectCount } from "../platform/session-state";
import { withSignIn } from "../platform/sign-in";
import type { PaperSection } from "./catalog";
import { createStore, useStore } from "./store";

export type { CaesarSection, CartCache, CourseHistoryEntry, RelatedSectionOption, SeatsNotesResult };

// Some loaders treat a redirect to the sign-in page as "nothing found".
// This turns that back into a sign-in request.
export async function needsSession<T>(run: () => Promise<T>): Promise<T> {
  return withSignIn(async () => {
    const before = signInRedirectCount();
    const result = await run();
    if (signInRedirectCount() !== before) throw new CaesarAuthRequiredError();
    return result;
  });
}

// The same request budget the extension keeps, so the app is no heavier on
// CAESAR than a browser tab.
export function spendCredit(owner: string): void {
  const credit = tryConsumePeopleSoftCredit(Date.now(), owner);
  if (!credit.ok) throw new Error(buildPeopleSoftCreditToast(credit.waitMs));
}

// The extension lets a load someone tapped for push aside the ones running
// on their own. In the app those quiet loads go back in line instead of
// failing, so opening several classes in a row finishes all of them.
const BUMPED = /task canceled because/i;
export function wasBumped(error: unknown): boolean {
  return isRetryablePeopleSoftTaskError(error) || (error instanceof Error && BUMPED.test(error.message));
}
export async function backInLine<T>(run: () => Promise<T>, bumped: (result: T) => boolean = () => false): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const last = attempt >= 5;
    try {
      const result = await run();
      if (last || !bumped(result)) return result;
    } catch (error) {
      if (last || !wasBumped(error)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
  }
}

// ── live sections ──────────────────────────────────────────────────────────

export type LiveCourse =
  | { status: "loading" }
  | { status: "ready"; group: CaesarCourseGroup | null; loadedAt: number }
  | { status: "error"; error: unknown };

const live = createStore<Record<string, LiveCourse>>({});

function liveKey(termId: string, subject: string, catalog: string): string {
  return `${termId}|${subject}|${catalog}`;
}

export function useLiveCourse(termId: string, subject: string, catalog: string): LiveCourse | null {
  return useStore(live)[liveKey(termId, subject, catalog)] ?? null;
}

// Loads the live list if needed and returns CAESAR's row for one section.
export async function resolveLiveSection(
  termId: string,
  subject: string,
  catalog: string,
  section: PaperSection
): Promise<CaesarSection | null> {
  const key = liveKey(termId, subject, catalog);
  if (live.get()[key]?.status !== "ready") await loadLiveCourse(termId, subject, catalog);
  const loaded = live.get()[key];
  if (loaded?.status === "error") throw loaded.error;
  return liveSectionFor(loaded ?? null, section);
}

function setLive(key: string, value: LiveCourse): void {
  live.update((current) => ({ ...current, [key]: value }));
}

const liveLoads = new Map<string, Promise<void>>();

export function loadLiveCourse(termId: string, subject: string, catalog: string): Promise<void> {
  const key = liveKey(termId, subject, catalog);
  const running = liveLoads.get(key);
  if (running) return running;
  setLive(key, { status: "loading" });
  const job = (async () => {
    try {
      spendCredit("app-live");
      const search = async () =>
        matchCaesarGroup(
          (
            await needsSession(() =>
              searchCaesarCatalog({
                termId,
                institution: INSTITUTION_DEFAULT,
                subject,
                bareCatalog: bareCatalogNumber(catalog)
              })
            )
          ).groups,
          catalog
        );
      // CAESAR now and then answers a search with an empty list for a class
      // it does have, so an empty answer is asked once more before it counts.
      let group = await search();
      if (!group) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        group = await search();
      }
      setLive(key, { status: "ready", group, loadedAt: Date.now() });
    } catch (error) {
      setLive(key, { status: "error", error });
    } finally {
      liveLoads.delete(key);
    }
  })();
  liveLoads.set(key, job);
  return job;
}

function mergeLive(termId: string, subject: string, catalog: string, groups: CaesarCourseGroup[]): void {
  const incoming = matchCaesarGroup(groups, catalog);
  if (!incoming) return;
  const key = liveKey(termId, subject, catalog);
  const current = live.get()[key];
  if (current?.status !== "ready" || !current.group) {
    setLive(key, { status: "ready", group: incoming, loadedAt: Date.now() });
    return;
  }
  const sections = [...current.group.sections];
  for (const section of incoming.sections) {
    const at = sections.findIndex((s) => s.classNumber === section.classNumber);
    if (at >= 0) sections[at] = section;
    else sections.push(section);
  }
  setLive(key, { ...current, group: { ...current.group, sections } });
}

export function liveSectionFor(course: LiveCourse | null, section: PaperSection): CaesarSection | null {
  if (course?.status !== "ready" || !course.group) return null;
  return matchCaesarSection(course.group, section.section, section.component);
}

// ── section details ────────────────────────────────────────────────────────

export function cachedSectionDetails(classNumber: string): SeatsNotesResult | null {
  return readCachedEntry(classNumber)?.result ?? null;
}

// Saved seat counts and when they were checked, for a list of classes.
const seatChecks = createStore(0);
export type SavedSeats = { open: number | null; taken: number | null; capacity: number | null; waitlist: number; at: number };
export function useSavedSeats(): (classNumber: string) => SavedSeats | null {
  useStore(seatChecks);
  return (classNumber) => {
    const entry = readCachedEntry(classNumber);
    if (!entry?.result.ok) return null;
    const num = (text: string | null) => (text !== null && text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : null);
    const capacity = num(entry.result.classCapacity);
    const taken = num(entry.result.enrollmentTotal);
    const open = num(entry.result.availableSeats) ?? (capacity !== null && taken !== null ? capacity - taken : null);
    return { open, taken, capacity, waitlist: num(entry.result.waitListTotal) ?? 0, at: entry.fetchedAt };
  };
}

export async function loadSectionDetails(input: {
  termId: string;
  subject: string;
  catalog: string;
  classNumber: string;
  // A check nobody tapped for waits its turn and never cancels other loads.
  quiet?: boolean;
}): Promise<SeatsNotesResult> {
  spendCredit("app-detail");
  const bare = bareCatalogNumber(input.catalog);
  const lookup = () => needsSession(() =>
    lookupClass(
      {
        type: "lookup-class",
        classNumber: input.classNumber,
        careerHint: Number.parseInt(bare, 10) >= 400 ? "TGS" : "UGRD",
        subjectHint: input.subject,
        catalogHint: bare,
        termId: input.termId
      },
      { priority: input.quiet ? "background" : "user", owner: "app-detail", label: `Section details for class ${input.classNumber}` }
    )
  );
  const response = await (input.quiet ? backInLine(lookup) : lookup());
  const result = toSeatsNotesResult(response);
  if (result.ok) {
    writeCachedEntry(input.classNumber, { result, fetchedAt: Date.now() });
    seatChecks.update((n) => n + 1);
  }
  return result;
}

// ── shopping cart ──────────────────────────────────────────────────────────

const cart = createStore<CartCache | null>(null);

export function useCart(): CartCache | null {
  return useStore(cart);
}

async function readCart(): Promise<void> {
  const saved = (await chrome.storage.local.get(CART_CACHE_STORAGE_KEY))[CART_CACHE_STORAGE_KEY];
  cart.set((saved as CartCache | undefined) ?? null);
}

export async function refreshCart(): Promise<void> {
  const html = await needsSession(() => fetchTextViaBackground(CART_URL));
  const parsed = parseCartPage(new DOMParser().parseFromString(html, "text/html"), html);
  if (!parsed) throw new Error("CAESAR didn’t send the shopping cart page. Try again.");
  replaceTermFromCartPage(parsed.termId, parsed.cart, parsed.enrolled);
}

export type AddToCartOutcome =
  | { kind: "added"; classNumber: string }
  | { kind: "already" }
  | { kind: "pick"; options: RelatedSectionOption[]; resume: (rowIndex: number) => Promise<AddToCartOutcome> }
  | { kind: "failed"; error: string };

export async function addToCart(input: {
  termId: string;
  subject: string;
  catalog: string;
  section: PaperSection;
  classNumber: string;
}): Promise<AddToCartOutcome> {
  spendCredit("app-add");
  const finish = (result: CartFlowResult): AddToCartOutcome => {
    if ("searchGroups" in result && result.searchGroups) {
      mergeLive(input.termId, input.subject, input.catalog, result.searchGroups);
    }
    if (result.ok) {
      recordOptimisticAdd(input.termId, {
        classNumber: result.classNumber,
        subject: input.subject,
        catalog: input.catalog,
        sectionLabel: `${input.section.section}-${input.section.component}`,
        capturedAt: Date.now()
      });
      return { kind: "added", classNumber: result.classNumber };
    }
    if ("needsRelatedSection" in result) {
      return {
        kind: "pick",
        options: result.relatedOptions,
        resume: async (rowIndex) =>
          finish(
            await needsSession(() =>
              continueCartAddWithRelated({
                continuationFormState: result.continuationFormState,
                selectedRowIndex: rowIndex,
                classNumber: result.classNumber,
                sectionLabel: result.sectionLabel,
                courseTitle: result.courseTitle,
                searchGroups: result.searchGroups
              })
            )
          )
      };
    }
    if (result.alreadyInCart) return { kind: "already" };
    return { kind: "failed", error: result.error };
  };
  return finish(
    await needsSession(() =>
      addSectionToCart({
        classNumber: input.classNumber,
        termId: input.termId,
        institution: INSTITUTION_DEFAULT,
        subject: input.subject,
        bareCatalog: bareCatalogNumber(input.catalog)
      })
    )
  );
}

// ── course history ─────────────────────────────────────────────────────────

const history = createStore<CourseHistoryCache | null>(null);

export function useCourseHistory(): CourseHistoryCache | null {
  return useStore(history);
}

async function readHistory(): Promise<void> {
  const saved = (await chrome.storage.local.get(COURSE_HISTORY_STORAGE_KEY))[COURSE_HISTORY_STORAGE_KEY];
  history.set((saved as CourseHistoryCache | undefined) ?? null);
}

const COURSE_HISTORY_URL =
  COURSE_HISTORY_PAGE_URL + "&ICAJAX=1&ICMDTarget=start&ICPanelControlStyle=%20pst_side1-fixed%20pst_panel-mode%20";

export async function refreshCourseHistory(): Promise<void> {
  const xml = await needsSession(() => fetchTextViaBackground(COURSE_HISTORY_URL));
  const entries = parseCourseHistoryAjax(xml);
  if (!entries) throw new Error("CAESAR didn’t send your course history. Try again.");
  writeCourseHistory(entries);
}

// ── start-up ───────────────────────────────────────────────────────────────

export async function initCaesarData(): Promise<void> {
  chrome.storage.onChanged.addListener((changes) => {
    if (CART_CACHE_STORAGE_KEY in changes) void readCart();
    if (COURSE_HISTORY_STORAGE_KEY in changes) void readHistory();
  });
  await Promise.all([initCartCache(), initCourseHistoryCache(), initSeatsCache()]);
  await Promise.all([readCart(), readHistory()]);
}
