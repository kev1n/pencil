import { decodeEntities } from "../../../peoplesoft/shared";
import { formatCatalogForDisplay } from "../catalog-format";
import type {
  CaesarCourseGroup,
  CaesarSection,
  CaesarStatus,
  RelatedSectionOption
} from "./types";

// CAESAR's AJAX response is XML with HTML inside CDATA. We pull out the
// PAGECONTAINER FIELD and let the browser's parser do the heavy lifting.
export function parseAjaxFragment(payload: string): Document {
  const cdataMatch = /<FIELD\s+id=['"]win0divPAGECONTAINER['"][^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/FIELD>/i.exec(
    payload
  );
  const html = cdataMatch?.[1] ?? payload;
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html");
}

// Parse the related-component picker page (SSR_CLS_RELCOMP / SSR_SSENRL_RC).
// Returns null when the response isn't that page. We locate the picker via
// the radio inputs in the `SSR_CLS_TBL_R1` grid and read each row's data
// from its `<tr>` so we don't depend on the wizard's dynamic positional
// suffixes (e.g. `$190$`).
export function parseRelatedComponentOptions(html: string): RelatedSectionOption[] | null {
  const doc = parseAjaxFragment(html);
  const radios = doc.querySelectorAll<HTMLInputElement>(
    "input[type='radio'][id^='SSR_CLS_TBL_R1$sels$']"
  );
  if (radios.length === 0) return null;

  const options: RelatedSectionOption[] = [];
  for (const radio of Array.from(radios)) {
    const idMatch = /\$sels\$(\d+)\$\$\d+$/.exec(radio.id);
    if (!idMatch) continue;
    const rowIndex = Number(idMatch[1]);

    const tr = radio.closest("tr");
    if (!tr) continue;
    const cells = Array.from(tr.querySelectorAll<HTMLElement>("td"));
    const cellText = (n: number) =>
      decodeEntities((cells[n]?.textContent ?? "").trim()).replace(/\s+/g, " ");

    // Column order on CAESAR: radio | Class Nbr | Section | Schedule | Room | Instructor | Status.
    const classNumber = cellText(1);
    const section = cellText(2);
    const schedule = cellText(3);
    const room = cellText(4);
    const instructor = cellText(5);
    const statusImg = cells[6]?.querySelector<HTMLImageElement>("img");
    const status = statusFromAlt(statusImg?.getAttribute("alt"));

    if (!classNumber) continue;
    options.push({ rowIndex, classNumber, section, schedule, room, instructor, status });
  }
  return options.length > 0 ? options : null;
}

export function statusFromAlt(alt: string | null | undefined): CaesarStatus {
  const a = (alt ?? "").toLowerCase();
  if (a.includes("open")) return "Open";
  if (a.includes("closed")) return "Closed";
  if (a.includes("wait")) return "Wait List";
  return "Unknown";
}

export function parseCaesarGroups(searchHtml: string): CaesarCourseGroup[] {
  const doc = parseAjaxFragment(searchHtml);
  const groups: CaesarCourseGroup[] = [];

  const groupHeaders = doc.querySelectorAll<HTMLElement>("[id^='win0divSSR_CLSRSLT_WRK_GROUPBOX2$']");
  for (const header of Array.from(groupHeaders)) {
    if (header.id.startsWith("win0divSSR_CLSRSLT_WRK_GROUPBOX2GP$")) continue;
    const idMatch = /\$(\d+)$/.exec(header.id);
    if (!idMatch) continue;

    const groupTitle =
      header.querySelector<HTMLAnchorElement>("[id^='SSR_CLSRSLT_WRK_GROUPBOX2$']")?.title ??
      "";
    const cleanedTitle = decodeEntities(
      groupTitle.replace(/^Collapse section\s+/i, "").replace(/^Expand section\s+/i, "")
    );
    const parsed = splitCourseIdAndTitle(cleanedTitle);

    const sections: CaesarSection[] = [];
    const rowAnchors = header.querySelectorAll<HTMLElement>("[id^='MTG_CLASS_NBR$']");
    for (const anchor of Array.from(rowAnchors)) {
      const rowMatch = /\$(\d+)$/.exec(anchor.id);
      if (!rowMatch) continue;
      const rowIndex = Number(rowMatch[1]);
      const section = parseSectionRow(doc, rowIndex);
      if (section) sections.push(section);
    }

    if (sections.length === 0) continue;

    groups.push({
      courseId: cleanedTitle,
      catalog: parsed.catalog,
      title: parsed.title,
      sections
    });
  }

  return groups;
}

export function parseSectionRow(doc: Document, rowIndex: number): CaesarSection | null {
  const classAnchor = doc.querySelector<HTMLElement>(`#MTG_CLASS_NBR\\$${rowIndex}`);
  if (!classAnchor) return null;
  const classNumber = (classAnchor.textContent ?? "").trim();
  if (!classNumber) return null;

  const sectionEl = doc.querySelector<HTMLElement>(`#MTG_CLASSNAME\\$${rowIndex}`);
  const sectionRaw = (sectionEl?.textContent ?? "").trim();
  const sectionLabel = sectionRaw.split(/\n/)[0]?.trim() ?? "";
  const sectionMatch = /^(\w+?)-(\w+)/.exec(sectionLabel);
  const sectionNumber = sectionMatch?.[1] ?? "";
  const component = sectionMatch?.[2] ?? "";

  const daysTime = textById(doc, `MTG_DAYTIME\\$${rowIndex}`);
  const room = textById(doc, `MTG_ROOM\\$${rowIndex}`);
  const instructor = textById(doc, `MTG_INSTR\\$${rowIndex}`);
  const meetingDates = textById(doc, `MTG_TOPIC\\$${rowIndex}`);
  const grading = textById(doc, `NW_DERIVED_SS3_DESCR\\$${rowIndex}`);
  const status = parseStatus(doc, rowIndex);

  // The Select button is rendered inside `#win0divSSR_PB_SELECT$N`. CAESAR
  // omits it (cell shows just "&nbsp;") when the section is already in the
  // user's shopping cart — we use that absence as our "already in cart"
  // signal further up the call chain.
  const selectButton = doc.querySelector<HTMLElement>(
    `#win0divSSR_PB_SELECT\\$${rowIndex} input[type='button']`
  );

  return {
    classNumber,
    sectionLabel,
    sectionNumber,
    component,
    daysTime,
    room,
    instructor,
    meetingDates,
    grading,
    status,
    selectActionId: `SSR_PB_SELECT$${rowIndex}`,
    selectAvailable: selectButton !== null
  };
}

