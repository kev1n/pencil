import { afterEach, expect, it, vi } from "vitest";

import { ClassSearchAugmentation } from "./augmentation";
import { ROOT_ID } from "./views/shell";

const fall = { name: "2026 Fall", updated: "fall" };
const winter = { name: "2027 Winter", updated: "winter" };
const section = {
  i: "000000-1", u: "COMP_SCI", n: "211-0", s: "1", c: "LEC",
  t: "Programming in Systems-Level Languages", f: "2"
};
const course = {
  i: "000000", n: "211-0", u: "COMP_SCI", t: "Programming in Systems-Level Languages",
  s: [section, { ...section, i: "000000-2", s: "2" }]
};
const searchPage = `
  <form name="win0" id="CLASS_SEARCH">
    <div id="win0divPAGECONTAINER">
      <select name="CLASS_SRCH_WRK2_STRM$35$"><option value="5050">2027 Winter</option></select>
      <input type="button" id="CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH" value="Search">
    </div>
  </form>`;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  window.sessionStorage.clear();
});

it("mounts on the current CAESAR form, finds a newly published term, and leaves Classic results visible", async () => {
  await chrome.storage.local.set({
    "better-caesar:paper:meta:v1": {
      data: { latest: "5040", terms: { "5040": fall }, plan: "old", subjects: "old" },
      cachedAt: Date.now()
    }
  });

  let releaseFall: () => void = () => undefined;
  const fallPending = new Promise<void>((resolve) => { releaseFall = resolve; });
  const requestedUrls: string[] = [];
  vi.spyOn(chrome.runtime, "sendMessage").mockImplementation(
    async (message: unknown) => {
      const { url } = message as { url: string };
      requestedUrls.push(url);
      let data: unknown;
      if (url.endsWith("/paper/data")) {
        data = { latest: "5050", terms: { "5040": fall, "5050": winter }, plan: "new", subjects: "new" };
      } else if (url.endsWith("/subjects")) {
        data = { subjects: { COMP_SCI: { d: "Computer Science" } } };
      } else if (url.endsWith("/plan.json")) {
        data = { courses: [] };
      } else if (url.endsWith("/5050.json")) {
        data = [course];
      } else if (url.endsWith("/5040.json")) {
        await fallPending;
        data = [];
      } else {
        throw new Error("Unexpected network request");
      }
      return { ok: true, status: 200, text: JSON.stringify(data), finalUrl: url };
    }
  );

  // Current PeopleSoft markup, with no pt_pageinfo_win0 element.
  document.body.innerHTML = searchPage;
  const augmentation = new ClassSearchAugmentation();
  try {
    augmentation.run(document);
    const query = await vi.waitFor(() => {
      const input = document.querySelector<HTMLInputElement>("#bc-cs-query");
      expect(input).not.toBeNull();
      return input!;
    });
    const term = document.querySelector<HTMLSelectElement>("#bc-cs-term")!;
    expect(term.value).toBe("5050");
    expect(requestedUrls.filter((url) => url.endsWith("/paper/data"))).toHaveLength(1);

    query.value = "comp_sci 211";
    query.dispatchEvent(new Event("input"));
    await vi.waitFor(() => expect(document.querySelector(".bc-cs-add")).not.toBeNull());

    term.value = "5040";
    term.dispatchEvent(new Event("change"));
    expect(document.querySelector(".bc-cs-add")).toBeNull();
    releaseFall();
    await vi.waitFor(() => expect(document.getElementById(ROOT_ID)?.textContent).toContain("No matches"));

    document.querySelector<HTMLButtonElement>('[data-tab="classic"]')!.click();
    const native = document.getElementById("win0divPAGECONTAINER")!;
    expect(getComputedStyle(native).display).not.toBe("none");
    native.innerHTML = '<input type="button" id="CLASS_SRCH_WRK2_SSR_PB_MODIFY" value="Modify Search">';
    augmentation.run(document);
    expect(document.getElementById(ROOT_ID)).toBeNull();
    expect(getComputedStyle(native).display).not.toBe("none");
  } finally {
    releaseFall();
    augmentation.cleanup(document);
  }
});

