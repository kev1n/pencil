// Inline Foundational Discipline filter chips for the class-search status
// row. Pure DOM — the mount-state controller wires up state.filters.disciplines
// and re-renders results on toggle. Each chip is a <label> + <input
// type=checkbox> so the affordance reads "toggleable filter" not "button".

import { FOUNDATIONAL_DISCIPLINES } from "../types";
import type { SearchFilters } from "../types";

import { renderDisciplineIcon } from "./discipline-icons";

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
    const label = doc.createElement("label");
    label.className = "bc-cs-fd-chip";
    label.dataset.fd = fd.code;
    label.title = `Filter to ${fd.label}`;

    const input = doc.createElement("input");
    input.type = "checkbox";
    input.checked = props.filters.disciplines.has(fd.code);
    input.addEventListener("change", () => {
      if (input.checked) props.filters.disciplines.add(fd.code);
      else props.filters.disciplines.delete(fd.code);
      props.onChange();
    });

    const icon = renderDisciplineIcon(doc, fd.code);
    const text = doc.createElement("span");
    text.textContent = fd.short;

    label.append(input, icon, text);
    host.appendChild(label);
  }
}
