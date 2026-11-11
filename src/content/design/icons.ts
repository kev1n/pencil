// Drawn icons shared across surfaces: four seasons (for academic terms) and
// four faces (for how a comment reads). One hand for both: a 16-unit grid,
// round caps, solid fills with a "hole" stroke cut through them.
//
// Colors come from tokens and are set inline, so the icons need no
// stylesheet. A parent can restyle them through three custom properties:
//   --bc-icon-hole      what shows through the cut-outs (default: page bg)
//   --bc-icon-strength  how much of the icon's own ink to keep (default 100%)
//   --bc-icon-wash      what the ink is mixed toward when strength < 100%
//   --bc-icon-tint      how much ink fills a face (default 13%)
// e.g. on a selected (inverted) chip: hole = the chip fill, wash = the chip
// text color, strength ~50%, tint 0%.

import { html, render, svg, type TemplateResult } from "lit-html";

export type Season = "fall" | "winter" | "spring" | "summer";
export type FaceTone = "positive" | "mixed" | "neutral" | "critical";

const HOLE = "var(--bc-icon-hole, var(--bc-color-bg))";
const ink = (token: string): string =>
  `color: color-mix(in srgb, var(${token}) var(--bc-icon-strength, 100%), var(--bc-icon-wash, transparent))`;

const n2 = (value: number): string => value.toFixed(2);

// Six-armed flake with small forks.
const WINTER_PATH = (() => {
  let d = "";
  for (let a = 0; a < 6; a++) {
    const r = (a * Math.PI) / 3 - Math.PI / 2;
    const at = (len: number): string =>
      `${n2(8 + Math.cos(r) * len)} ${n2(8 + Math.sin(r) * len)}`;
    const fx = 8 + Math.cos(r) * 4.2;
    const fy = 8 + Math.sin(r) * 4.2;
    const fork = (o: number): string =>
      `${n2(fx + Math.cos(r + o) * 2)} ${n2(fy + Math.sin(r + o) * 2)}`;
    d += `M${at(1.6)}L${at(6.6)}M${fork(0.75)}L${n2(fx)} ${n2(fy)}L${fork(-0.75)}`;
  }
  return d;
})();

// Five round petals around an open centre.
const SPRING_PETALS = [0, 1, 2, 3, 4].map((a) => {
  const r = (a * 2 * Math.PI) / 5 - Math.PI / 2;
  return { cx: n2(8 + Math.cos(r) * 3.6), cy: n2(8.2 + Math.sin(r) * 3.6) };
});

// Round sun, rays of alternating length.
const SUMMER_RAYS = (() => {
  let d = "";
  for (let a = 0; a < 8; a++) {
    const r = (a * Math.PI) / 4;
    const o = a % 2 ? 6.4 : 7.2;
    d += `M${n2(8 + Math.cos(r) * 5)} ${n2(8 + Math.sin(r) * 5)}L${n2(8 + Math.cos(r) * o)} ${n2(8 + Math.sin(r) * o)}`;
  }
  return d;
})();

const SEASON_ART: Record<Season, TemplateResult> = {
  // A leaf with a vein and a little stem.
  fall: svg`<g transform="rotate(35 8 8)">
    <path d="M8 1.2C12.6 3.9 13.7 9 8 13.2 2.3 9 3.4 3.9 8 1.2z" fill="currentColor" />
    <path d="M8 12.4V4.6M8 9.4l2.1-1.7M8 7.2L6.1 5.8" fill="none" style="stroke: ${HOLE}" stroke-width="1" stroke-linecap="round" />
    <path d="M8 13v2.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  </g>`,
  winter: svg`<path d=${WINTER_PATH} fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" />`,
  spring: svg`${SPRING_PETALS.map(
    (p) => svg`<circle cx=${p.cx} cy=${p.cy} r="2.75" fill="currentColor" />`
  )}<circle cx="8" cy="8.2" r="1.85" style="fill: ${HOLE}" />
    <circle cx="8" cy="8.2" r="0.9" fill="currentColor" />`,
  summer: svg`<circle cx="8" cy="8" r="3.3" fill="currentColor" />
    <path d=${SUMMER_RAYS} fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" />`
};

const SEASON_TOKEN: Record<Season, string> = {
  fall: "--bc-color-season-fall",
  winter: "--bc-color-season-winter",
  spring: "--bc-color-season-spring",
  summer: "--bc-color-season-summer"
};

// Reads the season out of a term name in either order ("2026 Fall",
// "Fall 2026"). Null when the name carries none.
export function seasonOf(term: string): Season | null {
  const match = term.match(/\b(fall|winter|spring|summer)\b/i);
  return match ? (match[1]!.toLowerCase() as Season) : null;
}

export function seasonIcon(season: Season, size = 14): TemplateResult {
  return html`<svg
    class="bc-icon bc-icon-season"
    data-season=${season}
    width=${size}
    height=${size}
    viewBox="0 0 16 16"
    aria-hidden="true"
    style=${ink(SEASON_TOKEN[season])}
  >${SEASON_ART[season]}</svg>`;
}

const FACE_MOUTH: Record<FaceTone, string> = {
  positive: "M5.1 9.5Q8 12.6 10.9 9.5",
  neutral: "M5.5 10.5H10.5",
  mixed: "M5.1 10.7Q6.5 9.3 8 10.4T10.9 10.1",
  critical: "M5.3 11.5Q8 8.7 10.7 11.5"
};

const FACE_TOKEN: Record<FaceTone, string> = {
  positive: "--bc-color-sentiment-pos-fg",
  mixed: "--bc-color-sentiment-mix-fg",
  neutral: "--bc-color-sentiment-neu-fg",
  critical: "--bc-color-sentiment-neg-fg"
};

export const FACE_LABELS: Record<FaceTone, string> = {
  positive: "Positive",
  mixed: "Mixed",
  neutral: "Neutral",
  critical: "Critical"
};

export function faceIcon(tone: FaceTone, size = 16): TemplateResult {
  return html`<svg
    class="bc-icon bc-icon-face"
    data-tone=${tone}
    width=${size}
    height=${size}
    viewBox="0 0 16 16"
    role="img"
    aria-label=${FACE_LABELS[tone]}
    style=${ink(FACE_TOKEN[tone])}
  >
    <circle
      cx="8"
      cy="8"
      r="6.6"
      style="fill: color-mix(in srgb, currentColor var(--bc-icon-tint, 13%), ${HOLE}); stroke: currentColor; stroke-width: 1.3"
    />
    <circle cx="5.8" cy="6.5" r="0.95" fill="currentColor" />
    <circle cx="10.2" cy="6.5" r="0.95" fill="currentColor" />
    <path d=${FACE_MOUTH[tone]} fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" />
  </svg>`;
}

// For surfaces built with plain DOM calls rather than lit-html templates.
export function iconElement(doc: Document, icon: TemplateResult): SVGElement {
  const host = doc.createElement("span");
  render(icon, host);
  return host.firstElementChild as SVGElement;
}
