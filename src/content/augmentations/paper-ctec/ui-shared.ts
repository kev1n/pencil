import { PAPER_CTEC_CONFIG } from "./config";

export type IconName =
  | "alert"
  | "book"
  | "cap"
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

export function createIcon(name: IconName, options?: { filled?: boolean }): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", options?.filled ? "currentColor" : "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const addPath = (d: string) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  };

  if (name === "alert") {
    addPath("M12 9v4");
    addPath("M12 17h.01");
    addPath("M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z");
    return svg;
  }

  if (name === "book") {
    addPath("M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 0 4 22z");
    addPath("M8 4v16");
    return svg;
  }

  if (name === "check") {
    addPath("M5 12.5 10 17l9-10");
    return svg;
  }

  if (name === "plus") {
    addPath("M12 5v14");
    addPath("M5 12h14");
    return svg;
  }

  if (name === "cap") {
    addPath("m3 10 9-4 9 4-9 4-9-4Z");
    addPath("M7 12v4.5c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5V12");
    addPath("M21 10v6");
    return svg;
  }

  if (name === "chart") {
    addPath("M4 19h16");
    addPath("M7 16V9");
    addPath("M12 16V5");
    addPath("M17 16v-4");
    return svg;
  }

  if (name === "clock") {
    addPath("M12 6v6l4 2");
    addPath("M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z");
    return svg;
  }

  if (name === "lock") {
    addPath("M7 11V8a5 5 0 0 1 10 0v3");
    addPath("M5 11h14v10H5z");
    return svg;
  }

  if (name === "spark") {
    addPath("m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z");
    return svg;
  }

  if (name === "stack") {
    addPath("m12 4 8 4-8 4-8-4 8-4Z");
    addPath("m4 12 8 4 8-4");
    addPath("m4 16 8 4 8-4");
    return svg;
  }

  if (name === "star") {
    addPath("m12 3.5 2.7 5.47 6.03.88-4.36 4.25 1.03 6.01L12 17.9l-5.4 2.84 1.03-6.01L3.27 9.85l6.03-.88Z");
    return svg;
  }

  addPath("M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z");
  addPath("M5 20a7 7 0 0 1 14 0");
  return svg;
}
