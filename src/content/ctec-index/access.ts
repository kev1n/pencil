// CTEC-access state machine.
//
// Northwestern flips CTEC access either way: revoked for students who
// skipped CTECs in the prior collection period, restored once they
// complete them. CAESAR signals revocation by routing every CTEC URL to
// a `NW_CTEC_MSG_FL` message panel. This module caches the verdict in
// chrome.storage.local so we short-circuit later CTEC paths without
// re-hitting the network — but every verdict expires after
// ACCESS_VERDICT_TTL_MS, so neither side gets stuck on a stale call.
//
// Three states:
//   • "denied" — auto-expires after ACCESS_VERDICT_TTL_MS so a
//     reauthorized student recovers without manual intervention. The
//     popup's "Clear CTEC cache" button is still the immediate escape.
//   • "confirmed" — auto-expires after the same TTL; if the student
//     loses access mid-quarter, the next click forces a fresh probe.
//   • "unknown" — default and post-expiry; the access-probe in
//     `access-probe.ts` resolves it on the next CTEC fetch.

import { logDebug, logQuiet } from "../../shared/log";

import {
  ACCESS_VERDICT_TTL_MS,
  CTEC_ACCESS_CHECK_ENABLED,
  CTEC_ACCESS_STORAGE_KEY,
  type CtecAccessStatus
} from "./access-shared";

export { CTEC_ACCESS_STORAGE_KEY, type CtecAccessStatus };

type StoredState =
  | { kind: "denied"; deniedAt: number }
  | { kind: "confirmed"; confirmedAt: number };

let memoryState: StoredState | null = null;

void chrome.storage.local
  .get(CTEC_ACCESS_STORAGE_KEY)
  .then((result: Record<string, unknown>) => {
    memoryState = parseStored(result[CTEC_ACCESS_STORAGE_KEY]);
    logDebug("ctec-access:hydrate", "loaded from storage", { state: memoryState });
  })
  .catch((err: unknown) => logQuiet("ctec-access:hydrate", err));

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!(CTEC_ACCESS_STORAGE_KEY in changes)) return;
  memoryState = parseStored(changes[CTEC_ACCESS_STORAGE_KEY]?.newValue);
});

function parseStored(raw: unknown): StoredState | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<StoredState>;
  if (candidate.kind === "confirmed" && typeof candidate.confirmedAt === "number") {
    return { kind: "confirmed", confirmedAt: candidate.confirmedAt };
  }
  if (candidate.kind === "denied" && typeof candidate.deniedAt === "number") {
    return { kind: "denied", deniedAt: candidate.deniedAt };
  }
  return null;
}

export function getCtecAccessStatus(): CtecAccessStatus {
  if (!CTEC_ACCESS_CHECK_ENABLED) return "confirmed";
  if (!memoryState) return "unknown";
  // Auto-expire either verdict without mutating storage; the next mark*
  // call refreshes the timestamp.
  const timestamp =
    memoryState.kind === "denied" ? memoryState.deniedAt : memoryState.confirmedAt;
  if (Date.now() - timestamp > ACCESS_VERDICT_TTL_MS) return "unknown";
  return memoryState.kind;
}

export function isCtecAccessDenied(): boolean {
  if (!CTEC_ACCESS_CHECK_ENABLED) return false;
  if (memoryState?.kind !== "denied") return false;
  return Date.now() - memoryState.deniedAt <= ACCESS_VERDICT_TTL_MS;
}

export function markCtecAccessDenied(reason: string): void {
  if (!CTEC_ACCESS_CHECK_ENABLED) return;
  if (
    memoryState?.kind === "denied" &&
    Date.now() - memoryState.deniedAt <= ACCESS_VERDICT_TTL_MS
  ) {
    return;
  }
  logDebug("ctec-access:denied", "marking denied (from)", reason);
  memoryState = { kind: "denied", deniedAt: Date.now() };
  void chrome.storage.local.set({ [CTEC_ACCESS_STORAGE_KEY]: memoryState });
}

export function markCtecAccessConfirmed(reason: string): void {
  if (!CTEC_ACCESS_CHECK_ENABLED) return;
  // A live denied verdict still wins — only an expired one (treated as
  // "unknown" by getCtecAccessStatus) gets overwritten by confirmed.
  if (
    memoryState?.kind === "denied" &&
    Date.now() - memoryState.deniedAt <= ACCESS_VERDICT_TTL_MS
  ) {
    return;
  }
  if (
    memoryState?.kind === "confirmed" &&
    Date.now() - memoryState.confirmedAt <= ACCESS_VERDICT_TTL_MS
  ) {
    return;
  }
  logDebug("ctec-access:confirmed", "marking confirmed (from)", reason);
  memoryState = { kind: "confirmed", confirmedAt: Date.now() };
  void chrome.storage.local.set({ [CTEC_ACCESS_STORAGE_KEY]: memoryState });
}

// Detects the "You are not authorized to access CTECs" panel. Two
// URL-agnostic signals — either is sufficient: the literal copy in the
// body, or `Page = NW_CTEC_MSG_FL` in pt_pageinfo.
export function isCtecUnauthorizedHtml(html: string): boolean {
  if (html.toLowerCase().includes("not authorized to access ctecs")) return true;
  return extractPeopleSoftPageId(html) === "NW_CTEC_MSG_FL";
}

export function extractPeopleSoftPageId(html: string): string | null {
  const match = html.match(/pt_pageinfo\.setAttribute\(\s*['"]Page['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
  return match?.[1] ?? null;
}
