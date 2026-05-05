import { CART_CACHE_STORAGE_KEY } from "../../content/cart-cache/types";
import { CTEC_INDEX_STORAGE_KEY } from "../../content/ctec-index/storage";
import {
  NAME_FETCH_FAILED_AT_KEY,
  fetchAndCacheUserName
} from "../../content/access-gate/name-fetch";
import {
  ACCESS_GATE_NAME_KEY
} from "../../content/access-gate/storage";
import {
  PAPER_CTEC_MODAL_CACHE_KEY
} from "../../content/augmentations/paper-ctec/modal-cache";
import {
  SCHEDULE_CACHE_STORAGE_KEY,
  getRemoteSchedule
} from "../../content/access-gate/server-client";

const FEEDBACK_RESTORE_DELAY_MS = 1500;

// Wires a "click → run cleanup → flash success → restore label" pattern.
// Used for every cache-clear button in the popup. The button is disabled
// during the success-flash window so a frantic double-click can't queue a
// second cleanup before the first one's feedback has cleared.
export function makeClearCacheButton(options: {
  containerId: string;
  buttonText: string;
  successText?: string;
  cleanup(): Promise<void>;
}): void {
  const { containerId, buttonText, cleanup } = options;
  const successText = options.successText ?? "Cleared!";
  const btn = document.getElementById(containerId);
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.addEventListener("click", async () => {
    await cleanup();
    btn.textContent = successText;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = buttonText;
      btn.disabled = false;
    }, FEEDBACK_RESTORE_DELAY_MS);
  });
}

export function initCacheButtons(): void {
  makeClearCacheButton({
    containerId: "clear-ctec-cache",
    buttonText: "Clear CTEC cache",
    cleanup: async () => {
      await chrome.storage.local.remove([
        CTEC_INDEX_STORAGE_KEY,
        PAPER_CTEC_MODAL_CACHE_KEY
      ]);
    }
  });

  makeClearCacheButton({
    containerId: "clear-catalog-cache",
    buttonText: "Clear catalog cache",
    cleanup: async () => {
      // Wipes every paper.nu source-data key (plan/subjects/per-term files)
      // by prefix — keys are versioned so they can't be enumerated up front.
      const all = (await chrome.storage.local.get(null)) as Record<string, unknown>;
      const keys = Object.keys(all).filter((k) => k.startsWith("better-caesar:paper:"));
      if (keys.length > 0) await chrome.storage.local.remove(keys);
    }
  });

  makeClearCacheButton({
    containerId: "clear-cart-cache",
    buttonText: "Clear cart cache",
    cleanup: async () => {
      await chrome.storage.local.remove(CART_CACHE_STORAGE_KEY);
    }
  });
}

// The grad-year reconfirm and schedule-refresh buttons share the same
// "click → work → flash → restore" shape but want different success text
// and longer feedback windows. Kept as separate inits because their cleanup
// also writes back into UI state (success message reflects the fetched
// grad year), which the generic factory's fixed success-text contract
// doesn't fit.

export function initReconfirmGradYearButton(): void {
  const btn = document.getElementById("reconfirm-grad-year");
  if (!(btn instanceof HTMLButtonElement)) return;
  const restore = "Reconfirm grad year";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Checking...";
    await chrome.storage.local.remove([ACCESS_GATE_NAME_KEY, NAME_FETCH_FAILED_AT_KEY]);
    const stored = await fetchAndCacheUserName();
    if (stored) {
      const yr = stored.gradYear;
      btn.textContent = yr !== null ? `Detected ${yr}` : "Detected (no grad year)";
    } else {
      btn.textContent = "Failed — sign in to CAESAR";
    }
    setTimeout(() => {
      btn.textContent = restore;
      btn.disabled = false;
    }, 3000);
  });
}

export function initRefreshScheduleButton(): void {
  const btn = document.getElementById("refresh-schedule");
  if (!(btn instanceof HTMLButtonElement)) return;
  const restore = "Refresh bucket schedule";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Polling...";
    await chrome.storage.local.remove(SCHEDULE_CACHE_STORAGE_KEY);
    await getRemoteSchedule();
    btn.textContent = "Refreshed";
    setTimeout(() => {
      btn.textContent = restore;
      btn.disabled = false;
    }, 2000);
  });
}
