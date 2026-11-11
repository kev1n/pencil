import { describe, expect, it } from "vitest";

import {
  decidePop,
  decideSettle,
  type PopInput,
  type PopTarget,
  type SettleInput,
  TAB_CONTENT_GIVES_UP_AFTER_MS,
  TAB_CONTENT_SETTLES_MS
} from "./decide";

function settle(overrides: Partial<SettleInput>): SettleInput {
  return {
    now: 1_000_000,
    current: { sideTab: "tab:A", dialog: false },
    sideTab: "tab:A",
    stateNum: "5",
    lastState: "4",
    dialog: false,
    tabList: true,
    tabLoad: null,
    reopening: null,
    ...overrides
  };
}

describe("decideSettle", () => {
  it("gives the first view of a page its own entry and waits for a tab-list page's first tab", () => {
    const decision = decideSettle(settle({ current: undefined }));
    expect(decision.kind).toBe("new-entry");
    expect(decision.tabLoad).toMatchObject({ before: "5", arrived: null });
    expect(decideSettle(settle({ current: undefined, tabList: false })).tabLoad).toBeNull();
  });

  it("treats a tab-list page opening its first tab as the same entry", () => {
    const decision = decideSettle(settle({ current: { sideTab: null, dialog: false }, stateNum: "4" }));
    expect(decision.kind).toBe("same-entry");
  });

  it("records a tab switch once, however long the tab's content takes", () => {
    // The tab is marked selected before the server answers.
    const picked = decideSettle(settle({ sideTab: "tab:B", stateNum: "4", lastState: "4" }));
    expect(picked.kind).toBe("new-entry");
    expect(picked.tabLoad).toMatchObject({ before: "4", arrived: null });

    // Unrelated re-renders while the answer is on its way.
    const meanwhile = decideSettle(
      settle({ current: { sideTab: "tab:B", dialog: false }, sideTab: "tab:B", stateNum: "4", tabLoad: picked.tabLoad, now: 1_004_000 })
    );
    expect(meanwhile.kind).toBe("same-entry");

    // The answer arrives long after any fixed window would have closed.
    const content = decideSettle(
      settle({ current: { sideTab: "tab:B", dialog: false }, sideTab: "tab:B", stateNum: "5", tabLoad: meanwhile.tabLoad, now: 1_006_000 })
    );
    expect(content.kind).toBe("same-entry");
    expect(content.tabLoad?.arrived).toEqual({ stateNum: "5", at: 1_006_000 });

    // A second DOM update of the same answer.
    const tail = decideSettle(
      settle({
        current: { sideTab: "tab:B", dialog: false },
        sideTab: "tab:B",
        stateNum: "5",
        tabLoad: content.tabLoad,
        now: 1_006_000 + TAB_CONTENT_SETTLES_MS - 1
      })
    );
    expect(tail.kind).toBe("same-entry");
  });

  it("still counts a tab's content that takes CAESAR twenty seconds", () => {
    const picked = decideSettle(settle({ sideTab: "tab:B", stateNum: "4", lastState: "4" }));
    const late = decideSettle(
      settle({ current: { sideTab: "tab:B", dialog: false }, sideTab: "tab:B", stateNum: "5", tabLoad: picked.tabLoad, now: 1_020_000 })
    );
    expect(late.kind).toBe("same-entry");
  });

  it("gives the next step after a tab's content its own entry", () => {
    const tabLoad = { before: "4", arrived: { stateNum: "5", at: 1_000_000 }, until: 1_000_000 + TAB_CONTENT_GIVES_UP_AFTER_MS };
    // The user clicks something inside the tab: a new server state.
    expect(decideSettle(settle({ stateNum: "6", tabLoad, now: 1_000_200 })).kind).toBe("new-entry");
    // Or changes the view client-side once the answer has settled.
    expect(decideSettle(settle({ stateNum: "5", tabLoad, now: 1_000_000 + TAB_CONTENT_SETTLES_MS })).kind).toBe("new-entry");
  });

  it("stops waiting for a tab's content that never comes", () => {
    const tabLoad = { before: "4", arrived: null, until: 1_000_000 };
    expect(decideSettle(settle({ stateNum: "4", tabLoad, now: 1_000_000 })).kind).toBe("new-entry");
  });

  it("makes opening and closing a dialog steps of their own, however the dialog renders", () => {
    const opened = decideSettle(settle({ dialog: true, stateNum: "5", lastState: "5" }));
    expect(opened.kind).toBe("new-entry");
    // The dialog names itself (the page title changes) a moment later.
    const named = decideSettle(settle({ current: { sideTab: "tab:A", dialog: true }, dialog: true }));
    expect(named.kind).toBe("same-entry");
    const closed = decideSettle(settle({ current: { sideTab: "tab:A", dialog: true }, dialog: false, stateNum: "6" }));
    expect(closed.kind).toBe("new-entry");
  });

  it("waits for the tab being re-opened for Back, then hands the view to that entry", () => {
    const reopening = { sideTab: "tab:B", before: "7", until: 1_010_000 };
    expect(decideSettle(settle({ sideTab: "tab:A", reopening })).kind).toBe("wait");
    const arrived = decideSettle(settle({ sideTab: "tab:B", stateNum: "7", reopening }));
    expect(arrived.kind).toBe("reopened");
    // The tab is selected; its content is still to come and belongs to it.
    expect(arrived.tabLoad).toMatchObject({ before: "7", arrived: null });
    // Gives up waiting eventually rather than swallowing every later view.
    expect(decideSettle(settle({ sideTab: "tab:A", reopening, now: 1_010_000 })).kind).toBe("reopened");
  });
});

