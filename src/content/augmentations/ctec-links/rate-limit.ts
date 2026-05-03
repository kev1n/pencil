const STORAGE_KEY = "bc-ctec-load-credit-v1";

export const CTEC_CREDIT_LIMIT = 20;
export const CTEC_CREDIT_WINDOW_MS = 60 * 60 * 1000;
export const CTEC_BATCH_SIZE = 3;

type CreditStore = {
  version: 1;
  credits: number[];
};

let memory: CreditStore = { version: 1, credits: [] };

void chrome.storage.local
  .get(STORAGE_KEY)
  .then((result: Record<string, unknown>) => {
    const raw = result[STORAGE_KEY];
    if (raw && typeof raw === "object") {
      const candidate = raw as Partial<CreditStore>;
      if (candidate.version === 1 && Array.isArray(candidate.credits)) {
        memory = {
          version: 1,
          credits: candidate.credits.filter((t): t is number => typeof t === "number")
        };
      }
    }
  });

function prune(now: number): void {
  const cutoff = now - CTEC_CREDIT_WINDOW_MS;
  const kept = memory.credits.filter((t) => t > cutoff);
  if (kept.length !== memory.credits.length) {
    memory.credits = kept;
  }
}

// Each batch of up to CTEC_BATCH_SIZE PeopleSoft class-page fetches consumes
// one credit. Caps total Northwestern traffic from the extension.
export function tryConsumeCtecCredit(
  now: number
): { ok: true } | { ok: false; waitMs: number } {
  prune(now);
  if (memory.credits.length >= CTEC_CREDIT_LIMIT) {
    const oldestAt = memory.credits[0]!;
    return { ok: false, waitMs: Math.max(0, oldestAt + CTEC_CREDIT_WINDOW_MS - now) };
  }
  memory.credits.push(now);
  void chrome.storage.local.set({ [STORAGE_KEY]: memory });
  return { ok: true };
}

export function buildCtecCreditToastMessage(waitMs: number): string {
  const waitMin = Math.max(1, Math.ceil(waitMs / 60_000));
  return `Limit reached: ${CTEC_CREDIT_LIMIT} CTEC loads per hour to reduce load on Northwestern's servers. Try again in ${waitMin} min.`;
}

// Shown when a CTEC fetch fails (timeout, transport error, server error).
// Points the user at CAESAR directly so they can finish what they were doing
// without us, and includes the cookie-clear escape hatch for the most common
// stuck-state we've seen.
export const CTEC_ERROR_TOAST_MESSAGE =
  "CTEC load failed. Try opening https://caesar.ent.northwestern.edu/ yourself. If it's stuck on infinite loading, clear your cookies for the site.";
