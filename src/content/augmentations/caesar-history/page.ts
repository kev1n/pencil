// What caesar-history reads from a CAESAR page: the selected left-hand tab,
// the name of the view on screen, and PeopleSoft's open dialog.

export const CONTENT_FRAME = "iframe.ps_target-iframe";
// Left-hand tab lists come in two layouts. Link menus tag each tab, and
// whatever they mark selected, with a `psa_tab_<name>` class; step lists
// name the step in each button's click handler.
const SELECTED_SIDE_TAB = '.psc_selected[class*="psa_tab_"], .ps_ag-step-button.psc_selected';
export const SIDE_TAB_LIST = '[class*="psa_tab_"], .ps_ag-step-button';
export const STEP_LIST = ".ps_ag-step-button";
const PENCIL_MARKUP = '[class*="bc-"], [id^="bc-"], [class*="better-caesar"], [id^="better-caesar"]';
const TAB_CLASS = /(?:^|\s)(psa_tab_\S+)/;
const STEP_ID = /openCustomStepButton\('([^']+)'/;
// PeopleSoft's dialogs (details pop-ups, lookups, messages) mount here.
const DIALOG = '#pt_modals [id^="ptMod_"]';
const DIALOG_FRAME = 'iframe[id^="ptModFrame_"]';
// The dialog's own close control. Cancelling never changes anything.
const DIALOG_CANCEL = "#ICCancel";

export function readSideTab(doc: Document): string | null {
  const selected = doc.querySelector(SELECTED_SIDE_TAB);
  if (!selected) return null;
  const step = selected.getAttribute("onclick")?.match(STEP_ID)?.[1];
  if (step) return `step:${step}`;
  const tab = selected.className.match(TAB_CLASS)?.[1];
  return tab ? `tab:${tab}` : null;
}

export function findSideTabOpener(doc: Document, key: string): HTMLElement | null {
  const name = CSS.escape(key.slice(key.indexOf(":") + 1));
  return doc.querySelector<HTMLElement>(
    key.startsWith("step:") ? `.ps_ag-step-button[onclick*="'${name}'"]` : `[onclick].${name}`
  );
}

export function hasDialog(doc: Document): boolean {
  return doc.querySelector(DIALOG) !== null;
}

// The open dialog's Cancel / close control, wherever the dialog renders it.
export function findDialogCancel(doc: Document): HTMLElement | null {
  const dialog = doc.querySelector(DIALOG);
  if (!dialog) return null;
  try {
    const inner = dialog.querySelector<HTMLIFrameElement>(DIALOG_FRAME)?.contentDocument;
    const found = inner?.getElementById(DIALOG_CANCEL) ?? null;
    if (found) return found;
  } catch {
    // A dialog frame from another site has no control we could press.
    return null;
  }
  return Array.from(dialog.querySelectorAll<HTMLElement>("[id]")).find((el) => el.id === DIALOG_CANCEL) ?? null;
}

export type ViewContext = {
  // A top window showing a content frame is only a shell around it: the
  // frame names its own views, the shell just names the tab.
  shell: boolean;
  searchTab: string;
};

// What a view shows, apart from which left-hand tab is selected.
export function viewContent(doc: Document, context: ViewContext): string {
  if (context.shell) return "";
  // Pencil's search tab is remembered per browser tab, so the frame's
  // choice is visible to the shell too; only the window showing the page
  // names it.
  const parts = [context.searchTab, doc.title];
  for (const heading of doc.querySelectorAll("form.PSForm .PAPAGETITLE, form.PSForm h1")) {
    // Pencil's own headings come and go as its panels mount.
    if (heading.closest(PENCIL_MARKUP)) continue;
    parts.push(heading.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "");
  }
  if (hasDialog(doc)) parts.push("dialog");
  return parts.join("|");
}

// A view's name: when it changes, the user has gone somewhere new. The top
// window names its selected left-hand tab; the frame leaves that to the top.
export function viewName(sideTab: string | null | undefined, content: string): string {
  return sideTab === undefined ? content : `${sideTab ?? ""}|${content}`;
}
