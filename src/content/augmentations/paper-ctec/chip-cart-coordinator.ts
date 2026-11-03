// Coordinator for the per-chip "+ Cart" sub-machine on paper.nu schedule
// cards. Owns:
//   - cartStates / cartInFlight / cartResetTimers / chipSections maps
//   - the cart-cache subscription lifecycle (start/stop)
//   - the optimistic-write path into cart-cache
//
// Extracted from PaperCtecAugmentation (Wave 6a). The augmentation hands
// the coordinator a chip key + identity (params, titleHint) and the
// coordinator drives the rest. The prior synthesized-target hack — which
// wrapped an AnalyticsModalSource into a fake PaperCtecTarget with
// `card: document.body, widget: document.body` — is gone: the coordinator
// never needed those DOM refs in the first place.
//
// The augmentation supplies an `attachToWidgets(key, state, onClick)`
// callback so the coordinator can re-render whichever live widget(s)
// currently represent a key (paper.nu remounts cards on every drag/scroll).
//
// Cart-cache reads/writes flow through injected deps so this file stays
// fully testable in jsdom without chrome.storage.

import type { CtecLinkParams } from "../ctec-links/types";
import type { CartAnchorState } from "./schedule-ui";
import type { CartChipResult, ResolvedChipSection } from "./cart-flow";
import type { CartEntry, CartLookupHit } from "../../cart-cache";

const CART_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A";
const CART_SUCCESS_RESET_MS = 10_000;

export type ChipIdentity = {
  key: string;
  params: CtecLinkParams;
  titleHint: string;
};

export type ToastTone = "info" | "warn" | "success" | "error";

export type ToastOptions = {
  tone?: ToastTone;
  durationMs?: number;
  action?: { label: string; run: () => void };
};

export type ChipCartCoordinatorDeps = {
  /**
   * PS credit pool gate. tryConsume → returns whether the call may
   * proceed; format → returns the soft warning string for the success
   * toast (or null when above threshold); formatLimitReached → the toast
   * text shown when the gate blocks.
   */
  psCreditPool: {
    tryConsume(owner?: string): { allowed: boolean; waitMs: number };
    format(): string | null;
    formatLimitReached(waitMs: number): string;
  };
  showToast(message: string, options?: ToastOptions): void;
  /** Cart-flow execution (search → select → next chain). */
  addChipSectionToCart(
    params: CtecLinkParams,
    titleHint: string,
    onProgress: (message: string) => void
  ): Promise<CartChipResult>;
  /** Lazy chip → (termId, subject, catalog, sectionLabel). */
  resolveChipSection(
    params: CtecLinkParams,
    titleHint: string
  ): Promise<ResolvedChipSection | null>;
  /** Cart-cache lookup by canonical signature. */
  lookupBySignature(
    termId: string,
    subject: string,
    catalog: string,
    sectionLabel: string
  ): CartLookupHit | null;
  /** Cart-cache optimistic write. */
  recordOptimisticAdd(termId: string, entry: CartEntry): void;
  /** Cart-cache subscribe → returns unsubscribe. */
  subscribeCartCache(listener: () => void): () => void;
  /** Re-render all live chip widgets that match `key`. */
  attachToWidgets(
    key: string,
    state: CartAnchorState,
    onClick: () => void
  ): void;
};

export interface ChipCartCoordinator {
  /** Wire the cart-cache subscription. Idempotent. */
  start(): void;
  /** Tear everything down: timers, maps, subscription. */
  stop(): void;
  /**
   * Probe the cart cache for this chip and apply any in-cart/enrolled
   * state to the chip. No-op if nothing matches.
   */
  seedCartStateFromCache(chip: ChipIdentity): Promise<void>;
  /** Drives a full cart-add flow for the chip. */
  kickChipCart(chip: ChipIdentity): void;
  /** Lookup the current state for a key (for repainting from outside). */
  getState(key: string): CartAnchorState | undefined;
  /** Snapshot for tests. */
  hasInFlight(key: string): boolean;
  /**
   * Schedule a delayed flip back to idle. Not currently called by the
   * augmentation (success/already states stick until cache changes), but
   * preserved on the interface so future flows can reuse the timer.
   */
  scheduleCartReset(key: string): void;
  /** Cancel a pending cart-reset timer. */
  clearCartResetTimer(key: string): void;
}

