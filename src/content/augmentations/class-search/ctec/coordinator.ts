// Per-key CTEC fetch state machine for class-search section rows. Lighter
// than paper-ctec/chip-fetch-coordinator (no schedule cards, no status
// bar, no cart anchor wiring), but mirrors the same lifecycle so the
// shared ModalController and subject-index cache stay in sync:
//
//   • register(host, identity) — bind a section-row CTEC host element to
//     a course key. Repeated for every render of the same row; the latest
//     host wins so post-mutation re-renders stay live.
//   • kick(identity) — gated by ctecCreditPool. Drives the fetch, then
//     repaints all hosts bound to that key.
//   • renderForKey(key, data) — used by the modal's background-refresh
//     path to push fresh aggregate data back into the chip.
//   • peek(key) — sync read of the resolved map; used at register time
//     for cache-warm rendering with no flicker.
//
// State maps (resolved/inFlight/loadingMessages) are SEPARATE from
// paper-ctec's so an in-flight fetch in one augmentation doesn't
// short-circuit the other. The underlying subject-index cache IS shared
// (via ctec-links/reports.ts), so a fetch here warms the chip on a later
// paper.nu visit and vice versa.

import { ctecCreditPool } from "../../../../shared/credit-pool";
import { showToast } from "../../../../shared/toast";
import { isCtecAccessDenied } from "../../../ctec-index/access";
import {
  fetchCtecReportAggregate,
  getCachedReportAggregate,
  getCtecCourseAnalyticsSnapshot,
  type CtecReportAggregate
} from "../../ctec-links/reports";
import { CTEC_ERROR_TOAST_MESSAGE } from "../../ctec-links/rate-limit";
import { getRecentAggregationTerms } from "../../../settings";
import { buildModalDisplayData } from "../../paper-ctec/modal-data";
import type {
  AnalyticsModalSource,
  PaperCtecWidgetData
} from "../../paper-ctec/types";
import { isCaesarAuthRequiredError } from "../caesar-search/types";
import { withAuthRecovery, type AuthRecovery } from "../auth-recovery";
import { confirmLoginPrompt } from "../../../auth/login-prompt";

import { renderIdle, renderLoading, renderResolved } from "./view";

export interface CtecCoordinator {
  /** Wire a section-row CTEC host to a course identity. Idempotent across
   *  re-renders of the same row — the latest host wins. */
  register(host: HTMLElement, identity: AnalyticsModalSource): void;
  /** User clicked Load CTEC — drive the fetch loop. */
  kick(identity: AnalyticsModalSource): void;
  /** Returns the resolved widget data for `key`, or null if none yet. */
  peek(key: string): PaperCtecWidgetData | null;
  /** Push fresh widget data into the resolved map and repaint every live
   *  host for `key`. Used by the modal's background-refresh callback. */
  renderForKey(key: string, data: PaperCtecWidgetData): void;
  /** Drop all in-memory state. Called from the augmentation cleanup
   *  path. The underlying subject-index cache is preserved. */
  stop(): void;
}

export type CtecCoordinatorDeps = {
  /** Modal opener — used by the chip's Analytics button. */
  openAnalyticsModal(source: AnalyticsModalSource): void;
  /** Shared CAESAR auth-recovery handle. Wraps the CTEC fetch so a stale
   *  CAESAR or Bluera session triggers the silent → popup-and-retry
   *  cascade instead of surfacing auth-required to the chip. */
  authRecovery: AuthRecovery;
};

