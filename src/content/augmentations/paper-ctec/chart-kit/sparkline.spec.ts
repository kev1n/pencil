import { describe, expect, it } from "vitest";

import { renderSparkline } from "./sparkline";

const SVG_NS = "http://www.w3.org/2000/svg";

function makeSvg(): SVGSVGElement {
  return document.createElementNS(SVG_NS, "svg");
}

describe("renderSparkline", () => {
  it("returns null and emits nothing for empty points", () => {
    const svg = makeSvg();
    const result = renderSparkline(document, svg, [], {
      strokeColor: "var(--bc-color-accent)",
      strokeWidth: 1.5
    });
    expect(result).toBeNull();
    expect(svg.children.length).toBe(0);
  });

  it("emits one polyline with comma-separated points", () => {
    const svg = makeSvg();
    renderSparkline(
      document,
      svg,
      [
        { x: 0, y: 10 },
        { x: 5, y: 20 },
        { x: 10, y: 15 }
      ],
      { strokeColor: "var(--bc-color-accent)", strokeWidth: 2 }
    );
    const polylines = svg.querySelectorAll("polyline");
    expect(polylines.length).toBe(1);
    expect(polylines[0]!.getAttribute("points")).toBe("0,10 5,20 10,15");
    expect(polylines[0]!.getAttribute("stroke-width")).toBe("2");
    expect(polylines[0]!.getAttribute("fill")).toBe("none");
    expect(polylines[0]!.getAttribute("stroke-linecap")).toBe("round");
    expect(polylines[0]!.getAttribute("stroke-linejoin")).toBe("round");
  });

  it("renders no dots when dotRadius is omitted", () => {
    const svg = makeSvg();
    renderSparkline(
      document,
      svg,
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      { strokeColor: "var(--bc-color-accent)", strokeWidth: 1.5 }
    );
    expect(svg.querySelectorAll("circle").length).toBe(0);
  });

  it("renders a dot per point with the requested radius when dotRadius is set", () => {
    const svg = makeSvg();
    renderSparkline(
      document,
      svg,
      [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: 10 }
      ],
      {
        strokeColor: "var(--bc-color-accent)",
        strokeWidth: 2,
        dotRadius: 3.5
      }
    );
    const circles = svg.querySelectorAll("circle");
    expect(circles.length).toBe(3);
    expect(circles[0]!.getAttribute("r")).toBe("3.5");
    // strokeWidth >= 2 → default dot stroke-width 1.6
    expect(circles[0]!.getAttribute("stroke-width")).toBe("1.6");
  });

  it("renders only a single fill-colored dot at the last point in lastDotOnly mode", () => {
    const svg = makeSvg();
    renderSparkline(
      document,
      svg,
      [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: 12 }
      ],
      {
        strokeColor: "var(--bc-color-accent)",
        strokeWidth: 1.5,
        lastDotOnly: true,
        lastDotRadius: 2
      }
    );
    const circles = svg.querySelectorAll("circle");
    expect(circles.length).toBe(1);
    expect(circles[0]!.getAttribute("cx")).toBe("20");
    expect(circles[0]!.getAttribute("cy")).toBe("12");
    expect(circles[0]!.getAttribute("r")).toBe("2");
    // lastDotOnly fills with the stroke color (no outline).
    expect((circles[0] as SVGElement).style.fill).toBe(
      "var(--bc-color-accent)"
    );
  });

  it("respects an explicit dotStrokeWidth override", () => {
    const svg = makeSvg();
    renderSparkline(
      document,
      svg,
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      {
        strokeColor: "var(--bc-color-accent)",
        strokeWidth: 1.6,
        dotRadius: 2.6,
        dotStrokeWidth: 1.4
      }
    );
    const circles = svg.querySelectorAll("circle");
    expect(circles[0]!.getAttribute("stroke-width")).toBe("1.4");
  });
});
