// Discrete colored bands behind the trend chart, one per integer step on
// the y-axis. Lets users compare two courses at a glance: a class trending
// in the 4–5 zone and one in the 2–3 zone are visually distinct even if
// their auto-scaled deltas would otherwise look identical.
//
// Light-mode rgba strings are written into the SVG via setAttribute so
// dark-mode CSS overrides can match them exactly (see styles/modal-charts.ts
// and styles/cards.ts). Keep the strings here in lockstep with those
// selectors — no spaces inside the rgba(), and the same alpha values.

export type ChartZone = { from: number; to: number; fill: string };

// 5 tiers from worst (red) to best (green). Used twice: once forward for
// rating trends (low rating = red), once reversed for hours trends (high
// hours = red).
const ZONE_TIERS = [
  "rgba(220,38,38,0.08)",
  "rgba(234,88,12,0.08)",
  "rgba(202,138,4,0.08)",
  "rgba(101,163,13,0.10)",
  "rgba(22,163,74,0.10)"
] as const;

export const RATING_TREND_ZONES: ChartZone[] = ZONE_TIERS.map(
  (fill, i) => ({ from: 1 + i, to: 2 + i, fill })
);

export const HOURS_TREND_ZONES: ChartZone[] = [...ZONE_TIERS]
  .reverse()
  .map((fill, i) => ({ from: i * 4, to: (i + 1) * 4, fill }));

// Dark-mode replacements, keyed by the light-mode fill string. Used by
// CSS rules that select on the exact attribute value.
export const ZONE_DARK_OVERRIDES: Record<string, string> = {
  "rgba(220,38,38,0.08)": "rgba(248,113,113,0.16)",
  "rgba(234,88,12,0.08)": "rgba(251,146,60,0.16)",
  "rgba(202,138,4,0.08)": "rgba(250,204,21,0.16)",
  "rgba(101,163,13,0.10)": "rgba(132,204,22,0.18)",
  "rgba(22,163,74,0.10)": "rgba(74,222,128,0.18)"
};

// Emits CSS rules that flip every zone fill to its dark-mode equivalent
// for the given SVG class selector (e.g. `.bc-paper-ctec-modal-trend-svg`).
// Style modules call this so the override list stays generated from
// ZONE_DARK_OVERRIDES — adding or tweaking a tier here updates both
// surfaces automatically.
export function trendZoneDarkRules(svgSelector: string): string {
  return Object.entries(ZONE_DARK_OVERRIDES)
    .map(
      ([light, dark]) =>
        `.dark ${svgSelector} [fill="${light}"] { fill: ${dark}; }`
    )
    .join("\n    ");
}

// Renders a sequence of <rect> bands inside the plot area. Caller passes
// the inner-plot x bounds and a yAt() that maps a y-value to pixels so
// the same helper works regardless of the chart's padding choices.
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
    rect.setAttribute("fill", zone.fill);
    parent.append(rect);
  }
}
