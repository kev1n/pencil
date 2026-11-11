// caesar-history — makes the browser's Back and Forward buttons work inside
// CAESAR.
//
// CAESAR changes what is on screen without touching browser history, so Back
// leaves CAESAR altogether. This plugin records a history entry each time the
// view changes and brings the earlier view back on Back / Forward.
//
// One rule covers every kind of page:
//
// - A "view" is named by the selected left-hand tab (if the page has a tab
//   list), the page title and headings, Pencil's own search tab, and whether
//   a PeopleSoft dialog is open (`page.ts`). When that name changes, a history
//   entry is added.
// - Every entry lives in the TOP window's history, whether the view changed
//   in the top window or in the content frame CAESAR embeds classic pages in
//   (Manage Classes → Class Search). The frame never gets entries of its own,
//   so the browser never reloads it behind our back.
// - Going to an entry puts back a saved copy of the page's form, state number
//   included, and CAESAR's server resumes from it (`stack.ts` covers how far
//   back that works). When a copy cannot be resumed, the view is loaded
//   afresh instead: by re-opening its left-hand tab, or by reloading. Views
//   beside a step list, and frames, are always re-opened. An open dialog is
//   closed with its own Cancel, never by putting a copy back, because
//   PeopleSoft's script keeps its own record of open dialogs (`decide.ts`).
//
// It adds nothing visible to the page.

import { logQuiet } from "../../../shared/log";
import type { Augmentation } from "../../framework";
import { readActiveTab, writeActiveTab } from "../class-search/page-detection";
import type { TabId } from "../class-search/types";

import { decidePop, decideSettle, type PopTarget, type Reopening, type TabLoad } from "./decide";
import {
  CONTENT_FRAME,
  findDialogCancel,
  findSideTabOpener,
  hasDialog,
  readSideTab,
  SIDE_TAB_LIST,
  STEP_LIST,
  viewContent,
  viewName
} from "./page";
import { type Arrival, PageStack, type StackEntry } from "./stack";

type Snapshot = {
  // innerHTML of each of the form's top-level containers, by id. PeopleSoft
  // keeps those containers and replaces what is inside them.
  parts: Array<[id: string, html: string]>;
  // What the user typed or picked after the page rendered: not part of
  // innerHTML.
  values: Record<string, string>;
  title: string;
  ptHistory: string | null;
  searchTab: TabId;
  // Left-hand tab the view belongs to, when the page has a tab list.
  sideTab: string | null;
  framed: boolean;
  dialog: boolean;
  scrollY: number;
};

// One per window that records entries: the top window, and the content frame.
type Owner = "top" | "frame";
type OwnerState = { id: string; sideTab: string | null };
type HistoryState = { seq: number } & Partial<Record<Owner, OwnerState>>;

const STATE_KEY = "bcHistory";
const SEQ_KEY = "better-caesar:history-seq";
const PT_HISTORY_KEY = "pt_history";
// Buttons that change the user's cart or enrollment. Copies taken before one
// of these show data that is no longer true, so they are not put back.
const CHANGES_DATA = /\b(enroll|finish\w*|drop|swap|delete|save|submit|confirm|next|add|update|remove)\b/i;
const CLICK_SEALS_FOR_MS = 15_000;
// A view change often lands in two or three DOM updates; wait for them.
const SETTLE_MS = 150;
const REOPEN_GIVES_UP_AFTER_MS = 10_000;
// CAESAR ignores a tab picked while it is still loading another one (Back
// pressed twice in quick succession on a slow day), so the pick is repeated
// until the tab shows.
const REOPEN_RETRY_MS = 2_000;

function topWindow(): Window | null {
  try {
    const top = window.top;
    // Throws when the top window is another site.
    return top && top.location.host === window.location.host ? top : null;
  } catch {
    return null;
  }
}

