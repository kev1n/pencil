import type {
  PaperCtecAnalyticsState,
  PaperCtecStatusBarData,
  PaperCtecWidgetData
} from "./types";

type ProgressMessage = { message: string; updatedAt: number };

type BuildStatusBarDataArgs = {
  visibleKeys: Set<string>;
  resolved: Map<string, PaperCtecWidgetData>;
  analyticsResolved: Map<string, PaperCtecAnalyticsState>;
  inFlight: Map<string, unknown>;
  analyticsInFlight: Map<string, unknown>;
  loadingMessages: Map<string, ProgressMessage>;
};

export function buildStatusBarData(args: BuildStatusBarDataArgs): PaperCtecStatusBarData | null {
  if (args.visibleKeys.size === 0) return null;

  let foundCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  let activeCount = 0;

  for (const key of args.visibleKeys) {
    if (args.inFlight.has(key) || args.analyticsInFlight.has(key)) {
      activeCount += 1;
    }

    const value = args.resolved.get(key);
    if (value?.state === "found") foundCount += 1;
    if (value?.state === "not-found") notFoundCount += 1;
    if (value?.state === "error") errorCount += 1;
  }

  const totalCount = args.visibleKeys.size;
  const resolvedCount = foundCount + notFoundCount + errorCount;
  const latestMessage = getLatestProgressMessage(args.visibleKeys, args.loadingMessages);

  // Suppress the loading bar entirely until we have at least one verified
  // resolution. Otherwise a brief race during syncTargets — setProgress runs
  // before inFlight.set, so activeCount is momentarily 0 — flashes a
  // "Loading CTECs · 0/N classes checked" bar that's gone milliseconds later.
  if (resolvedCount === 0 && activeCount === 0) {
    return null;
  }

  if (activeCount > 0 || resolvedCount < totalCount) {
    return {
      state: "loading",
      totalCount,
      resolvedCount,
      activeCount,
      foundCount,
      notFoundCount,
      errorCount,
      latestMessage
    };
  }

  return {
    state: "ready",
    totalCount,
    resolvedCount,
    activeCount,
    foundCount,
    notFoundCount,
    errorCount
  };
}

function getLatestProgressMessage(
  visibleKeys: Set<string>,
  loadingMessages: Map<string, ProgressMessage>
): string | undefined {
  let latest: ProgressMessage | undefined;

  for (const key of visibleKeys) {
    const progress = loadingMessages.get(key);
    if (!progress) continue;
    if (!latest || progress.updatedAt > latest.updatedAt) {
      latest = progress;
    }
  }

  return latest?.message;
}
