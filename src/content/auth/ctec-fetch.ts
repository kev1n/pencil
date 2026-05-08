// Shared CTEC fetch wrappers used by both surfaces (paper-ctec chip on
// paper.nu and class-search section rows on CAESAR). Each wraps an
// underlying fetch (aggregate or analytics) in `withAuthRecovery` plus
// the visible-popup confirmation modal, then maps the cancel result into
// the shape each caller expects.

import { isCaesarAuthRequiredError } from "../augmentations/class-search/caesar-search/types";
import {
  withAuthRecovery,
  type AuthRecovery
} from "../augmentations/class-search/auth-recovery";
import {
  fetchCtecCourseAnalytics,
  fetchCtecReportAggregate,
  type CtecCourseAnalyticsResult,
  type CtecReportAggregateResult
} from "../augmentations/ctec-links/reports";
import type { CtecLinkParams } from "../augmentations/ctec-links/types";
import { confirmLoginPrompt } from "./login-prompt";

const RECOVERY_OPTIONS = {
  confirmBeforePopup: (loginUrl: string) => confirmLoginPrompt(loginUrl)
};

// Schedule-chip fetch. Returns `null` when the user cancels the popup —
// the chip handles that by leaving its resolved map empty so the Load
// CTEC button reappears.
export function fetchAggregateWithAuth(
  authRecovery: AuthRecovery,
  params: CtecLinkParams,
  titleHint: string,
  onProgress: (message: string) => void,
  options: { fetchLimit: number; aggregateLimit: number }
): Promise<CtecReportAggregateResult | null> {
  return withAuthRecovery(
    authRecovery,
    isCaesarAuthRequiredError,
    () => fetchCtecReportAggregate(params, titleHint, onProgress, options),
    RECOVERY_OPTIONS
  );
}

// Modal-data-controller fetch. Maps cancel into a synthetic error so the
// controller's `analyticsResolved` map is set to a non-loading terminal
// state (otherwise the modal would loop on "no data yet").
export function fetchAnalyticsWithAuth(
  authRecovery: AuthRecovery,
  params: CtecLinkParams,
  titleHint: string | undefined,
  recentAggregateLimit: number | undefined,
  onProgress: ((message: string) => void) | undefined,
  fetchLimit: number | undefined,
  forceRefreshLinks: boolean | undefined
): Promise<CtecCourseAnalyticsResult> {
  return withAuthRecovery(
    authRecovery,
    isCaesarAuthRequiredError,
    () =>
      fetchCtecCourseAnalytics(
        params,
        titleHint,
        recentAggregateLimit,
        onProgress,
        fetchLimit,
        forceRefreshLinks
      ),
    RECOVERY_OPTIONS
  ).then((result) =>
    result === null
      ? ({ state: "error", message: "Sign-in canceled." } as const)
      : result
  );
}
