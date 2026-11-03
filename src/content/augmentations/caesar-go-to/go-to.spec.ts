// @vitest-environment-options {"url":"https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/TEST.GBL"}

import { afterEach, describe, expect, it, vi } from "vitest";
import { CaesarBookmarksAugmentation } from ".";

describe("CAESAR bookmarks", () => {
  const augmentation = new CaesarBookmarksAugmentation();

  afterEach(() => {
    augmentation.cleanup(document);
    document.body.replaceChildren();
  });

  it("fits the native banner slot and follows the live Class Search link", () => {
    document.body.innerHTML = `
      <header><div id="win0hdrdivPT_CUSTOM_RIGHT"></div></header>
      <nav><div role="link" href="#native-search">Class Search</div></nav>
      <main></main>
    `;
    augmentation.run(document);
    augmentation.run(document);
    const slot = document.getElementById("win0hdrdivPT_CUSTOM_RIGHT")!;
    const bars = slot.querySelectorAll("nav[aria-label='CAESAR bookmarks']");
    expect(bars).toHaveLength(1);
    expect(bars[0]!.children).toHaveLength(4);

    // PeopleSoft may replace a navigation link while the banner stays put.
    const oldLink = document.querySelector<HTMLElement>("nav > [href='#native-search']")!;
    const replacement = oldLink.cloneNode(true) as HTMLElement;
    const navigate = vi.fn((event: MouseEvent) => event.preventDefault());
    replacement.addEventListener("click", navigate);
    oldLink.replaceWith(replacement);
    bars[0]!.querySelector<HTMLAnchorElement>("a[aria-label='Class Search']")!.click();
    expect(navigate).toHaveBeenCalledOnce();

    augmentation.cleanup(document);
    expect(slot.children).toHaveLength(0);
    expect(slot.hasAttribute("data-bc-bookmark-slot")).toBe(false);
  });

  it("shares the standalone cart title row", () => {
    document.body.innerHTML = `
      <div id="win0divDERIVED_REGFRM1_SS_TRANSACT_TITLE"><span id="app_label">Shopping Cart</span></div>
      <form id="SSR_SSENRL_CART">
        <input type="button" id="DERIVED_REGFRM1_SSR_PB_SRCH" value="Search">
      </form>
    `;
    const nativeSearch = vi.fn();
    document.getElementById("DERIVED_REGFRM1_SSR_PB_SRCH")!.addEventListener("click", nativeSearch);
    augmentation.run(document);
    const bar = document.querySelector("#app_label + nav[aria-label='CAESAR bookmarks']");
    expect(bar).not.toBeNull();
    bar!.querySelector<HTMLAnchorElement>("a[aria-label='Class Search']")!.click();
    expect(nativeSearch).toHaveBeenCalledOnce();
    expect(document.body.children).toHaveLength(2);
    augmentation.cleanup(document);
    expect(document.querySelector("[data-bc-bookmark-title]")).toBeNull();
  });
});
