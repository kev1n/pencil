// enrollment-navigation augmentation — orchestrates the four sibling
// modules (state / term-picker / auto-continue / term-url) and owns the
// per-instance state that ties them together (debounce sentinels,
// term-picker fetch cache, PS lock).

import { type Augmentation } from "../../framework";
import {
  acquirePeopleSoftLock,
  releasePeopleSoftLock,
} from "../../peoplesoft";

import {
  type AutoContinueState,
  autoContinueTermPage,
  hideEarlyTermPageMask,
  hideTermSpinnerOverlay,
  resetAutoContinueState,
} from "./auto-continue";
import {
  clearSubmittedUrl,
  clearTargetTermSelection,
  parseContext,
  persistContext,
  setTargetTermSelection,
} from "./state";
import { injectStyles, STYLE_ID } from "./styles";
import {
  fetchTermPickerState,
  injectTermSwitcher,
  TERM_PAGE_ID,
  TERM_SWITCHER_ID,
  type TermPickerState,
} from "./term-picker";
import {
  extractUrlsFromInlineScripts,
  getPageId,
  isEnrollmentWorkflowPage,
} from "./term-url";

const NAV_LOCK_OWNER = "enrollment-navigation";

export class EnrollmentNavigationAugmentation implements Augmentation {
  readonly id = "enrollment-navigation";

  private readonly autoContinueState: AutoContinueState = {
    waitingForLoad: false,
    lastSubmittedSignature: null,
    submittedForUrl: null,
  };
  private termStateCache: {
    fetchedAt: number;
    promise: Promise<TermPickerState | null>;
  } | null = null;

  cleanup(doc: Document = document): void {
    this.autoContinueState.waitingForLoad = false;
    this.autoContinueState.lastSubmittedSignature = null;
    this.autoContinueState.submittedForUrl = null;
    clearSubmittedUrl();
    releasePeopleSoftLock(NAV_LOCK_OWNER);
    doc.getElementById(TERM_SWITCHER_ID)?.remove();
    hideTermSpinnerOverlay(doc);
    hideEarlyTermPageMask(doc);
    doc.getElementById(STYLE_ID)?.remove();
  }

  run(doc: Document = document): void {
    injectStyles(doc);
    this.persistContextFromKnownSources(doc);

    const pageId = getPageId(doc);
    if (isEnrollmentWorkflowPage(doc, pageId)) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      injectTermSwitcher(doc, {
        getTermPickerState: (d) => this.getTermPickerState(d),
        onSwitch: async (selected, state) => {
          setTargetTermSelection(selected.value);
          try {
            await this.startLockedNavigation(() => {
              window.location.assign(state.termSelectorUrl);
            });
          } catch (error) {
            clearTargetTermSelection();
            throw error;
          }
        },
      });
    }

    if (pageId !== TERM_PAGE_ID) {
      resetAutoContinueState(doc, this.autoContinueState);
      return;
    }

    autoContinueTermPage(doc, {
      state: this.autoContinueState,
      reRun: () => this.run(document),
    });
  }

  private persistContextFromKnownSources(doc: Document): void {
    const candidates = [window.location.href, ...extractUrlsFromInlineScripts(doc)];

    for (const candidate of candidates) {
      const context = parseContext(candidate);
      if (!context) continue;
      persistContext(context);
      return;
    }
  }

  private async getTermPickerState(doc: Document): Promise<TermPickerState | null> {
    const now = Date.now();
    if (this.termStateCache && now - this.termStateCache.fetchedAt < 30_000) {
      return this.termStateCache.promise;
    }

    const promise = fetchTermPickerState(doc);
    this.termStateCache = { fetchedAt: now, promise };
    return promise;
  }

  private async startLockedNavigation(navigate: () => void): Promise<void> {
    await acquirePeopleSoftLock(NAV_LOCK_OWNER, {
      waitForIdle: true,
      abortActive: true,
      ttlMs: 120_000,
    });

    try {
      navigate();
    } catch (error) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      throw error;
    }
  }
}
