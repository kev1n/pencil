import { describe, expect, it } from "vitest";

import { CTEC_ACCESS_CHECK_ENABLED } from "./access-shared";

// CI and the release workflow both run tests, so a local debugging
// bypass (flag flipped to false) can't ship by accident.
describe("CTEC access check", () => {
  it("ships enabled", () => {
    expect(CTEC_ACCESS_CHECK_ENABLED).toBe(true);
  });
});
