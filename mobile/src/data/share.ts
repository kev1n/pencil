// Moving a plan between devices without a server. A plan fits in a link (the
// term and its section ids, which are Paper.nu's own ids), shown as text and
// as a QR code. Paper.nu share links can be read too: those name a copy kept
// on Paper.nu's server, which anyone holding the link may fetch.
import { getTermCourses } from "@ext/content/augmentations/class-search/paper-data";
import { fetchTextViaBackground } from "@ext/content/remote-fetch";
import { selectTerm } from "./catalog";
import { addToSchedule, isPlanned } from "./schedule";
import { createStore } from "./store";

const LINK = "https://pencil.nu/plan";
const PAPER_SHARE = "https://api-legacy.dilanxd.com/paper/share/";

export type SharedPlan = { termId: string; sectionIds: string[] };

export function planLink(plan: SharedPlan): string {
  return `${LINK}#t=${encodeURIComponent(plan.termId)}&s=${plan.sectionIds.map(encodeURIComponent).join(",")}`;
}

function readPencilLink(text: string): SharedPlan | null {
  const match = /(?:pencil\.nu\/plan\/?|pencilnu:\/\/plan\/?)#(\S+)/i.exec(text);
  if (!match) return null;
  const params = new URLSearchParams(match[1]);
  const termId = params.get("t") ?? "";
  // URLSearchParams has already decoded the ids.
  const sectionIds = (params.get("s") ?? "").split(",").filter(Boolean);
  return termId && sectionIds.length > 0 ? { termId, sectionIds } : null;
}

async function readPaperLink(text: string): Promise<SharedPlan | null> {
  const match = /paper\.nu\/?#([a-z0-9]{8})(?![a-z0-9])/i.exec(text);
  if (!match) return null;
  const body = await fetchTextViaBackground(PAPER_SHARE + match[1].toUpperCase(), { timeoutMs: 20000 });
  const data = (JSON.parse(body) as { data?: { termId?: string; schedule?: unknown[] } }).data;
  if (!data?.termId) throw new Error("That Paper.nu link holds a course plan, not a class schedule.");
  // Custom blocks (objects) have no section to look up; only real sections move.
  const sectionIds = (data.schedule ?? []).filter((entry): entry is string => typeof entry === "string");
  return { termId: data.termId, sectionIds };
}

// A plan link the app was opened with (the website's "Open in Pencil" button,
// or a link tapped elsewhere). The You screen picks it up and adds it.
export const incomingLink = createStore<string | null>(null);

export function listenForLinks(launch: Promise<{ url: string }>): void {
  void launch.then((r) => r.url && incomingLink.set(r.url)).catch(() => undefined);
  window.addEventListener("pencil:link", (event) => incomingLink.set((event as CustomEvent<string>).detail));
}

export type ImportResult = { termId: string; added: number; already: number; missing: number };

// Adds the plan a link describes to this device's schedule. Throws when the
// text is not a plan link or the link cannot be fetched.
export async function importPlan(text: string): Promise<ImportResult> {
  const plan = readPencilLink(text) ?? (await readPaperLink(text));
  if (!plan) throw new Error("That isn’t a Pencil or Paper.nu plan link.");
  const courses = await getTermCourses(plan.termId);
  const result: ImportResult = { termId: plan.termId, added: 0, already: 0, missing: 0 };
  for (const id of plan.sectionIds) {
    if (isPlanned(plan.termId, id)) {
      result.already += 1;
      continue;
    }
    const course = courses.find((c) => c.sections.some((s) => s.section_id === id));
    const section = course?.sections.find((s) => s.section_id === id);
    if (!course || !section) {
      result.missing += 1;
      continue;
    }
    addToSchedule({ termId: plan.termId, subject: course.subject, catalog: course.catalog, title: course.title, section });
    result.added += 1;
  }
  if (result.added > 0) selectTerm(plan.termId);
  return result;
}
