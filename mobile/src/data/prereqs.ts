// Prerequisites, checked against the student's own course history with the
// extension's parser, evaluator and tree drawing.
import {
  buildHistoryMap,
  ensureParsedPrereqs,
  evaluateCourseId,
  getParsedNodeForCourseId,
  getRawForCourseId
} from "@ext/content/augmentations/prereq-filter/data";
import { renderPrereqTree } from "@ext/content/augmentations/prereq-filter/tree-render";
import type { EligibilityState } from "@ext/content/prereqs/types";

// `tree` shows the course's own requirements; `fullTree` also draws what
// those courses need, and is missing when that adds nothing.
export type Prereqs = {
  state: EligibilityState;
  notes: string[];
  tree: HTMLElement | null;
  fullTree: HTMLElement | null;
  raw: string | null;
};

// Course codes read "COMP SCI 211" everywhere else in the app.
function tidy(tree: HTMLElement): HTMLElement {
  const walker = document.createTreeWalker(tree, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) walker.currentNode.textContent = (walker.currentNode.textContent ?? "").replace(/_/g, " ");
  return tree;
}

export async function loadPrereqs(subject: string, catalog: string): Promise<Prereqs> {
  const parsed = await ensureParsedPrereqs();
  const history = buildHistoryMap();
  const id = `${subject} ${catalog}`;
  const result = evaluateCourseId(id, parsed, history);
  const node = getParsedNodeForCourseId(id, parsed);
  const target = { subject, number: catalog, state: result.state };
  const draw = (deep: boolean) =>
    tidy(renderPrereqTree(document, node, history, { parsedMap: deep ? parsed : undefined, target }).el);
  const tree = node ? draw(false) : null;
  const full = node ? draw(true) : null;
  return {
    state: result.state,
    notes: result.notes,
    tree,
    fullTree: full && full.textContent !== tree?.textContent ? full : null,
    raw: getRawForCourseId(id, parsed)
  };
}

// Whether the student's course history meets a course's prerequisites, for
// marking a whole list of courses at once.
export async function loadEligibility(): Promise<(subject: string, catalog: string) => EligibilityState> {
  const parsed = await ensureParsedPrereqs();
  const history = buildHistoryMap();
  return (subject, catalog) => evaluateCourseId(`${subject} ${catalog}`, parsed, history).state;
}
