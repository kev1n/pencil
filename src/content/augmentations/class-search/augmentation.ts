import {
  initCartCache,
  recordOptimisticAdd,
  subscribe as subscribeCartCache
} from "../../cart-cache";
import type { Augmentation } from "../../framework";
import { ModalController } from "../paper-ctec/modal-controller";
import { STYLE_ID as PAPER_CTEC_STYLE_ID } from "../paper-ctec/constants";
import { ANALYTICS_MODAL_ID as PAPER_CTEC_MODAL_ID } from "../paper-ctec/constants";
import { injectStyles as injectPaperCtecStyles } from "../paper-ctec/ui";
import type {
  PaperCtecAnalyticsState,
  PaperCtecWidgetData
} from "../paper-ctec/types";
import {
  initStorage as initSeatsNotesStorage,
  formatPsCreditsWarning,
  pruneEmptySeatsCache,
  buildPeopleSoftCreditToast,
  tryConsumePeopleSoftCredit
} from "../seats-notes/storage";
import { showToast } from "../../../shared/toast";

import {
  addSectionToCart,
  continueCartAddWithRelated,
  type RelatedSectionOption
} from "./caesar-search";
import { createAuthRecovery, type AuthRecovery } from "./auth-recovery";
import { fetchAnalyticsWithAuth } from "../../auth/ctec-fetch";
import { createAddCartContext } from "./controllers/add-cart-context";
import {
  createAddToCartController,
  type AddToCartContext,
  type AddToCartController
} from "./controllers/add-to-cart";
import { createMountState } from "./controllers/mount-state";
import {
  createRelatedPickerController,
  type RelatedPickerController
} from "./controllers/related-picker";
import { initCatalogCache } from "./catalog-cache";
import {
  createCtecCoordinator,
  type CtecCoordinator
} from "./ctec/coordinator";
import {
  getDataMapInfo,
  getPlanCourses,
  getSubjects,
  pruneStalePaperCaches,
  type DataMapInfo,
  type PaperCourse,
  type PaperSection,
  type SubjectInfo
} from "./paper-data";
import { isSearchEntryPage } from "./page-detection";
import { STYLE_ID as CLASS_SEARCH_STYLE_ID, ensureStyles } from "./styles";
import { type MountedState, type ResultRow, type TabId } from "./types";
import {
  buildLoadingShell,
  ensureRoot,
  hasAnyFilter,
  renderFatalError,
  ROOT_ID
} from "./views/shell";
import {
  renderSearchShell,
  renderTabBar,
  syncTabButtonActive,
  TABS_ID
} from "./views/search-form";

const CART_URL =
  "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A";

export class ClassSearchAugmentation implements Augmentation {
  readonly id = "class-search";

  private mounted: MountedState | null = null;
  private mountInProgress = false;
  // Mutex + handshake for the SSO popup re-auth flow. Lives at the
  // augmentation level (not per-mount) so a Load CAESAR + Add-to-cart
  // racing through `getEntryFormState()` from different DOM mount cycles
  // still coalesce onto a single popup.
  private authRecovery: AuthRecovery = createAuthRecovery({
    chromeRuntime: chrome.runtime,
    windowLocation: { assign: (url: string | URL) => window.location.assign(url) }
  });

  // Picker UI controller. Owns its own DOM (the inline <li> appended below
  // the section row). The cart-add controller resolves Promise<option | null>
  // through it so the cart-add wizard can run as one linear async flow.
  private relatedPicker: RelatedPickerController = createRelatedPickerController({
    doc: document
  });

  // Cart-add click handler. Talks to caesar-search/flow.ts under the hood,
  // drives the button state machine, and recurses through the picker on
  // needs-related results.
  private addToCartCtrl: AddToCartController = createAddToCartController({
    authRecovery: this.authRecovery,
    consumeCredit: (owner) => this.consumePsCredit(owner),
    formatPsWarning: () => formatPsCreditsWarning(),
    showToast,
    recordOptimisticAdd,
    addSectionToCart,
    continueCartAddWithRelated,
    openRelatedPicker: (button, options, ctx) =>
      this.openRelatedPickerForAdd(button, options, ctx),
    closeRelatedPicker: () => this.relatedPicker.close(),
    cartUrl: CART_URL
  });

  // Per-key CTEC fetch + repaint coordinator. Shared across mount cycles
  // so the resolved map survives navigations away from / back to the
  // search page within a single content-script load. The Analytics-button
  // click on the chip routes through `modal.openModal`. Auth recovery is
  // delegated to the shared `authRecovery` so a stale CAESAR/Bluera
  // session gets the silent → popup-and-retry cascade automatically.
  private readonly ctecCoordinator: CtecCoordinator = createCtecCoordinator({
    openAnalyticsModal: (source) => this.modal.openModal(source),
    authRecovery: this.authRecovery
  });

