// Coordinator for the per-chip CTEC fetch sub-machine on paper.nu schedule
// cards. Owns:
//   - inFlight / resolved / loadingMessages maps
//   - userActivated set (keys the user explicitly clicked Load CTEC on —
//     survives invalidateAndRerun so login retries auto-resume)
//   - targetSources map (lazy AnalyticsModalSource for renderForKey wiring)
//   - visibleKeys set (snapshot of currently-visible chip keys for the
//     status-bar derivation)
//
// Extracted from PaperCtecAugmentation (Wave 6d). The augmentation hands
// over a list of PaperCtecTarget per run() and a small bag of cross-
// coordinator hooks; the coordinator drives the rest. Cart-anchor wiring
// is delegated back to the augmentation via attachCartButton, which itself
// routes to ChipCartCoordinator.
//
// All side-effecting deps (CTEC fetch, credit pool, toast, widget renderers,
// cache reads) flow through the deps bag so the coordinator stays unit-
// testable in jsdom without chrome.storage / network.

import type {
  AnalyticsModalSource,
  PaperCtecTarget,
  PaperCtecWidgetData
} from "./types";
import type { CtecLinkParams } from "../ctec-links/types";
import type {
  CtecCourseAnalytics,
  CtecReportAggregate
} from "../ctec-links/reports";
import type { ModalDisplayData } from "./modal-data";
import { findWidgetsByKey } from "./dom";

export type ToastTone = "info" | "warn" | "success" | "error";

export type ToastOptions = {
  tone?: ToastTone;
  durationMs?: number;
  action?: { label: string; run: () => void };
};

export type ChipFetchProgressMessage = {
  message: string;
  updatedAt: number;
};

export type ChipFetchCoordinatorState = {
  // Promise<… | null> — null is the user-canceled-popup signal from
  // withAuthRecovery; nothing is written to `resolved` in that case.
  readonly inFlight: Map<string, Promise<PaperCtecWidgetData | null>>;
  readonly resolved: Map<string, PaperCtecWidgetData>;
  readonly loadingMessages: Map<string, ChipFetchProgressMessage>;
  readonly userActivated: Set<string>;
  readonly visibleKeys: Set<string>;
};

export type ChipFetchCoordinatorDeps = {
  /** CTEC credit pool gate (formatLimitReached + tryConsume). */
  ctecCreditPool: {
    tryConsume(owner?: string): { allowed: boolean; waitMs: number };
    format(): string | null;
    formatLimitReached(waitMs: number): string;
  };
  /** Toast surface. */
  showToast(message: string, options?: ToastOptions): void;
  /** Aggregator fetch with per-message progress callback. Returns null
   *  when the user cancels the auth-recovery popup; data otherwise. The
   *  augmentation wires this through withAuthRecovery so credential
   *  failures self-heal silently for CAESAR or via the popup for Bluera. */
  fetchAggregate(
    params: CtecLinkParams,
    titleHint: string,
    onProgress: (message: string) => void,
    options: { fetchLimit: number; aggregateLimit: number }
  ): Promise<PaperCtecWidgetData | null>;
  /** Resolves paper.nu's grid-card "Smith" abbreviation back to a full
   *  name ("Alexander Smith") via paper.nu's plan data, so the CTEC
   *  directory search can distinguish same-last-name profs. Returns the
   *  input unchanged when enrichment isn't possible. */
  enrichParams(params: CtecLinkParams): Promise<CtecLinkParams>;
  /** Sync-cache reader: returns aggregate if already in the subject index. */
  getCachedAggregate(
    params: CtecLinkParams,
    titleHint: string,
    aggregateLimit: number
  ): CtecReportAggregate | null;
  /** Snapshot reader for the chip hover preview. */
  getCourseAnalyticsSnapshot(
    params: CtecLinkParams,
    titleHint: string,
    fetchLimit: number
  ): CtecCourseAnalytics | null;
  /** Current aggregation-window setting (most-recent-N terms). */
  getAggregateLimit(): number;
  /** Recent-terms fetch limit (paged batch size). */
  getFetchLimit(): number;
  /** Build modal display data from a snapshot (for the hover preview). */
  buildModalDisplayData(
    snapshot: CtecCourseAnalytics,
    params: CtecLinkParams,
    titleHint: string
  ): ModalDisplayData | null;
  /** CTEC error-toast text used on failure. */
  ctecErrorToastMessage: string;
  /** Wire the cart anchor onto the chip widget. */
  attachCartButton(target: PaperCtecTarget): void;
  /** True for paper.nu user-created custom blocks (no instructor → no cart). */
  isCustomScheduleCard(card: HTMLElement): boolean;
  /** Sticky "this NetID lacks CTEC access" gate. When true the coordinator
   *  short-circuits every chip to a no-access pill — no Load CTEC button,
   *  no fetch, no analytics. The cart button still renders. */
  isCtecAccessDenied(): boolean;
  /** Open the analytics modal for this chip. */
  openAnalyticsModal(source: AnalyticsModalSource): void;
  /** Render an idle chip (Load CTEC button). */
  renderIdle(widget: HTMLElement, onLoad: () => void): void;
  /** Render a loading chip with optional analytics-button callback. */
  renderLoading(
    widget: HTMLElement,
    message?: string,
    onAnalytics?: () => void
  ): void;
  /** Render a resolved chip. */
  renderWidget(
    widget: HTMLElement,
    data: PaperCtecWidgetData,
    onAnalytics: (() => void) | undefined,
    getPreviewData: (() => ModalDisplayData | null) | undefined
  ): void;
  /** Bump the loadingMessages map and resync the status bar. */
  setProgress(key: string, message: string): void;
  /** Trigger downstream sync after a chip resolves. */
  syncStatusBar(): void;
  syncSideCard(): void;
  syncModal(): void;
  /** True if the modal still has an analytics fetch in flight for `key`. */
  modalHasInFlight(key: string): boolean;
};