export function parseStatus(doc: Document, rowIndex: number): CaesarStatus {
  const statusEl = doc.querySelector<HTMLElement>(
    `#win0divDERIVED_CLSRCH_SSR_STATUS_LONG\\$${rowIndex} img`
  );
  const alt = (statusEl?.getAttribute("alt") ?? "").toLowerCase();
  if (alt.includes("open")) return "Open";
  if (alt.includes("closed")) return "Closed";
  if (alt.includes("wait")) return "Wait List";
  return "Unknown";
}

export function textById(doc: Document, escapedId: string): string {
  const el = doc.querySelector<HTMLElement>(`#${escapedId}`);
  if (!el) return "";
  // Replace <br> with newlines first so "MoWeFr 1:00PM - 1:50PM\n" stays
  // legible on consumers that prefer single-line.
  const html = el.innerHTML.replace(/<br\s*\/?>/gi, "\n");
  const tmp = doc.createElement("div");
  tmp.innerHTML = html;
  return decodeEntities(tmp.textContent ?? "").trim();
}

// "COMP_SCI  111-0 - Fundamentals of Computer Programming"
//   → catalog "111-0", title "Fundamentals of Computer Programming"
export function splitCourseIdAndTitle(value: string): { catalog: string; title: string } {
  const trimmed = value.trim();
  const match = /^(\S+)\s+(\S+)\s*-\s*(.*)$/.exec(trimmed);
  if (!match) return { catalog: "", title: trimmed };
  return { catalog: match[2] ?? "", title: (match[3] ?? "").trim() };
}

// ────────────────────────────────────────────────────────────────────────────
// Shared matching helpers (exported so both the cart flow in this module AND
// the live-data overlay in augmentation.ts converge on identical semantics).

// Compare a paper.nu catalog against the catalog string CAESAR put on the
// course-group title. Paper.nu may give us "111" (because the user-facing `n`
// field drops the "-0" suffix) while CAESAR labels the group "111-0", or vice
// versa. We try exact first, then both directions of the "-0" tolerance.
export function matchCaesarGroup(
  groups: CaesarCourseGroup[],
  paperCatalog: string
): CaesarCourseGroup | null {
  const wantExact = paperCatalog.toLowerCase();
  const exact = groups.find((g) => g.catalog.toLowerCase() === wantExact);
  if (exact) return exact;

  // Paper.nu side stripped of trailing "-0" (their display form).
  const wantStripped = formatCatalogForDisplay(paperCatalog).toLowerCase();
  // Same paper.nu form with explicit "-0" appended (the CAESAR-canonical form).
  const wantWithZero = `${wantStripped}-0`;

  return (
    groups.find((g) => {
      const have = g.catalog.toLowerCase();
      if (have === wantStripped) return true;
      if (have === wantWithZero) return true;
      // Reverse direction: CAESAR's group catalog has "-0", paper.nu didn't.
      const haveStripped = have.replace(/-0$/, "");
      return haveStripped === wantStripped;
    }) ?? null
  );
}

// Find a section within a CAESAR group by number + component. Both sides
// occasionally pad the section number ("01" vs "1") so we collapse leading
// zeros on each before comparing.
export function matchCaesarSection(
  group: CaesarCourseGroup,
  sectionNumber: string,
  component: string
): CaesarSection | null {
  const wantNum = normalizeSectionNumber(sectionNumber).toLowerCase();
  const wantComp = component.toUpperCase();
  return (
    group.sections.find(
      (s) =>
        normalizeSectionNumber(s.sectionNumber).toLowerCase() === wantNum &&
        s.component.toUpperCase() === wantComp
    ) ?? null
  );
}

// Collapse leading zeros so "01" → "1", "001" → "1". Special-case: a value
// that's purely zeros ("0", "00") collapses to a single "0" — never empty —
// because section "0" is technically distinct from a missing section.
export function normalizeSectionNumber(value: string): string {
  if (!value) return value;
  const stripped = value.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

// Class-number search returns a single group with a single row whose class
// number matches exactly. We still walk all groups defensively in case
// CAESAR ever returns a wider result set.
export function locateByClassNumber(
  groups: CaesarCourseGroup[],
  classNumber: string
): { group: CaesarCourseGroup; section: CaesarSection } | null {
  const want = classNumber.trim();
  for (const group of groups) {
    for (const section of group.sections) {
      if (section.classNumber === want) return { group, section };
    }
  }
  return null;
}

// 400-level NU classes are catalogued under TGS even when undergrads can
// take them (see project memory). For everything else, undergrad-first
// matches the typical case. Two-element list so a wrong first guess always
// has a fallback.
export function careerOrderFor(bareCatalog: string): string[] {
  const num = parseInt(bareCatalog, 10);
  const gradFirst = Number.isFinite(num) && num >= 400;
  return gradFirst ? ["TGS", "UGRD"] : ["UGRD", "TGS"];
}
