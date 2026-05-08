// Coordinator for the paper.nu side panel CTEC tabs (Paper / Analytics).
// Owns:
//   - the per-key selectedTabs map (preserves the user's last tab choice
//     when paper.nu remounts the panel between mutations)
//   - the syncSideCard pump that reads the active panel + bridges to the
//     modal controller for state mirroring + auto-resume
//
// Extracted from PaperCtecAugmentation (Wave 6d). All side effects run
// through the deps bag so the coordinator stays unit-testable.

import type { ModalController } from "./modal-controller";
import type {
  PaperCtecSideCardContext,
  PaperCtecWidgetData
} from "./types";
import type { CtecLinkParams } from "../ctec-links/types";

export type SideCardTab = "paper" | "analytics";

export type SideCardCoordinatorDeps = {
  /** Read the current side-panel context (or null if no panel is open). */
  extractSideCardContext(doc: Document): PaperCtecSideCardContext | null;
  /** ModalController handle — passed lazily so the augmentation can wire
   *  it after the coordinator is constructed. */
  modalController(): ModalController;
  /** True if the user has explicitly clicked Load CTEC on this chip. */
  hasUserActivated(key: string): boolean;
  /** Front-page resolved state map (read-only). */
  getResolved(): Map<string, PaperCtecWidgetData>;
  /** Front-page in-flight state map (read-only). */
  getInFlight(): Map<string, Promise<PaperCtecWidgetData | null>>;
  /** Sync cache reader: true when we already have an aggregate cached. */
  hasCachedReportAggregate(
    params: CtecLinkParams,
    titleHint: string,
    aggregateLimit: number
  ): boolean;
  /** Aggregation-window setting (recent N terms). */
  getAggregateLimit(): number;
  /** Render the panel UI (paper.nu native + our analytics tab). */
  renderSideCardAnalytics(
    context: PaperCtecSideCardContext,
    state: { selectedTab: SideCardTab; analyticsAvailable: boolean },
    onTabChange: (tab: SideCardTab) => void,
    onOpenModal: () => void
  ): void;
};

export interface SideCardCoordinator {
  syncSideCard(doc: Document): void;
  start(doc: Document): void;
  stop(doc: Document): void;
}

export function createSideCardCoordinator(
  deps: SideCardCoordinatorDeps
): SideCardCoordinator {
  // Per-key tab choice. paper.nu remounts the panel on every navigation, so
  // we restore the user's previous tab when the same course re-opens.
  const selectedTabs = new Map<string, SideCardTab>();

  function syncSideCard(doc: Document): void {
    const context = deps.extractSideCardContext(doc);
    if (!context) return;

    const modal = deps.modalController();
    modal.mirrorFrontPageState(context);
    modal.resumeIfNeeded(context);

    const analyticsAvailable =
      deps.hasUserActivated(context.key) ||
      deps.getResolved().has(context.key) ||
      deps.getInFlight().has(context.key) ||
      deps.hasCachedReportAggregate(
        context.params,
        context.titleHint,
        deps.getAggregateLimit()
      );

    // Reset the selected tab back to "paper" if Analytics is no longer
    // surfaced — otherwise a stale "analytics" choice would leave the panel
    // in an empty state.
    const requestedTab = selectedTabs.get(context.key) ?? "paper";
    const selectedTab: SideCardTab = analyticsAvailable ? requestedTab : "paper";

    deps.renderSideCardAnalytics(
      context,
      { selectedTab, analyticsAvailable },
      (tab) => {
        selectedTabs.set(context.key, tab);
        // Selecting the CTEC Analytics tab opens the modal. The side panel
        // itself just hosts a launcher button now — all rich content lives
        // in the modal.
        if (tab === "analytics") {
          modal.openModal(context);
        }
        syncSideCard(document);
      },
      () => {
        modal.openModal(context);
      }
    );
  }

  return {
    syncSideCard,
    start(doc: Document): void {
      syncSideCard(doc);
    },
    stop(_doc: Document): void {
      selectedTabs.clear();
    }
  };
}
