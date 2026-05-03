import type { ModalDisplayData, ModalTerm } from "../modal-data";
import { stopPropagation } from "../ui-shared";

// Section card with a header (title + optional right-side meta + optional
// CTA link) and an empty body slot the caller fills. Used by overview and
// terms tabs to keep card visuals consistent.
export function renderCard(
  doc: Document,
  title: string,
  right: string,
  cta?: { label: string; href: string }
): { root: HTMLElement; body: HTMLElement } {
  const root = doc.createElement("section");
  root.className = "bc-paper-ctec-modal-card-section";

  const head = doc.createElement("div");
  head.className = "bc-paper-ctec-modal-card-head";
  const titleEl = doc.createElement("div");
  titleEl.className = "bc-paper-ctec-modal-card-title";
  titleEl.textContent = title;
  head.append(titleEl);

  if (right || cta) {
    const meta = doc.createElement("div");
    meta.className = "bc-paper-ctec-modal-card-meta";
    if (right) {
      const right_el = doc.createElement("span");
      right_el.textContent = right;
      meta.append(right_el);
    }
    if (cta) {
      const link = doc.createElement("a");
      link.href = cta.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = cta.label;
      link.className = "bc-paper-ctec-modal-card-cta";
      link.addEventListener("click", stopPropagation);
      meta.append(link);
    }
    head.append(meta);
  }
  root.append(head);

  const body = doc.createElement("div");
  body.className = "bc-paper-ctec-modal-card-body";
  root.append(body);

  return { root, body };
}

export function spacerCell(doc: Document): HTMLElement {
  const cell = doc.createElement("div");
  cell.className = "bc-paper-ctec-modal-heatmap-spacer";
  return cell;
}

// Selected term resolver. The selectedId might be stale (term gone from the
// dataset after a refresh) — fall back to the most recent term so the modal
// always has *some* term to show in the drill-in panes.
export function pickSelectedTerm(
  data: ModalDisplayData,
  selectedId: string | null
): ModalTerm | null {
  if (selectedId) {
    const match = data.terms.find((term) => term.id === selectedId);
    if (match) return match;
  }
  return data.terms[0] ?? null;
}
