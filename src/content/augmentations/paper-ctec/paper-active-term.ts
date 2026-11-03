import { getDataMapInfo } from "../class-search/paper-data";

// Reads the term the user is currently planning on paper.nu.
//
// In schedule mode paper.nu always renders a "Change term" button next to
// the search controls — it shows the term name (e.g. "Spring 2026") and
// has a hover tooltip containing the literal text "Change term". We find
// that button by its tooltip child, peel the tooltip text off the button's
// textContent, and resolve the remaining name back to a term ID via
// paper-data's already-cached info map.
//
// Falls back to `info.latest` only if the button isn't on the page (plan
// mode, or a paper.nu UI rewrite). The cart-flow then surfaces a clear
// error if the assumed term doesn't actually contain the section.
export async function getActivePaperTermId(
  doc: Document = document
): Promise<{ termId: string; source: "dom" | "fallback" }> {
  const info = await getDataMapInfo();
  const domName = readActiveTermNameFromDom(doc);
  if (domName) {
    const target = normalize(domName);
    for (const [id, term] of Object.entries(info.terms)) {
      if (normalize(term.name) === target) {
        return { termId: id, source: "dom" };
      }
    }
  }
  return { termId: info.latest, source: "fallback" };
}

export function readActiveTermNameFromDom(doc: Document): string | null {
  // paper.nu's Tooltip component renders a `div.absolute.hidden` with the
  // tooltip text. Match by exact textContent so we don't confuse it with
  // the schedule's other tooltips ("Filter", "Search options", etc.).
  const tooltips = doc.querySelectorAll<HTMLElement>("button > div.absolute.hidden");
  for (const tooltip of Array.from(tooltips)) {
    if (tooltip.textContent?.trim() !== "Change term") continue;
    const button = tooltip.parentElement;
    if (!(button instanceof HTMLButtonElement)) continue;
    const full = button.textContent?.trim() ?? "";
    const name = full.replace("Change term", "").trim();
    if (name) return name;
  }
  return null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