// The top window, or the content frame it embeds. Pop-up dialog frames and
// anything else are left alone.
function ownerOf(): Owner | null {
  const top = topWindow();
  if (!top) return null;
  if (top === window) return "top";
  try {
    return window.frameElement?.matches(CONTENT_FRAME) ? "frame" : null;
  } catch {
    return null;
  }
}

function readState(value: unknown): HistoryState | null {
  const state = (value as Record<string, unknown> | null)?.[STATE_KEY] as HistoryState | undefined;
  return typeof state?.seq === "number" ? state : null;
}

function nextSeq(): number {
  try {
    const seq = Number(window.sessionStorage.getItem(SEQ_KEY) ?? "0") + 1;
    window.sessionStorage.setItem(SEQ_KEY, String(seq));
    return seq;
  } catch {
    return Date.now();
  }
}

export class CaesarHistoryAugmentation implements Augmentation {
  readonly id = "caesar-history";

  // Set by the content entry: tears down and re-runs every augmentation, so
  // a restored page gets freshly wired controls instead of dead copies.
  onRestore: () => void = () => undefined;

  private readonly stack = new PageStack<Snapshot>();
  private readonly instance = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  private nextId = 0;
  private owner: Owner | null = null;
  private top: Window | null = null;
  private seen: string | null = null;
  private lastState: string | null = null;
  private settleTimer: number | undefined;
  private sealedAt = 0;
  private tabLoad: TabLoad | null = null;
  // Entry being loaded afresh for Back / Forward; its arrival updates that
  // entry instead of adding one.
  private reopening: (Reopening & { index: number }) | null = null;
  // Entry to go on to once a dialog closed for Back has gone.
  private afterDialog: number | null = null;