export function createCtecCoordinator(
  deps: CtecCoordinatorDeps
): CtecCoordinator {
  const resolved = new Map<string, PaperCtecWidgetData>();
  const inFlight = new Map<string, Promise<void>>();
  // Most recent live host per key — repaint targets. Section rows can be
  // rebuilt by results-renderer on every search; the latest register()
  // call wins.
  const hosts = new Map<string, HTMLElement>();
  // Sources stay around for renderForKey + Analytics-click after the row
  // remounts; identity is stable within a mount cycle.
  const sources = new Map<string, AnalyticsModalSource>();

  function repaint(key: string): void {
    const host = hosts.get(key);
    const source = sources.get(key);
    if (!host || !source) return;
    // No `host.isConnected` guard: register() runs while the section row
    // is still being assembled (host created → registered → appended to
    // <li>), so on the initial register the host isn't in the document
    // yet. lit-html writes children into a disconnected node fine; they
    // come along when the host mounts.

    const data = resolved.get(key);
    if (data) {
      renderResolved(
        host,
        data,
        () => deps.openAnalyticsModal(source),
        // Lazy: only invoked when the user actually hovers a chip, so we
        // never pay the buildModalDisplayData cost for chips that go
        // unhovered. Reads from the in-memory subject index (no network).
        () => {
          const snapshot = getCtecCourseAnalyticsSnapshot(
            source.params,
            source.titleHint,
            getRecentAggregationTerms()
          );
          if (!snapshot || snapshot.entries.length === 0) return null;
          return buildModalDisplayData(snapshot, source.params, source.titleHint);
        }
      );
      return;
    }
    if (inFlight.has(key)) {
      renderLoading(host);
      return;
    }
    renderIdle(host, () => kick(source));
  }

  function kick(identity: AnalyticsModalSource): void {
    if (inFlight.has(identity.key)) return;
    if (resolved.has(identity.key)) return;
    if (isCtecAccessDenied()) {
      resolved.set(identity.key, { state: "no-access" });
      repaint(identity.key);
      return;
    }

    const credit = ctecCreditPool.tryConsume("class-search-ctec");
    if (!credit.allowed) {
      showToast(ctecCreditPool.formatLimitReached(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

    sources.set(identity.key, identity);
    repaintLoading(identity.key, "Connecting to Northwestern CTEC…");

    const aggregateLimit = getRecentAggregationTerms();
    const job = withAuthRecovery(
      deps.authRecovery,
      isCaesarAuthRequiredError,
      () =>
        fetchCtecReportAggregate(
          identity.params,
          identity.titleHint,
          (message) => repaintLoading(identity.key, message),
          { fetchLimit: aggregateLimit, aggregateLimit }
        ),
      { confirmBeforePopup: (loginUrl) => confirmLoginPrompt(loginUrl) }
    )
      .then((result) => {
        // null = user canceled the sign-in popup. withAuthRecovery
        // already toasted; leave resolved empty so the next render falls
        // back to the Load CTEC button.
        if (result === null) return;
        const data: PaperCtecWidgetData = toWidgetData(result);
        resolved.set(identity.key, data);
        repaint(identity.key);
        if (data.state === "error") {
          showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        } else {
          const warning = ctecCreditPool.format();
          if (warning) {
            showToast(`Loaded CTEC. ${warning}.`, {
              tone: "warn",
              durationMs: 5000
            });
          }
        }
      })
      .catch((error: unknown) => {
        const data: PaperCtecWidgetData = {
          state: "error",
          message: error instanceof Error ? error.message : String(error)
        };
        resolved.set(identity.key, data);
        repaint(identity.key);
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
      })
      .finally(() => {
        inFlight.delete(identity.key);
        // Repaint so the chip reflects the post-fetch state. Cancel path
        // (resolved unset) re-renders the Load CTEC button.
        repaint(identity.key);
      });

    inFlight.set(identity.key, job);
  }

  function repaintLoading(key: string, message?: string): void {
    const host = hosts.get(key);
    if (!host) return;
    renderLoading(host, message ?? "Connecting to Northwestern CTEC…");
  }

  return {
    register(host, identity) {
      hosts.set(identity.key, host);
      sources.set(identity.key, identity);

      // Sticky no-access gate: paint the muted pill and skip every CTEC
      // path. No Load button, no fetch, no analytics. The cache-warm path
      // below would already short-circuit (getCachedReportAggregate
      // returns null when denied), but seeding `resolved` here lets the
      // first paint be the no-access state instead of a Load button that
      // would only short-circuit on click.
      if (isCtecAccessDenied()) {
        resolved.set(identity.key, { state: "no-access" });
        repaint(identity.key);
        return;
      }

      // Cache-warm path: when the subject index already has parsed reports
      // for this course, populate `resolved` synchronously so the host
      // renders chips with no flicker.
      if (!resolved.has(identity.key) && !inFlight.has(identity.key)) {
        const cachedAggregate = getCachedReportAggregate(
          identity.params,
          identity.titleHint,
          getRecentAggregationTerms()
        );
        if (cachedAggregate) {
          resolved.set(identity.key, cacheToWidget(cachedAggregate));
        }
      }
      repaint(identity.key);
    },
    kick,
    peek(key) {
      return resolved.get(key) ?? null;
    },
    renderForKey(key, data) {
      resolved.set(key, data);
      repaint(key);
    },
    stop() {
      resolved.clear();
      inFlight.clear();
      hosts.clear();
      sources.clear();
    }
  };
}

function toWidgetData(
  result: Awaited<ReturnType<typeof fetchCtecReportAggregate>>
): PaperCtecWidgetData {
  if (result.state === "found") return { state: "found", aggregate: result.aggregate };
  if (result.state === "no-access") return { state: "no-access" };
  if (result.state === "not-found") return { state: "not-found" };
  return { state: "error", message: result.message };
}

function cacheToWidget(aggregate: CtecReportAggregate): PaperCtecWidgetData {
  return { state: "found", aggregate };
}
