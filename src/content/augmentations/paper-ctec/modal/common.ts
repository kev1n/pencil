import { html, type TemplateResult } from "lit-html";

import { seasonIcon, seasonOf } from "../../../design/icons";
import type { ModalDisplayData, ModalTerm } from "../modal-data";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState
} from "./types";

// A chart whose counts are still being read from its image ("pending"),
// could not be read ("failed"), or were read.
export type ChartRead = number[] | "pending" | "failed";

// State that only matters while the sheet is on screen. Everything the
// controller needs to restore on reopen lives on AnalyticsModalState.
export type SheetLocal = {
  lensOpen: boolean;
  // Index into data.trendTerms (oldest first) the ratings sparklines are
  // scrubbed to, or null.
  scrub: number | null;
  // What the ratings header says while a distribution bar is hovered.
  peek: string | null;
  // Counts read from chart images on demand, keyed by image URL.
  charts: Map<string, ChartRead>;
};

// Everything a section of the sheet needs to draw itself.
export type SheetContext = {
  input: AnalyticsModalInput;
  data: ModalDisplayData;
  state: AnalyticsModalState;
  callbacks: AnalyticsModalCallbacks;
  local: SheetLocal;
  // The selected term, or null for all terms.
  term: ModalTerm | null;
  // The sheet's root element, once mounted.
  sheet: () => HTMLElement | null;
  // Redraws without a round trip through the controller.
  rerender: () => void;
  // Selects a term (null = all terms) and scrolls the sheet to the top.
  selectTerm: (id: string | null) => void;
};

// "2026 Fall" or "Fall 2026" -> "Fall 2026". Anything else passes through.
export function termName(term: string): string {
  const season = seasonOf(term);
  const year = term.match(/\b\d{4}\b/)?.[0];
  if (!season || !year) return term;
  return `${season[0]!.toUpperCase()}${season.slice(1)} ${year}`;
}

// "2026 Fall" -> "’26".
export function termShortYear(term: string): string {
  const year = term.match(/\b\d{4}\b/)?.[0];
  return year ? `’${year.slice(2)}` : term;
}

// Season icon followed by the term's name (or the text given).
export function termLabel(term: string, text: string = termName(term)): TemplateResult {
  const season = seasonOf(term);
  return html`<span class="bc-sheet-termlabel"
    >${season ? seasonIcon(season, 13) : ""}<span>${text}</span></span
  >`;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
