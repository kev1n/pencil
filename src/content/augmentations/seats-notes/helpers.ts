// Pure helpers shared across the seats-notes augmentation. The grid-level
// `queryTargetTables` from the pre-Wave-4 codebase is gone — the runtime now
// finds rows directly via `gridRowSelector`.

export function extractClassNumber(rawText: string): string | null {
  const match = rawText.match(/\((\d{4,10})\)/);
  if (match) return match[1];
  const digits = rawText.replace(/\D+/g, "");
  return digits.length >= 4 ? digits : null;
}

// Discussion / lab sub-rows render the class label inside a
// <span class="PSHYPERLINKDISABLED"> instead of an <a> because the row isn't
// independently selectable. We still inject Seats/Notes cells so the row's
// border and alternating background stay continuous, but the user-facing
// load button is shorter ("Load seats") since notes are typically empty for
// these sub-rows.
export function isDisabledClassRow(row: Element): boolean {
  return (
    row.querySelector(
      "span.PSHYPERLINKDISABLED[id^='P_CLASS_NAME$span$'], span.PSHYPERLINKDISABLED[id^='E_CLASS_NAME$span$']"
    ) !== null
  );
}

export function extractCareerHint(text: string): "UGRD" | "TGS" | undefined {
  const catalog = text.match(/\b(\d{3})-\d\b/)?.[1];
  if (!catalog) return undefined;
  const value = Number(catalog);
  if (!Number.isFinite(value)) return undefined;
  return value >= 400 ? "TGS" : "UGRD";
}

import { readTermId } from "../../cart-cache/parse-cart-page";

// CAESAR seat/enrollment fields arrive as either strings ("30") or numbers
// (paper.nu's typed-as-string-but-actually-number capacity). Tolerates both,
// strips stray punctuation, returns null on garbage.
export function parseCount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  const n = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// `readTermId` does a full-document outerHTML scan as its fallback, which is
// expensive on CAESAR's multi-MB cart pages. seats-notes calls this once per
// combined-section row, so we memoize per Document for the lifetime of the
// content-script.
const strmCache = new WeakMap<Document, string | null>();
export function readActiveStrm(doc: Document = document): string | null {
  const cached = strmCache.get(doc);
  if (cached !== undefined) return cached;
  const value = readTermId(doc);
  strmCache.set(doc, value);
  return value;
}
