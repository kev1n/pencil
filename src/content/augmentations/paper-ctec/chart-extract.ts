// Pixel-level extractor for Bluera CTEC distribution chart PNGs.
//
// Bluera renders distribution charts as flat PNG images with no metadata.
// The chart layout is fixed: 6 horizontal bars, axis at y=217, 4 light
// gridlines at 25/50/75/100% with the implicit 0% line one tick spacing
// to the left.
//
// Given an image URL plus the externally-known total response count, this
// returns the integer count per row by measuring bar pixel widths and
// applying count_i = round(width_i / span * total). Validated against a
// 6-image suite: 36/36 row counts match ground truth.
//
// See scripts/chart-prototype/extract_final.py for the prototype.

import { fetchBinaryViaBackground } from "../../remote-fetch";

const ROW_CENTERS = [30, 62, 93, 124, 155, 186] as const;
const AXIS_Y = 217;
const VBAND = 8;

export type ChartExtraction = {
  counts: number[]; // length 6, top → bottom (1-VeryLow … 6-VeryHigh)
  percentages: number[]; // length 6, derived from widths
  widths: number[]; // raw bar pixel widths (for diagnostics)
  span: number; // pixel span representing 100%
  total: number;
};

export type ChartExtractionResult =
  | { ok: true; data: ChartExtraction }
  | { ok: false; reason: string };

const cache = new Map<string, Promise<ChartExtractionResult>>();