it("restores the same-tab search after leaving and rebuilding the native form", async () => {
  const send = vi.spyOn(chrome.runtime, "sendMessage").mockImplementation(
    async (message: unknown) => {
      const { url } = message as { url: string };
      let data: unknown;
      if (url.endsWith("/paper/data")) {
        data = { latest: "5050", terms: { "5040": fall, "5050": winter }, plan: "new", subjects: "new" };
      } else if (url.endsWith("/subjects")) {
        data = { subjects: { COMP_SCI: { d: "Computer Science" } } };
      } else if (url.endsWith("/plan.json")) {
        data = { courses: [] };
      } else if (url.endsWith("/5050.json") || url.endsWith("/5040.json")) {
        data = [course];
      } else {
        throw new Error("Unexpected network request");
      }
      return { ok: true, status: 200, text: JSON.stringify(data), finalUrl: url };
    }
  );
  document.body.innerHTML = searchPage;
  const augmentation = new ClassSearchAugmentation();
  const scroller = document.scrollingElement ?? document.documentElement;
  try {
    augmentation.run(document);
    const input = await vi.waitFor(() => {
      const field = document.querySelector<HTMLInputElement>("#bc-cs-query");
      expect(field).not.toBeNull();
      return field!;
    });
    const chip = document.querySelector<HTMLInputElement>('[data-fd="EDR"] input')!;
    input.value = "comp_sci 211";
    input.dispatchEvent(new Event("input"));
    chip.click();
    const disclosure = await vi.waitFor(() => {
      const details = document.querySelector<HTMLDetailsElement>(".bc-cs-sections-disclosure");
      expect(details).not.toBeNull();
      return details!;
    });
    disclosure.open = true;
    disclosure.dispatchEvent(new Event("toggle"));
    scroller.scrollTop = 320;
    document.dispatchEvent(new Event("scroll"));

    document.body.replaceChildren();
    augmentation.run(document);
    scroller.scrollTop = 0;
    send.mockClear();

    document.body.innerHTML = searchPage;
    augmentation.run(document);
    await vi.waitFor(() => {
      expect(document.querySelector<HTMLInputElement>("#bc-cs-query")?.value).toBe("comp_sci 211");
      expect(document.querySelector<HTMLInputElement>('[data-fd="EDR"] input')?.checked).toBe(true);
      expect(document.querySelector<HTMLDetailsElement>(".bc-cs-sections-disclosure")?.open).toBe(true);
      expect(scroller.scrollTop).toBe(320);
    });
    expect(send).not.toHaveBeenCalled();

    const term = document.querySelector<HTMLSelectElement>("#bc-cs-term")!;
    term.value = "5040";
    term.dispatchEvent(new Event("change"));
    window.dispatchEvent(new Event("pagehide"));
    document.body.replaceChildren();
    augmentation.run(document);

    document.body.innerHTML = searchPage;
    augmentation.run(document);
    await vi.waitFor(() => {
      expect(document.querySelector<HTMLSelectElement>("#bc-cs-term")?.value).toBe("5040");
      expect(document.querySelector<HTMLInputElement>("#bc-cs-query")?.value).toBe("comp_sci 211");
    });

    document.body.replaceChildren();
    augmentation.run(document);
    // A new native career must start with its own form defaults.
    document.body.innerHTML = searchPage.replace(
      "<input type",
      '<select name="SSR_CLSRCH_WRK_ACAD_CAREER"><option value="TGS">Graduate</option></select><input type'
    );
    augmentation.run(document);
    await vi.waitFor(() => {
      expect(document.querySelector<HTMLSelectElement>("#bc-cs-term")?.value).toBe("5050");
      expect(document.querySelector<HTMLInputElement>("#bc-cs-query")?.value).toBe("");
    });
  } finally {
    scroller.scrollTop = 0;
    augmentation.cleanup(document);
  }
});
