import { getDataMapInfo } from "../class-search/paper-data";

// Reads the term the user is currently planning on paper.nu.
//
// Resolve the term for CTEC enrichment. Cart adds use the DOM reader
// directly because they must verify the term before writing to CAESAR.
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
  // Searching hides the term button, but the search field still names
  // the quarter (e.g. "Search 2027 Winter..."). Ignore the plan-mode
  // placeholder ("Search for classes...").
  for (const input of doc.querySelectorAll<HTMLInputElement>('input[placeholder^="Search "]')) {
    const match = /^Search (\d{4} (?:Fall|Winter|Spring|Summer))\.\.\.$/.exec(input.placeholder);
    if (match?.[1]) return match[1];
  }
  return null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
