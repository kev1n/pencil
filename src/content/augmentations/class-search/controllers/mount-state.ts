// Wires up every mount-scoped controller for the class-search augmentation
// and assembles the `MountedState` object. The painters / renderer / detail
// controller all hold references to the same shared `filters` object the
// augmentation mutates from the search-form input handlers, so a single
// mutation fans out without re-wiring deps.
//
// Extracted from augmentation.ts (Wave 5g). The augmentation supplies a
// small set of cross-cutting deps (the auth recovery, ps-credit consumer,
// add-to-cart context builder, live-data store factory) and gets back a
// fully-assembled state.

import type { AuthRecovery } from "../auth-recovery";
import { createCartButtonRegistry } from "../cart-button-registry";
import type { CtecCoordinator } from "../ctec/coordinator";
import { applyFilters, buildCatalogIndex } from "../filter";
import type {
  DataMapInfo,
  PaperCourse,
  PaperSection,
  PaperTermCourse,
  SubjectInfo
} from "../paper-data";
import { getTermCourses } from "../paper-data";
import {
  readCareerFromNativeForm,
  readInstitutionFromNativeForm,
  readTermFromNativeForm
} from "../page-detection";
import { type MountedState, type ResultRow } from "../types";
import { setStatus } from "../views/shell";

import { createCartCachePainter } from "./cart-cache-painter";
import { createCartCardDetailsController } from "./cart-card-details-controller";
import {
  createCatalogLiveDataStore,
  createLiveDataPainter,
  makeLiveCacheKey
} from "./live-data-painter";
import { createResultsRenderer } from "./results-renderer";
import { createSearchOrchestrator } from "./search-orchestrator";
import { createSectionDetailController } from "./section-detail-controller";
import { createTabController } from "./tab-controller";

const INSTITUTION_DEFAULT = "NWUNV";

export type MountStateDeps = {
  doc: Document;
  placeholder: HTMLDivElement;
  info: DataMapInfo;
  subjects: Record<string, SubjectInfo>;
  planCourses: PaperCourse[];
  /** SSO popup re-auth recovery, shared across mount cycles. */
  authRecovery: AuthRecovery;
  /** Pre-built CTEC coordinator, shared across mount cycles so resolved
   *  state persists when the user navigates away from and back to the
   *  search page (the section index module's in-memory cache survives
   *  too, but the coordinator's resolved map is what powers no-flicker
   *  re-renders). The augmentation owns the singleton; mount-state just
   *  wires it through to the results-renderer. */
  ctecCoordinator: CtecCoordinator;
  /** PS credit gate. Returns true on success, false (and toasts) when the
   *  budget is exhausted. */
  consumePsCredit(owner: string): boolean;
  /** Click → cart-add wizard. The renderer surfaces this from each
   *  section row's Add button click. */
  handleAdd(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): void;
};

export function createMountState(deps: MountStateDeps): MountedState {
  const { doc, placeholder, info, subjects, planCourses } = deps;

  const career = readCareerFromNativeForm(doc) ?? "UGRD";
  const institution = readInstitutionFromNativeForm(doc) ?? INSTITUTION_DEFAULT;
  const initialTerm = readTermFromNativeForm(doc) ?? info.latest;

  const filters = { termId: initialTerm, query: "" };
  const catalogIndex = buildCatalogIndex(planCourses);
  const liveData = createCatalogLiveDataStore({
    institution,
    authRecovery: deps.authRecovery
  });
  const tabs = createTabController({ doc });
  const cartButtons = createCartButtonRegistry();
  const resultsEl = doc.createElement("div");
  const statusEl = doc.createElement("div");

  const getTermId = (): string => filters.termId;
  const liveCacheKey = (row: ResultRow): string => makeLiveCacheKey(getTermId(), row);

  const cartCachePainter = createCartCachePainter({
    getTermId,
    liveData,
    liveCacheKey,
    cartButtons
  });

  const liveDataPainter = createLiveDataPainter({
    liveData,
    liveCacheKey,
    applyCartStateBySigKey: (button) => cartCachePainter.applyBySigKey(button)
  });
  const detailController = createSectionDetailController({
    doc,
    consumePsCredit: deps.consumePsCredit,
    ensureLiveData: (row, card) => liveDataPainter.ensureLiveData(row, card),
    peekLiveData: (row) => liveDataPainter.peekLiveData(row),
    getTermId
  });
  const cartCardDetailsController = createCartCardDetailsController({
    doc,
    consumePsCredit: deps.consumePsCredit,
    getTermId
  });

  // searchOrchestrator's onSearchReady → resultsRenderer.render. Since
  // the renderer needs the orchestrator (for `getActiveTermCourses`),
  // forward-ref the orchestrator the same way.
  const orchestratorRef: {
    o: ReturnType<typeof createSearchOrchestrator<PaperTermCourse[]>> | null;
  } = { o: null };
  // Forward-ref the state itself so handleAdd's button-click path can
  // re-enter the augmentation with the correct mount.
  const stateRef: { state: MountedState | null } = { state: null };
  const resultsRenderer = createResultsRenderer({
    doc,
    filters,
    resultsEl,
    statusEl,
    catalogIndex,
    getActiveTermCourses: () => orchestratorRef.o?.getTerm(getTermId()) ?? null,
    liveData,
    liveCacheKey,
    cartButtons,
    liveDataPainter,
    cartCachePainter,
    detailController,
    cartCardDetailsController,
    ctecCoordinator: deps.ctecCoordinator,
    handleAdd: (row, section, button) => {
      if (stateRef.state) deps.handleAdd(stateRef.state, row, section, button);
    }
  });

  const searchOrchestrator = createSearchOrchestrator<PaperTermCourse[]>({
    getActiveTerm: getTermId,
    fetchTermCourses: (termId) => getTermCourses(termId),
    formatTermName: (termId) => info.terms[termId]?.name ?? termId,
    onSearchReady: (termId, courses) => {
      if (filters.termId !== termId) return;
      const rows = applyFilters(courses, catalogIndex, subjects, filters, career);
      resultsRenderer.render(rows);
    },
    onStatus: (status, message) => setStatus(doc, statusEl, status, message)
  });
  orchestratorRef.o = searchOrchestrator;

  const state: MountedState = {
    doc,
    root: placeholder,
    panelEl: doc.createElement("div"),
    resultsEl,
    statusEl,
    filters,
    info,
    subjects,
    catalogIndex,
    career,
    institution,
    searchOrchestrator,
    liveData,
    tabs,
    cartButtons,
    liveDataPainter,
    cartCachePainter,
    detailController,
    ctecCoordinator: deps.ctecCoordinator,
    resultsRenderer,
    cartUnsubscribe: null
  };
  stateRef.state = state;
  return state;
}
