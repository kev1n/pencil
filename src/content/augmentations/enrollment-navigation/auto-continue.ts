// Auto-Continue choreography for the SSR_SSENRL_TERM page.
//
// PS forces the user to pick a term + click Continue before any enrollment
// page renders. We auto-pick the most useful default (or the user's chosen
// term, threaded through sessionStorage from the in-page switcher) and click
// Continue, masking the page with a spinner overlay so the brief flash
// doesn't look broken.

import { releasePeopleSoftLock } from "../../peoplesoft";

import {
  clearSubmittedUrl,
  clearTargetTermSelection,
  getTargetTermSelection,
  readSubmittedUrl,
  writeSubmittedUrl,
} from "./state";
import {
  CONTINUE_BUTTON_SELECTOR,
  pickDefaultRadio,
  TERM_PAGE_ID,
  TERM_RADIO_SELECTOR,
} from "./term-picker";
import { getPageId } from "./term-url";

const SPINNER_OVERLAY_ID = "better-caesar-term-auto-continue-overlay";
const EARLY_MASK_ID = "better-caesar-early-term-mask";

const NAV_LOCK_OWNER = "enrollment-navigation";

export type AutoContinueState = {
  waitingForLoad: boolean;
  lastSubmittedSignature: string | null;
  // In-memory mirror of the persisted SUBMITTED_URL_KEY. Used as a fallback
  // when sessionStorage access throws (rare: sandboxed iframe, exhausted
  // quota, locked-down browser profile). The persisted value is the source
  // of truth across page reloads; the field only helps within a single
  // content-script lifetime if storage is unusable.
  submittedForUrl: string | null;
};

export function buildPageSignature(doc: Document, targetValue: string): string {
  const icStateNum =
    doc.querySelector<HTMLInputElement>("#ICStateNum")?.value ?? "";
  return `${window.location.href}|${icStateNum}|${targetValue}`;
}

export function showTermSpinnerOverlay(doc: Document): void {
  if (doc.getElementById(SPINNER_OVERLAY_ID)) return;

  const overlay = doc.createElement("div");
  overlay.id = SPINNER_OVERLAY_ID;
  overlay.className = "better-caesar-term-overlay";

  const spinner = doc.createElement("div");
  spinner.className = "better-caesar-term-spinner";

  const text = doc.createElement("div");
  text.className = "better-caesar-term-overlay-text";
  text.textContent = "Switching term...";

  overlay.appendChild(spinner);
  overlay.appendChild(text);

  const host = doc.body ?? doc.documentElement;
  if (!host) return;
  host.appendChild(overlay);
}

export function hideTermSpinnerOverlay(doc: Document): void {
  doc.getElementById(SPINNER_OVERLAY_ID)?.remove();
}

export function hideEarlyTermPageMask(doc: Document): void {
  doc.getElementById(EARLY_MASK_ID)?.remove();
}

export type AutoContinueDeps = {
  state: AutoContinueState;
  reRun: () => void;
};

// Mutates `deps.state` in place to track per-run sentinels. The caller
// keeps ownership of the state object (the augmentation instance) so this
// stays consistent across run() invocations from the framework runner.
export function autoContinueTermPage(
  doc: Document,
  { state, reRun }: AutoContinueDeps,
): void {
  showTermSpinnerOverlay(doc);

  if (doc.readyState !== "complete") {
    if (state.waitingForLoad) return;
    state.waitingForLoad = true;
    window.addEventListener(
      "load",
      () => {
        state.waitingForLoad = false;
        reRun();
      },
      { once: true },
    );
    return;
  }

  const currentUrl = window.location.href;
  const persistedSubmittedUrl = readSubmittedUrl();
  if ((persistedSubmittedUrl ?? state.submittedForUrl) === currentUrl) {
    // Already clicked Continue once for this landing. PS will either
    // navigate (next run sees pageId !== TERM_PAGE_ID and clears the
    // sentinel) or stall — in which case we'd rather leave the user on
    // the page than spam clicks at CAESAR.
    return;
  }

  const targetValue = getTargetTermSelection() ?? "";
  const signature = buildPageSignature(doc, targetValue);
  if (state.lastSubmittedSignature === signature) {
    return;
  }

  const radios = Array.from(
    doc.querySelectorAll<HTMLInputElement>(TERM_RADIO_SELECTOR),
  ).filter((radio) => !radio.disabled);
  const continueButton = doc.querySelector<HTMLInputElement>(
    CONTINUE_BUTTON_SELECTOR,
  );
  if (radios.length === 0 || !continueButton || continueButton.disabled) {
    clearTargetTermSelection();
    releasePeopleSoftLock(NAV_LOCK_OWNER);
    hideTermSpinnerOverlay(doc);
    hideEarlyTermPageMask(doc);
    return;
  }

  const selectedRadio =
    (targetValue ? radios.find((radio) => radio.value === targetValue) : null) ??
    pickDefaultRadio(doc, radios);

  if (!selectedRadio) {
    clearTargetTermSelection();
    releasePeopleSoftLock(NAV_LOCK_OWNER);
    hideTermSpinnerOverlay(doc);
    hideEarlyTermPageMask(doc);
    return;
  }

  state.lastSubmittedSignature = signature;
  state.submittedForUrl = currentUrl;
  writeSubmittedUrl(currentUrl);
  clearTargetTermSelection();

  if (!selectedRadio.checked) {
    selectedRadio.checked = true;
    selectedRadio.setAttribute("checked", "checked");
  }

  window.setTimeout(() => {
    continueButton.click();
  }, 80);

  window.setTimeout(() => {
    if (getPageId(document) === TERM_PAGE_ID) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      hideTermSpinnerOverlay(document);
      hideEarlyTermPageMask(document);
    }
  }, 10_000);
}

// Reset the per-page sentinels and any persisted Continue marker. Called
// when the augmentation lands on a non-TERM page (PS navigated us off the
// term selector) or when the user disables the feature.
export function resetAutoContinueState(
  doc: Document,
  state: AutoContinueState,
): void {
  state.waitingForLoad = false;
  state.lastSubmittedSignature = null;
  state.submittedForUrl = null;
  clearSubmittedUrl();
  hideTermSpinnerOverlay(doc);
  hideEarlyTermPageMask(doc);
}