  run(doc: Document = document): void {
    const owner = this.owner ?? ownerOf();
    const form = owner ? doc.querySelector<HTMLFormElement>("form.PSForm") : null;
    const stateNum = form?.querySelector<HTMLInputElement>("#ICStateNum")?.value;
    if (!owner || !form || !stateNum || doc.readyState === "loading") return;
    this.bind(owner);

    if (`${stateNum}|${this.viewName(doc)}` === this.seen) return;
    window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => this.settle(doc), SETTLE_MS);
  }

  cleanup(): void {
    if (!this.owner) return;
    this.owner = null;
    window.clearTimeout(this.settleTimer);
    this.top?.removeEventListener("popstate", this.onPopState);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("input", this.onInput, true);
  }

  private bind(owner: Owner): void {
    if (this.owner) return;
    this.owner = owner;
    this.top = topWindow();
    // The frame listens on the top window too: that is where entries live.
    this.top?.addEventListener("popstate", this.onPopState);
    window.addEventListener("pagehide", () => this.cleanup(), { once: true });
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("input", this.onInput, true);
  }

  private get shared(): DOMStringMap | null {
    return this.top?.document.documentElement.dataset ?? null;
  }

  private sideTab(): string | null {
    return this.top ? readSideTab(this.top.document) : null;
  }

  private isShell(doc: Document): boolean {
    return this.owner === "top" && doc.querySelector(CONTENT_FRAME) !== null;
  }

  private viewContent(doc: Document): string {
    return viewContent(doc, { shell: this.isShell(doc), searchTab: readActiveTab() });
  }

  private viewName(doc: Document): string {
    return viewName(this.owner === "top" ? this.sideTab() : undefined, this.viewContent(doc));
  }

  private takeSnapshot(doc: Document, form: HTMLFormElement): Snapshot {
    const shell = this.isShell(doc);
    return {
      parts: shell
        ? []
        : Array.from(form.children)
            .filter((child) => child.id)
            .map((child) => [child.id, child.innerHTML]),
      values: {},
      title: doc.title,
      ptHistory: this.owner === "top" ? window.sessionStorage.getItem(PT_HISTORY_KEY) : null,
      searchTab: readActiveTab(),
      sideTab: this.sideTab(),
      framed: shell || (this.owner === "top" && doc.querySelector(STEP_LIST) !== null),
      dialog: hasDialog(doc),
      scrollY: 0
    };
  }

  private settle(doc: Document): void {
    const form = doc.querySelector<HTMLFormElement>("form.PSForm");
    const stateNum = form?.querySelector<HTMLInputElement>("#ICStateNum")?.value;
    if (!this.owner || !this.top || !form || !stateNum) return;

    const view = this.viewName(doc);
    const lastState = this.lastState;
    const sameState = stateNum === lastState;
    this.seen = `${stateNum}|${view}`;
    this.lastState = stateNum;
    const snapshot = this.takeSnapshot(doc, form);

    const reopening = this.reopening;
    const current = this.stack.current;
    const decision = decideSettle({
      now: Date.now(),
      current: current && { sideTab: current.data.sideTab, dialog: current.data.dialog },
      sideTab: snapshot.sideTab,
      stateNum,
      lastState,
      dialog: snapshot.dialog,
      tabList: this.owner === "top" && doc.querySelector(SIDE_TAB_LIST) !== null,
      tabLoad: this.tabLoad,
      reopening
    });
    this.tabLoad = decision.tabLoad;

    if (decision.kind === "wait") return;
    if (decision.kind === "reopened" && reopening) {
      this.reopening = null;
      this.stack.adopt(reopening.index, view, Number(stateNum), snapshot);
    } else if (decision.kind === "same-entry") {
      if (sameState) this.stack.amend(view, snapshot);
      else this.stack.adopt(this.stack.pos, view, Number(stateNum), snapshot);
    } else {
      this.addEntry(view, stateNum, sameState, snapshot);
    }

    const after = this.afterDialog;
    if (after === null || snapshot.dialog) return;
    this.afterDialog = null;
    if (after !== this.stack.pos) this.bringBack(form, after, true);
  }

  private addEntry(view: string, stateNum: string, sameState: boolean, snapshot: Snapshot): void {
    const id = `${this.instance}:${(this.nextId += 1)}`;
    const first = this.stack.pos < 0;
    if (sameState) {
      // Same live form, so what the user typed carries over to the new view.
      snapshot.values = { ...this.stack.current?.data.values };
      this.record(this.stack.shift(view, snapshot, id), first);
      return;
    }
    const sealed = Date.now() - this.sealedAt < CLICK_SEALS_FOR_MS;
    this.sealedAt = 0;
    this.record(this.stack.arrive(view, Number(stateNum), snapshot, id, sealed), first);
  }

  private record(arrival: Arrival, first: boolean): void {
    const top = this.top;
    const owner = this.owner;
    const current = this.stack.current;
    if (!top || !owner || !current) return;

    if (arrival.kind === "rewind") {
      this.ignoreNextPop();
      top.history.go(-arrival.steps);
      return;
    }
    if (arrival.kind !== "push") return;

    const mine: OwnerState = { id: current.id, sideTab: current.data.sideTab };
    const entryState = this.entryState();
    const existing = readState(entryState);
    // The frame's first view shares the entry its tab was opened with.
    if (first && (owner === "frame" || existing)) {
      const state: HistoryState = { ...(existing ?? { seq: nextSeq() }), [owner]: mine };
      this.writeEntry({ ...entryState, [STATE_KEY]: state }, "replace");
      return;
    }
    const state: HistoryState = { ...existing, seq: nextSeq(), [owner]: mine };
    // A new tab means a new frame page; its entry is not the old frame's.
    if (owner === "top") delete state.frame;
    this.writeEntry({ ...(first ? entryState : null), [STATE_KEY]: state }, first ? "replace" : "push");
  }

  // The top window's current history state. `history.state` read from the
  // frame keeps the value it had before Back / Forward, so both windows use a
  // copy on the top document, kept by every write and every popstate.
  private entryState(): Record<string, unknown> | null {
    const copy = this.shared?.bcHistoryState;
    if (copy) {
      try {
        return JSON.parse(copy) as Record<string, unknown> | null;
      } catch (err) {
        logQuiet("caesar-history.entryState", err);
      }
    }
    return (this.top?.history.state as Record<string, unknown> | null) ?? null;
  }

  private keepEntryState(value: unknown): void {
    const shared = this.shared;
    const state = readState(value);
    if (!shared || !state) return;
    shared.bcHistoryState = JSON.stringify(value);
    shared.bcHistorySeq = String(state.seq);
  }

  private writeEntry(value: Record<string, unknown>, how: "push" | "replace"): void {
    if (how === "push") this.top?.history.pushState(value, "");
    else this.top?.history.replaceState(value, "");
    this.keepEntryState(value);
  }

  // Both windows hear every popstate, so the flags they must agree on live
  // on the top document, which both can read.
  private ignoreNextPop(): void {
    const shared = this.shared;
    if (!shared) return;
    shared.bcHistoryIgnore = "1";
    window.setTimeout(() => delete shared.bcHistoryIgnore, 1_000);
  }

  // Whether `state` is behind the entry we were on. The first listener to
  // run moves the marker, so it leaves the old position for the second.
  private isBehind(state: HistoryState): boolean {
    const shared = this.shared;
    if (!shared) return true;
    if (shared.bcHistorySeq !== String(state.seq)) {
      shared.bcHistoryPrevSeq = shared.bcHistorySeq ?? "0";
      shared.bcHistorySeq = String(state.seq);
    }
    return state.seq < Number(shared.bcHistoryPrevSeq ?? "0");
  }

  private readonly onClick = (event: MouseEvent): void => {
    const current = this.stack.current;
    if (current) current.data.scrollY = window.scrollY;
    // Pencil's search tabs change no DOM the runner watches, so look again
    // once the click has been handled.
    window.setTimeout(() => this.run(), 0);

    const control = (event.target as Element | null)?.closest?.("a, button, input");
    if (!control?.closest("form.PSForm")) return;
    const label = control instanceof HTMLInputElement ? control.value : control.textContent ?? "";
    if (CHANGES_DATA.test(label)) this.sealedAt = Date.now();
  };

  private readonly onInput = (event: Event): void => {
    const field = event.target;
    const current = this.stack.current;
    if (!current) return;
    if (
      !(field instanceof HTMLInputElement && field.type === "text") &&
      !(field instanceof HTMLTextAreaElement) &&
      !(field instanceof HTMLSelectElement)
    ) return;
    if (field.name && field.closest("form.PSForm")) current.data.values[field.name] = field.value;
  };

  private readonly onPopState = (event: PopStateEvent): void => {
    const shared = this.shared;
    const owner = this.owner;
    const state = readState(event.state);
    if (!shared || !owner || !state) return;
    if (shared.bcHistoryIgnore) {
      // Cleared after both windows have seen this event.
      window.setTimeout(() => delete shared.bcHistoryIgnore, 0);
      this.keepEntryState(event.state);
      return;
    }
    const behind = this.isBehind(state);
    this.keepEntryState(event.state);
    const form = document.querySelector<HTMLFormElement>("form.PSForm");
    if (!form) return;
    const target = state[owner];
    const index = target ? this.stack.indexOf(target.id) : -1;
    this.act(form, index, behind, {
      entrySideTab: target?.sideTab ?? null,
      topSideTab: state.top?.sideTab ?? null,
      topReopening: !!shared.bcHistoryReopening
    });
  };

  // Brings back the entry at `index` after the browser has moved to it.
  private bringBack(form: HTMLFormElement, index: number, behind: boolean): void {
    this.act(form, index, behind, { entrySideTab: null, topSideTab: this.sideTab(), topReopening: false });
  }

  private act(
    form: HTMLFormElement,
    index: number,
    behind: boolean,
    seen: { entrySideTab: string | null; topSideTab: string | null; topReopening: boolean }
  ): void {
    const owner = this.owner;
    if (!owner) return;
    const entry = this.stack.entries[index];
    const target: PopTarget | undefined = entry && {
      framed: entry.data.framed,
      dialog: entry.data.dialog,
      sideTab: entry.data.sideTab,
      restorable: this.stack.isRestorable(entry)
    };
    const cancel = findDialogCancel(form.ownerDocument);
    const action = decidePop({
      owner,
      index,
      pos: this.stack.pos,
      target,
      ...seen,
      shownSideTab: this.sideTab(),
      dialogOpen: cancel !== null
    });

    switch (action.kind) {
      case "none":
        return;
      case "close-dialog":
        this.closeDialog(index, cancel);
        return;
      case "restore":
        if (entry) this.restore(form, index, entry);
        return;
      case "reopen":
        if (this.reopen(action.sideTab, entry ? index : this.stack.pos)) return;
        if (action.otherwise === "reload") window.location.reload();
        else this.stepPast(behind);
        return;
      case "reload":
        // A reload forgets this stack; the entries it leaves behind are
        // stepped past later.
        window.location.reload();
        return;
      case "step-past":
        this.stepPast(behind);
    }
  }

  // The answer to Cancel shows the view beneath the dialog, which becomes the
  // current entry; Back past that one carries on once it has arrived.
  private closeDialog(index: number, cancel: HTMLElement | null): void {
    if (this.stack.current?.data.dialog) this.stack.pos -= 1;
    this.afterDialog = index;
    cancel?.click();
  }

  private reopen(sideTab: string, index: number): boolean {
    const opener = this.top ? findSideTabOpener(this.top.document, sideTab) : null;
    if (!opener || this.owner !== "top") return false;
    this.stack.pos = index;
    this.reopening = {
      index,
      sideTab,
      before: this.lastState ?? "",
      until: Date.now() + REOPEN_GIVES_UP_AFTER_MS
    };
    const shared = this.shared;
    if (shared) {
      shared.bcHistoryReopening = "1";
      window.setTimeout(() => delete shared.bcHistoryReopening, 0);
    }
    opener.click();
    this.retryReopen(this.reopening, sideTab);
    return true;
  }

  private retryReopen(reopening: Reopening, sideTab: string): void {
    window.setTimeout(() => {
      const top = this.top;
      if (this.reopening !== reopening || !top || Date.now() >= reopening.until) return;
      if (readSideTab(top.document) === sideTab) return;
      findSideTabOpener(top.document, sideTab)?.click();
      this.retryReopen(reopening, sideTab);
    }, REOPEN_RETRY_MS);
  }

  // An entry whose page is gone. Keep going the way the user was heading
  // when going back; refuse to move when going forward.
  private stepPast(behind: boolean): void {
    if (!behind) this.ignoreNextPop();
    this.top?.history.back();
  }

  private restore(form: HTMLFormElement, index: number, entry: StackEntry<Snapshot>): void {
    const doc = form.ownerDocument;
    const snapshot = entry.data;
    this.stack.pos = index;
    writeActiveTab(snapshot.searchTab);
    for (const [id, html] of snapshot.parts) {
      const part = doc.getElementById(id);
      if (part) part.innerHTML = html;
    }
    for (const [name, value] of Object.entries(snapshot.values)) {
      const field = form.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        field.value = value;
      }
    }
    doc.title = snapshot.title;
    try {
      if (snapshot.ptHistory !== null) {
        window.sessionStorage.setItem(PT_HISTORY_KEY, snapshot.ptHistory);
      }
    } catch (err) {
      logQuiet("caesar-history.restore", err);
    }
    this.lastState = String(entry.stateNum);
    this.seen = `${entry.stateNum}|${this.viewName(doc)}`;
    this.onRestore();
    window.scrollTo(0, snapshot.scrollY);
  }
}

export const caesarHistoryAugmentation = new CaesarHistoryAugmentation();
