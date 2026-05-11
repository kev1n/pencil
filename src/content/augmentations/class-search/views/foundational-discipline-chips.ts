// Inline Foundational Discipline filter chips for the class-search status
// row. Pure DOM — the mount-state controller wires up state.filters.disciplines
// and re-renders results on toggle.

import { FOUNDATIONAL_DISCIPLINES } from "../types";
import type { FoundationalDisciplineCode, SearchFilters } from "../types";

export type FoundationalDisciplineChipsProps = {
  filters: SearchFilters;
  onChange(): void;
};

export function renderFoundationalDisciplineChips(
  doc: Document,
  host: HTMLElement,
  props: FoundationalDisciplineChipsProps
): void {
  host.innerHTML = "";
  host.className = "bc-cs-fd-filters";

  for (const fd of FOUNDATIONAL_DISCIPLINES) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "bc-cs-fd-chip";
    btn.dataset.fd = fd.code;
    btn.dataset.active = props.filters.disciplines.has(fd.code) ? "true" : "false";
    btn.textContent = fd.short;
    btn.title = `Filter to ${fd.label}`;
    btn.addEventListener("click", () => {
      toggleDiscipline(props.filters, fd.code);
      btn.dataset.active = props.filters.disciplines.has(fd.code) ? "true" : "false";
      props.onChange();
    });
    host.appendChild(btn);
  }
}

function toggleDiscipline(
  filters: SearchFilters,
  code: FoundationalDisciplineCode
): void {
  if (filters.disciplines.has(code)) filters.disciplines.delete(code);
  else filters.disciplines.add(code);
}
