import { bindActionButton } from "../../content/framework";
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
// Adopts the static HTML <button> via bindActionButton so the action-button
// contract (sync disabled lock, click-once, state machine) covers it.
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
  bindActionButton(btn, {
    label: buttonText,
    loadingLabel: "Clearing…",
    successLabel: successText,
    successFlashMs: FEEDBACK_RESTORE_DELAY_MS,
    onClick: async () => {
      await cleanup();
      return { kind: "success", label: successText };
    }
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

export function initReconfirmGradYearButton(): void {
  const btn = document.getElementById("reconfirm-grad-year");
  if (!(btn instanceof HTMLButtonElement)) return;
  bindActionButton(btn, {
    label: "Reconfirm grad year",
    loadingLabel: "Checking…",
    successFlashMs: 3000,
    onClick: async () => {
      await chrome.storage.local.remove([ACCESS_GATE_NAME_KEY, NAME_FETCH_FAILED_AT_KEY]);
      const stored = await fetchAndCacheUserName();
      if (stored) {
        const yr = stored.gradYear;
        return {
          kind: "success",
          label: yr !== null ? `Detected ${yr}` : "Detected (no grad year)"
        };
      }
      return { kind: "error", label: "Failed — sign in to CAESAR", retryable: true };
    }
  });
}

export function initRefreshScheduleButton(): void {
  const btn = document.getElementById("refresh-schedule");
  if (!(btn instanceof HTMLButtonElement)) return;
  bindActionButton(btn, {
    label: "Refresh bucket schedule",
    loadingLabel: "Polling…",
    successFlashMs: 2000,
    onClick: async () => {
      await chrome.storage.local.remove(SCHEDULE_CACHE_STORAGE_KEY);
      await getRemoteSchedule();
      return { kind: "success", label: "Refreshed" };
    }
  });
}