const restorable: PopTarget = { framed: false, dialog: false, sideTab: "tab:A", restorable: true };

function pop(overrides: Partial<PopInput>): PopInput {
  return {
    owner: "top",
    index: 1,
    pos: 2,
    target: restorable,
    entrySideTab: "tab:A",
    topSideTab: "tab:A",
    shownSideTab: "tab:A",
    topReopening: false,
    dialogOpen: false,
    ...overrides
  };
}

describe("decidePop", () => {
  it("restores a copy the server can still resume", () => {
    expect(decidePop(pop({}))).toEqual({ kind: "restore" });
  });

  it("re-opens the tab when the copy is too old, and reloads when there is no tab", () => {
    expect(decidePop(pop({ target: { ...restorable, restorable: false } }))).toEqual({
      kind: "reopen",
      sideTab: "tab:A",
      otherwise: "reload"
    });
    expect(decidePop(pop({ target: { ...restorable, restorable: false, sideTab: null } }))).toEqual({ kind: "reload" });
  });

  it("always re-opens views that a copy cannot put back", () => {
    // Frames, and pages beside a step list (the list sits outside the form).
    expect(decidePop(pop({ target: { ...restorable, framed: true } })).kind).toBe("reopen");
  });

  it("closes an open dialog on Back instead of restoring over it", () => {
    expect(decidePop(pop({ dialogOpen: true }))).toEqual({ kind: "close-dialog" });
    // Forward with a dialog open (it was opened after Back) moves on as usual.
    expect(decidePop(pop({ dialogOpen: true, index: 3 }))).toEqual({ kind: "restore" });
  });

  it("never tries to put a dialog back", () => {
    expect(decidePop(pop({ target: { ...restorable, dialog: true } }))).toEqual({ kind: "step-past" });
  });

  it("leaves an entry the frame owns to the frame", () => {
    expect(decidePop(pop({ index: 2, pos: 2 }))).toEqual({ kind: "none" });
  });

  it("re-opens the tab of an entry from an earlier load of the page, or steps past it", () => {
    expect(decidePop(pop({ target: undefined, index: -1, entrySideTab: "tab:B" }))).toEqual({
      kind: "reopen",
      sideTab: "tab:B",
      otherwise: "step-past"
    });
    expect(decidePop(pop({ target: undefined, index: -1, entrySideTab: "tab:A" }))).toEqual({ kind: "step-past" });
  });

  it("lets the frame act only on entries of the tab it is showing", () => {
    const frame = { owner: "frame" as const };
    expect(decidePop(pop({ ...frame }))).toEqual({ kind: "restore" });
    expect(decidePop(pop({ ...frame, topSideTab: "tab:B" }))).toEqual({ kind: "none" });
    expect(decidePop(pop({ ...frame, topReopening: true }))).toEqual({ kind: "none" });
    // An entry from an earlier frame page in this tab is gone.
    expect(decidePop(pop({ ...frame, target: undefined, index: -1 }))).toEqual({ kind: "step-past" });
  });
});
