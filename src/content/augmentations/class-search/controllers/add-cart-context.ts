// Build the per-click `AddToCartContext` the cart-add controller consumes.
// Resolves the CAESAR class number through the live-data store, folds the
// cart-add response back into the live cache, and exposes a hook for the
// "switch to Classic CAESAR after manual completion" path.
//
// Extracted from augmentation.ts (Wave 5g).

import {
  matchCaesarGroup,
  matchCaesarSection
} from "../caesar-search";
import type { PaperSection } from "../paper-data";
import type { MountedState, ResultRow, TabId } from "../types";
import type { AddToCartContext } from "./add-to-cart";
import { makeLiveCacheKey } from "./live-data-painter";

export function createAddCartContext(
  state: MountedState,
  row: ResultRow,
  section: PaperSection,
  button: HTMLButtonElement,
  switchTab: (id: TabId) => void
): AddToCartContext {
  const { liveDataPainter } = state;
  const liveKey = makeLiveCacheKey(state.filters.termId, row);
  return {
    termId: state.filters.termId,
    institution: state.institution,
    row,
    section,
    resolveClassNumber: async () => {
      // We need the 5-digit CAESAR class number for the cart-add chain.
      // Resolve via cache (memory → disk → fetch).
      const card = button.closest<HTMLElement>(".bc-cs-course");
      const liveResult = await liveDataPainter.ensureLiveData(row, card);
      if (!liveResult) return null;
      const group = matchCaesarGroup(liveResult.groups, row.course.catalog);
      if (!group) return null;
      return matchCaesarSection(group, section.section, section.component)?.classNumber ?? null;
    },
    mergeAndRepaint: (searchGroups) => {
      state.liveData.mergeLiveCache(liveKey, searchGroups);
      const card = button.closest<HTMLElement>(".bc-cs-course");
      const merged = state.liveData.get(liveKey);
      if (card && merged?.status === "ready" && merged.result) {
        liveDataPainter.applyLiveDataToCard(row, card, merged.result);
      }
    },
    openClassicTab: () => switchTab("classic")
  };
}
