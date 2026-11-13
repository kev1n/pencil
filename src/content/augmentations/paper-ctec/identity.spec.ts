import { expect, it } from "vitest";

import { classKey } from "./identity";

it("gives a card and Paper.nu's panel the same key for one class", () => {
  expect(classKey("COMP_SCI:180:horswill:software design: part 1")).toBe(classKey("COMP_SCI:180:i horswill:software design: part 1"));
  expect(classKey("COMP_SCI:180:i horswill, j smith:x")).toBe("COMP_SCI:180:horswill,smith:x");
  expect(classKey("COMP_SCI:180:horswill:x")).not.toBe(classKey("COMP_SCI:180:jones:x"));
  expect(classKey("COMP_SCI:180:horswill:x")).not.toBe(classKey("COMP_SCI:211:horswill:x"));
});