export function createChipCartCoordinator(
  deps: ChipCartCoordinatorDeps
): ChipCartCoordinator {
  // Per-card "+ Cart" button state. Persists across the framework's
  // per-mutation re-renders so the user sees mid-flight progress and the
  // success/error result. Errors stay sticky; cache-derived in-cart /
  // enrolled states stick until the cache itself changes.
  const cartStates = new Map<string, CartAnchorState>();
  const cartInFlight = new Set<string>();
  const cartResetTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Per-chip resolved section (memoized so we only walk paper.nu's term data
  // once per key even though run() fires on every paper.nu DOM mutation).
  const chipSections = new Map<
    string,
    Promise<ResolvedChipSection | null>
  >();
  // The chip identity bundle for each key — needed so onCartCacheChanged
  // can re-issue applyCartCacheToChip against the current widget(s).
  const identities = new Map<string, ChipIdentity>();

  let unsubscribe: (() => void) | null = null;

  function rememberIdentity(chip: ChipIdentity): void {
    identities.set(chip.key, chip);
  }

  function clearCartResetTimer(key: string): void {
    const existing = cartResetTimers.get(key);
    if (existing) clearTimeout(existing);
    cartResetTimers.delete(key);
  }

  function scheduleCartReset(key: string): void {
    clearCartResetTimer(key);
    const timer = setTimeout(() => {
      cartResetTimers.delete(key);
      cartStates.delete(key);
      const chip = identities.get(key);
      if (!chip) return;
      deps.attachToWidgets(key, { kind: "idle" }, () => kickChipCart(chip));
    }, CART_SUCCESS_RESET_MS);
    cartResetTimers.set(key, timer);
  }

  function repaintChip(key: string): void {
    const state = cartStates.get(key) ?? { kind: "idle" as const };
    const chip = identities.get(key);
    if (!chip) return;
    deps.attachToWidgets(key, state, () => kickChipCart(chip));
  }

  function setCartState(key: string, state: CartAnchorState): void {
    cartStates.set(key, state);
    repaintChip(key);
  }

  function applyCartCacheToChip(
    key: string,
    resolved: ResolvedChipSection
  ): void {
    const local = cartStates.get(key);
    // Don't trample mid-flight or error states — they reflect the user's
    // most recent intent. Cache updates can only override idle/cache-sourced
    // states (success/already/enrolled).
    if (
      local &&
      local.kind !== "success" &&
      local.kind !== "already" &&
      local.kind !== "enrolled"
    ) {
      return;
    }
    const hit = deps.lookupBySignature(
      resolved.termId,
      resolved.subject,
      resolved.catalog,
      resolved.sectionLabel
    );
    if (!hit) {
      // Cache used to have it but the latest reconcile dropped it. Roll
      // back to idle.
      if (local) {
        cartStates.delete(key);
        repaintChip(key);
      }
      return;
    }
    const next: CartAnchorState =
      hit.status === "enrolled"
        ? { kind: "enrolled", classNumber: hit.entry.classNumber }
        : { kind: "already", classNumber: hit.entry.classNumber };
    if (
      local &&
      local.kind === next.kind &&
      "classNumber" in local &&
      local.classNumber === next.classNumber
    ) {
      return;
    }
    cartStates.set(key, next);
    repaintChip(key);
  }

  async function seedCartStateFromCache(chip: ChipIdentity): Promise<void> {
    rememberIdentity(chip);
    let pending = chipSections.get(chip.key);
    if (!pending) {
      pending = deps.resolveChipSection(chip.params, chip.titleHint);
      chipSections.set(chip.key, pending);
    }
    const resolved = await pending;
    if (!resolved) return;
    applyCartCacheToChip(chip.key, resolved);
  }

  function recordCartAdd(
    chip: ChipIdentity,
    classNumber: string,
    sectionLabel: string | undefined,
    termIdHint: string | undefined
  ): void {
    void (async () => {
      let resolved: ResolvedChipSection | null =
        sectionLabel && termIdHint
          ? {
              termId: termIdHint,
              subject: chip.params.subject,
              catalog: chip.params.catalogNumber,
              sectionLabel
            }
          : null;
      if (!resolved) {
        // Fall back to the lazy resolver — we still need termId and a
        // canonical sectionLabel for the cache entry.
        resolved = (await chipSections.get(chip.key)) ?? null;
        if (!resolved) {
          const pending = deps.resolveChipSection(chip.params, chip.titleHint);
          chipSections.set(chip.key, pending);
          resolved = await pending;
        }
      }
      if (!resolved) return;
      deps.recordOptimisticAdd(resolved.termId, {
        classNumber,
        subject: resolved.subject,
        catalog: resolved.catalog,
        sectionLabel: resolved.sectionLabel,
        capturedAt: Date.now()
      });
    })();
  }

  function kickChipCart(chip: ChipIdentity): void {
    rememberIdentity(chip);
    const key = chip.key;
    if (cartInFlight.has(key)) return;

    // Chip cart-add fires a CAESAR catalog search + multi-step cart chain.
    // Pull from the same seats-notes credit pool that gates class-search /
    // CAESAR cart so a user can't burn through the cap by spamming chip
    // adds on paper.nu.
    const credit = deps.psCreditPool.tryConsume("paper-ctec-chip-cart");
    if (!credit.allowed) {
      deps.showToast(deps.psCreditPool.formatLimitReached(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

    cartInFlight.add(key);
    clearCartResetTimer(key);
    setCartState(key, { kind: "adding", message: "Looking up section…" });

    void (async () => {
      const result = await deps.addChipSectionToCart(
        chip.params,
        chip.titleHint,
        (message) => setCartState(key, { kind: "adding", message })
      );

      if (result.ok) {
        setCartState(key, {
          kind: "success",
          classNumber: result.classNumber
        });
        recordCartAdd(chip, result.classNumber, result.sectionLabel, result.termId);
        const warning = deps.psCreditPool.format();
        const suffix = warning ? ` ${warning}.` : "";
        deps.showToast(
          `Added ${chip.params.subject} ${chip.params.catalogNumber} ${result.sectionLabel} (#${result.classNumber}) to your CAESAR shopping cart.${suffix}`,
          {
            tone: "success",
            durationMs: 6000,
            action: { label: "View cart", run: () => window.open(CART_URL, "_blank") }
          }
        );
      } else if (result.alreadyInCart && result.classNumber) {
        setCartState(key, {
          kind: "already",
          classNumber: result.classNumber
        });
        recordCartAdd(chip, result.classNumber, result.sectionLabel, result.termId);
        const warning = deps.psCreditPool.format();
        const suffix = warning ? ` ${warning}.` : "";
        deps.showToast(
          `${chip.params.subject} ${chip.params.catalogNumber} #${result.classNumber} is already in your CAESAR shopping cart.${suffix}`,
          {
            tone: "info",
            durationMs: 5000,
            action: { label: "View cart", run: () => window.open(CART_URL, "_blank") }
          }
        );
      } else {
        setCartState(key, { kind: "error", message: result.error });
        deps.showToast(`Couldn't add to cart: ${result.error}`, {
          tone: "error",
          durationMs: 7000
        });
      }

      cartInFlight.delete(key);
    })();
  }

  function onCartCacheChanged(): void {
    for (const [key, pending] of chipSections) {
      void pending.then((resolved) => {
        if (!resolved) return;
        applyCartCacheToChip(key, resolved);
      });
    }
  }

  return {
    start(): void {
      if (unsubscribe) return;
      unsubscribe = deps.subscribeCartCache(() => onCartCacheChanged());
    },
    stop(): void {
      unsubscribe?.();
      unsubscribe = null;
      for (const timer of cartResetTimers.values()) clearTimeout(timer);
      cartResetTimers.clear();
      cartStates.clear();
      cartInFlight.clear();
      chipSections.clear();
      identities.clear();
    },
    seedCartStateFromCache,
    kickChipCart,
    getState(key: string): CartAnchorState | undefined {
      return cartStates.get(key);
    },
    hasInFlight(key: string): boolean {
      return cartInFlight.has(key);
    },
    scheduleCartReset,
    clearCartResetTimer
  };
}

// Re-export the reset interval for tests.
export const __CART_SUCCESS_RESET_MS = CART_SUCCESS_RESET_MS;
