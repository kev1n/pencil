import type { MeetingBlock, Time } from "./types";

// timesOverlap mirrors paper.nu/src/utility/Utility.ts so two sections that
// touch boundary-to-boundary (10:00 end vs 10:00 start) are flagged as
// overlapping. Keeps our verdict consistent with the host UI.
export function timesOverlap(
  aStart: Time,
  aEnd: Time,
  bStart: Time,
  bEnd: Time
): boolean {
  const startA = aStart.h * 60 + aStart.m;
  const endA = aEnd.h * 60 + aEnd.m;
  const startB = bStart.h * 60 + bStart.m;
  const endB = bEnd.h * 60 + bEnd.m;
  return startA <= endB && startB <= endA;
}

export function blocksConflict(a: MeetingBlock, b: MeetingBlock): boolean {
  if (a.day !== b.day) return false;
  return timesOverlap(a.start, a.end, b.start, b.end);
}

// Cross-product check used during enumeration: any pair across the two
// section's flattened blocks that lands on the same day with overlapping
// minutes is a conflict.
export function sectionsConflict(
  a: { blocks: MeetingBlock[] },
  b: { blocks: MeetingBlock[] }
): boolean {
  for (const ab of a.blocks) {
    for (const bb of b.blocks) {
      if (blocksConflict(ab, bb)) return true;
    }
  }
  return false;
}
