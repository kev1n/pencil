// =============================================================================
// Responsive breakpoints. Exposed as TypeScript constants — not CSS custom
// properties — because `@media (max-width: var(--x))` is invalid CSS, and
// every style module in this repo is a template-string function we can
// interpolate into directly.
//
// Usage:
//   `@media ${maxWidth("xl")} { ... }`
//
// The five tiers are the values that already appear in the codebase, named
// loosely after the device class they collapse around. Add a new tier here
// rather than hardcoding a px value in any single styles file.
// =============================================================================

export const BREAKPOINTS = {
  sm: 640,
  md: 720,
  lg: 900,
  xl: 1000,
  xxl: 1100,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

export function maxWidth(key: BreakpointKey): string {
  return `(max-width: ${BREAKPOINTS[key]}px)`;
}
