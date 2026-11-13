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
  AnalyticsModalSource,
  PaperCtecSideCardContext,
  PaperCtecWidgetData
} from "./types";
import type { CtecLinkParams } from "../ctec-links/types";

export type SideCardTab = "paper" | "caesar" | "analytics";

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
    onTabChange: (tab: SideCardTab) => void
  ): { analytics: HTMLElement | null; caesar: HTMLElement | null; foot?: HTMLElement | null } | null;
  /** Draw the seats-and-register bar under Paper.nu's own tab. */
  renderPanelFoot?(context: PaperCtecSideCardContext, host: HTMLElement): void;
  /** The panel has opened on a class: load what Pencil shows for it. */
  onClassOpened?(context: PaperCtecSideCardContext): void;
  /** Draw CAESAR's facts for the panel's class into the CAESAR tab. */
  renderCaesarTab?(context: PaperCtecSideCardContext, host: HTMLElement): void;
  /** Schedule card for a chip key, used to open Paper.nu's own panel. */
  findCard(key: string): HTMLElement | null;
};

export interface SideCardCoordinator {
  syncSideCard(doc: Document): void;
  start(doc: Document): void;
  /** Analytics button on a schedule card: open Paper.nu's Section Info
   *  panel on its CTECs tab, or the docked sheet if the panel won't open. */
  openAnalytics(source: AnalyticsModalSource): void;
  stop(doc: Document): void;
}

export function createSideCardCoordinator(
  deps: SideCardCoordinatorDeps
): SideCardCoordinator {
  // Per-key tab choice. paper.nu remounts the panel on every navigation, so
  // we restore the user's previous tab when the same course re-opens.
  const selectedTabs = new Map<string, SideCardTab>();

  // Key of the section whose sheet is currently living inside Paper.nu's
  // panel, or null when the sheet is docked or closed.
  let hosting: string | null = null;
  // The class the panel last opened on, so each opening loads once.
  let opened: string | null = null;

  function releaseHost(): void {
    if (!hosting) return;
    const modal = deps.modalController();
    modal.setHost(null);
    if (modal.openKey() === hosting) modal.closeModal();
    hosting = null;
  }

  function syncSideCard(doc: Document): void {
    const context = deps.extractSideCardContext(doc);
    if (!context) {
      opened = null;
      releaseHost();
      return;
    }
    if (opened !== context.key) {
      opened = context.key;
      deps.onClassOpened?.(context);
    }

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

    // The sheet was closed from inside (Escape): fall back to Paper.nu's tab
    // instead of reopening it on the next tick.
    if (hosting === context.key && modal.openKey() !== context.key) {
      selectedTabs.set(context.key, "paper");
    }

    // Reset the selected tab back to "paper" if Analytics is no longer
    // surfaced — otherwise a stale "analytics" choice would leave the panel
    // in an empty state.
    const requestedTab = selectedTabs.get(context.key) ?? "paper";
    // CAESAR's facts move into the CTECs tab once that tab exists.
    const selectedTab: SideCardTab =
      requestedTab === "analytics" && !analyticsAvailable ? "paper" : requestedTab === "caesar" && analyticsAvailable ? "analytics" : requestedTab;

    const hosts = deps.renderSideCardAnalytics(
      context,
      { selectedTab, analyticsAvailable },
      (tab) => {
        selectedTabs.set(context.key, tab);
        syncSideCard(document);
      }
    );

    if (hosts?.caesar) deps.renderCaesarTab?.(context, hosts.caesar);
    if (hosts?.foot) deps.renderPanelFoot?.(context, hosts.foot);
    const host = hosts?.analytics ?? null;
    if (!host) {
      releaseHost();
      return;
    }
    modal.setHost(host);
    const alreadyOpen = modal.openKey() === context.key;
    hosting = context.key;
    if (alreadyOpen) modal.sync(doc);
    else modal.openModal(context);
  }

  function openAnalytics(source: AnalyticsModalSource): void {
    const card = deps.findCard(source.key);
    if (!card) {
      deps.modalController().openModal(source);
      return;
    }
    card.click();
    // Paper.nu mounts its panel a moment after the click. The panel names
    // the professor more fully than the card does, so the two keys differ:
    // match on the course instead. If the panel never shows up for this
    // section (custom block, layout change), keep the feature working with
    // the docked sheet.
    let tries = 0;
    const check = (): void => {
      const context = deps.extractSideCardContext(document);
      if (
        context &&
        context.params.subject === source.params.subject &&
        context.params.catalogNumber === source.params.catalogNumber
      ) {
        selectedTabs.set(context.key, "analytics");
        syncSideCard(document);
        return;
      }
      tries += 1;
      if (tries < 15) {
        setTimeout(check, 100);
        return;
      }
      deps.modalController().openModal(source);
    };
    setTimeout(check, 50);
  }

  return {
    syncSideCard,
    openAnalytics,
    start(doc: Document): void {
      syncSideCard(doc);
    },
    stop(_doc: Document): void {
      releaseHost();
      opened = null;
      selectedTabs.clear();
    }
  };
}
