import { decodeEntities } from "../../shared/decode-entities";
import type { CourseHistoryEntry } from "./types";

// Parses the SSR_CRSE_HIST_FL AJAX response into a flat list of course
// history rows. The response is an XML envelope wrapping an HTML fragment
// inside <FIELD id='divPAGECONTAINER_TGT'><![CDATA[ ... ]]></FIELD>; we
// extract the CDATA payload and parse it as HTML so DOMParser doesn't have
// to deal with the XML/CDATA mixed mode. Returns null when the table isn't
// present (login redirect, error response, structure change).

const FIELD_RE =
  /<FIELD id='divPAGECONTAINER_TGT'[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/FIELD>/;

const ROW_ID_RE = /^CRSE_HIST2\$0_row_(\d+)$/;
const CATALOG_RE = /^([A-Z][A-Z_]*)\s+(.+)$/;
const TERM_DATE_COMMENT_RE = /<!--\s*(\d{4}-\d{2}-\d{2})\s*-->/;

export function parseCourseHistoryAjax(xmlText: string): CourseHistoryEntry[] | null {
  const match = FIELD_RE.exec(xmlText);
  if (!match) return null;
  const html = match[1];
  return parseCourseHistoryHtml(html);
}

export function parseCourseHistoryHtml(html: string): CourseHistoryEntry[] | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = Array.from(
    doc.querySelectorAll<HTMLTableRowElement>("tr.ps_grid-row")
  ).filter((row) => ROW_ID_RE.test(row.id ?? ""));

  if (rows.length === 0) return null;

  const entries: CourseHistoryEntry[] = [];
  for (const row of rows) {
    const entry = parseRow(row);
    if (entry) entries.push(entry);
  }
  return entries;
}

function parseRow(row: HTMLTableRowElement): CourseHistoryEntry | null {
  const idMatch = ROW_ID_RE.exec(row.id);
  if (!idMatch) return null;
  const idx = idMatch[1];

  const catalogText = textById(row, `SSR_CLASS_BTN$${idx}`);
  if (!catalogText) return null;

  const catalog = catalogText;
  const catalogMatch = CATALOG_RE.exec(catalogText);
  const subject = catalogMatch?.[1] ?? catalogText;
  const number = catalogMatch?.[2] ?? "";

  // Description column. Falls back to the title attribute on the class
  // link, which is sometimes more complete than the truncated cell text
  // (e.g. "Special Topics in CS (Software Design Principles and Practices)").
  const descCellText = textById(
    row,
    `DERIVED_SSS_HST_SSR_CLASSNAME_LONG$83$$${idx}`
  );
  const linkTitle = row
    .querySelector<HTMLElement>(`#win5divSSR_CLASS_BTN\\$${idx} .ps-link-wrapper`)
    ?.getAttribute("title")
    ?.trim() ?? null;
  const description = pickDescription(linkTitle, descCellText);

  const termCell = row.querySelector<HTMLElement>(
    `[id='win5divDERIVED_SSR_FL_SS_MESSAGE_LONG$${idx}']`
  );
  const termLabel = (termCell?.textContent ?? "").replace(/\s+/g, " ").trim();
  const termStartDate = readTermStartDate(termCell);

  const gradeAnchor = row.querySelector<HTMLElement>(
    `#VIEW_HOLDS_LINK\\$${idx} .ps-text`
  );
  const gradeText = (gradeAnchor?.textContent ?? "").trim();
  const grade = gradeText.length > 0 ? gradeText : null;

  const unitsText = textById(row, `DERIVED_SSS_HST_UNT_TAKEN$${idx}`);
  const unitsNum = Number.parseFloat(unitsText);
  const units = Number.isFinite(unitsNum) ? unitsNum : null;

  // Status comes from the alt text on the leading <img> inside the
  // status htmlarea. Stays a free-form string — CAESAR could add new
  // states (e.g. "Withdrawn") and we want to surface them as-is.
  const statusImg = row.querySelector<HTMLImageElement>(
    `[id='win5divDERIVED_SSS_HST_SSR_STATUS_LONG$${idx}'] img`
  );
  const status =
    statusImg?.getAttribute("alt")?.trim() ||
    textById(row, `DERIVED_SSS_HST_SSR_STATUS_LONG$${idx}`);

  return {
    catalog,
    subject,
    number,
    description,
    termLabel,
    termStartDate,
    grade,
    units,
    status
  };
}

function textById(row: HTMLElement, id: string): string {
  const escaped = id.replace(/\$/g, "\\$");
  const el = row.querySelector(`#${escaped}`);
  if (!el) return "";
  return decodeEntities((el.textContent ?? "").replace(/\s+/g, " ").trim());
}

function pickDescription(linkTitle: string | null, cellText: string): string {
  // The cell text and the title are usually identical; the title wins
  // when it's longer because CAESAR truncates parenthetical detail in
  // the cell ("Special Topics" vs "Special Topics (Software Design...)").
  if (linkTitle && (!cellText || linkTitle.length > cellText.length)) {
    return linkTitle;
  }
  return cellText;
}

function readTermStartDate(cell: HTMLElement | null): string | null {
  if (!cell) return null;
  // The HTML comment `<!--YYYY-MM-DD-->` is the canonical sort key
  // CAESAR uses for the term column. textContent doesn't expose it,
  // so we walk childNodes and pick the first comment that matches.
  const walker = cell.ownerDocument.createNodeIterator(cell, NodeFilter.SHOW_COMMENT);
  let node = walker.nextNode();
  while (node) {
    const m = TERM_DATE_COMMENT_RE.exec(node.nodeValue ?? "");
    if (m) return m[1];
    node = walker.nextNode();
  }
  return null;
}
