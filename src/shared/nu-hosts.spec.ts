import { describe, expect, it } from "vitest";

import { repairLegacyBlueraUrl } from "./nu-hosts";

describe("repairLegacyBlueraUrl", () => {
  it("moves legacy-host paths outside /northwestern/ to the current host", () => {
    expect(repairLegacyBlueraUrl("https://northwestern.bluera.com/Chart.aspx?id=1")).toBe(
      "https://my-northwestern-bc.bluera.com/Chart.aspx?id=1"
    );
  });

  it("leaves /northwestern/ paths alone — the legacy host still redirects those", () => {
    const url = "https://northwestern.bluera.com/northwestern/rpvf-eng.aspx?x=1";
    expect(repairLegacyBlueraUrl(url)).toBe(url);
  });

  it("leaves other hosts and unparseable input alone", () => {
    const current = "https://my-northwestern-bc.bluera.com/Chart.aspx";
    expect(repairLegacyBlueraUrl(current)).toBe(current);
    expect(repairLegacyBlueraUrl("not a url")).toBe("not a url");
  });
});
