// Vertical linearGradient `<defs>` boilerplate shared by chart-histogram
// (rating distribution overlay) and hours-density (workload curve fill).
//
// Returns the generated id string so callers can reference it in
// `fill="url(#<id>)"` on the path.

const SVG_NS = "http://www.w3.org/2000/svg";

export type VerticalGradientOptions = {
  // Used as the `id` prefix; a 6-char random suffix is appended to keep
  // multiple gradients on the same page unique.
  idPrefix: string;
  // CSS color expression (e.g. "var(--bc-color-accent-fill-45)").
  topColor: string;
  bottomColor: string;
};

// Appends a vertical linearGradient to a freshly-created <defs> element
// (which is itself appended to `svg`). Returns the id so the caller can
// reference it. Two stops at 0% and 100%.
export function appendVerticalGradient(
  doc: Document,
  svg: SVGSVGElement,
  opts: VerticalGradientOptions
): string {
  const id = `${opts.idPrefix}-${Math.random().toString(36).slice(2, 8)}`;

  const defs = doc.createElementNS(SVG_NS, "defs");
  const grad = doc.createElementNS(SVG_NS, "linearGradient");
  grad.setAttribute("id", id);
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "0");
  grad.setAttribute("y2", "1");

  const stopTop = doc.createElementNS(SVG_NS, "stop");
  stopTop.setAttribute("offset", "0%");
  stopTop.style.stopColor = opts.topColor;

  const stopBot = doc.createElementNS(SVG_NS, "stop");
  stopBot.setAttribute("offset", "100%");
  stopBot.style.stopColor = opts.bottomColor;

  grad.append(stopTop, stopBot);
  defs.append(grad);
  svg.append(defs);

  return id;
}
