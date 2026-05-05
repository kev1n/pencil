import { html, svg, type SVGTemplateResult, type TemplateResult } from "lit-html";

import { PAPER_CTEC_CONFIG } from "./config";

export type IconName =
  | "alert"
  | "book"
  | "cap"
  | "cart"
  | "chart"
  | "check"
  | "clock"
  | "lock"
  | "plus"
  | "spark"
  | "stack"
  | "star"
  | "user";

export function stopPropagation(event: Event): void {
  event.stopPropagation();
}

export function preventAndStop(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

export function guardNestedInteraction(element: HTMLElement): void {
  element.addEventListener("pointerdown", stopPropagation);
  element.addEventListener("click", stopPropagation);
  element.addEventListener("keydown", stopPropagation);
}

// Attaches a hover/focus tooltip to `host`. Styling lives in the shared
// `.bc-paper-ctec-modal-tip` rule so every callsite gets the same popup.
// `align: "right"` anchors the tooltip's right edge to the host (use when
// the host sits on the right side of its container so the tooltip doesn't
// overflow off-screen).
export function attachTooltip(
  doc: Document,
  host: HTMLElement,
  text: string,
  options?: { align?: "left" | "right" }
): void {
  host.classList.add("bc-paper-ctec-modal-tip-host");
  const tip = doc.createElement("span");
  tip.className = `bc-paper-ctec-modal-tip${
    options?.align === "right" ? " is-right" : ""
  }`;
  tip.textContent = text;
  host.append(tip);
}

export function createRatingStars(doc: Document, value: number): HTMLElement {
  const stars = doc.createElement("div");
  stars.className = "bc-paper-ctec-stars";
  stars.title = `${value.toFixed(2)} / ${PAPER_CTEC_CONFIG.aggregate.ratingScaleMax}`;

  const normalized = Math.max(
    0,
    Math.min(PAPER_CTEC_CONFIG.aggregate.ratingScaleMax, value)
  );

  for (let index = 0; index < PAPER_CTEC_CONFIG.aggregate.ratingScaleMax; index++) {
    const star = doc.createElement("span");
    star.className = "bc-paper-ctec-star";

    const base = createIcon("star", { filled: true });
    base.classList.add("bc-paper-ctec-star-base");

    const fill = doc.createElement("span");
    fill.className = "bc-paper-ctec-star-fill";
    fill.style.width = `${Math.max(0, Math.min(1, normalized - index)) * 100}%`;
    fill.append(createIcon("star", { filled: true }));

    star.append(base, fill);
    stars.append(star);
  }

  return stars;
}

// Vector-shape table shared by both the imperative `createIcon()` (for
// modal / status-bar / auth-modal call sites that still build SVGs by hand)
// and the lit-html `iconTemplate()` (for migrated chip render paths).
type IconShape = {
  paths: string[];
  circles?: Array<{ cx: string; cy: string; r: string }>;
};

const ICON_SHAPES: Record<IconName, IconShape> = {
  alert: {
    paths: [
      "M12 9v4",
      "M12 17h.01",
      "M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
    ]
  },
  book: {
    paths: [
      "M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 0 4 22z",
      "M8 4v16"
    ]
  },
  check: { paths: ["M5 12.5 10 17l9-10"] },
  plus: { paths: ["M12 5v14", "M5 12h14"] },
  cart: {
    paths: ["M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6.5"],
    circles: [
      { cx: "10", cy: "20", r: "1.2" },
      { cx: "17", cy: "20", r: "1.2" }
    ]
  },
  cap: {
    paths: [
      "m3 10 9-4 9 4-9 4-9-4Z",
      "M7 12v4.5c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5V12",
      "M21 10v6"
    ]
  },
  chart: {
    paths: ["M4 19h16", "M7 16V9", "M12 16V5", "M17 16v-4"]
  },
  clock: {
    paths: ["M12 6v6l4 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"]
  },
  lock: { paths: ["M7 11V8a5 5 0 0 1 10 0v3", "M5 11h14v10H5z"] },
  spark: {
    paths: ["m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z"]
  },
  stack: {
    paths: [
      "m12 4 8 4-8 4-8-4 8-4Z",
      "m4 12 8 4 8-4",
      "m4 16 8 4 8-4"
    ]
  },
  star: {
    paths: [
      "m12 3.5 2.7 5.47 6.03.88-4.36 4.25 1.03 6.01L12 17.9l-5.4 2.84 1.03-6.01L3.27 9.85l6.03-.88Z"
    ]
  },
  user: {
    paths: ["M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", "M5 20a7 7 0 0 1 14 0"]
  }
};

export function createIcon(name: IconName, options?: { filled?: boolean }): SVGElement {
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgEl.setAttribute("viewBox", "0 0 24 24");
  svgEl.setAttribute("fill", options?.filled ? "currentColor" : "none");
  svgEl.setAttribute("stroke", "currentColor");
  svgEl.setAttribute("stroke-linecap", "round");
  svgEl.setAttribute("stroke-linejoin", "round");
  svgEl.setAttribute("aria-hidden", "true");

  const shape = ICON_SHAPES[name];
  for (const d of shape.paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svgEl.appendChild(path);
  }
  if (shape.circles) {
    for (const c of shape.circles) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", c.cx);
      circle.setAttribute("cy", c.cy);
      circle.setAttribute("r", c.r);
      svgEl.appendChild(circle);
    }
  }

  return svgEl;
}

// lit-html SVG template equivalent of `createIcon`. Pulls from the same
// ICON_SHAPES table so the two paths can never drift.
export function iconTemplate(
  name: IconName,
  options?: { filled?: boolean }
): SVGTemplateResult {
  const shape = ICON_SHAPES[name];
  return svg`<svg
    viewBox="0 0 24 24"
    fill=${options?.filled ? "currentColor" : "none"}
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >${shape.paths.map((d) => svg`<path d=${d}></path>`)}${
    shape.circles?.map((c) => svg`<circle cx=${c.cx} cy=${c.cy} r=${c.r}></circle>`) ?? ""
  }</svg>`;
}

// lit-html equivalent of `createRatingStars`.
export function ratingStarsTemplate(value: number): TemplateResult {
  const max = PAPER_CTEC_CONFIG.aggregate.ratingScaleMax;
  const normalized = Math.max(0, Math.min(max, value));
  const title = `${value.toFixed(2)} / ${max}`;

  const stars = [];
  for (let index = 0; index < max; index++) {
    const fillPct = Math.max(0, Math.min(1, normalized - index)) * 100;
    stars.push(html`<span class="bc-paper-ctec-star"
      >${starIconTemplate("bc-paper-ctec-star-base")}<span
        class="bc-paper-ctec-star-fill"
        style=${`width: ${fillPct}%`}
        >${starIconTemplate()}</span
      ></span
    >`);
  }

  return html`<div class="bc-paper-ctec-stars" title=${title}>${stars}</div>`;
}

function starIconTemplate(className?: string): SVGTemplateResult {
  return svg`<svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class=${className ?? ""}
  ><path d=${ICON_SHAPES.star.paths[0]}></path></svg>`;
}
