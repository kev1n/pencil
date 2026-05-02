import {
  NOTES_CELL_CLASS,
  NOTES_HEADER_CLASS,
  SEATS_CELL_CLASS,
  SEATS_HEADER_CLASS,
  STYLE_ID
} from "./constants";
import type { RowCells, SeatsNotesResult, SeatsNotesSuccess } from "./types";

const TIMESTAMP_REFRESH_INTERVAL_MS = 30_000;
let timestampRefreshTimer: number | null = null;

export function ensureCustomHeaders(table: HTMLTableElement): void {
  const headerRow = table.querySelector("tr");
  if (!headerRow) return;

  if (!headerRow.querySelector(`.${SEATS_HEADER_CLASS}`)) {
    const seatsHeader = document.createElement("th");
    seatsHeader.scope = "col";
    seatsHeader.className = `PSLEVEL1GRIDCOLUMNHDR ${SEATS_HEADER_CLASS}`;
    seatsHeader.textContent = "Seats";
    headerRow.appendChild(seatsHeader);
  }

  if (!headerRow.querySelector(`.${NOTES_HEADER_CLASS}`)) {
    const notesHeader = document.createElement("th");
    notesHeader.scope = "col";
    notesHeader.className = `PSLEVEL1GRIDCOLUMNHDR ${NOTES_HEADER_CLASS}`;
    notesHeader.textContent = "Notes";
    headerRow.appendChild(notesHeader);
  }
}

export function ensureCustomCells(row: HTMLTableRowElement): RowCells {
  return {
    seatsCell: ensureCustomCell(row, SEATS_CELL_CLASS),
    notesCell: ensureCustomCell(row, NOTES_CELL_CLASS)
  };
}

export function renderIdle(cells: RowCells, classNumber: string, onLoad: () => void): void {
  cells.seatsCell.dataset.classNumber = classNumber;
  cells.notesCell.dataset.classNumber = classNumber;
  cells.seatsCell.dataset.bcState = "idle";
  cells.notesCell.dataset.bcState = "idle";

  clearChildren(cells.seatsCell);
  clearChildren(cells.notesCell);

  const wrap = document.createElement("div");
  wrap.className = "better-caesar-idle";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "better-caesar-load-btn";
  button.textContent = "Load seats & notes";
  button.addEventListener("click", () => {
    onLoad();
  });
  wrap.appendChild(button);

  cells.seatsCell.appendChild(wrap);

  const dash = document.createElement("div");
  dash.className = "better-caesar-muted";
  dash.textContent = "—";
  cells.notesCell.appendChild(dash);
}

export function renderLoading(cells: RowCells, classNumber: string): void {
  cells.seatsCell.dataset.classNumber = classNumber;
  cells.notesCell.dataset.classNumber = classNumber;
  cells.seatsCell.dataset.bcState = "loading";
  cells.notesCell.dataset.bcState = "loading";
  cells.seatsCell.textContent = "Loading seats…";
  cells.notesCell.textContent = "Loading notes…";
}

export function renderLoaded(
  cells: RowCells,
  result: SeatsNotesResult,
  fetchedAt: number,
  classNumber: string,
  onRefresh: () => void
): void {
  cells.seatsCell.dataset.classNumber = classNumber;
  cells.notesCell.dataset.classNumber = classNumber;
  cells.seatsCell.dataset.bcState = "loaded";
  cells.notesCell.dataset.bcState = "loaded";

  clearChildren(cells.seatsCell);
  clearChildren(cells.notesCell);

  const meta = buildMetaBar(fetchedAt, onRefresh);
  cells.seatsCell.appendChild(meta);

  if (!result.ok) {
    cells.seatsCell.appendChild(buildError(`Unavailable: ${result.error}`));
    cells.notesCell.appendChild(buildError("No notes available."));
    return;
  }

  cells.seatsCell.appendChild(buildSeatsCard(result));
  cells.notesCell.appendChild(buildNotesCard(result, classNumber));

  ensureTimestampRefresh();
}

