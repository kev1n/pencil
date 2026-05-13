import type { CartEntry } from "./types";

export type ParsedCartPage = {
  termId: string;
  cart: CartEntry[];
  enrolled: CartEntry[];
};

// Parses the live CAESAR Enrollment Shopping Cart page (or the same DOM
// fetched in the background) into `cart` (tr[bufnum] in #SSR_REGFORM_VW)
// and `enrolled` (tr[bufnum] in #STDNT_ENRL_SSVW, status icon "Enrolled").
//
// Returns null when the page isn't a recognizable cart page (e.g. login
// redirect from the background reconciler) so callers can bail without
// touching the cache.
export function parseCartPage(
  doc: Document,
  htmlSource?: string
): ParsedCartPage | null {
  const termId = readTermId(doc, htmlSource);
  if (!termId) return null;

  const cart = parseRows(doc, "#SSR_REGFORM_VW\\$scroll\\$0", "P");
  const enrolled = parseRows(doc, "#STDNT_ENRL_SSVW\\$scroll\\$0", "E").filter(
    (entry) => entry.statusAlt === "Enrolled"
  );

  // If neither table exists, this isn't actually the cart page.
  if (
    !doc.querySelector("#SSR_REGFORM_VW\\$scroll\\$0") &&
    !doc.querySelector("#STDNT_ENRL_SSVW\\$scroll\\$0")
  ) {
    return null;
  }

  return {
    termId,
    cart: cart.map(stripStatus),
    enrolled: enrolled.map(stripStatus)
  };
}

function stripStatus(row: ParsedRow): CartEntry {
  return {
    classNumber: row.classNumber,
    subject: row.subject,
    catalog: row.catalog,
    sectionLabel: row.sectionLabel,
    description: row.description,
    capturedAt: Date.now()
  };
}

type ParsedRow = CartEntry & { statusAlt: string | null };

function parseRows(
  doc: Document,
  tableSelector: string,
  prefix: "P" | "E"
): ParsedRow[] {
  const table = doc.querySelector<HTMLElement>(tableSelector);
  if (!table) return [];

  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tr[bufnum]"));
  const entries: ParsedRow[] = [];

  for (const row of rows) {
    const bufnum = row.getAttribute("bufnum");
    if (bufnum === null) continue;

    // Class link is `<a id="P_CLASS_NAME$N">SUBJECT 111-0-1<br/> (34612)</a>`
    // (or E_CLASS_NAME on the enrolled grid). Some enrolled rows render the
    // class label inside a `PSHYPERLINKDISABLED` span instead of an anchor —
    // grab the whole div text and let the regex pull the parts.
    const cellId = `win0div${prefix}_CLASS_NAME$${bufnum}`;
    const cell = row.querySelector<HTMLElement>(`[id='${cellId}']`);
    const text = (cell?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    const parsed = parseClassText(text);
    if (!parsed) continue;

    const statusAlt = readStatusAlt(row);
    const description = readDescription(row, prefix, bufnum);

    entries.push({
      classNumber: parsed.classNumber,
      subject: parsed.subject,
      catalog: parsed.catalog,
      sectionLabel: parsed.sectionLabel,
      description: description ?? undefined,
      capturedAt: 0,
      statusAlt
    });
  }

  return entries;
}

// "COMP_SCI 111-0-1 (34612)" → subject "COMP_SCI", catalog "111-0",
// sectionLabel "1", classNumber "34612". The section label is the trailing
// segment after the last hyphen of the dashed identifier (could be "1",
// "01", "20", "61", "SG-01"). For sectionLabel we keep the original
// "section + component-style" text but the cart page only renders
// "section number" — component is implied. We store the bare section number;
// the optimistic-add side stores "1-LEC" but lookupBySignature treats the
// label case-insensitively and only the part before the first dash matches.
export function parseClassText(
  text: string
): { subject: string; catalog: string; sectionLabel: string; classNumber: string } | null {
  // Match "{SUBJECT} {DIGITS}-{DIGITS|LETTERS}-{SECTION} ({CLASSNUMBER})".
  // Catalog can be e.g. "111-0", "105-8", "380-2", "111-SG", "240-0".
  const m =
    /^([A-Z][A-Z_&]*)\s+(\d+(?:-[A-Z0-9]+)?)-([A-Z0-9]+)\s*\((\d{3,8})\)$/.exec(text);
  if (!m) return null;
  return {
    subject: m[1]!,
    catalog: m[2]!,
    sectionLabel: m[3]!,
    classNumber: m[4]!
  };
}

function readStatusAlt(row: HTMLElement): string | null {
  const img = row.querySelector<HTMLImageElement>("img[alt]");
  return img?.getAttribute("alt") ?? null;
}

function readDescription(
  row: HTMLElement,
  prefix: "P" | "E",
  bufnum: string
): string | null {
  if (prefix !== "E") return null;
  const el = row.querySelector<HTMLElement>(`[id='E_CLASS_DESCR$${bufnum}']`);
  const text = (el?.textContent ?? "").trim();
  return text || null;
}

// CAESAR encodes the term in two places: the URL `STRM` query param and a
// `PIA_KEYSTRUCT` JS object emitted in the page head. Try the URL first
// (cheap, deterministic) then the JS literal. Background-fetched HTML may
// not have a `doc.location` — `htmlSource` lets the reconciler pass the raw
// HTML so we can still find the literal.
export function readTermId(doc: Document, htmlSource?: string): string | null {
  const fromLocation = doc.location?.search
    ? new URLSearchParams(doc.location.search).get("STRM")
    : null;
  if (fromLocation) return fromLocation;

  const sources = [htmlSource ?? "", doc.documentElement?.outerHTML ?? ""];
  for (const src of sources) {
    if (!src) continue;
    const m = /PIA_KEYSTRUCT\s*=\s*\{[^}]*STRM\s*:\s*["'](\d{4,5})["']/i.exec(src);
    if (m) return m[1] ?? null;
    const m2 = /[?&]STRM=(\d{4,5})/i.exec(src);
    if (m2) return m2[1] ?? null;
  }
  return null;
}
