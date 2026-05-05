import {
  initCartCache,
  recordOptimisticAdd,
  subscribe as subscribeCartCache
} from "../../cart-cache";
import type { Augmentation } from "../../framework";
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

  constructor() {
    void initSeatsNotesStorage().then(() => pruneEmptySeatsCache());
    void pruneStalePaperCaches();
    void initCartCache();
    void initCatalogCache();
  }

  cleanup(doc: Document = document): void {
    this.unmount(doc);
    this.authRecovery.dispose();
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
    const ctx = createAddCartContext(state, row, section, button, (id) =>
      this.switchTab(state, id)
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