export interface ChipFetchCoordinator {
  readonly state: ChipFetchCoordinatorState;
  /** Walk targets and render the right state for each chip. */
  syncTargets(targets: PaperCtecTarget[]): void;
  /** User clicked Load CTEC: drive the fetch loop. */
  kickTargetFetch(target: PaperCtecTarget): void;
  /** No-op start (kept for symmetry with other coordinators). */
  start(): void;
  /** Clear all chip-fetch state. */
  stop(): void;
  /** Get the lazy AnalyticsModalSource for `key` (callers use it to route clicks). */
  getSource(key: string): AnalyticsModalSource | undefined;
  /** Lookup the lazy preview-data callback for `key`. */
  previewDataCallbackFor(key: string): (() => ModalDisplayData | null) | undefined;
  /** True if the user has explicitly clicked Load CTEC on this chip. */
  hasUserActivated(key: string): boolean;
  /**
   * Persist new chip data and repaint every live widget for `key`. Used by
   * the modal controller's onRefresh path so a successful background
   * refresh updates the schedule chip alongside the modal.
   */
  renderForKey(key: string, data: PaperCtecWidgetData): void;
}

export function createChipFetchCoordinator(
  deps: ChipFetchCoordinatorDeps
): ChipFetchCoordinator {
  const inFlight = new Map<string, Promise<PaperCtecWidgetData | null>>();
  const resolved = new Map<string, PaperCtecWidgetData>();
  const loadingMessages = new Map<string, ChipFetchProgressMessage>();
  const userActivated = new Set<string>();
  const visibleKeys = new Set<string>();
  // Per-key snapshot of the data needed to open the modal. syncTargets
  // populates this from currently-visible targets so renderForKey /
  // renderLoadingForKey can wire the analytics-button callback even when
  // they don't have direct access to a PaperCtecTarget.
  const targetSources = new Map<string, AnalyticsModalSource>();

  const state: ChipFetchCoordinatorState = {
    inFlight,
    resolved,
    loadingMessages,
    userActivated,
    visibleKeys
  };

  function getSource(key: string): AnalyticsModalSource | undefined {
    return targetSources.get(key);
  }

  function openAnalyticsCallbackFor(key: string): (() => void) | undefined {
    const source = targetSources.get(key);
    if (!source) return undefined;
    return () => deps.openAnalyticsModal(source);
  }

  // Lazy snapshot reader for the schedule-chip hover preview. Reads from
  // the in-memory subject index — no network — and converts to ModalDisplayData
  // so the popup can reuse the modal's hours-density renderer. Returns null
  // when nothing usable is cached yet (e.g. the chip is showing a stale
  // aggregate but the index has been wiped).
  function previewDataCallbackFor(
    key: string
  ): (() => ModalDisplayData | null) | undefined {
    const source = targetSources.get(key);
    if (!source) return undefined;
    return () => {
      const snapshot = deps.getCourseAnalyticsSnapshot(
        source.params,
        source.titleHint,
        deps.getFetchLimit()
      );
      if (!snapshot || snapshot.entries.length === 0) return null;
      return deps.buildModalDisplayData(snapshot, source.params, source.titleHint);
    };
  }

  function renderForKey(key: string, data: PaperCtecWidgetData): void {
    const onAnalytics = openAnalyticsCallbackFor(key);
    const getPreviewData = previewDataCallbackFor(key);
    for (const widget of findWidgetsByKey(document, key)) {
      deps.renderWidget(
        widget,
        data,
        onAnalytics,
        getPreviewData
      );
    }
    deps.syncStatusBar();
    deps.syncSideCard();
    deps.syncModal();
  }

  function renderLoadingForKey(key: string, message: string): void {
    deps.setProgress(key, message);
    const onAnalytics = openAnalyticsCallbackFor(key);
    for (const widget of findWidgetsByKey(document, key)) {
      deps.renderLoading(widget, message, onAnalytics);
    }
  }

  async function loadTarget(target: PaperCtecTarget): Promise<PaperCtecWidgetData | null> {
    try {
      const enrichedParams = await deps.enrichParams(target.params);
      const data = await deps.fetchAggregate(
        enrichedParams,
        target.titleHint,
        (message) => {
          renderLoadingForKey(target.key, message);
        },
        {
          fetchLimit: deps.getFetchLimit(),
          aggregateLimit: deps.getAggregateLimit()
        }
      );

      // null = user canceled the auth-recovery popup. withAuthRecovery
      // already toasted. Drop userActivated so syncTargets doesn't re-pop
      // the popup on every paper.nu remount, and leave resolved untouched
      // so the next render falls back to the Load CTEC button.
      if (data === null) {
        userActivated.delete(target.key);
        return null;
      }

      resolved.set(target.key, data);
      renderForKey(target.key, data);
      if (data.state === "error") {
        deps.showToast(deps.ctecErrorToastMessage, { tone: "warn", durationMs: 9000 });
      } else if (
        data.state === "not-found" &&
        userActivated.has(target.key)
      ) {
        // User explicitly asked for CTEC and we got nothing. Surface
        // the analytics modal immediately so its dry-run dialog can
        // auto-open — the chip itself has no UI for picking
        // alternatives. Gated on userActivated so cache-warm autoloads
        // don't pop a modal in the background.
        const source = targetSources.get(target.key);
        if (source) deps.openAnalyticsModal(source);
      } else {
        const warning = deps.ctecCreditPool.format();
        if (warning) {
          deps.showToast(`Loaded CTEC. ${warning}.`, {
            tone: "warn",
            durationMs: 5000
          });
        }
      }
      return data;
    } catch (error) {
      const widgetData: PaperCtecWidgetData = {
        state: "error",
        message: error instanceof Error ? error.message : String(error)
      };
      resolved.set(target.key, widgetData);
      renderForKey(target.key, widgetData);
      deps.showToast(deps.ctecErrorToastMessage, { tone: "warn", durationMs: 9000 });
      return widgetData;
    }
  }

  function kickTargetFetch(target: PaperCtecTarget): void {
    if (inFlight.has(target.key)) return;
    if (resolved.has(target.key)) return;
    if (deps.isCtecAccessDenied()) return;

    const credit = deps.ctecCreditPool.tryConsume("paper-ctec-chip-fetch");
    if (!credit.allowed) {
      deps.showToast(deps.ctecCreditPool.formatLimitReached(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

    userActivated.add(target.key);

    deps.setProgress(target.key, "Connecting to Northwestern CTEC…");
    deps.renderLoading(target.widget);

    const job = loadTarget(target);
    inFlight.set(target.key, job);
    void job.finally(() => {
      inFlight.delete(target.key);
      if (!deps.modalHasInFlight(target.key)) {
        loadingMessages.delete(target.key);
      }
      deps.syncStatusBar();
      deps.syncSideCard();
      deps.syncModal();
    });
  }

  function syncTargets(targets: PaperCtecTarget[]): void {
    visibleKeys.clear();
    for (const target of targets) visibleKeys.add(target.key);

    for (const target of targets) {
      target.widget.dataset.bcPaperCtecKey = target.key;
      const source: AnalyticsModalSource = {
        key: target.key,
        params: target.params,
        titleHint: target.titleHint
      };
      targetSources.set(target.key, source);
      const onAnalytics = () => deps.openAnalyticsModal(source);

      // Independent of CTEC fetch state — always wire the cart button so the
      // user can add to cart without ever loading CTECs first. Skip user-
      // created custom sections (paper.nu marks them with a dashed border):
      // they have no instructor to disambiguate against and don't correspond
      // to anything in CAESAR.
      if (!deps.isCustomScheduleCard(target.card)) {
        deps.attachCartButton(target);
      }

      // Sticky no-access gate: render the muted pill once and skip every
      // CTEC code path (no Load button, no fetch, no analytics anchor).
      // Cart wiring above is preserved.
      if (deps.isCtecAccessDenied()) {
        deps.renderWidget(
          target.widget,
          { state: "no-access" },
          undefined,
          undefined
        );
        continue;
      }

      const getPreviewData = previewDataCallbackFor(target.key);

      const cached = resolved.get(target.key);
      if (cached) {
        deps.renderWidget(
          target.widget,
          cached,
          onAnalytics,
          getPreviewData
        );
        continue;
      }

      if (inFlight.has(target.key)) {
        if (!target.widget.textContent?.trim()) {
          deps.renderLoading(target.widget, "CTEC…", onAnalytics);
        }
        continue;
      }

      // Sync cache hit: render without touching the network. This covers
      // repeat visits where the subject index already has parsed reports
      // for the recent terms.
      const cachedAggregate = deps.getCachedAggregate(
        target.params,
        target.titleHint,
        deps.getAggregateLimit()
      );
      if (cachedAggregate) {
        const widgetData: PaperCtecWidgetData = {
          state: "found",
          aggregate: cachedAggregate
        };
        resolved.set(target.key, widgetData);
        deps.renderWidget(
          target.widget,
          widgetData,
          onAnalytics,
          getPreviewData
        );
        continue;
      }

      // User previously clicked Load CTEC on this card and the fetch was
      // interrupted by something other than a popup-cancel (e.g. an
      // analytics-modal close mid-fetch). Resume.
      if (userActivated.has(target.key)) {
        kickTargetFetch(target);
        continue;
      }

      // Not cached — wait for an explicit user click before hitting CAESAR.
      // No Analytics button until the user actually loads CTECs.
      deps.renderIdle(target.widget, () => kickTargetFetch(target));
    }
  }

  return {
    state,
    syncTargets,
    kickTargetFetch,
    start(): void {
      // No-op: chip-fetch has no subscription lifecycle of its own. Kept on
      // the interface so the augmentation can call start() symmetrically
      // for every coordinator.
    },
    stop(): void {
      inFlight.clear();
      resolved.clear();
      loadingMessages.clear();
      userActivated.clear();
      visibleKeys.clear();
      targetSources.clear();
    },
    getSource,
    previewDataCallbackFor,
    hasUserActivated(key: string): boolean {
      return userActivated.has(key);
    },
    renderForKey(key: string, data: PaperCtecWidgetData): void {
      resolved.set(key, data);
      renderForKey(key, data);
    }
  };
}
