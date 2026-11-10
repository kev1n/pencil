import { logQuiet } from "../../../shared/log";
import { parseCourseHistoryRow, type CourseHistoryEntry } from "../../course-history";
import { el, ensureStyle, type Augmentation } from "../../framework";
import { STYLE_ID, styles } from "./styles";

// CAESAR Course History: groups the native grid by term, filters it by
// status (In Progress off by default) and subject with inline chips, and
// downloads the visible rows as CSV. The native <tr>s are only reordered and hidden, never
// cloned, so each row's own onclick (OnRowAction with its row index) still
// opens CAESAR's class detail.

const TOOLBAR_ID = "bc-course-history-toolbar";
const GRID_BOX = '[id$="divCRSE_HIST2$0"]';
const ROW_SELECTOR = 'tr.ps_grid-row[id^="CRSE_HIST2$0_row_"]';
const ROW_INDEX_RE = /_row_(\d+)$/;
const TERM_ROW_CLASS = "bc-ch-term-row";
const HIDDEN_ATTR = "data-bc-ch-hidden";
const STATE_KEY = "better-caesar:course-history-view:v3";
const DEFAULT_HIDDEN_STATUSES = ["In Progress"];
const STATUS_ORDER = ["Taken", "Transferred", "In Cart", "Planned", "In Progress"];
const VISIBLE_SUBJECTS = 6;

type ViewState = { subject: string | null; hiddenStatuses: string[]; showAllSubjects: boolean };
type Count = [name: string, count: number];
type Row = { tr: HTMLTableRowElement; index: number; entry: CourseHistoryEntry };

function readState(): ViewState {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? "null") as Partial<ViewState> | null;
    return {
      subject: typeof raw?.subject === "string" ? raw.subject : null,
      hiddenStatuses: Array.isArray(raw?.hiddenStatuses) ? raw.hiddenStatuses : DEFAULT_HIDDEN_STATUSES,
      showAllSubjects: raw?.showAllSubjects === true
    };
  } catch (err) {
    logQuiet("course-history-view.state", err);
    return { subject: null, hiddenStatuses: DEFAULT_HIDDEN_STATUSES, showAllSubjects: false };
  }
}

function writeState(state: ViewState): void {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (err) {
    logQuiet("course-history-view.state", err);
  }
}

function rowIndex(tr: HTMLTableRowElement): number {
  return Number(ROW_INDEX_RE.exec(tr.id)?.[1] ?? 0);
}

function readRows(tbody: HTMLTableSectionElement): Row[] {
  const rows: Row[] = [];
  for (const tr of tbody.querySelectorAll<HTMLTableRowElement>(ROW_SELECTOR)) {
    const entry = parseCourseHistoryRow(tr);
    if (entry) rows.push({ tr, index: rowIndex(tr), entry });
  }
  // PeopleSoft numbers rows in its own display order (after any native
  // sort), so the index is the native order we restore and sort within.
  return rows.sort((a, b) => a.index - b.index);
}

function formatUnits(units: number): string {
  return `${units.toFixed(2)} ${units === 1 ? "unit" : "units"}`;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function courseHistoryCsv(entries: CourseHistoryEntry[]): string {
  const lines = [["Term", "Class", "Description", "Grade", "Units", "Status"]];
  for (const e of entries) {
    lines.push([
      e.termLabel,
      e.catalog,
      e.description,
      e.grade ?? "",
      e.units === null ? "" : e.units.toFixed(2),
      e.status
    ]);
  }
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function setAttrIfChanged(node: Element, name: string, value: string | null): void {
  if (node.getAttribute(name) === value) return;
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}

function countBy(rows: Row[], key: (entry: CourseHistoryEntry) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { entry } of rows) counts.set(key(entry), (counts.get(key(entry)) ?? 0) + 1);
  return counts;
}

function statusRank(status: string): number {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? STATUS_ORDER.length : i;
}

// Arrow into a tray, drawn in currentColor so it follows the link colour.
function downloadIcon(doc: Document): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS(NS, "path");
  path.setAttribute("d", "M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 11v2.5h11V11");
  svg.append(path);
  return svg;
}

