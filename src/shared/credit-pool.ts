// Generic rolling-window credit pool, shared between seats-notes (PS pool)
// and ctec-links (CTEC pool). Each instance is bound to a chrome.storage.local
// key, an integer cap, and a window length. State is mirrored in memory and
// persisted on every mutation; cross-tab sync rides on chrome.storage.onChanged.
//
// The two concrete singletons (psCreditPool, ctecCreditPool) live at the
// bottom of this file so callers across augmentations import them from a
// single shared path instead of reaching into one another's folders.
//
// API surface mirrors what the original twin implementations exposed:
// - tryConsume(): single-tab atomic decrement when there's headroom; returns
//   next state. Mutates the in-memory mirror first, then asynchronously
//   persists via chrome.storage.local.set. Within a single tab this is
//   effectively atomic (JS event loop). Across tabs, ordering is best-effort:
//   chrome.storage.onChanged broadcasts updates, so concurrent consumers can
//   race within ~storage-flush latency. Eventually consistent — acceptable
//   for soft traffic gating, not a hard limiter.
// - peek(): observe state without mutating.
// - format(): "X of Y left, limit resets in N min" warning, only past the
//   threshold (so normal use is silent).
// - formatLimitReached(): the "limit reached" toast text shown when consume
//   blocks. Bespoke per pool so caller messaging stays unchanged.
// - clear(): reset state to a full window (used by popup "clear" buttons).
//
// All time inputs default to Date.now() so callers can pass a fixed clock
// in tests without threading it through every callsite.

import { logQuiet } from "./log";

export interface CreditPoolConfig {
  /** chrome.storage.local key. */
  key: string;
  /** max credits in the rolling window. */
  cap: number;
  /** window duration in ms. */
  windowMs: number;
  /** short identifier used in the credit-used log message. */
  name: string;
  /**
   * Format the bespoke "limit reached" toast text. Called when tryConsume
   * blocks; given the wait time until the next slot frees up.
   */
  limitReachedMessage: (waitMs: number) => string;
  /**
   * Threshold ratio (0–1). format() returns null when remaining is above
   * `floor(cap * thresholdRatio)`. Defaults to 0.3 (silent until ~30% left).
   */
  thresholdRatio?: number;
}

export interface CreditPoolState {
  remaining: number;
  /** epoch ms when the oldest credit ages out (i.e., the next slot frees). */
  resetAt: number;
}

export interface CreditPoolConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  /** Only meaningful when allowed=false: ms until the next slot frees. */
  waitMs: number;
}

export interface CreditPoolApi {
  tryConsume(owner?: string, now?: number): CreditPoolConsumeResult;
  peek(now?: number): CreditPoolState;
  format(now?: number): string | null;
  formatLimitReached(waitMs: number): string;
  clear(): void;
  readonly cap: number;
  readonly windowMs: number;
}

interface CreditStore {
  version: 1;
  credits: number[];
}

const DEFAULT_THRESHOLD_RATIO = 0.3;

