// Stacked AVG-pill + dashed mean-line emitter shared by chart-histogram
// and hours-density. The two charts laid out their pills with the same
// math (PILL_H=14, PILL_STEP=16, label-width clamp, x-clamp inside [PL,
// PL+innerW-pillW]); this module owns that pattern.

const SVG_NS = "http://www.w3.org/2000/svg";

export type AvgIndicator = {
  // X-pixel where the mean line lands (already interpolated by the caller).
  x: number;
  // Pill text — e.g. "AVG 5.4" or "Sp'23 5.4". Width grows to fit it.
  label: string;
  // CSS color expression (token reference). Used for both pill fill and
  // dashed mean line stroke so a pill visually owns its line.
  color: string;
};

export type AvgPillsLayout = {
  PILL_H: number;
  PILL_STEP: number;
  PL: number;
  innerW: number;
  // Y-pixel of the chart baseline (where the dashed line terminates).
  baselineY: number;
};

// Stacks pills top-down in input order. Pill #0 sits at y=0; pill #1 at
// y=PILL_STEP; etc. Each pill emits a dashed line from just below its
// own bottom edge down to `baselineY`. Skips any indicator with a
// non-finite x.
export function appendStackedAvgPills(
  doc: Document,
  svg: SVGSVGElement,
  indicators: AvgIndicator[],
  layout: AvgPillsLayout
): void {
  const { PILL_H, PILL_STEP, PL, innerW, baselineY } = layout;
  indicators.forEach((ind, slot) => {
    if (!Number.isFinite(ind.x)) return;
    const pillTop = slot * PILL_STEP;

    const meanLine = doc.createElementNS(SVG_NS, "line");
    meanLine.setAttribute("x1", String(ind.x));
    meanLine.setAttribute("x2", String(ind.x));
    meanLine.setAttribute("y1", String(pillTop + PILL_H + 1));
    meanLine.setAttribute("y2", String(baselineY));
    meanLine.style.stroke = ind.color;
    meanLine.setAttribute("stroke-width", "1.5");
    meanLine.setAttribute("stroke-dasharray", "3 3");
    svg.append(meanLine);

    const pillW = Math.max(60, ind.label.length * 5.5 + 12);
    const pillX = Math.max(
      PL,
      Math.min(PL + innerW - pillW, ind.x - pillW / 2)
    );

    const pill = doc.createElementNS(SVG_NS, "rect");
    pill.setAttribute("x", String(pillX));
    pill.setAttribute("y", String(pillTop));
    pill.setAttribute("width", String(pillW));
    pill.setAttribute("height", String(PILL_H));
    pill.setAttribute("rx", "3");
    pill.style.fill = ind.color;
    svg.append(pill);

    const pillLabel = doc.createElementNS(SVG_NS, "text");
    pillLabel.setAttribute("x", String(pillX + pillW / 2));
    pillLabel.setAttribute("y", String(pillTop + 10));
    pillLabel.setAttribute("text-anchor", "middle");
    pillLabel.setAttribute("font-size", "9");
    pillLabel.setAttribute("font-weight", "700");
    pillLabel.style.fill = "var(--bc-color-accent-on)";
    pillLabel.setAttribute("letter-spacing", "0.5");
    pillLabel.textContent = ind.label;
    svg.append(pillLabel);
  });
}
