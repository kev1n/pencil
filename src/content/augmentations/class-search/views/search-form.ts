// Top-of-page chrome for the class-search augmentation: tab bar, search
// header, query input, term <select>, and the wrapping card that frames
// status + results.
//
// Pure render. The augmentation supplies callbacks (term change, query
// input, tab click) and the live `statusEl` / `resultsEl` it owns so the
// returned root can compose them without view-side mutation tracking.
//
// Extracted from augmentation.ts (Wave 5g). No behavior change.

import { listTerms, type DataMapInfo } from "../paper-data";
import type { TabId } from "../types";

export const TABS_ID = "better-caesar-class-search-tabs";

export type ShellViewProps = {
  /** Current term id (selects the matching <option> on render). */
  termId: string;
  /** Term metadata used to populate the <select>. */
  info: DataMapInfo;
  /** Pre-built status element, owned by the augmentation. Inserted into
   *  the card so status writes show up in the right place. */
  statusEl: HTMLElement;
  /** Pre-built results element, owned by the augmentation. Inserted as
   *  the bottom child of the shell. */
  resultsEl: HTMLElement;
  onQueryInput(value: string): void;
  onTermChange(termId: string): void;
};

export function renderSearchShell(doc: Document, props: ShellViewProps): HTMLElement {
  const root = doc.createElement("div");
  root.className = "bc-cs-shell";

  const header = doc.createElement("div");
  header.className = "bc-cs-header";
  const title = doc.createElement("h1");
  title.className = "bc-cs-title";
  title.textContent = "Search for Classes";
  const subtitle = doc.createElement("div");
  subtitle.className = "bc-cs-subtitle";
  subtitle.innerHTML = `Catalog from <a href="https://paper.nu" target="_blank" rel="noopener">paper.nu</a> · live status fetched from CAESAR on demand`;
  header.append(title, subtitle);

  const card = doc.createElement("div");
  card.className = "bc-cs-card";

  const form = doc.createElement("div");
  form.className = "bc-cs-form";
  form.append(buildQueryField(doc, props), buildTermField(doc, props));

  props.statusEl.className = "bc-cs-status";
  props.statusEl.textContent = "";

  props.resultsEl.className = "bc-cs-results";

  card.append(form, props.statusEl);

  root.append(header, card, props.resultsEl);
  return root;
}

export type TabBarProps = {
  /** Returns the current active tab id at click time. The button uses this
   *  to short-circuit "click on already-active tab" instead of capturing
   *  the value at render time, which would go stale after tab swaps. */
  getActiveTab(): TabId;
  onSelect(tab: TabId): void;
};

export function renderTabBar(doc: Document, props: TabBarProps): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.id = TABS_ID;
  wrap.className = "bc-cs-tabs";
  wrap.append(
    buildTabButton(doc, "better", "Sharper Search", props),
    buildTabButton(doc, "classic", "Classic CAESAR", props)
  );
  return wrap;
}

/**
 * Reflect the active tab onto every button in the tab bar by toggling
 * `dataset.active`. Used after a tab swap so styling stays in sync.
 */
export function syncTabButtonActive(doc: Document, activeTab: TabId): void {
  const tabsEl = doc.getElementById(TABS_ID);
  tabsEl?.querySelectorAll<HTMLButtonElement>("button.bc-cs-tab").forEach((el) => {
    el.dataset.active = el.dataset.tab === activeTab ? "true" : "false";
  });
}

// ── Internals ──────────────────────────────────────────────────────────────

function buildQueryField(doc: Document, props: ShellViewProps): HTMLDivElement {
  const field = doc.createElement("div");
  field.className = "bc-cs-field bc-cs-field-query";
  const label = doc.createElement("label");
  label.htmlFor = "bc-cs-query";
  label.textContent = "Search";
  const input = doc.createElement("input");
  input.id = "bc-cs-query";
  input.className = "bc-cs-input bc-cs-input-query";
  input.placeholder = "comp_sci 111, machine learning, stat 21x, …";
  input.autocomplete = "off";
  input.addEventListener("input", () => {
    props.onQueryInput(input.value);
  });
  field.append(label, input);
  return field;
}

function buildTermField(doc: Document, props: ShellViewProps): HTMLDivElement {
  const field = doc.createElement("div");
  field.className = "bc-cs-field";
  const label = doc.createElement("label");
  label.htmlFor = "bc-cs-term";
  label.textContent = "Term";
  const select = doc.createElement("select");
  select.id = "bc-cs-term";
  select.className = "bc-cs-select";

  const terms = listTerms(props.info);
  for (const term of terms) {
    const option = doc.createElement("option");
    option.value = term.id;
    option.textContent = term.name;
    if (term.id === props.termId) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener("change", () => {
    props.onTermChange(select.value);
  });

  field.append(label, select);
  return field;
}

function buildTabButton(
  doc: Document,
  id: TabId,
  label: string,
  props: TabBarProps
): HTMLButtonElement {
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className = "bc-cs-tab";
  btn.dataset.tab = id;
  btn.textContent = label;
  btn.dataset.active = props.getActiveTab() === id ? "true" : "false";
  btn.addEventListener("click", () => {
    if (props.getActiveTab() === id) return;
    props.onSelect(id);
  });
  return btn;
}