export function defineCreditPool(config: CreditPoolConfig): CreditPoolApi {
  const thresholdRatio = config.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO;
  let memory: CreditStore = { version: 1, credits: [] };

  // Lazy hydrate from chrome.storage.local. Tests run in jsdom without
  // chrome present; bail out silently.
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    void chrome.storage.local
      .get(config.key)
      .then((result: Record<string, unknown>) => {
        const raw = result[config.key];
        if (raw && typeof raw === "object") {
          const candidate = raw as Partial<CreditStore>;
          if (candidate.version === 1 && Array.isArray(candidate.credits)) {
            memory = {
              version: 1,
              credits: candidate.credits.filter(
                (t): t is number => typeof t === "number"
              )
            };
          }
        }
      })
      .catch((err: unknown) => logQuiet(`credit-pool.${config.name}.init`, err));

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      const change = changes[config.key];
      if (!change) return;
      const next = change.newValue as Partial<CreditStore> | undefined;
      if (next && next.version === 1 && Array.isArray(next.credits)) {
        memory = {
          version: 1,
          credits: next.credits.filter((t): t is number => typeof t === "number")
        };
      } else {
        memory = { version: 1, credits: [] };
      }
    });
  }

  function prune(now: number): void {
    const cutoff = now - config.windowMs;
    const kept = memory.credits.filter((t) => t > cutoff);
    if (kept.length !== memory.credits.length) {
      memory.credits = kept;
    }
  }

  function persist(): void {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    // chrome APIs throw synchronously (not as a rejecting Promise) when the
    // extension context is invalidated, so the inner .catch can't see them.
    try {
      void chrome.storage.local
        .set({ [config.key]: memory })
        .catch((err: unknown) => logQuiet(`credit-pool.${config.name}.persist`, err));
    } catch (err) {
      logQuiet(`credit-pool.${config.name}.persist`, err);
    }
  }

  function notifyConsumed(remaining: number, owner: string | undefined): void {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    try {
      void chrome.runtime
        .sendMessage({
          type: "credit-used",
          pool: config.name.toLowerCase(),
          remaining,
          cap: config.cap,
          owner
        })
        .catch((err: unknown) => logQuiet(`credit-pool.${config.name}.notify`, err));
    } catch (err) {
      logQuiet(`credit-pool.${config.name}.notify`, err);
    }
  }

  function stateFromMemory(now: number): CreditPoolState {
    const used = memory.credits.length;
    const remaining = Math.max(0, config.cap - used);
    const oldestAt = memory.credits[0];
    const resetAt = oldestAt !== undefined ? oldestAt + config.windowMs : now;
    return { remaining, resetAt };
  }

  return {
    cap: config.cap,
    windowMs: config.windowMs,

    tryConsume(owner?: string, now: number = Date.now()): CreditPoolConsumeResult {
      prune(now);
      if (memory.credits.length >= config.cap) {
        const oldestAt = memory.credits[0]!;
        const resetAt = oldestAt + config.windowMs;
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          waitMs: Math.max(0, resetAt - now)
        };
      }
      memory.credits.push(now);
      persist();
      const remaining = Math.max(0, config.cap - memory.credits.length);
      const oldestAt = memory.credits[0]!;
      const resetAt = oldestAt + config.windowMs;
      notifyConsumed(remaining, owner);
      return {
        allowed: true,
        remaining,
        resetAt,
        waitMs: 0
      };
    },

    peek(now: number = Date.now()): CreditPoolState {
      prune(now);
      return stateFromMemory(now);
    },

    format(now: number = Date.now()): string | null {
      prune(now);
      const used = memory.credits.length;
      const remaining = Math.max(0, config.cap - used);
      if (remaining > Math.floor(config.cap * thresholdRatio)) return null;
      const oldestAt = memory.credits[0];
      if (oldestAt === undefined) return null;
      const refreshMs = Math.max(0, oldestAt + config.windowMs - now);
      const refreshMin = Math.max(1, Math.ceil(refreshMs / 60_000));
      return `${remaining} of ${config.cap} left, limit resets in ${refreshMin} min`;
    },

    formatLimitReached(waitMs: number): string {
      return config.limitReachedMessage(waitMs);
    },

    clear(): void {
      memory = { version: 1, credits: [] };
      persist();
    }
  };
}

// ── Concrete pools ────────────────────────────────────────────────────────

export const PS_CREDIT_CAP = 20;
export const PS_CREDIT_WINDOW_MS = 30 * 60 * 1000;

// Single-shot credit pool for CAESAR PeopleSoft work. Shared by seats-notes,
// class-search, and paper-ctec's chip cart-add so they can't burn through
// the cap independently.
export const psCreditPool = defineCreditPool({
  key: "bc-seats-notes-rate-limit-v1",
  cap: PS_CREDIT_CAP,
  windowMs: PS_CREDIT_WINDOW_MS,
  name: "PS",
  limitReachedMessage: (waitMs) => {
    const waitMin = Math.max(1, Math.ceil(waitMs / 60_000));
    return `Limit reached: ${PS_CREDIT_CAP} CAESAR loads per 30 min. Try again in ${waitMin} min.`;
  }
});

export const CTEC_CREDIT_CAP = 20;
export const CTEC_CREDIT_WINDOW_MS = 60 * 60 * 1000;

// Each batch of up to CTEC_BATCH_SIZE PeopleSoft class-page fetches consumes
// one credit. Caps total Northwestern traffic from the extension.
export const ctecCreditPool = defineCreditPool({
  key: "bc-ctec-load-credit-v1",
  cap: CTEC_CREDIT_CAP,
  windowMs: CTEC_CREDIT_WINDOW_MS,
  name: "CTEC",
  limitReachedMessage: (waitMs) => {
    const waitMin = Math.max(1, Math.ceil(waitMs / 60_000));
    return `Limit reached: ${CTEC_CREDIT_CAP} CTEC loads per hour to reduce load on Northwestern's servers. Try again in ${waitMin} min.`;
  }
});
