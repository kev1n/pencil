// Re-exports d3-scale primitives + the local `niceStep` helper used by the
// percent y-axis on chart-histogram + hours-density. Keeping the helper next
// to scaleLinear so callers import a single module.

export { scaleLinear } from "d3-scale";

// Picks the smallest step from `candidates` such that `max / step <= 4`
// (so the y-axis lands at no more than 5 ticks: 0, step, 2*step, 3*step,
// 4*step). Falls through to the last candidate when even it can't keep
// the tick count low enough — distributions can't physically exceed 100%
// so the [2, 5, 10, 20, 25, 50] ladder is sufficient in practice.
export function niceStep(max: number, candidates: number[]): number {
  for (const t of candidates) if (max / t <= 4) return t;
  return candidates[candidates.length - 1] ?? 1;
}

// Default percent-axis ladder used by both histogram + hours-density.
export const PERCENT_AXIS_STEPS = [2, 5, 10, 20, 25, 50] as const;