function setTextIfChanged(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export class CourseHistoryViewAugmentation implements Augmentation {
  readonly id = "course-history-view";
  private state: ViewState = readState();

  run(doc: Document = document): void {
    const box = doc.querySelector<HTMLElement>(GRID_BOX);
    const tbody = box?.querySelector<HTMLTableSectionElement>("table.ps_grid-flex > tbody");
    if (!box || !tbody) return;
    const rows = readRows(tbody);
    if (rows.length === 0) return;

    ensureStyle(doc, STYLE_ID, styles);
    const subjectCounts = countBy(rows, (e) => e.subject);
    if (this.state.subject && !subjectCounts.has(this.state.subject)) {
      this.state = { ...this.state, subject: null };
    }
    // Biggest subjects first so the truncated row shows the useful ones.
    const subjects: Count[] = [...subjectCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const statuses: Count[] = [...countBy(rows, (e) => e.status)]
      .sort((a, b) => statusRank(a[0]) - statusRank(b[0]) || a[0].localeCompare(b[0]));
    this.renderToolbar(doc, box, subjects, statuses);
    this.renderGrid(doc, tbody, rows);
  }

  cleanup(doc: Document = document): void {
    doc.getElementById(TOOLBAR_ID)?.remove();
    doc.getElementById(STYLE_ID)?.remove();
    for (const header of doc.querySelectorAll(`tr.${TERM_ROW_CLASS}`)) header.remove();
    const tbody = doc.querySelector<HTMLTableSectionElement>(`${GRID_BOX} table.ps_grid-flex > tbody`);
    if (!tbody) return;
    const native = Array.from(tbody.querySelectorAll<HTMLTableRowElement>(ROW_SELECTOR));
    for (const tr of native) tr.removeAttribute(HIDDEN_ATTR);
    native.sort((a, b) => rowIndex(a) - rowIndex(b));
    for (const tr of native) tbody.appendChild(tr);
  }

  private update(doc: Document, next: Partial<ViewState>): void {
    this.state = { ...this.state, ...next };
    writeState(this.state);
    this.run(doc);
  }

  private isVisible({ entry }: Row): boolean {
    const { subject, hiddenStatuses } = this.state;
    if (subject && entry.subject !== subject) return false;
    return !hiddenStatuses.includes(entry.status);
  }

  private orderedGroups(rows: Row[]): Array<{ term: string; rows: Row[] }> {
    const groups = new Map<string, { term: string; start: string; rows: Row[] }>();
    for (const row of rows) {
      const term = row.entry.termLabel || "Other";
      const group = groups.get(term) ?? { term, start: row.entry.termStartDate ?? "", rows: [] };
      group.rows.push(row);
      groups.set(term, group);
    }
    // Newest term first; terms without a start date sink to the bottom.
    return [...groups.values()].sort((a, b) => b.start.localeCompare(a.start));
  }

  private renderGrid(doc: Document, tbody: HTMLTableSectionElement, rows: Row[]): void {
    const columns = tbody.closest("table")?.tHead?.rows[0]?.cells.length ?? 7;
    const existingHeaders = new Map<string, HTMLTableRowElement>();
    for (const header of tbody.querySelectorAll<HTMLTableRowElement>(`tr.${TERM_ROW_CLASS}`)) {
      existingHeaders.set(header.dataset.bcChTerm ?? "", header);
    }

    const desired: HTMLTableRowElement[] = [];
    for (const group of this.orderedGroups(rows)) {
      const header = existingHeaders.get(group.term) ?? this.createTermRow(doc, group.term);
      existingHeaders.delete(group.term);
      const shown = group.rows.filter((r) => this.isVisible(r));
      const units = shown.reduce((sum, r) => sum + (r.entry.units ?? 0), 0);
      const cell = header.cells[0]!;
      setAttrIfChanged(cell, "colspan", String(columns));
      setTextIfChanged(cell.querySelector(".bc-ch-term-meta")!,
        `${shown.length} ${shown.length === 1 ? "class" : "classes"} · ${formatUnits(units)}`);
      setAttrIfChanged(header, HIDDEN_ATTR, shown.length === 0 ? "1" : null);
      desired.push(header);
      for (const row of group.rows) {
        setAttrIfChanged(row.tr, HIDDEN_ATTR, this.isVisible(row) ? null : "1");
        desired.push(row.tr);
      }
    }
    for (const stale of existingHeaders.values()) stale.remove();

    // Only touch the DOM when the order differs, so the runner's
    // mutation-driven re-runs settle instead of looping.
    const current = Array.from(tbody.children);
    if (current.length === desired.length && desired.every((tr, i) => current[i] === tr)) return;
    for (const tr of desired) tbody.appendChild(tr);
  }

  private createTermRow(doc: Document, term: string): HTMLTableRowElement {
    return el(doc, "tr", { class: TERM_ROW_CLASS, dataset: { bcChTerm: term } }, [
      el(doc, "th", { attrs: { scope: "rowgroup" } }, [
        el(doc, "span", { class: "bc-ch-term-label", text: term }),
        el(doc, "span", { class: "bc-ch-term-meta" })
      ])
    ]);
  }

  private renderToolbar(doc: Document, box: HTMLElement, subjects: Count[], statuses: Count[]): void {
    // Sit in CAESAR's own grid header bar (replacing its Filter button, whose
    // only option is status) so the filters read as part of the grid.
    const host = box.querySelector<HTMLElement>(".ps_header-grid-custom");
    const signature = JSON.stringify([this.state, subjects, statuses]);
    let toolbar = doc.getElementById(TOOLBAR_ID);
    const placed = host ? toolbar?.parentElement === host : toolbar?.nextElementSibling === box;
    if (toolbar && placed && toolbar.dataset.bcSignature === signature) return;
    toolbar?.remove();

    const { subject, hiddenStatuses, showAllSubjects } = this.state;
    const chip = (label: string, count: number | null, pressed: boolean, onClick: () => void) =>
      el(doc, "button", {
        class: "bc-ch-chip",
        attrs: { type: "button", "aria-pressed": String(pressed) },
        on: { click: onClick }
      }, [label, count !== null && el(doc, "span", { class: "bc-ch-count", text: String(count) })]);

    const statusChips = statuses.map(([status, count]) => {
      const shown = !hiddenStatuses.includes(status);
      return chip(status, count, shown, () => this.update(doc, {
        hiddenStatuses: shown ? [...hiddenStatuses, status] : hiddenStatuses.filter((s) => s !== status)
      }));
    });

    let listed = showAllSubjects ? subjects : subjects.slice(0, VISIBLE_SUBJECTS);
    // Keep the selected subject visible even when it is past the cut-off.
    if (subject && !listed.some(([s]) => s === subject)) {
      listed = [...listed, ...subjects.filter(([s]) => s === subject)];
    }
    const extra = subjects.length - listed.length;
    const subjectChips = [
      chip("All", null, subject === null, () => this.update(doc, { subject: null })),
      ...listed.map(([s, count]) => chip(s, count, subject === s, () => this.update(doc, { subject: s }))),
      (extra > 0 || showAllSubjects) && el(doc, "button", {
        class: "bc-ch-more",
        text: showAllSubjects ? "Show less" : `+${extra} more`,
        attrs: { type: "button", "aria-expanded": String(showAllSubjects) },
        on: { click: () => this.update(doc, { showAllSubjects: !showAllSubjects }) }
      })
    ];

    const row = (label: string, children: Node[], trailing?: Node) =>
      el(doc, "div", { class: "bc-ch-row", attrs: { role: "group", "aria-label": label } }, [
        el(doc, "span", { class: "bc-ch-label", text: label }),
        el(doc, "div", { class: "bc-ch-chips" }, children),
        trailing
      ]);

    toolbar = el(doc, "div", {
      attrs: { id: TOOLBAR_ID, role: "toolbar", "aria-label": "Course History filters" },
      dataset: { bcSignature: signature }
    }, [
      row("Status", statusChips, el(doc, "button", {
        class: "bc-ch-download",
        attrs: { type: "button", title: "Download the classes shown below as a CSV file" },
        on: { click: () => this.download(doc) }
      }, [downloadIcon(doc), "Download CSV"])),
      row("Subject", subjectChips.filter((c): c is HTMLButtonElement => c !== false))
    ]);
    if (host) host.append(toolbar);
    else box.before(toolbar);
  }

  private download(doc: Document): void {
    const tbody = doc.querySelector<HTMLTableSectionElement>(`${GRID_BOX} table.ps_grid-flex > tbody`);
    if (!tbody) return;
    // Read the grid as it stands, so the file matches the on-screen order.
    const entries = Array.from(tbody.querySelectorAll<HTMLTableRowElement>(ROW_SELECTOR))
      .filter((tr) => !tr.hasAttribute(HIDDEN_ATTR))
      .map((tr) => parseCourseHistoryRow(tr))
      .filter((e): e is CourseHistoryEntry => e !== null);
    const url = URL.createObjectURL(new Blob([courseHistoryCsv(entries)], { type: "text/csv" }));
    const suffix = this.state.subject ? `-${this.state.subject.toLowerCase()}` : "";
    const link = el(doc, "a", { attrs: { href: url, download: `course-history${suffix}.csv` } });
    doc.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export const courseHistoryViewAugmentation = new CourseHistoryViewAugmentation();
