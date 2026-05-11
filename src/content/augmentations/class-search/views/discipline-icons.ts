// Inline SVG icons for the six Foundational Disciplines. Lucide-inspired
// 24×24 line icons rendered via createElementNS so the CSP-safe content
// script doesn't need to set innerHTML on SVG nodes. Stroke uses
// `currentColor`, so they inherit the surrounding text color (chip text /
// course-card meta) and flow with theme changes.

import { FOUNDATIONAL_DISCIPLINES } from "../types";
import type { FoundationalDisciplineCode } from "../types";

const SVG_NS = "http://www.w3.org/2000/svg";

type SvgShape = {
  tag: "path" | "circle" | "line" | "polygon";
  attrs: Record<string, string>;
};

// Each icon is a list of SVG primitives. Keep them on a 24×24 viewBox so
// scaling for chips (~12px) and card badges (~14px) stays crisp.
const ICONS: Record<FoundationalDisciplineCode, SvgShape[]> = {
  // Atom — small nucleus + three orbital ellipses (lucide `atom`).
  NS: [
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "1.2", fill: "currentColor", stroke: "none" } },
    { tag: "path", attrs: { d: "M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" } },
    { tag: "path", attrs: { d: "M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" } }
  ],
  // Bar chart — three ascending bars (lucide `bar-chart-3`).
  EDR: [
    { tag: "path", attrs: { d: "M3 3v18h18" } },
    { tag: "path", attrs: { d: "M18 17V9" } },
    { tag: "path", attrs: { d: "M13 17V5" } },
    { tag: "path", attrs: { d: "M8 17v-3" } }
  ],
  // Two-person group (lucide `users-round`).
  SBS: [
    { tag: "path", attrs: { d: "M18 21a8 8 0 0 0-16 0" } },
    { tag: "circle", attrs: { cx: "10", cy: "8", r: "5" } },
    { tag: "path", attrs: { d: "M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" } }
  ],
  // Classical column / landmark (lucide `landmark`).
  HS: [
    { tag: "line", attrs: { x1: "3", x2: "21", y1: "22", y2: "22" } },
    { tag: "line", attrs: { x1: "6", x2: "6", y1: "18", y2: "11" } },
    { tag: "line", attrs: { x1: "10", x2: "10", y1: "18", y2: "11" } },
    { tag: "line", attrs: { x1: "14", x2: "14", y1: "18", y2: "11" } },
    { tag: "line", attrs: { x1: "18", x2: "18", y1: "18", y2: "11" } },
    { tag: "polygon", attrs: { points: "12 2 20 7 4 7" } }
  ],
  // Balance scale (lucide `scale`).
  EET: [
    { tag: "path", attrs: { d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" } },
    { tag: "path", attrs: { d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" } },
    { tag: "path", attrs: { d: "M7 21h10" } },
    { tag: "path", attrs: { d: "M12 3v18" } },
    { tag: "path", attrs: { d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" } }
  ],
  // Open book (lucide `book-open`).
  LA: [
    { tag: "path", attrs: { d: "M12 7v14" } },
    { tag: "path", attrs: { d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" } }
  ]
};

export function renderDisciplineIcon(
  doc: Document,
  code: FoundationalDisciplineCode
): HTMLSpanElement {
  const fd = FOUNDATIONAL_DISCIPLINES.find((f) => f.code === code);
  const label = fd?.label ?? code;

  // Wrap in <span> so the HTML `title` attribute makes the full bounding
  // box a tooltip target. SVG <title> children only fire when the cursor
  // is over a stroked pixel, which is barely-usable for small line icons.
  const wrap = doc.createElement("span");
  wrap.className = "bc-cs-fd-icon-wrap";
  wrap.title = label;
  wrap.dataset.fd = code;

  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-label", label);
  svg.setAttribute("role", "img");
  svg.classList.add("bc-cs-fd-icon");

  const titleEl = doc.createElementNS(SVG_NS, "title");
  titleEl.textContent = label;
  svg.appendChild(titleEl);

  for (const shape of ICONS[code]) {
    const el = doc.createElementNS(SVG_NS, shape.tag);
    for (const [k, v] of Object.entries(shape.attrs)) {
      el.setAttribute(k, v);
    }
    svg.appendChild(el);
  }

  wrap.appendChild(svg);
  return wrap;
}