export function extractChartFromImage(
  imageUrl: string,
  total: number,
  signal?: AbortSignal
): Promise<ChartExtractionResult> {
  const key = `${imageUrl}|${total}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const promise = doExtract(imageUrl, total, signal).catch((err): ChartExtractionResult => ({
    ok: false,
    reason: err instanceof Error ? err.message : String(err)
  }));
  cache.set(key, promise);
  return promise;
}

async function doExtract(
  imageUrl: string,
  total: number,
  signal?: AbortSignal
): Promise<ChartExtractionResult> {
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, reason: `bad total=${total}` };
  }

  const { buffer, contentType, finalUrl } = await fetchBinaryViaBackground(imageUrl, signal);
  if (buffer.byteLength < 100) {
    return { ok: false, reason: `tiny response (${buffer.byteLength} bytes, type='${contentType}')` };
  }
  const ct = (contentType || "").toLowerCase();
  if (ct && !ct.startsWith("image/") && !ct.includes("octet-stream")) {
    const redirected = finalUrl && finalUrl !== imageUrl ? ` → ${finalUrl}` : "";
    return {
      ok: false,
      reason: `non-image response: '${contentType}' (likely auth redirect)${redirected}`
    };
  }
  const blob = new Blob([buffer], { type: contentType || "image/png" });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const head = Array.from(new Uint8Array(buffer.slice(0, 8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    return {
      ok: false,
      reason: `decode failed: ${msg} (${buffer.byteLength}B type='${contentType}' head=${head})`
    };
  }
  try {
    const W = bitmap.width;
    const H = bitmap.height;
    if (H < AXIS_Y + 1) {
      return { ok: false, reason: `image too short H=${H} (need ${AXIS_Y + 1})` };
    }

    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(W, H)
        : Object.assign(document.createElement("canvas"), { width: W, height: H });
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return { ok: false, reason: "canvas getContext('2d') returned null" };
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;

    const grids = findLightGridlines(data, W);
    if (grids.length < 2) {
      return { ok: false, reason: `only ${grids.length} gridline(s) detected (need ≥2)` };
    }
    const spacing = (grids[grids.length - 1] - grids[0]) / (grids.length - 1);
    const computedLeft = Math.round(grids[0] - spacing);
    // Snap to the actual y-axis line. Bluera rounds spacing inconsistently
    // so the average can land 1px off; the true 0% column is whichever
    // nearby x has the most gray pixels (the y-axis runs the full plot
    // height in any gray shade — usually ~174 vs gridlines' ~210).
    const axisLeft = snapToYAxis(data, W, computedLeft);
    const axisRight = grids[grids.length - 1];
    const span = axisRight - axisLeft;
    if (span <= 0) {
      return { ok: false, reason: `bad span ${span} (axisLeft=${axisLeft}, axisRight=${axisRight})` };
    }

    const widths: number[] = [];
    const counts: number[] = [];
    const percentages: number[] = [];
    for (const yc of ROW_CENTERS) {
      if (yc + VBAND >= H) {
        return { ok: false, reason: `row center ${yc} out of bounds (H=${H})` };
      }
      const right = findBarRight(data, W, axisLeft, axisRight, yc);
      const w = right === null ? 0 : right - axisLeft + 1;
      widths.push(w);
      counts.push(Math.round((w * total) / span));
      percentages.push(Math.round((1000 * w) / span) / 10);
    }

    const sum = counts.reduce((a, b) => a + b, 0);
    const tolerance = Math.max(3, total * 0.02);
    if (Math.abs(sum - total) > tolerance) {
      return {
        ok: false,
        reason:
          `sum=${sum} ≠ total=${total} (tol ±${tolerance.toFixed(1)}); ` +
          `widths=[${widths.join(",")}] span=${span} ` +
          `image=${W}x${H} axisLeft=${axisLeft} axisRight=${axisRight}`
      };
    }

    return { ok: true, data: { counts, percentages, widths, span, total } };
  } finally {
    bitmap.close?.();
  }
}

// ─── Pixel helpers ──────────────────────────────────────────────────────────

function px(data: Uint8ClampedArray, W: number, x: number, y: number): [number, number, number] {
  const i = (y * W + x) << 2;
  return [data[i], data[i + 1], data[i + 2]];
}

function isWhite(r: number, g: number, b: number): boolean {
  return r >= 245 && g >= 245 && b >= 245;
}

function isLightGridGray(r: number, g: number, b: number): boolean {
  if (Math.abs(r - g) >= 15 || Math.abs(g - b) >= 15) return false;
  return r > 195 && r < 235;
}

// True for any roughly-neutral gray pixel — covers both the light gridline
// shade (~210) and the darker y-axis shade (~174). Bar fills are always
// noticeably colored (one channel diverges from the others), so a gray-ish
// sample at axis_left+1 means we're seeing the y-axis line, not a bar.
function isGrayish(r: number, g: number, b: number): boolean {
  if (Math.abs(r - g) >= 18 || Math.abs(g - b) >= 18 || Math.abs(r - b) >= 18) return false;
  return r >= 100 && r <= 240;
}

function colorDist(
  c1: [number, number, number],
  r2: number,
  g2: number,
  b2: number
): number {
  return Math.abs(c1[0] - r2) + Math.abs(c1[1] - g2) + Math.abs(c1[2] - b2);
}

// Search a ±2px window around the computed position for the actual y-axis
// column. Bars cross this column too, so we measure "gray pixel count"
// (any neutral shade — gridline gray, axis gray, anti-aliased blends).
// The column with the most gray hits is the real axis. Defaults to the
// computed value if no candidate scores meaningfully.
function snapToYAxis(data: Uint8ClampedArray, W: number, computedLeft: number): number {
  let best = computedLeft;
  let bestScore = -1;
  for (let dx = -2; dx <= 2; dx += 1) {
    const x = computedLeft + dx;
    if (x < 0 || x >= W) continue;
    let gray = 0;
    for (let y = 0; y < AXIS_Y; y += 1) {
      const i = (y * W + x) << 2;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (
        Math.abs(r - g) < 15 && Math.abs(g - b) < 15 &&
        r >= 150 && r <= 235
      ) {
        gray += 1;
      }
    }
    if (gray > bestScore) {
      bestScore = gray;
      best = x;
    }
  }
  return best;
}

// Light vertical gridlines at 25/50/75/100%. Threshold: column must be
// dominantly gray (>55% of axis-height pixels). Bars never reach 100%, so
// the rightmost line is always reliably detected even on dense charts.
function findLightGridlines(data: Uint8ClampedArray, W: number): number[] {
  const cols: number[] = [];
  const minGray = AXIS_Y * 0.55;
  for (let x = 0; x < W; x += 1) {
    let gray = 0;
    for (let y = 0; y < AXIS_Y; y += 1) {
      const i = (y * W + x) << 2;
      if (isLightGridGray(data[i], data[i + 1], data[i + 2])) gray += 1;
    }
    if (gray > minGray) cols.push(x);
  }
  // Cluster runs of adjacent columns to single centroids.
  const clusters: number[] = [];
  let runStart = -1;
  let runEnd = -1;
  for (const x of cols) {
    if (runStart < 0) {
      runStart = runEnd = x;
    } else if (x - runEnd <= 2) {
      runEnd = x;
    } else {
      clusters.push((runStart + runEnd) >> 1);
      runStart = runEnd = x;
    }
  }
  if (runStart >= 0) clusters.push((runStart + runEnd) >> 1);
  return clusters;
}

// Sample bar fill color at axis_left+1; if white the row is empty (0%).
// Otherwise scan right-to-left for the last column where the row's
// vertical band has majority color match — that's the bar's right edge.
function findBarRight(
  data: Uint8ClampedArray,
  W: number,
  axisLeft: number,
  axisRight: number,
  yCenter: number
): number | null {
  const sampleX = axisLeft + 1;
  const target = px(data, W, sampleX, yCenter);
  // Empty row: pure white sample, OR the y-axis line bleeds gray into
  // axis_left+1. Treat both as "no bar".
  if (isWhite(target[0], target[1], target[2])) return null;
  if (isGrayish(target[0], target[1], target[2])) return null;

  for (let x = axisRight - 1; x > axisLeft; x -= 1) {
    let match = 0;
    for (let dy = -VBAND; dy <= VBAND; dy += 1) {
      const i = ((yCenter + dy) * W + x) << 2;
      if (colorDist(target, data[i], data[i + 1], data[i + 2]) <= 60) match += 1;
    }
    if (match >= VBAND + 1) return x;
  }
  // Bar exists but didn't satisfy band-match anywhere right of sample —
  // it's exactly 1 pixel wide.
  return sampleX;
}

export function clearChartExtractCache(): void {
  cache.clear();
}
