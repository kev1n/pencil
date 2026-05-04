import { logQuiet } from "../../shared/log";
import {
  CART_CACHE_STORAGE_KEY,
  emptyCache,
  emptyTermCart,
  type CartCache,
  type CartEntry,
  type TermCart
} from "./types";

let memoryCache: CartCache = emptyCache();
let initPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function initCartCache(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = chrome.storage.local
    .get(CART_CACHE_STORAGE_KEY)
    .then((result: Record<string, unknown>) => {
      const stored = result[CART_CACHE_STORAGE_KEY];
      if (stored && typeof stored === "object") {
        const candidate = stored as Partial<CartCache>;
        if (candidate.version === 1 && candidate.byTerm && typeof candidate.byTerm === "object") {
          memoryCache = candidate as CartCache;
        }
      }
    })
    .catch(() => undefined);

  // Cross-tab broadcast: any other context (popup, sibling tab) that mutates
  // the cache reaches us through chrome.storage.onChanged. Adopt the new
  // value into our in-memory mirror and notify listeners.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const change = changes[CART_CACHE_STORAGE_KEY];
    if (!change) return;
    const next = change.newValue as Partial<CartCache> | undefined;
    if (next && next.version === 1 && next.byTerm && typeof next.byTerm === "object") {
      memoryCache = next as CartCache;
    } else {
      memoryCache = emptyCache();
    }
    fireListeners();
  });

  return initPromise;
}

function fireListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      // Listener errors must never break the broadcast loop.
      logQuiet("cart-cache.fireListeners", err);
    }
  }
}

function persist(): void {
  void chrome.storage.local.set({ [CART_CACHE_STORAGE_KEY]: memoryCache });
  fireListeners();
}

export function readTermCart(termId: string): TermCart | null {
  return memoryCache.byTerm[termId] ?? null;
}

export function isInCart(termId: string, classNumber: string): boolean {
  return !!memoryCache.byTerm[termId]?.cart[classNumber];
}

export function isEnrolled(termId: string, classNumber: string): boolean {
  return !!memoryCache.byTerm[termId]?.enrolled[classNumber];
}

export type CartLookupHit = {
  status: "in-cart" | "enrolled";
  entry: CartEntry;
};

// Generic cache lookup. Used by the augmentations to render the right badge.
// Enrolled wins over in-cart when (somehow) both keys carry the same number.
export function lookupClassNumber(termId: string, classNumber: string): CartLookupHit | null {
  const term = memoryCache.byTerm[termId];
  if (!term) return null;
  const enrolled = term.enrolled[classNumber];
  if (enrolled) return { status: "enrolled", entry: enrolled };
  const cart = term.cart[classNumber];
  if (cart) return { status: "in-cart", entry: cart };
  return null;
}

// Secondary lookup for callers that don't yet have a 5-digit class number
// (e.g. paper-ctec chips, where the chip's identity is subject + catalog +
// section). We canonicalize subject + catalog + sectionLabel into the same
// signature on both ends.
export function lookupBySignature(
  termId: string,
  subject: string,
  catalog: string,
  sectionLabel: string
): CartLookupHit | null {
  const term = memoryCache.byTerm[termId];
  if (!term) return null;
  const want = signatureFor(subject, catalog, sectionLabel);
  for (const entry of Object.values(term.enrolled)) {
    if (signatureFor(entry.subject, entry.catalog, entry.sectionLabel) === want) {
      return { status: "enrolled", entry };
    }
  }
  for (const entry of Object.values(term.cart)) {
    if (signatureFor(entry.subject, entry.catalog, entry.sectionLabel) === want) {
      return { status: "in-cart", entry };
    }
  }
  return null;
}

function signatureFor(subject: string, catalog: string, sectionLabel: string): string {
  // Tolerate paper.nu's "111" vs CAESAR's "111-0" by normalizing both to
  // the bare-number form. Section label has two normalizations: optimistic
  // adds carry "{section}-{component}" (e.g. "1-LEC") because paper.nu
  // knows both, but the cart-page hydrator only sees the section number
  // because CAESAR's cart grid doesn't surface the component column. Strip
  // any trailing `-ALPHA` so both forms collapse to just the section
  // number, then collapse leading zeros so "01" matches "1".
  const bareCatalog = catalog.toLowerCase().replace(/-0$/, "");
  let bareSection = sectionLabel.trim().toLowerCase().replace(/-[a-z]+$/, "");
  bareSection = bareSection.replace(/^0+(\d)/, "$1");
  return `${subject.toLowerCase()}|${bareCatalog}|${bareSection}`;
}

// Optimistic write — used after our flow successfully adds a section to
// CAESAR's cart. Stamps the entry into the term's `cart` map and bumps the
// stored shape's source to "optimistic" if the term wasn't backed by a
// real cart-page reconcile yet. Cart-page reconciles always supersede.
export function recordOptimisticAdd(termId: string, entry: CartEntry): void {
  const term = memoryCache.byTerm[termId] ?? emptyTermCart();
  term.cart = { ...term.cart, [entry.classNumber]: entry };
  // If the term was already reconciled from the real cart page, keep that
  // source label — the optimistic add is an addendum that the next reconcile
  // will fold in. Otherwise mark the whole term as optimistic.
  if (term.source !== "cart-page") term.source = "optimistic";
  memoryCache.byTerm[termId] = term;
  persist();
}

// Ground-truth write — fully replaces the term's cart and enrolled lists
// with what the real CAESAR cart page reported. Removed sections drop out
// here. `refreshedAt` lets the opportunistic reconcile decide whether the
// cache is stale.
export function replaceTermFromCartPage(
  termId: string,
  cart: CartEntry[],
  enrolled: CartEntry[],
  now: number = Date.now()
): void {
  const cartMap: Record<string, CartEntry> = {};
  for (const entry of cart) cartMap[entry.classNumber] = entry;
  const enrolledMap: Record<string, CartEntry> = {};
  for (const entry of enrolled) enrolledMap[entry.classNumber] = entry;

  memoryCache.byTerm[termId] = {
    cart: cartMap,
    enrolled: enrolledMap,
    refreshedAt: now,
    source: "cart-page"
  };
  persist();
}

export function getRefreshedAt(termId: string): number {
  return memoryCache.byTerm[termId]?.refreshedAt ?? 0;
}

// Returns the most recent refresh timestamp across all known terms, or 0
// if nothing has ever been reconciled. Reconcile uses this to decide
// whether to fire the opportunistic background fetch.
export function getNewestRefresh(): number {
  let max = 0;
  for (const term of Object.values(memoryCache.byTerm)) {
    if (term.refreshedAt > max) max = term.refreshedAt;
  }
  return max;
}

export function clearCartCache(): void {
  memoryCache = emptyCache();
  persist();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
