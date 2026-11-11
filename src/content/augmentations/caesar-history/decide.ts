// The choices caesar-history makes, kept apart from the page so they can be
// tested without a browser: whether a settled view gets its own history entry,
// and how Back / Forward brings an entry back.

// Picking a left-hand tab marks it selected at once and brings its content
// later, with the server's next response, after a round trip of unknown
// length: one switch arrives in two steps. A tab-list page likewise opens its
// first tab after loading. Until that response has arrived, every change
// belongs to the switch. CAESAR has been seen taking over 12 s to answer a
// tab; the limit only matters for a tab whose answer never comes.
export const TAB_CONTENT_GIVES_UP_AFTER_MS = 30_000;
// The response can land in more than one DOM update.
export const TAB_CONTENT_SETTLES_MS = 1_000;

// A tab switch (or tab-list page load) still finishing.
export type TabLoad = {
  // Server state when the tab was picked: its content comes with the next.
  before: string;
  // The state the content arrived with, and when, once it has.
  arrived: { stateNum: string; at: number } | null;
  until: number;
};

export type Reopening = { sideTab: string | null; before: string; until: number };

export type SettleInput = {
  now: number;
  // The current entry, if there is one.
  current: { sideTab: string | null; dialog: boolean } | undefined;
  // The view that just settled: its left-hand tab, its server state and the
  // one before it, whether a dialog is open, and whether the page has a
  // left-hand tab list at all.
  sideTab: string | null;
  stateNum: string;
  lastState: string | null;
  dialog: boolean;
  tabList: boolean;
  tabLoad: TabLoad | null;
  reopening: Reopening | null;
};

export type SettleDecision = {
  // wait: the tab being re-opened for Back / Forward is not showing yet.
  // reopened: it is; the view belongs to the entry being re-opened.
  // same-entry: the view finishes the current entry's tab switch or load.
  // new-entry: the user went somewhere new.
  kind: "wait" | "reopened" | "same-entry" | "new-entry";
  tabLoad: TabLoad | null;
};

function startTabLoad(input: SettleInput, before: string | null): TabLoad {
  const arrived = before === null || input.stateNum === before ? null : { stateNum: input.stateNum, at: input.now };
  return { before: before ?? input.stateNum, arrived, until: input.now + TAB_CONTENT_GIVES_UP_AFTER_MS };
}

export function decideSettle(input: SettleInput): SettleDecision {
  const { now, current, sideTab, reopening } = input;
  if (reopening) {
    if (sideTab !== reopening.sideTab && now < reopening.until) {
      return { kind: "wait", tabLoad: input.tabLoad };
    }
    return { kind: "reopened", tabLoad: startTabLoad(input, reopening.before) };
  }
  if (!current) {
    // A tab-list page opens its first tab right after it loads.
    return { kind: "new-entry", tabLoad: input.tabList ? startTabLoad(input, null) : null };
  }
  // Opening or closing a dialog is always a step of its own, so Back can
  // close the dialog. A dialog mounts first and names itself (the page
  // title) a moment later; whatever changes while it stays open is the same
  // step.
  if (current.dialog && input.dialog) return { kind: "same-entry", tabLoad: input.tabLoad };
  if (current.dialog !== input.dialog) return { kind: "new-entry", tabLoad: null };

  if (sideTab !== current.sideTab) {
    const tabLoad = startTabLoad(input, input.lastState);
    // A page with a tab list first renders without one selected, then opens
    // its first tab: that is the page finishing loading, not a tab switch.
    return { kind: current.sideTab === null ? "same-entry" : "new-entry", tabLoad };
  }
  const load = input.tabLoad;
  if (load && now < load.until) {
    if (!load.arrived) {
      const arrived = input.stateNum === load.before ? null : { stateNum: input.stateNum, at: now };
      return { kind: "same-entry", tabLoad: { ...load, arrived } };
    }
    if (input.stateNum === load.arrived.stateNum && now - load.arrived.at < TAB_CONTENT_SETTLES_MS) {
      return { kind: "same-entry", tabLoad: load };
    }
  }
  return { kind: "new-entry", tabLoad: null };
}

export type PopTarget = {
  // The view can only be brought back by re-opening its tab: it is a frame
  // the tab loads, or it sits beside a step list that a copy cannot reset.
  framed: boolean;
  // The copy was taken with a dialog open; a dialog cannot be put back.
  dialog: boolean;
  sideTab: string | null;
  // CAESAR's server can still resume the copy's state.
  restorable: boolean;
};

export type PopInput = {
  owner: "top" | "frame";
  // The entry Back / Forward landed on, when this page load recorded it.
  index: number;
  pos: number;
  target: PopTarget | undefined;
  // Left-hand tab named by the entry; known even for entries from an
  // earlier load of the page.
  entrySideTab: string | null;
  // Left-hand tab of the entry's top-window half (what the frame belongs to).
  topSideTab: string | null;
  shownSideTab: string | null;
  // The top window has started re-opening another tab, which replaces the
  // frame.
  topReopening: boolean;
  // A dialog is open and can be cancelled.
  dialogOpen: boolean;
};

export type PopAction =
  | { kind: "none" }
  // Close the open dialog; the server's answer lands on the view beneath it.
  | { kind: "close-dialog" }
  | { kind: "restore" }
  // Re-open the left-hand tab; when it cannot be found, `otherwise`.
  | { kind: "reopen"; sideTab: string; otherwise: "reload" | "step-past" }
  | { kind: "reload" }
  // The entry's page is gone: keep going back, or refuse to go forward.
  | { kind: "step-past" };

export function decidePop(input: PopInput): PopAction {
  const { owner, index, pos, target } = input;
  if (owner === "frame") {
    if (input.topReopening || input.topSideTab !== input.shownSideTab) return { kind: "none" };
    return target ? bringBack(input, target) : { kind: "step-past" };
  }
  if (target) {
    // Already there means the frame moved, not the top window.
    return index === pos ? { kind: "none" } : bringBack(input, target);
  }
  const sideTab = input.entrySideTab;
  if (sideTab && sideTab !== input.shownSideTab) {
    return { kind: "reopen", sideTab, otherwise: "step-past" };
  }
  return { kind: "step-past" };
}

function bringBack(input: PopInput, target: PopTarget): PopAction {
  if (input.dialogOpen && input.index < input.pos) return { kind: "close-dialog" };
  if (target.dialog) return { kind: "step-past" };
  if (!target.framed && target.restorable) return { kind: "restore" };
  if (target.sideTab) return { kind: "reopen", sideTab: target.sideTab, otherwise: "reload" };
  // Nothing to re-open: load the page afresh.
  return { kind: "reload" };
}
