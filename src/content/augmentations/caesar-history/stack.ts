// Pure model of the pages the user has walked through inside one CAESAR
// document, and of which of them CAESAR's server can still resume.
//
// PeopleSoft numbers every response (`ICStateNum`) and keeps the current
// state plus the five before it. A page restored from one of those states
// behaves like the live page; anything older answers "This page is no longer
// available". Acting on an old state also discards every newer one and reuses
// their numbers, so `chain` records which response currently owns each state
// number and an entry is only restorable while it still points at that one.

export const STATES_KEPT_BEHIND = 5;

export type StackEntry<T> = {
  id: string;
  page: string;
  stateNum: number;
  response: number;
  data: T;
};

export type Arrival =
  | { kind: "refresh" }
  | { kind: "push" }
  | { kind: "rewind"; steps: number };

export class PageStack<T> {
  readonly entries: StackEntry<T>[] = [];
  pos = -1;
  private serverState = 0;
  private responses = 0;
  private readonly chain = new Map<number, number>();

  get current(): StackEntry<T> | undefined {
    return this.entries[this.pos];
  }

  // The server answered with `stateNum` showing `page`. `sealed` means the
  // request changed the user's data, so every earlier snapshot is out of date.
  arrive(page: string, stateNum: number, data: T, id: string, sealed: boolean): Arrival {
    this.serverState = stateNum;
    for (const key of [...this.chain.keys()]) {
      if (sealed || key >= stateNum) this.chain.delete(key);
    }
    this.responses += 1;
    this.chain.set(stateNum, this.responses);
    return this.place(page, stateNum, this.responses, data, id);
  }

  // The view changed without a server round trip (a client-side tab), so the
  // new view sits on the same server state as the current entry.
  shift(page: string, data: T, id: string): Arrival {
    const current = this.current;
    if (!current) return { kind: "refresh" };
    return this.place(page, current.stateNum, current.response, data, id);
  }

  private place(page: string, stateNum: number, response: number, data: T, id: string): Arrival {
    const current = this.current;
    if (current && current.page === page) {
      Object.assign(current, { stateNum, response, data });
      return { kind: "refresh" };
    }

    // CAESAR's own Cancel / Return buttons walk back to a page we already
    // hold. Rewind to it instead of stacking a second copy on top.
    for (let index = this.pos - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (entry.page !== page) continue;
      const steps = this.pos - index;
      this.pos = index;
      Object.assign(entry, { stateNum, response, data });
      return { kind: "rewind", steps };
    }

    this.entries.splice(this.pos + 1);
    this.entries.push({ id, page, stateNum, response, data });
    this.pos = this.entries.length - 1;
    return { kind: "push" };
  }

  // The page at `index` was loaded afresh (its copy could not be resumed), so
  // the entry takes over whatever the server answered with.
  adopt(index: number, page: string, stateNum: number, data: T): void {
    this.pos = index;
    this.serverState = stateNum;
    this.responses += 1;
    this.chain.set(stateNum, this.responses);
    Object.assign(this.entries[index], { page, stateNum, response: this.responses, data });
  }

  // The current view finished changing without a new server state (a tab
  // switch lands in two steps), so the entry keeps its place and state.
  amend(page: string, data: T): void {
    const current = this.current;
    if (current) Object.assign(current, { page, data });
  }

  indexOf(id: string): number {
    return this.entries.findIndex((entry) => entry.id === id);
  }

  isRestorable(entry: StackEntry<T>): boolean {
    return (
      this.chain.get(entry.stateNum) === entry.response &&
      this.serverState - entry.stateNum <= STATES_KEPT_BEHIND
    );
  }
}