  // CTEC-analytics modal — same component paper-ctec uses, instantiated
  // here so class-search section-row chips can open it with no new
  // rendering surface. Maps are SEPARATE from paper-ctec's: shared
  // resolved/inFlight maps would short-circuit cross-augmentation
  // fetches. The underlying subject-index cache (read by
  // getCtecCourseAnalyticsSnapshot inside the modal) IS shared, so
  // fetches in either surface warm both.
  private readonly modalState = {
    resolved: new Map<string, PaperCtecWidgetData>(),
    inFlight: new Map<string, Promise<PaperCtecWidgetData | null>>(),
    analyticsResolved: new Map<string, PaperCtecAnalyticsState>(),
    analyticsInFlight: new Map<string, Promise<PaperCtecAnalyticsState>>(),
    loadingMessages: new Map<string, { message: string; updatedAt: number }>()
  };

  private readonly modal: ModalController = new ModalController(
    this.modalState,
    {
      setProgress: (key, message) => {
        this.modalState.loadingMessages.set(key, {
          message,
          updatedAt: Date.now()
        });
      },
      syncStatusBar: () => undefined,
      syncSideCard: () => undefined,
      // Background-refresh path: when a modal-driven refresh discovers
      // newly-published CTECs, the modal pushes the fresh widget data
      // back through here so the section-row chip updates too.
      renderForKey: (key, data) => this.ctecCoordinator.renderForKey(key, data),
      fetchAnalytics: (
        params,
        titleHint,
        recentAggregateLimit,
        onProgress,
        fetchLimit,
        forceRefreshLinks
      ) =>
        fetchAnalyticsWithAuth(
          this.authRecovery,
          params,
          titleHint,
          recentAggregateLimit,
          onProgress,
          fetchLimit,
          forceRefreshLinks
        )
    }
  );

  constructor() {
    void initSeatsNotesStorage().then(() => pruneEmptySeatsCache());
    void pruneStalePaperCaches();
    void initCartCache();
    void initCatalogCache();
  }

  cleanup(doc: Document = document): void {
    this.unmount(doc);
    this.authRecovery.dispose();
    this.modal.closeModal();
    this.modal.invalidate();
    this.ctecCoordinator.stop();
    this.modalState.resolved.clear();
    this.modalState.inFlight.clear();
    this.modalState.analyticsResolved.clear();
    this.modalState.analyticsInFlight.clear();
    this.modalState.loadingMessages.clear();
    // The paper-ctec stylesheet is injected by `mount()` for the chip
    // visuals; tear it down here too so cleanup leaves the page
    // indistinguishable from the never-augmented state. The page-id
    // constants come from the paper-ctec module so we don't fork them.
    doc.getElementById(PAPER_CTEC_STYLE_ID)?.remove();
    doc.getElementById(PAPER_CTEC_MODAL_ID)?.remove();
  }

  run(doc: Document = document): void {
    if (!isSearchEntryPage(doc)) {
      this.unmount(doc);
      return;
    }

    if (this.mounted && this.mounted.doc === doc && doc.getElementById(ROOT_ID) && doc.getElementById(TABS_ID)) {
      // Re-apply visibility in case PeopleSoft swapped DOM under us.
      this.mounted.tabs.applyVisibility(this.mounted.panelEl);
      return;
    }

    if (this.mountInProgress) return;
    void this.mount(doc);
  }

