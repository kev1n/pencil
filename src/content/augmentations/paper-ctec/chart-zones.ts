// Discrete colored bands behind the trend chart, one per integer step on
// the y-axis. Lets users compare two courses at a glance: a class trending
// in the 4–5 zone and one in the 2–3 zone are visually distinct even if
// their auto-scaled deltas would otherwise look identical.
//
// Zone fills are emitted as inline SVG `style="fill: var(--bc-color-trend-zone-N)"`
// so the tier colors flow with the active theme + dark mirror automatically.
// No per-attribute CSS overrides needed — the variable swap in tokens.ts
// is the only knob.

export type ChartZone = { from: number; to: number; fill: string };

// 5 tiers from worst (red) to best (green). Used twice: once forward for
// rating trends (low rating = red), once reversed for hours trends (high
// hours = red). The string is a CSS variable reference; tokens.ts owns
// the actual color values per theme.
const ZONE_TIERS: readonly string[] = [
  "var(--bc-color-trend-zone-1)",
  "var(--bc-color-trend-zone-2)",
  "var(--bc-color-trend-zone-3)",
  "var(--bc-color-trend-zone-4)",
  "var(--bc-color-trend-zone-5)"
] as const;

export const RATING_TREND_ZONES: ChartZone[] = ZONE_TIERS.map((fill, i) => ({
  from: 1 + i,
  to: 2 + i,
  fill
}));

export const HOURS_TREND_ZONES: ChartZone[] = [...ZONE_TIERS]
  .reverse()
  .map((fill, i) => ({ from: i * 4, to: (i + 1) * 4, fill }));

// Renders a sequence of <rect> bands inside the plot area. Caller passes
// the inner-plot x bounds and a yAt() that maps a y-value to pixels so
// the same helper works regardless of the chart's padding choices.
//
// Fills are set on `style.fill` (not the SVG `fill` attribute) so CSS
// `var(...)` references resolve via the cascade — SVG presentation
// attributes don't compute custom-property references in all engines.
export function appendTrendZones(
  doc: Document,
  parent: SVGElement,
  zones: ChartZone[],
  xLeft: number,
  xRight: number,
  yAt: (value: number) => number
): void {
  const SVG_NS = "http://www.w3.org/2000/svg";
  for (const zone of zones) {
    const yTop = yAt(zone.to);
    const yBottom = yAt(zone.from);
    const rect = doc.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(xLeft));
    rect.setAttribute("y", String(Math.min(yTop, yBottom)));
    rect.setAttribute("width", String(xRight - xLeft));
    rect.setAttribute("height", String(Math.abs(yBottom - yTop)));
    rect.style.fill = zone.fill;
    parent.append(rect);
  }
}
