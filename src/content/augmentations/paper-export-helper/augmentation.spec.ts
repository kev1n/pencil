import { beforeEach, describe, expect, it } from "vitest";
import { PaperExportHelperAugmentation } from "./augmentation";
import { COPY_BUTTON_ID } from "./constants";

describe("Paper Export Markdown action", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("adds one menu item with a copy icon and removes it on cleanup", () => {
    document.body.innerHTML = `<button id="calendar"><span><svg xmlns="http://www.w3.org/2000/svg"><path d="calendar-icon"/></svg><p>Export to calendar</p></span></button>`;
    const calendar = document.getElementById("calendar") as HTMLButtonElement;
    const augmentation = new PaperExportHelperAugmentation();
    const ensureCopyButton = (augmentation as unknown as {
      ensureCopyButton(doc: Document, button: HTMLButtonElement): void;
    }).ensureCopyButton.bind(augmentation);

    ensureCopyButton(document, calendar);
    ensureCopyButton(document, calendar);

    const copy = document.getElementById(COPY_BUTTON_ID);
    expect(document.querySelectorAll(`#${COPY_BUTTON_ID}`)).toHaveLength(1);
    expect(copy?.textContent).toBe("Copy schedule as Markdown");
    expect(copy?.previousElementSibling).toBe(calendar);
    expect(copy?.querySelector("svg rect")).not.toBeNull();
    expect(copy?.querySelector("svg path")?.getAttribute("d")).not.toBe("calendar-icon");

    augmentation.cleanup(document);
    expect(document.getElementById(COPY_BUTTON_ID)).toBeNull();
  });
});