  private async mount(doc: Document): Promise<void> {
    this.mountInProgress = true;
    try {
      ensureStyles(doc);
      // Pulls in the chip / modal / button / chart styles that the
      // section-row CTEC widget and ModalController both depend on. Safe
      // to call on CAESAR — the schedule-grid-scoped rules don't match
      // anything here, and the function is idempotent on STYLE_ID.
      injectPaperCtecStyles();

      const placeholder = ensureRoot(doc);
      placeholder.innerHTML = "";
      placeholder.appendChild(buildLoadingShell(doc));

      let info: DataMapInfo;
      let subjects: Record<string, SubjectInfo>;
      let planCourses: PaperCourse[];
      try {
        [info, subjects, planCourses] = await Promise.all([
          getDataMapInfo(),
          getSubjects(),
          getPlanCourses()
        ]);
      } catch (error) {
        if (doc.getElementById(ROOT_ID)) {
          renderFatalError(
            placeholder,
            doc,
            error instanceof Error ? error.message : String(error)
          );
        }
        return;
      }

      if (!doc.getElementById(ROOT_ID) || !isSearchEntryPage(doc)) {
        return;
      }

      const state = createMountState({
        doc,
        placeholder,
        info,
        subjects,
        planCourses,
        authRecovery: this.authRecovery,
        ctecCoordinator: this.ctecCoordinator,
        consumePsCredit: (owner) => this.consumePsCredit(owner),
        handleAdd: (s, row, section, button) => void this.handleAdd(s, row, section, button)
      });
      this.mounted = state;

      // Cart cache pushes here when CAESAR cart-page reconcile lands or
      // another tab made an optimistic add. Repaint Add-button badges and
      // re-render the empty-state "Your classes" cards if showing.
      state.cartUnsubscribe = subscribeCartCache(() => {
        state.cartCachePainter.repaintAll();
        if (!hasAnyFilter(state.filters)) {
          state.resultsRenderer.renderMyClasses();
        }
      });

      placeholder.innerHTML = "";
      placeholder.appendChild(this.buildTabBar(state));
      state.panelEl.id = "better-caesar-class-search-panel";
      state.panelEl.appendChild(
        renderSearchShell(doc, {
          termId: state.filters.termId,
          info: state.info,
          statusEl: state.statusEl,
          filtersEl: state.filtersEl,
          resultsEl: state.resultsEl,
          onQueryInput: (value) => {
            state.filters.query = value;
            state.searchOrchestrator.scheduleSearch();
          },
          onTermChange: (termId) => {
            state.filters.termId = termId;
            void state.searchOrchestrator.loadTermData(termId);
          }
        })
      );
      placeholder.appendChild(state.panelEl);

      state.tabs.applyVisibility(state.panelEl);

      void state.searchOrchestrator.loadTermData(state.filters.termId);
    } finally {
      this.mountInProgress = false;
    }
  }

  // Shared CAESAR PS rate gate. Each user-initiated PS chain (Load CAESAR,
  // Details, Add to cart, related-section pick, detail Refresh) consumes
  // one credit from the seats-notes pool so a single-cap budget covers
  // every CAESAR PS surface in the extension. `owner` is just for the
  // background worker's credit-usage log.
  private consumePsCredit(owner: string): boolean {
    const credit = tryConsumePeopleSoftCredit(Date.now(), `class-search-${owner}`);
    if (!credit.ok) {
      showToast(buildPeopleSoftCreditToast(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return false;
    }
    return true;
  }

  private unmount(doc: Document): void {
    this.mounted?.searchOrchestrator.cancelPending();
    this.mounted?.cartUnsubscribe?.();
    this.mounted?.cartButtons.clear();
    this.mounted?.liveData.clear();
    this.mounted?.tabs.cleanup(doc);
    const root = doc.getElementById(ROOT_ID);
    if (root) root.remove();
    doc.getElementById(CLASS_SEARCH_STYLE_ID)?.remove();
    this.mounted = null;
  }

  // ── Tab bar ───────────────────────────────────────────────────────────────

  private buildTabBar(state: MountedState): HTMLElement {
    return renderTabBar(state.doc, {
      getActiveTab: () => state.tabs.getActive(),
      onSelect: (id) => this.switchTab(state, id)
    });
  }

  // Single source of truth for tab switching: flips controller state, syncs
  // the button data-active attributes, then re-applies panel visibility.
  // Used by both the tab button click handlers and the cart-add controller's
  // `openClassicTab` callback.
  private switchTab(state: MountedState, id: TabId): void {
    state.tabs.setActive(id);
    syncTabButtonActive(state.doc, id);
    state.tabs.applyVisibility(state.panelEl);
  }

  // ── Add to cart ──────────────────────────────────────────────────────────
  //
  // Wizard UI orchestration (button state machine, optimistic cart-cache
  // writes, toasts, picker recursion) lives in `controllers/add-to-cart.ts` +
  // `controllers/related-picker.ts`. The augmentation only supplies the
  // mount-scoped context (term, institution, live-data lookup, repaint).

  private async handleAdd(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): Promise<void> {
    const ctx = createAddCartContext(
      {
        termId: state.filters.termId,
        institution: state.institution,
        liveData: state.liveData,
        liveDataPainter: state.liveDataPainter,
        switchTab: (id) => this.switchTab(state, id)
      },
      row,
      section,
      button
    );
    await this.addToCartCtrl.onClick(button, ctx);
  }

  // ── Related-component picker (lab/discussion required) ──────────────────
  //
  // Bridge between the cart-add controller and the picker controller. The
  // controller deps need a Promise-returning function, while the picker owns
  // its own DOM lifecycle — this thin wrapper resolves the section <li>
  // anchor from the button and delegates.

  private openRelatedPickerForAdd(
    button: HTMLButtonElement,
    options: RelatedSectionOption[],
    ctx: AddToCartContext
  ): Promise<RelatedSectionOption | null> {
    const sectionLi = button.closest<HTMLLIElement>("li.bc-cs-section");
    if (!sectionLi) return Promise.resolve(null);
    return this.relatedPicker.open(options, {
      row: ctx.row,
      section: ctx.section,
      sectionLi
    });
  }
}

