// Small drawn control icons: a 16-unit grid, 1.5 stroke, round caps and
// joins, `currentColor` ink. Used wherever a control used to carry a text
// glyph or an emoji (arrows, the pin, the kebab). The picture icons
// (seasons, faces) live in icons.ts.

const SVG_NS = "http://www.w3.org/2000/svg";

export type UiIconName =
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "arrow-left"
  | "arrow-up-right"
  | "check"
  | "plus"
  | "close"
  | "dots"
  | "pin"
  | "refresh"
  | "download"
  | "alert";

type Shape = { d?: string; dots?: Array<[number, number]> };

const SHAPES: Record<UiIconName, Shape> = {
  "chevron-left": { d: "M9.75 3.75 5.5 8l4.25 4.25" },
  "chevron-right": { d: "M6.25 3.75 10.5 8l-4.25 4.25" },
  "chevron-down": { d: "M3.75 6.25 8 10.5l4.25-4.25" },
  "arrow-left": { d: "M13 8H3.5M7.25 4 3.25 8l4 4" },
  "arrow-up-right": { d: "M5 11 11 5M6 5h5v5" },
  check: { d: "M3.25 8.5 6.5 11.5l6.25-7" },
  plus: { d: "M8 3.25v9.5M3.25 8h9.5" },
  close: { d: "M4 4l8 8M12 4l-8 8" },
  dots: { dots: [[3.5, 8], [8, 8], [12.5, 8]] },
  // A push pin: head, body, point.
  pin: { d: "M5.5 2.75h5M6.25 2.75v4L4.5 9.25h7L9.75 6.75v-4M8 9.25v4" },
  refresh: { d: "M12.75 8a4.75 4.75 0 1 1-1.5-3.45M12.75 3v2.5h-2.5" },
  download: { d: "M8 2.75v7.5M4.75 7.25 8 10.5l3.25-3.25M3.25 13.25h9.5" },
  alert: { d: "M8 5.5v3.25M8 11.1v.05M7.1 2.9 1.9 11.8a1 1 0 0 0 .9 1.5h10.4a1 1 0 0 0 .9-1.5L8.9 2.9a1 1 0 0 0-1.8 0Z" }
};

export function uiIcon(doc: Document, name: UiIconName, size = 14): SVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("bc-ui-icon");

  const shape = SHAPES[name];
  if (shape.d) {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", shape.d);
    svg.appendChild(path);
  }
  for (const [cx, cy] of shape.dots ?? []) {
    const dot = doc.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    dot.setAttribute("r", "1.1");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    svg.appendChild(dot);
  }
  return svg;
}
