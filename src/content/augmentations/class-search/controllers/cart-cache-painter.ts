// Cart-cache painter: bridges the shared `cart-cache` module to the
// in-DOM Add buttons rendered by the augmentation.
//
//   • `applyForSection` — paint a single button using a class-number-keyed
//     lookup when live data is available, falling back to a (subject,
//     catalog, sectionLabel) signature otherwise.
//   • `applyBySigKey` — re-paint a single button from its `data-sigKey`,
//     used when freshly-resolved live data unlocks the canonical lookup.
//   • `repaintAll` — sweep the registry, used by the cart-cache subscribe
//     callback.
//
// Extracted from augmentation.ts (Wave 5g). The painter is mount-scoped
// (it closes over the live-data store + filters), but holds no state of
// its own — every dependency comes through the constructor closure.

import {
  lookupBySignature,
  lookupClassNumber,
  type CartLookupHit
} from "../../../cart-cache";
import type { CartButtonRegistry } from "../cart-button-registry";
import { matchCaesarGroup, matchCaesarSection } from "../caesar-search";
import type { LiveDataStore } from "../live-data-store";
import type { PaperSection } from "../paper-data";
import type { ResultRow } from "../types";

export interface CartCachePainter {
  /** Paint the initial cart-cache state for `(row, section)`'s Add button. */
  applyForSection(
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): void;
  /** Re-paint a single Add button using the sigKey stored on its dataset. */
  applyBySigKey(button: HTMLButtonElement): void;
  /** Sweep the registry, repainting every mounted Add button. */
  repaintAll(): void;
}

export type CartCachePainterDeps = {
  /** Returns the active term id at lookup time. */
  getTermId(): string;
  liveData: LiveDataStore;
  /** Build the live-cache key for `(termId, row)`. */
  liveCacheKey(row: ResultRow): string;
  cartButtons: CartButtonRegistry;
};

export function createCartCachePainter(deps: CartCachePainterDeps): CartCachePainter {
  function lookup(
    row: ResultRow,
    section: PaperSection
  ): CartLookupHit | null {
    const termId = deps.getTermId();
    // Prefer the resolved CAESAR class number (live data), since it's the
    // canonical key the cache uses. If we haven't loaded live data yet,
    // fall back to a paper.nu-derived signature.
    const live = deps.liveData.get(deps.liveCacheKey(row));
    if (live?.status === "ready" && live.result) {
      const group = matchCaesarGroup(live.result.groups, row.course.catalog);
      const caesarSection = group
        ? matchCaesarSection(group, section.section, section.component)
        : null;
      if (caesarSection) {
        return lookupClassNumber(termId, caesarSection.classNumber);
      }
    }
    return lookupBySignature(
      termId,
      row.course.subject,
      row.course.catalog,
      `${section.section}-${section.component}`
    );
  }

  function applyForSection(
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): void {
    const hit = lookup(row, section);
    deps.cartButtons.applyCartStateToButton(button, hit ? hit.status : null);
  }

  function applyBySigKey(button: HTMLButtonElement): void {
    const sigKey = button.dataset.sigKey ?? "";
    const parsed = deps.cartButtons.parseSigKey(sigKey);
    if (!parsed) return;
    const hit = lookupBySignature(
      parsed.termId,
      parsed.subject,
      parsed.catalog,
      parsed.sectionLabel
    );
    deps.cartButtons.applyCartStateToButton(button, hit ? hit.status : null);
  }

  function repaintAll(): void {
    deps.cartButtons.repaintAll((sigKey) => {
      const parsed = deps.cartButtons.parseSigKey(sigKey);
      if (!parsed) return null;
      const hit = lookupBySignature(
        parsed.termId,
        parsed.subject,
        parsed.catalog,
        parsed.sectionLabel
      );
      return hit ? hit.status : null;
    });
  }

  return { applyForSection, applyBySigKey, repaintAll };
}
