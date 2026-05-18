import { ctecCreditPool } from "../../../../shared/credit-pool";
import { showToast } from "../../../../shared/toast";
import { getCtecStrategy } from "../../../settings";
import { getSectionLens } from "../../ctec-links/section-lens";
import { CTEC_ERROR_TOAST_MESSAGE } from "../../ctec-links/rate-limit";
import type { CtecLinkParams } from "../../ctec-links/types";
import {
  fetchCtecCourseAnalytics,
  getCachedChipAggregate,
  getCtecCourseAnalyticsSnapshot
} from "../../ctec-links/reports";
import { PAPER_CTEC_CONFIG } from "../config";
import type {
  AnalyticsModalSource,
  PaperCtecAnalyticsState,
  PaperCtecWidgetData
} from "../types";
import type { ModalRefreshFlash } from "./types";

// Wraps the CTEC fetch loops the modal needs: kickBatch (user-facing
// load-more), kickRefresh (background "check for new CTECs"), and the
// auto-dismiss timer that clears success-flash banners after a few seconds.
//
// The controller doesn't know about the modal UI — callers wire view sync
// + status-bar refresh + chip mirror via the `callbacks` bag. Carved out of
// ModalController in Wave 6c so each piece can be reasoned about (and
// tested) on its own.

export interface ModalDataControllerDeps {
  // Cross-augmentation shared state — passed by reference. Writes here must
  // be observed by both the modal sync loop AND the augmentation's status
  // bar / schedule chips.
  state: {
    resolved: Map<string, PaperCtecWidgetData>;
    inFlight: Map<string, Promise<PaperCtecWidgetData | null>>;
    analyticsResolved: Map<string, PaperCtecAnalyticsState>;
    analyticsInFlight: Map<string, Promise<PaperCtecAnalyticsState>>;
    loadingMessages: Map<string, { message: string; updatedAt: number }>;
  };
  callbacks: {
    setProgress: (key: string, message: string) => void;
    syncStatusBar: () => void;
    syncSideCard: () => void;
    syncView: () => void;
    // Background refresh path also needs to push fresh aggregate data into
    // the schedule-card chip mini-summary when new CTECs land — newly-
    // published terms shift the rating/responses count.
    renderForKey: (key: string, data: PaperCtecWidgetData) => void;
  };
  // Wraps fetchCtecCourseAnalytics through withAuthRecovery. Returns null
  // when the user cancels the auth-recovery popup.
  fetcher: typeof fetchCtecCourseAnalytics;
  // Resolves paper.nu's grid-card "Smith" abbreviation back to a full
  // name via paper.nu's plan data so same-last-name profs don't collide
  // on the Prof-lens directory search. Returns input unchanged when
  // enrichment isn't possible.
  enrichParams: (params: CtecLinkParams) => Promise<CtecLinkParams>;
}

export interface ModalDataController {
  isBackgroundRefreshing(key: string): boolean;
  getRefreshFlash(key: string): ModalRefreshFlash | null;
  getTargetCount(key: string): number | undefined;
  // Drops the per-key analytics batch target so the next kickBatch starts
  // from parsedCount + batchSize instead of carrying over a prior lens's
  // count. Called on lens-switch paths.
  clearTargetCount(key: string): void;
  setRefreshFlash(key: string, flash: ModalRefreshFlash): void;
  clearRefreshFlash(key: string): void;
  kickBatch(
    context: AnalyticsModalSource,
    increment?: boolean,
    forceRefreshLinks?: boolean
  ): void;
  kickRefresh(context: AnalyticsModalSource): void;
  // Frees auto-dismiss timers — used by ModalController.invalidate to
  // ensure no pending callback fires after the modal is torn down.
  reset(): void;
}

