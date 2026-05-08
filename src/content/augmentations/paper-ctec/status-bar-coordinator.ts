// Coordinator for the bottom-of-screen "Loading CTECs · X/N classes checked"
// status bar on paper.nu. Owns the syncStatusBar re-entrancy guard.
//
// Extracted from PaperCtecAugmentation (Wave 6d). The bulk of the work
// (deriving the data shape) lives in session.buildStatusBarData; this
// coordinator just wires the inputs and routes outputs.

import type {
  PaperCtecAnalyticsState,
  PaperCtecStatusBarData,
  PaperCtecWidgetData
} from "./types";

type ProgressMessage = { message: string; updatedAt: number };

export type StatusBarCoordinatorDeps = {
  /** Visible chip keys (snapshot taken on each run() pass). */
  getVisibleKeys(): Set<string>;
  /** Front-page resolved state map. */
  getResolved(): Map<string, PaperCtecWidgetData>;
  /** Modal analytics resolved state map. */
  getAnalyticsResolved(): Map<string, PaperCtecAnalyticsState>;
  /** Front-page in-flight map. */
  getInFlight(): Map<string, unknown>;
  /** Modal analytics in-flight map. */
  getAnalyticsInFlight(): Map<string, unknown>;
  /** Per-chip latest progress message map. */
  getLoadingMessages(): Map<string, ProgressMessage>;
  /**
   * Pure derivation function — passed in so tests can stub the data shape.
   * Defaults to session.buildStatusBarData in the augmentation wiring.
   */
  buildStatusBarData(args: {
    visibleKeys: Set<string>;
    resolved: Map<string, PaperCtecWidgetData>;
    analyticsResolved: Map<string, PaperCtecAnalyticsState>;
    inFlight: Map<string, unknown>;
    analyticsInFlight: Map<string, unknown>;
    loadingMessages: Map<string, ProgressMessage>;
  }): PaperCtecStatusBarData | null;
  /** Side-effect: paint the status bar. */
  renderStatusBar(doc: Document, data: PaperCtecStatusBarData): void;
};

export interface StatusBarCoordinator {
  syncStatusBar(doc: Document): void;
  start(doc: Document): void;
  stop(doc: Document): void;
}

export function createStatusBarCoordinator(
  deps: StatusBarCoordinatorDeps
): StatusBarCoordinator {
  // Re-entrancy guard: status-bar / modal renders mutate document.body,
  // which can trip listeners (paper.nu's React tree, our own focus retry,
  // third-party extensions) into firing synchronous callbacks back into the
  // augmentation. Without this guard those rare loops blow the stack.
  let syncing = false;

  function syncStatusBar(doc: Document): void {
    if (syncing) return;
    syncing = true;
    try {
      const status = deps.buildStatusBarData({
        visibleKeys: deps.getVisibleKeys(),
        resolved: deps.getResolved(),
        analyticsResolved: deps.getAnalyticsResolved(),
        inFlight: deps.getInFlight(),
        analyticsInFlight: deps.getAnalyticsInFlight(),
        loadingMessages: deps.getLoadingMessages()
      });
      if (status) deps.renderStatusBar(doc, status);
    } finally {
      syncing = false;
    }
  }

  return {
    syncStatusBar,
    start(doc: Document): void {
      syncStatusBar(doc);
    },
    stop(_doc: Document): void {
      // No-op: status-bar DOM teardown lives in the augmentation cleanup
      // alongside the rest of the per-chip / panel teardown. Future shape:
      // hideStatusBar(doc) here.
    }
  };
}
