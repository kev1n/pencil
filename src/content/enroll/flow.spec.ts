import { describe, expect, it } from "vitest";
import { cartPage, cartPageKeys } from "./flow";

const page = (termId: string, how: "keys" | "links") =>
  `<input type='hidden' name='ICSID' value='x'>` +
  (how === "keys"
    ? `<script>PIA_KEYSTRUCT = {ACAD_CAREER:"UGRD",INSTITUTION:"NWUNV",STRM:"${termId}"};</script>`
    : `<form action="../c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&amp;Action=A"></form><a href="/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&amp;Action=A&amp;ACAD_CAREER=UGRD&amp;INSTITUTION=NWUNV&amp;STRM=${termId}">Cart</a>`);

describe("cartPage", () => {
  it("reads the term and career from either page layout", () => {
    expect(cartPageKeys(page("5040", "keys"))).toEqual({ career: "UGRD", termId: "5040" });
    expect(cartPageKeys(page("5040", "links"))).toEqual({ career: "UGRD", termId: "5040" });
  });

  it("asks for the named term when CAESAR opens another one", async () => {
    const asked: string[] = [];
    const html = await cartPage("5050", async (url) => {
      asked.push(url);
      return page(url.includes("STRM=5050") ? "5050" : "5040", "links");
    });
    expect(asked).toHaveLength(2);
    expect(cartPageKeys(html).termId).toBe("5050");
  });

  it("never answers with another term's cart", async () => {
    await expect(cartPage("5050", async () => page("5040", "links"))).rejects.toThrow(/this term/);
    await expect(cartPage("5050", async () => `<input name='ICSID'>`)).rejects.toThrow(/this term/);
  });

  it("hands a sign-in page back as it is", async () => {
    expect(await cartPage("5050", async () => "<html>sign in</html>")).toBe("<html>sign in</html>");
  });
});
