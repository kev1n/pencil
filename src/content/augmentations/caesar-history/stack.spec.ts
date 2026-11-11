import { describe, expect, it } from "vitest";

import { PageStack } from "./stack";

function walk(): PageStack<string> {
  const stack = new PageStack<string>();
  stack.arrive("CART", 10, "cart", "a", false);
  stack.arrive("DETAIL", 11, "detail", "b", false);
  return stack;
}

describe("PageStack", () => {
  it("pushes a new page and keeps the earlier one restorable", () => {
    const stack = walk();
    expect(stack.pos).toBe(1);
    expect(stack.isRestorable(stack.entries[0])).toBe(true);
  });

  it("refreshes the current entry when the same page re-renders", () => {
    const stack = walk();
    expect(stack.arrive("DETAIL", 12, "sorted", "c", false)).toEqual({ kind: "refresh" });
    expect(stack.entries).toHaveLength(2);
    expect(stack.current).toMatchObject({ id: "b", stateNum: 12, data: "sorted" });
  });

  it("rewinds when CAESAR returns to a page already in the stack", () => {
    const stack = walk();
    expect(stack.arrive("CART", 12, "cart again", "c", false)).toEqual({ kind: "rewind", steps: 1 });
    expect(stack.pos).toBe(0);
    expect(stack.current).toMatchObject({ id: "a", stateNum: 12, data: "cart again" });
    // The page ahead is still on the server, so Forward can return to it.
    expect(stack.isRestorable(stack.entries[1])).toBe(true);
  });

  it("stops restoring a page once the server has dropped its state", () => {
    const stack = walk();
    stack.arrive("DETAIL", 15, "sorted", "c", false);
    expect(stack.isRestorable(stack.entries[0])).toBe(true);
    stack.arrive("DETAIL", 16, "sorted", "c", false);
    expect(stack.isRestorable(stack.entries[0])).toBe(false);
  });

  it("drops pages ahead once the user acts on an older state", () => {
    const stack = walk();
    const detail = stack.entries[1];
    stack.pos = 0;
    // Re-rendering the cart from state 10 reuses state number 11.
    stack.arrive("CART", 11, "cart sorted", "c", false);
    expect(stack.isRestorable(detail)).toBe(false);
  });

  it("gives a client-side view change its own entry on the same server state", () => {
    const stack = walk();
    expect(stack.shift("DETAIL|other tab", "detail tab", "c")).toEqual({ kind: "push" });
    expect(stack.entries).toHaveLength(3);
    expect(stack.isRestorable(stack.entries[1])).toBe(true);
    expect(stack.isRestorable(stack.entries[2])).toBe(true);
    // Switching back returns to the entry already held.
    expect(stack.shift("DETAIL", "detail", "d")).toEqual({ kind: "rewind", steps: 1 });
    expect(stack.pos).toBe(1);
  });

  it("lets a freshly loaded page take over an entry that could not be resumed", () => {
    const stack = walk();
    stack.arrive("DETAIL", 17, "sorted", "c", false);
    expect(stack.isRestorable(stack.entries[0])).toBe(false);
    stack.adopt(0, "CART", 18, "fresh cart");
    expect(stack.pos).toBe(0);
    expect(stack.current).toMatchObject({ id: "a", stateNum: 18, data: "fresh cart" });
    expect(stack.isRestorable(stack.entries[0])).toBe(true);
  });

  it("invalidates every earlier page after a change to the user's data", () => {
    const stack = walk();
    stack.arrive("RESULT", 12, "result", "c", true);
    expect(stack.isRestorable(stack.entries[0])).toBe(false);
    expect(stack.isRestorable(stack.entries[1])).toBe(false);
    expect(stack.isRestorable(stack.entries[2])).toBe(true);
  });
});
