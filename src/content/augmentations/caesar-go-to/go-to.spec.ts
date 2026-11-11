// @vitest-environment-options {"url":"https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/TEST.GBL"}

import { afterEach, describe, expect, it, vi } from "vitest";
import { CaesarBookmarksAugmentation } from ".";

describe("CAESAR bookmarks", () => {
  const augmentation = new CaesarBookmarksAugmentation();

  afterEach(() => {
    augmentation.cleanup(document);
    document.body.replaceChildren();
    vi.unstubAllGlobals();
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
    expect(bars[0]!.querySelectorAll(":scope > a, :scope > button")).toHaveLength(5);
    const dates = bars[0]!.querySelector("button[aria-label='Enrollment Dates']");
    expect(dates?.getAttribute("popovertarget")).toBe("bc-caesar-enrollment-dates");
    expect(document.querySelector("#bc-caesar-enrollment-dates a")?.textContent).toContain("Open Enrollment Dates");

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

  it("opens Class Search as a Manage Classes tab, keeping CAESAR's sidebar", () => {
    const tab = `<div class="ps_ag-step-button" onclick="void 'ADMN_S201708141120276178777428'"></div>`;
    document.body.innerHTML = '<div id="win0hdrdivPT_CUSTOM_RIGHT"></div>';
    augmentation.run(document);
    const link = document.querySelector<HTMLAnchorElement>("a[aria-label='Class Search']")!;
    expect(link.href).toContain("NW_MANAGE_CLASSES_CLASSIC_NAV");

    // On Manage Classes the bookmark picks the tab in place.
    document.body.insertAdjacentHTML("beforeend", tab);
    const picked = vi.fn();
    document.querySelector(".ps_ag-step-button")!.addEventListener("click", picked);
    link.click();
    expect(picked).toHaveBeenCalledOnce();

    // Arriving from another page, the link's fragment names the tab, and
    // the pick repeats until CAESAR shows the tab selected.
    vi.useFakeTimers();
    history.replaceState(null, "", new URL(link.href).hash);
    augmentation.run(document);
    expect(picked).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1500);
    expect(picked).toHaveBeenCalledTimes(3);
    document.querySelector(".ps_ag-step-button")!.classList.add("psc_selected");
    vi.advanceTimersByTime(1500);
    expect(location.hash).toBe("");
    vi.advanceTimersByTime(3000);
    expect(picked).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("opens the Pencil About dialog once, supports dismiss/reopen, and cleans up", () => {
    vi.stubGlobal("chrome", {
      ...chrome,
      runtime: { ...chrome.runtime, getManifest: () => ({ version: "0.9.12" }) }
    });
    document.body.innerHTML = '<div id="win0hdrdivPT_CUSTOM_RIGHT"></div>';
    augmentation.run(document);
    const brand = document.querySelector<HTMLButtonElement>("button[aria-label='About pencil.nu']")!;
    expect(brand.type).toBe("button");
    brand.click();
    brand.click();
    expect(document.querySelectorAll("#bc-paper-brand-modal")).toHaveLength(1);
    expect(document.querySelector("#bc-paper-brand-modal")?.textContent).toContain("version 0.9.12");
    document.querySelector<HTMLButtonElement>("#bc-paper-brand-modal button[aria-label='Close']")!.click();
    expect(document.getElementById("bc-paper-brand-modal")).toBeNull();
    brand.click();
    const hostEscape = vi.fn();
    document.body.addEventListener("keydown", hostEscape);
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.querySelector<HTMLButtonElement>("#bc-paper-brand-modal button[aria-label='Close']")!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(hostEscape).not.toHaveBeenCalled();
    document.body.removeEventListener("keydown", hostEscape);
    expect(document.getElementById("bc-paper-brand-modal")).toBeNull();
    brand.click();
    document.getElementById("bc-paper-brand-modal")!.click();
    expect(document.getElementById("bc-paper-brand-modal")).toBeNull();
    for (const key of ["Enter", " "]) {
      const hostKeydown = vi.fn();
      document.addEventListener("keydown", hostKeydown);
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      brand.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(hostKeydown).not.toHaveBeenCalled();
      expect(document.getElementById("bc-paper-brand-modal")).not.toBeNull();
      document.removeEventListener("keydown", hostKeydown);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }
    brand.click();
    augmentation.cleanup(document);
    expect(document.getElementById("bc-paper-brand-modal")).toBeNull();
    expect(document.getElementById("bc-paper-brand-style")).toBeNull();
  });

  it("keeps standalone navigation after the cart replaces its title and form", () => {
    document.body.innerHTML = `
      <div id="win0divDERIVED_REGFRM1_SS_TRANSACT_TITLE"><span id="app_label">Shopping Cart</span></div>
      <form id="SSR_SSENRL_CART">
        <input type="button" id="DERIVED_REGFRM1_SSR_PB_SRCH" value="Search">
      </form>
    `;
    const nativeSearch = vi.fn();
    document.getElementById("DERIVED_REGFRM1_SSR_PB_SRCH")!.addEventListener("click", nativeSearch);
    augmentation.run(document);
    const header = document.getElementById("bc-caesar-header")!;
    const bar = header.querySelector("nav[aria-label='CAESAR bookmarks']");
    expect(bar).not.toBeNull();
    bar!.querySelector<HTMLAnchorElement>("a[aria-label='Class Search']")!.click();
    expect(nativeSearch).toHaveBeenCalledOnce();
    expect(header.firstElementChild?.textContent).toBe("CAESAR");
    expect(header.querySelector("a[aria-label='CAESAR Home']")).not.toBeNull();
    expect(bar!.querySelector("a[aria-label='CAESAR Home']")).toBeNull();
    document.getElementById("win0divDERIVED_REGFRM1_SS_TRANSACT_TITLE")!.remove();
    document.getElementById("SSR_SSENRL_CART")!.replaceWith(document.createElement("form"));
    document.querySelector("form")!.id = "SSR_SSENRL_CART";
    augmentation.run(document);
    expect(document.querySelector("#bc-caesar-header nav")).toBe(bar);
    augmentation.cleanup(document);
    expect(document.getElementById("bc-caesar-header")).toBeNull();
    expect(document.getElementById("bc-caesar-enrollment-dates")).toBeNull();
  });

  it("keeps the portal shell's Back, Home and Actions controls alongside the logo and shortcuts", () => {
    document.body.innerHTML = `
      <div id="classicbackbuttoncontainer"><button id="back">Back</button></div>
      <div id="pthdr2navbarlinks"><button id="native-home">Home</button><button id="actions">Actions</button></div>
      <iframe id="ptifrmtgtframe"></iframe>
    `;
    const controls = ["back", "native-home", "actions"].map((id) => document.getElementById(id));
    augmentation.run(document);
    augmentation.run(document);
    expect(document.querySelectorAll(".bc-caesar-home-logo")).toHaveLength(1);
    expect(document.querySelector("#classicbackbuttoncontainer a")?.textContent).toBe("CAESAR");
    expect(document.querySelector("#pthdr2navbarlinks")?.firstElementChild?.id).toBe("bc-caesar-bookmarks");
    expect(controls.every((control) => control?.isConnected)).toBe(true);
    document.querySelector(".bc-caesar-home-logo")!.remove();
    augmentation.run(document);
    expect(document.querySelectorAll(".bc-caesar-home-logo")).toHaveLength(1);
    augmentation.cleanup(document);
    expect(document.querySelector(".bc-caesar-home-logo")).toBeNull();
    expect(document.querySelector("[data-bc-caesar-logo-slot]")).toBeNull();
    expect(controls.every((control) => control?.isConnected)).toBe(true);
  });

  it("provides the same header on other standalone PeopleSoft pages", () => {
    document.body.innerHTML = '<form name="win0" id="OTHER_PAGE"></form>';
    augmentation.run(document);
    expect(document.querySelector("#bc-caesar-header .bc-caesar-home-logo")?.textContent).toBe("CAESAR");
    expect(document.querySelectorAll("#bc-caesar-bookmarks")).toHaveLength(1);
  });
});
