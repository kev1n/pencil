import { afterEach, describe, expect, it } from "vitest";
import {
  findDownloadButton,
  findExportButton,
  findExportToCalendarButton,
  waitForDownloadButton
} from "./detection";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findExportButton", () => {
  it("matches paper.nu's top-level button with <p>EXPORT</p>", () => {
    document.body.innerHTML = `
      <button>
        <svg><path d="..." /></svg>
        <p>EXPORT</p>
      </button>
    `;
    const btn = findExportButton(document);
    expect(btn).not.toBeNull();
    expect(btn?.querySelector("p")?.textContent).toBe("EXPORT");
  });

  it("does not match the 'Export to calendar' dropdown item", () => {
    document.body.innerHTML = `<button><p>Export to calendar</p></button>`;
    expect(findExportButton(document)).toBeNull();
  });

  it("is case- and whitespace-insensitive", () => {
    document.body.innerHTML = `<button><p>  export  </p></button>`;
    expect(findExportButton(document)).not.toBeNull();
  });
});

describe("findExportToCalendarButton", () => {
  it("matches paper.nu's button shape with <p>Export to calendar</p>", () => {
    document.body.innerHTML = `
      <div>
        <button>
          <svg><path d="..." /></svg>
          <p class="flex-1 whitespace-nowrap text-left">Export to calendar</p>
        </button>
      </div>
    `;
    const btn = findExportToCalendarButton(document);
    expect(btn).not.toBeNull();
    expect(btn?.querySelector("p")?.textContent).toBe("Export to calendar");
  });

  it("ignores buttons whose <p> label doesn't match", () => {
    document.body.innerHTML = `
      <button><p>Export</p></button>
      <button><p>Download</p></button>
      <button><p>Save as image</p></button>
    `;
    expect(findExportToCalendarButton(document)).toBeNull();
  });

  it("is case- and whitespace-insensitive", () => {
    document.body.innerHTML = `
      <button><p>  EXPORT TO CALENDAR  </p></button>
    `;
    expect(findExportToCalendarButton(document)).not.toBeNull();
  });

  it("returns null when no buttons are present", () => {
    document.body.innerHTML = "";
    expect(findExportToCalendarButton(document)).toBeNull();
  });

  it("returns null for buttons without a <p> label", () => {
    document.body.innerHTML = `
      <button>Export to calendar</button>
    `;
    expect(findExportToCalendarButton(document)).toBeNull();
  });
});

describe("findDownloadButton", () => {
  it("matches a plain <button>Download</button>", () => {
    document.body.innerHTML = `
      <div role="dialog">
        <h2>Export schedule to calendar</h2>
        <button>Download</button>
      </div>
    `;
    expect(findDownloadButton(document)?.textContent).toBe("Download");
  });

  it("matches an <a>Download</a> link too", () => {
    document.body.innerHTML = `<a href="#">Download</a>`;
    const node = findDownloadButton(document);
    expect(node).not.toBeNull();
    expect(node?.tagName.toLowerCase()).toBe("a");
  });

  it("is case- and whitespace-insensitive", () => {
    document.body.innerHTML = `<button>  download  </button>`;
    expect(findDownloadButton(document)).not.toBeNull();
  });

  it("returns null when no Download element is in the DOM", () => {
    document.body.innerHTML = `<button>Export to calendar</button>`;
    expect(findDownloadButton(document)).toBeNull();
  });
});

describe("waitForDownloadButton", () => {
  it("resolves immediately when the button is already in the DOM", async () => {
    document.body.innerHTML = `<button>Download</button>`;
    const result = await waitForDownloadButton(document, 1000);
    expect(result).not.toBeNull();
  });

  it("resolves once the button appears after a delay", async () => {
    const pending = waitForDownloadButton(document, 1000);
    setTimeout(() => {
      document.body.innerHTML = `<button>Download</button>`;
    }, 16);
    const result = await pending;
    expect(result).not.toBeNull();
  });

  it("resolves with null on timeout", async () => {
    const result = await waitForDownloadButton(document, 30);
    expect(result).toBeNull();
  });
});
