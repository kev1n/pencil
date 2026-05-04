import { logQuiet } from "../../shared/log";
import {
  bucketForGradYear,
  BUCKET_LABELS,
  type Bucket
} from "./constants";
import { isCodeValidForLastName } from "./code";
import { fetchAndCacheUserName } from "./name-fetch";
import { getRemoteSchedule } from "./server-client";
import {
  ACCESS_GATE_CODE_KEY,
  ACCESS_GATE_NAME_KEY,
  readStoredCode,
  readStoredName
} from "./storage";

export type GateStatus =
  | { kind: "unlocked"; reason: "bucket" | "code"; lastName: string }
  | {
      kind: "locked-bucket";
      releaseAt: number;
      bucket: Bucket;
      bucketLabel: string;
      lastName: string;
      gradYear: number | null;
    }
  | { kind: "killed"; killId: string; message: string }
  | { kind: "needs-caesar" };

// Grad year is treated as a one-shot confirmation: once we successfully
// parse one, the cached value sticks. If the previous fetch left gradYear
// null (parser miss, dual-program edge case, etc.), retry hourly so we
// pick it up quickly without hammering CAESAR for users we've already
// confirmed.
const MISSING_GRAD_YEAR_RETRY_MS = 60 * 60 * 1000; // 1 hour

let cachedStatus: GateStatus = { kind: "needs-caesar" };
let initialEvaluation: Promise<GateStatus> | null = null;
const listeners = new Set<(status: GateStatus) => void>();

export function getGateStatusSync(): GateStatus {
  return cachedStatus;
}

export function isAccessAllowed(): boolean {
  return cachedStatus.kind === "unlocked";
}

export function onGateStatusChange(listener: (status: GateStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(status: GateStatus): void {
  cachedStatus = status;
  for (const fn of listeners) {
    try {
      fn(status);
    } catch (err) {
      logQuiet("access-gate.emit.listener", err);
    }
  }
}

export async function evaluateGate(): Promise<GateStatus> {
  // Kill switch checked first — overrides everything, including the HMAC
  // code path. Fires even when no profile is cached so the toast is visible
  // to logged-out paper.nu users.
  const schedule = await getRemoteSchedule();
  if (schedule.kill) {
    return { kind: "killed", killId: schedule.kill.id, message: schedule.kill.message };
  }

  const stored = await readStoredName();
  if (!stored) return { kind: "needs-caesar" };

  const code = await readStoredCode();
  if (code) {
    const ok = await isCodeValidForLastName(code, stored.lastName);
    if (ok) {
      return { kind: "unlocked", reason: "code", lastName: stored.lastName };
    }
  }

  const bucket = bucketForGradYear(stored.gradYear);
  const releaseAt = schedule.releases[bucket];
  if (Date.now() >= releaseAt) {
    return { kind: "unlocked", reason: "bucket", lastName: stored.lastName };
  }

  return {
    kind: "locked-bucket",
    releaseAt,
    bucket,
    bucketLabel: BUCKET_LABELS[bucket],
    lastName: stored.lastName,
    gradYear: stored.gradYear
  };
}

async function refreshGate(): Promise<GateStatus> {
  const status = await evaluateGate();
  emit(status);
  return status;
}

// Public: ensure we have a name cached. Triggers a CAESAR fetch when missing
// or stale. Works from any origin (background does the cross-origin fetch
// using the user's CAESAR cookies); silently no-ops if the user is not signed
// in to CAESAR. The fetch helper itself only attempts once per content-script
// session, so retrying from paper.nu is cheap.
export async function ensureNameLoaded(): Promise<void> {
  const stored = await readStoredName();
  if (stored && stored.gradYear !== null) return;
  const recentlyTried =
    !!stored && Date.now() - stored.fetchedAt < MISSING_GRAD_YEAR_RETRY_MS;
  if (recentlyTried) return;
  await fetchAndCacheUserName();
  await refreshGate();
}

export function startAccessGate(): Promise<GateStatus> {
  if (initialEvaluation) return initialEvaluation;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[ACCESS_GATE_NAME_KEY] && !changes[ACCESS_GATE_CODE_KEY]) return;
    void refreshGate();
  });

  initialEvaluation = (async () => {
    const status = await refreshGate();
    // Kick off background name fetch from CAESAR even if we have a status —
    // this populates the cache on first CAESAR load and refreshes stale data.
    //
    // Only do the fetch from the top frame. The manifest sets all_frames:true
    // and CAESAR renders its app inside #ptifrmtgtframe (and other helper
    // iframes), so without this gate every CAESAR pageload would fan out
    // multiple concurrent profile-page GETs from sibling content scripts.
    // Iframes still attach the storage listener above, so a successful
    // top-frame fetch propagates to every frame's gate via storage.onChanged.
    if (isTopFrame()) {
      void ensureNameLoaded();
    }
    return status;
  })();

  return initialEvaluation;
}

function isTopFrame(): boolean {
  try {
    return window.top === window.self;
  } catch {
    // Cross-origin top access can throw — assume not top.
    return false;
  }
}