export function createModalDataController(
  deps: ModalDataControllerDeps
): ModalDataController {
  const { state, callbacks } = deps;
  const fetcher = deps.fetcher;

  // Distinct from analyticsInFlight: tracks background "check for new CTECs"
  // passes that must NOT flip the modal to a loading state. The user keeps
  // interacting with cached data while we re-poll Northwestern.
  const analyticsBackgroundRefresh = new Set<string>();

  // Result of the most recent background refresh per key. Cleared on user
  // dismiss or after a setTimeout for success cases.
  const analyticsRefreshFlash = new Map<string, ModalRefreshFlash>();
  const analyticsRefreshFlashTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  // Per-key target count for analytics. Each user click on "+N more terms"
  // bumps this by recentTerms; the next fetch uses it as fetchLimit so we
  // pull exactly the next batch.
  const analyticsTargetCount = new Map<string, number>();

  function clearRefreshFlash(key: string): void {
    const timer = analyticsRefreshFlashTimers.get(key);
    if (timer) clearTimeout(timer);
    analyticsRefreshFlashTimers.delete(key);
    analyticsRefreshFlash.delete(key);
  }

  function setRefreshFlash(key: string, flash: ModalRefreshFlash): void {
    analyticsRefreshFlash.set(key, flash);
    const existingTimer = analyticsRefreshFlashTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    analyticsRefreshFlashTimers.delete(key);
    if (flash.kind === "success") {
      const timer = setTimeout(() => {
        analyticsRefreshFlashTimers.delete(key);
        if (analyticsRefreshFlash.get(key) === flash) {
          analyticsRefreshFlash.delete(key);
          callbacks.syncView();
        }
      }, 6000);
      analyticsRefreshFlashTimers.set(key, timer);
    }
  }

  // Fetches the next batch of recentTerms-sized term reports for this course.
  // Each user-initiated call bumps the per-key target so the underlying
  // fetchLimit grows by recentTerms — pulling exactly the next batch of
  // unparsed entries. `increment=false` is used to resume an interrupted
  // batch (e.g. after a login retry) without bumping the target.
  function kickBatch(
    context: AnalyticsModalSource,
    increment = true,
    forceRefreshLinks = false
  ): void {
    if (state.analyticsInFlight.has(context.key)) return;

    const credit = ctecCreditPool.tryConsume("modal-load-more");
    if (!credit.allowed) {
      showToast(ctecCreditPool.formatLimitReached(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

    const batchSize = PAPER_CTEC_CONFIG.aggregate.recentTerms;
    const snapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      batchSize,
      getSectionLens(context.params) ?? getCtecStrategy()
    );
    const parsedCount = countParsedEntries(snapshot);
    // Fresh fetch after a lens switch: ignore parsedCount entirely.
    // Course/instructor lenses pull combo's overlapping entries into
    // parsedCount via the broader filter, which used to inflate
    // nextTarget to 2× batchSize and have the fetcher chase reports
    // for entries the user never asked about. The undefined-target
    // sentinel is the signal that clearTargetCount just ran (lens
    // switch / dry-run confirm) — start from exactly batchSize.
    const previousTarget = analyticsTargetCount.get(context.key);
    const nextTarget =
      previousTarget === undefined
        ? batchSize
        : increment
          ? Math.max(previousTarget, parsedCount) + batchSize
          : Math.max(previousTarget, parsedCount + batchSize);
    analyticsTargetCount.set(context.key, nextTarget);

    const start = async (): Promise<PaperCtecAnalyticsState | null> => {
      const currentFrontPageJob = state.inFlight.get(context.key);
      if (currentFrontPageJob) {
        await currentFrontPageJob.catch(() => undefined);
      }

      const enrichedParams = await deps.enrichParams(context.params);
      const result = await fetcher(
        enrichedParams,
        context.titleHint,
        PAPER_CTEC_CONFIG.aggregate.recentTerms,
        (message) => {
          callbacks.setProgress(context.key, `Loading term history… ${message}`);
        },
        nextTarget,
        forceRefreshLinks
      );
      // null = user canceled the auth-recovery popup. Surface as null so
      // the .then below leaves analyticsResolved untouched (modal falls
      // back to "no data yet").
      if (result === null) return null;

      return result.state === "found"
        ? { state: "found", analytics: result.analytics }
        : result;
    };

    const job = start()
      .then((resultState) => {
        if (resultState === null) {
          // Cancel path — surface as a non-storing terminal so the
          // analyticsInFlight bookkeeping resolves cleanly.
          return {
            state: "error" as const,
            message: "Sign-in canceled."
          } satisfies PaperCtecAnalyticsState;
        }
        state.analyticsResolved.set(context.key, resultState);
        if (resultState.state === "error") {
          showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        } else {
          const warning = ctecCreditPool.format();
          if (warning) {
            showToast(`Loaded CTEC. ${warning}.`, { tone: "warn", durationMs: 5000 });
          }
          // Repaint the schedule chip from the freshly-loaded lens. After a
          // section-lens switch via the wizard or strategy tabs we cleared
          // `state.resolved[context.key]`; without this nudge the chip would
          // sit on the Load-CTEC placeholder until paper.nu next mutates the
          // DOM (potentially never, on a quiet page). Use the chip-flavored
          // reader so combo (most precise) wins the rating display when it
          // has data, even if the user is currently browsing in the modal
          // via Course or Prof lens.
          const aggregate = getCachedChipAggregate(
            context.params,
            context.titleHint,
            PAPER_CTEC_CONFIG.aggregate.recentTerms
          );
          if (aggregate) {
            const widgetData: PaperCtecWidgetData = {
              state: "found",
              aggregate
            };
            state.resolved.set(context.key, widgetData);
            callbacks.renderForKey(context.key, widgetData);
          } else if (resultState.state === "not-found") {
            const widgetData: PaperCtecWidgetData = { state: "not-found" };
            state.resolved.set(context.key, widgetData);
            callbacks.renderForKey(context.key, widgetData);
          }
        }
        return resultState;
      })
      .catch((error) => {
        const errorState: PaperCtecAnalyticsState = {
          state: "error",
          message: error instanceof Error ? error.message : String(error)
        };
        state.analyticsResolved.set(context.key, errorState);
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        return errorState;
      })
      .finally(() => {
        state.analyticsInFlight.delete(context.key);
        if (!state.inFlight.has(context.key)) {
          state.loadingMessages.delete(context.key);
        }
        callbacks.syncStatusBar();
        callbacks.syncSideCard();
        callbacks.syncView();
      });

    state.analyticsInFlight.set(context.key, job);
  }

  // Background "check for new CTECs": re-pulls the link list from
  // Northwestern (forceRefreshLinks=true) so newly-published evaluations are
  // discovered, then fetches reports only for entries we haven't seen
  // before. Existing cached reportSummary data is preserved across the
  // refresh so the modal, side card, and schedule chip stay fully populated
  // and usable. Distinct from kickBatch (which the modal's load-more uses)
  // because it does NOT use analyticsInFlight — that flag drives the
  // modal's global loading state, which we explicitly want to avoid here.
  function kickRefresh(context: AnalyticsModalSource): void {
    if (analyticsBackgroundRefresh.has(context.key)) return;
    if (state.analyticsInFlight.has(context.key)) return;

    const credit = ctecCreditPool.tryConsume("modal-refresh");
    if (!credit.allowed) {
      showToast(ctecCreditPool.formatLimitReached(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

    analyticsBackgroundRefresh.add(context.key);
    // Clear any prior flash so the user doesn't see stale success/error
    // from the previous run while a new check is in flight.
    clearRefreshFlash(context.key);

    const strategy = getSectionLens(context.params) ?? getCtecStrategy();
    const previousSnapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms,
      strategy
    );
    const previousParsed = countParsedEntries(previousSnapshot);
    const previousTotal = previousSnapshot?.entries.length ?? 0;
    const previousTarget = analyticsTargetCount.get(context.key) ?? previousParsed;
    const refreshTarget = Math.max(previousTarget, PAPER_CTEC_CONFIG.aggregate.recentTerms);
    analyticsTargetCount.set(context.key, refreshTarget);

    // Re-render so the refresh button immediately shows "Checking…".
    callbacks.syncView();

    void (async () => {
      try {
        const enrichedParams = await deps.enrichParams(context.params);
        const result = await fetcher(
          enrichedParams,
          context.titleHint,
          PAPER_CTEC_CONFIG.aggregate.recentTerms,
          undefined,
          refreshTarget,
          /* forceRefreshLinks */ true
        );

        // null = user canceled the auth-recovery popup. Don't flash
        // success or error — leave existing data in place.
        if (result === null) return;

        if (result.state === "found") {
          state.analyticsResolved.set(context.key, {
            state: "found",
            analytics: result.analytics
          });
          const updatedSnapshot = getCtecCourseAnalyticsSnapshot(
            context.params,
            context.titleHint,
            PAPER_CTEC_CONFIG.aggregate.recentTerms,
            strategy
          );
          const newTotal = updatedSnapshot?.entries.length ?? 0;
          const addedCount = Math.max(0, newTotal - previousTotal);
          setRefreshFlash(context.key, { kind: "success", addedCount });
          const warning = ctecCreditPool.format();
          if (warning) {
            showToast(`Refreshed CTEC. ${warning}.`, { tone: "warn", durationMs: 5000 });
          }
          // Refresh the schedule chip's mini-summary too — newly-published
          // terms can shift the aggregated rating/responses count. Pull the
          // updated aggregate straight from cache without going through the
          // chip's loading state. Combo-first so the chip stays anchored to
          // the most precise (prof, course) data when it exists.
          const refreshedAggregate = getCachedChipAggregate(
            context.params,
            context.titleHint,
            PAPER_CTEC_CONFIG.aggregate.recentTerms
          );
          if (refreshedAggregate) {
            const widgetData: PaperCtecWidgetData = {
              state: "found",
              aggregate: refreshedAggregate
            };
            state.resolved.set(context.key, widgetData);
            callbacks.renderForKey(context.key, widgetData);
          }
        } else if (result.state === "error") {
          state.analyticsResolved.set(context.key, {
            state: "error",
            message: result.message
          });
          setRefreshFlash(context.key, {
            kind: "error",
            message: result.message
          });
          showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        } else if (result.state === "not-found") {
          // Existing data stays; flag it as up-to-date with zero added.
          setRefreshFlash(context.key, { kind: "success", addedCount: 0 });
        }
      } catch (error) {
        setRefreshFlash(context.key, {
          kind: "error",
          message: error instanceof Error ? error.message : String(error)
        });
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
      } finally {
        analyticsBackgroundRefresh.delete(context.key);
        callbacks.syncStatusBar();
        callbacks.syncSideCard();
        callbacks.syncView();
      }
    })();
  }

  return {
    isBackgroundRefreshing(key) {
      return analyticsBackgroundRefresh.has(key);
    },
    getRefreshFlash(key) {
      return analyticsRefreshFlash.get(key) ?? null;
    },
    getTargetCount(key) {
      return analyticsTargetCount.get(key);
    },
    clearTargetCount(key) {
      analyticsTargetCount.delete(key);
    },
    setRefreshFlash,
    clearRefreshFlash,
    kickBatch,
    kickRefresh,
    reset() {
      for (const timer of analyticsRefreshFlashTimers.values()) {
        clearTimeout(timer);
      }
      analyticsRefreshFlashTimers.clear();
      analyticsRefreshFlash.clear();
      analyticsBackgroundRefresh.clear();
      analyticsTargetCount.clear();
    }
  };
}

function countParsedEntries(
  snapshot: ReturnType<typeof getCtecCourseAnalyticsSnapshot>
): number {
  if (!snapshot) return 0;
  return snapshot.entries.filter(
    (entry) => entry.status === "ready" || entry.status === "unavailable"
  ).length;
}
