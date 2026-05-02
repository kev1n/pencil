import { FEATURES_STORAGE_KEY, isFeatureEnabled } from "../settings";
import type { Augmentation } from "./template";

// IMPORTANT: every augmentation's `run()` is invoked on initial load AND after
// every DOM mutation (debounced via requestAnimationFrame). PeopleSoft and
// paper.nu both navigate via in-place DOM swaps, which produces a steady
// stream of mutations.
//
// Each augmentation is therefore responsible for its OWN dedup/idempotence —
// any side effect that hits the network, writes storage, or mutates shared
// state must be guarded so it only happens when the page state actually
// requires it. Patterns used in this repo:
//   - DOM markers (e.g. dataset.ctecReady / dataset.ctecDone in ctec-links)
//   - In-flight Sets/Maps keyed by target identity (e.g. paper-ctec inFlight)
//   - Resolved caches that short-circuit on subsequent runs
//
// Adding network calls or expensive work directly inside `run()` without one
// of these guards will fan out badly under mutation pressure.
export class AugmentationRunner {
  private readonly augmentations: Augmentation[];

  constructor(augmentations: Augmentation[]) {
    this.augmentations = augmentations;
  }

  start(): void {
    this.runAll();
    this.observeMutations();
    this.observeSettings();
  }

  private runAll(): void {
    for (const augmentation of this.augmentations) {
      if (!isFeatureEnabled(augmentation.id)) continue;
      augmentation.run(document);
    }
  }

  private observeMutations(): void {
    const root = document.body ?? document.documentElement;
    if (!root) return;

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;

      requestAnimationFrame(() => {
        scheduled = false;
        this.runAll();
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });
  }

  private observeSettings(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes[FEATURES_STORAGE_KEY]) return;
      this.runAll();
    });
  }
}
