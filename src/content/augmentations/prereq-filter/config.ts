// paper.nu DOM selectors. paper.nu doesn't expose stable hooks, so we ride
// fragile tailwind class chains the same way paper-ctec/paper-combos do.
// Multiple selector candidates are listed for resilience — the first match
// wins. If paper.nu changes its layout, update the candidate lists; the
// runner will keep trying every search/run cycle.

// paper.nu DOM selectors. Pinned to the actual markup in
// `paper.nu/src/components/search/{Search,SearchScheduleClass,SearchClass}.tsx`
// (a sibling clone lives in this repo at `paper.nu/`, gitignored). If
// paper.nu reshapes those files the selectors here need to follow.
export const PREREQ_FILTER_CONFIG = {
  searchPanel: {
    // Scroll container that holds every search-result card (one per course).
    // From Search.tsx ~L525:
    //   <div className="no-scrollbar flex-1 overflow-hidden overflow-y-scroll">
    //     {placeholder}{results}
    resultsListCandidates: [
      "div.no-scrollbar.flex-1.overflow-hidden.overflow-y-scroll"
    ],
    // SearchScheduleClass / SearchClass card outer div:
    //   "relative rounded-lg border-2 bg-opacity-60 p-2 ... group m-4 ..."
    // We match by `.group.m-4` since that pair is unique to result cards
    // within the scroll list.
    cardCandidates: [
      "div.group.m-4.rounded-lg.border-2",
      "div.group.m-4"
    ],
    // Course-code text inside a card (e.g. "COMP_SCI 211"):
    //   <p className="text-lg font-bold text-black dark:text-gray-50">
    cardCodeCandidates: [
      "p.text-lg.font-bold"
    ]
  },
  // Schedule grid card (weekly grid cells). Selector matches paper-ctec's
  // config so the badge mounts in the same DOM region.
  scheduleCard: ".schedule-grid-cols div.absolute.z-10.rounded-lg",
  // Paper-ctec mounts its "+ Cart" + analytics buttons inside this anchor
  // (a direct child of the schedule card, positioned bottom-right). We
  // prepend our badge there so it sits immediately to the left of the
  // cart button. If paper-ctec is disabled or the anchor isn't mounted
  // yet, the badge falls back to a floating absolute position.
  scheduleCardActionsAnchor: ":scope > .bc-paper-ctec-actions-anchor"
} as const;