export function getCellState(cells: RowCells): string | undefined {
  return cells.seatsCell.dataset.bcState;
}

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --bc-tyrian: #66023c;
      --bc-tyrian-soft: #f6ecf2;
      --bc-tyrian-mid: #d8b6c8;
      --bc-tyrian-ink: #3f0126;
      --bc-good-bg: #e8f5e9;
      --bc-good-ink: #1b5e20;
    }
    .${SEATS_HEADER_CLASS},
    .${NOTES_HEADER_CLASS} {
      min-width: 220px;
      color: #fff;
      background: var(--bc-tyrian);
      border-color: var(--bc-tyrian-ink);
    }
    .${SEATS_CELL_CLASS},
    .${NOTES_CELL_CLASS} {
      min-width: 220px;
      width: 220px;
      max-width: 320px;
      padding: 4px 6px;
      border-left: 2px solid var(--bc-tyrian-mid);
      vertical-align: top;
      overflow: hidden;
      box-sizing: border-box;
    }
    .better-caesar-idle {
      display: grid;
      gap: 6px;
      padding: 8px 4px;
    }
    .better-caesar-load-btn {
      padding: 6px 10px;
      font: 600 11px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: 0.3px;
      cursor: pointer;
      border: 1px solid var(--bc-tyrian);
      background: #fff;
      color: var(--bc-tyrian);
      border-radius: 4px;
    }
    .better-caesar-load-btn:hover { background: var(--bc-tyrian); color: #fff; }
    .better-caesar-load-btn:disabled { opacity: 0.6; cursor: default; }
    .better-caesar-load-btn:disabled:hover { background: #fff; color: var(--bc-tyrian); }
    .better-caesar-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 10px;
      color: var(--bc-tyrian);
    }
    .better-caesar-meta-time {
      font-weight: 600;
      letter-spacing: 0.2px;
    }
    .better-caesar-refresh-btn {
      padding: 2px 6px;
      font: 600 10px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      cursor: pointer;
      border: 1px solid var(--bc-tyrian);
      background: #fff;
      color: var(--bc-tyrian);
      border-radius: 3px;
    }
    .better-caesar-refresh-btn:hover { background: var(--bc-tyrian); color: #fff; }
    .better-caesar-refresh-btn:disabled { opacity: 0.6; cursor: default; }
    .better-caesar-refresh-btn:disabled:hover { background: #fff; color: var(--bc-tyrian); }
    .better-caesar-hint {
      font-size: 10px;
    }
    .better-caesar-card {
      display: grid;
      gap: 6px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--bc-tyrian-mid);
      background: var(--bc-tyrian-soft);
      color: var(--bc-tyrian-ink);
      font-size: 11px;
      line-height: 1.35;
      width: 100%;
      min-width: 0;
      overflow: hidden;
      box-sizing: border-box;
    }
    .better-caesar-pill {
      display: inline-block;
      justify-self: start;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-weight: 700;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .better-caesar-lines {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .better-caesar-line {
      font-size: 11px;
      color: var(--bc-tyrian-ink);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .better-caesar-note {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .better-caesar-note-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.25px;
      color: var(--bc-tyrian);
    }
    .better-caesar-note-text {
      color: var(--bc-tyrian-ink);
      overflow-wrap: anywhere;
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
    }
    .better-caesar-warning {
      color: #8a2e00;
      border-top: 1px dashed #d99a66;
      padding-top: 4px;
      font-weight: 600;
    }
    .better-caesar-muted {
      color: #5c4c56;
    }
    .better-caesar-error {
      color: #7a123f;
      font-size: 11px;
      padding: 4px 0;
    }
  `;
  const host = document.head ?? document.documentElement ?? document.body;
  if (!host) return;
  host.appendChild(style);
}

function buildMetaBar(fetchedAt: number, onRefresh: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "better-caesar-meta";

  const time = document.createElement("span");
  time.className = "better-caesar-meta-time";
  time.dataset.bcFetchedAt = String(fetchedAt);
  time.textContent = `Loaded ${formatRelativeTime(Date.now() - fetchedAt)}`;
  bar.appendChild(time);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "better-caesar-refresh-btn";
  button.textContent = "↻ Refresh";
  button.addEventListener("click", () => {
    onRefresh();
  });
  bar.appendChild(button);

  return bar;
}

function buildSeatsCard(response: SeatsNotesSuccess): HTMLElement {
  const card = document.createElement("div");
  card.className = "better-caesar-card";

  const primary = document.createElement("div");
  primary.className = "better-caesar-pill";
  const primaryLine = buildPrimarySeatsLine(response) ?? "Seat counts unavailable";
  primary.textContent = primaryLine;
  primary.title = primaryLine;
  applySeatsTone(primary, response);
  card.appendChild(primary);

  const details = document.createElement("div");
  details.className = "better-caesar-lines";
  appendLine(details, "Open seats", response.availableSeats ? `${response.availableSeats}` : null);
  appendLine(
    details,
    "Waitlist",
    response.waitListTotal && response.waitListCapacity
      ? `${response.waitListTotal}/${response.waitListCapacity}`
      : null
  );
  card.appendChild(details);

  return card;
}

function buildNotesCard(response: SeatsNotesSuccess, classNumber: string): HTMLElement {
  const card = document.createElement("div");
  card.className = "better-caesar-card";

  appendNote(card, "Class Attributes", response.classAttributes);
  appendNote(card, "Enrollment Requirements", response.enrollmentRequirements);
  appendNote(card, "Class Notes", response.classNotes);

  if (!response.classAttributes && !response.enrollmentRequirements && !response.classNotes) {
    const empty = document.createElement("div");
    empty.className = "better-caesar-muted";
    empty.textContent = "No notes listed.";
    card.appendChild(empty);
  }

  if (response.criteriaClassNumber && response.criteriaClassNumber !== classNumber) {
    const mismatch = document.createElement("div");
    mismatch.className = "better-caesar-warning";
    mismatch.textContent = `Criteria mismatch: ${response.criteriaClassNumber}`;
    card.appendChild(mismatch);
  }

  return card;
}

function buildPrimarySeatsLine(response: SeatsNotesSuccess): string | null {
  if (response.enrollmentTotal && response.classCapacity) {
    return `${response.enrollmentTotal}/${response.classCapacity} enrolled`;
  }
  if (response.availableSeats) {
    return `${response.availableSeats} seats open`;
  }
  return null;
}

function appendLine(container: HTMLElement, label: string, value: string | null): void {
  if (!value) return;
  const line = document.createElement("div");
  line.className = "better-caesar-line";
  const text = `${label}: ${value}`;
  line.textContent = text;
  line.title = text;
  container.appendChild(line);
}

function appendNote(container: HTMLElement, label: string, value: string | null): void {
  if (!value) return;
  const block = document.createElement("div");
  block.className = "better-caesar-note";

  const labelEl = document.createElement("div");
  labelEl.className = "better-caesar-note-label";
  labelEl.textContent = label;

  const textEl = document.createElement("div");
  textEl.className = "better-caesar-note-text";
  textEl.textContent = value;
  textEl.title = value;

  block.appendChild(labelEl);
  block.appendChild(textEl);
  container.appendChild(block);
}

function applySeatsTone(element: HTMLElement, response: SeatsNotesSuccess): void {
  const tone = getSeatsTone(response);
  element.style.background = tone.background;
  element.style.borderColor = tone.border;
  element.style.color = tone.ink;
}

function getSeatsTone(response: SeatsNotesSuccess): {
  background: string;
  border: string;
  ink: string;
} {
  const classCapacity = toNumber(response.classCapacity);
  const enrollmentTotal = toNumber(response.enrollmentTotal);
  const availableSeats = toNumber(response.availableSeats);
  const waitListTotal = toNumber(response.waitListTotal);

  if (classCapacity !== null) {
    if ((availableSeats !== null && availableSeats <= 0) || (enrollmentTotal !== null && enrollmentTotal >= classCapacity)) {
      return {
        background: "#fde8e8",
        border: "#f4a9a9",
        ink: "#8c1d18"
      };
    }

    if (enrollmentTotal !== null) {
      const occupancy = Math.min(Math.max(enrollmentTotal / classCapacity, 0), 1.2);
      return occupancyToTone(occupancy);
    }

    if (availableSeats !== null) {
      const occupancy = Math.min(Math.max((classCapacity - availableSeats) / classCapacity, 0), 1.2);
      return occupancyToTone(occupancy);
    }
  }

  if (waitListTotal !== null && waitListTotal > 0) {
    return {
      background: "#fff0d9",
      border: "#f1c27a",
      ink: "#8a4b00"
    };
  }

  return {
    background: "#eef2ff",
    border: "#c7d2fe",
    ink: "#3730a3"
  };
}

function occupancyToTone(occupancy: number): {
  background: string;
  border: string;
  ink: string;
} {
  if (occupancy >= 0.95) {
    return {
      background: "#fde8e8",
      border: "#f4a9a9",
      ink: "#8c1d18"
    };
  }
  if (occupancy >= 0.8) {
    return {
      background: "#fff1df",
      border: "#f7c58a",
      ink: "#94410d"
    };
  }
  if (occupancy >= 0.6) {
    return {
      background: "#fff8d9",
      border: "#eed46b",
      ink: "#7a5d00"
    };
  }
  if (occupancy >= 0.35) {
    return {
      background: "#eef8d7",
      border: "#bfdc7d",
      ink: "#4d6b00"
    };
  }
  return {
    background: "#e8f5e9",
    border: "#b9ddbc",
    ink: "#1b5e20"
  };
}

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildError(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "better-caesar-error";
  el.textContent = text;
  return el;
}

function ensureCustomCell(row: HTMLTableRowElement, customClass: string): HTMLTableCellElement {
  const existing = row.querySelector<HTMLTableCellElement>(`.${customClass}`);
  if (existing) return existing;

  const td = document.createElement("td");
  const rowClass = row.querySelector("td,th")?.className ?? "";
  td.className = `${rowClass} ${customClass}`.trim();
  td.style.verticalAlign = "top";
  row.appendChild(td);
  return td;
}

function clearChildren(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function ensureTimestampRefresh(): void {
  if (timestampRefreshTimer !== null) return;
  timestampRefreshTimer = window.setInterval(() => {
    const now = Date.now();
    document.querySelectorAll<HTMLElement>("[data-bc-fetched-at]").forEach((el) => {
      const ts = Number(el.dataset.bcFetchedAt);
      if (!Number.isFinite(ts)) return;
      el.textContent = `Loaded ${formatRelativeTime(now - ts)}`;
    });
  }, TIMESTAMP_REFRESH_INTERVAL_MS);
}

function formatRelativeTime(deltaMs: number): string {
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
