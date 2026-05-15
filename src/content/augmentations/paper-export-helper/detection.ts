// Three button-finders for paper.nu's export flow:
//
//   EXPORT (top-level button on the schedule view)
//     ↓ click — opens a dropdown menu with several export options
//   "Export to calendar" (item inside the dropdown)
//     ↓ click — opens paper.nu's own calendar export modal
//   "Download" (button inside that modal)
//     ↓ click — triggers the .ics file save
//
// We intercept "Export to calendar" rather than EXPORT itself: paper.nu's
// dropdown may carry other export options we don't want to preempt, and
// the "Export to calendar" button is what semantically maps to our
// walkthrough.

const EXPORT_LABEL_RE = /^\s*export\s*$/i;
const EXPORT_TO_CALENDAR_RE = /^\s*export\s+to\s+calendar\s*$/i;
const DOWNLOAD_BUTTON_RE = /^\s*download\s*$/i;

// The top-level EXPORT button on paper.nu's schedule view — the one
// that opens the dropdown menu containing "Export to calendar". We
// don't intercept this (the dropdown may carry other export options),
// but the highlight feature stamps a marker on it so the user knows
// the entry point exists.
export function findExportButton(doc: Document): HTMLButtonElement | null {
  for (const btn of Array.from(
    doc.querySelectorAll<HTMLButtonElement>("button")
  )) {
    const labelEl = btn.querySelector("p");
    if (!labelEl) continue;
    if (EXPORT_LABEL_RE.test(labelEl.textContent ?? "")) return btn;
  }
  return null;
}

export function findExportToCalendarButton(
  doc: Document
): HTMLButtonElement | null {
  for (const btn of Array.from(
    doc.querySelectorAll<HTMLButtonElement>("button")
  )) {
    // Paper.nu nests the label in a <p> inside the button. Matching on
    // the inner <p> text is more stable than matching the button's full
    // textContent (which also picks up the SVG's accessible label, if
    // any).
    const labelEl = btn.querySelector("p");
    if (!labelEl) continue;
    if (EXPORT_TO_CALENDAR_RE.test(labelEl.textContent ?? "")) return btn;
  }
  return null;
}

// Search the whole document for a Download button. Paper.nu's modal
// mounts at body level, not inside the EXPORT button's subtree, so we
// can't scope the lookup. The export modal is only open transiently
// during our chained download, so this won't collide with stray
// "Download" buttons elsewhere on the page outside that window.
export function findDownloadButton(
  doc: Document
): HTMLButtonElement | HTMLAnchorElement | null {
  for (const btn of Array.from(
    doc.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>("button, a")
  )) {
    if (DOWNLOAD_BUTTON_RE.test(btn.textContent ?? "")) return btn;
  }
  return null;
}

// Poll for the Download button to appear in the DOM. Paper.nu opens
// its export modal asynchronously (React render + portal mount), so a
// click on "Export to calendar" doesn't put the Download button in the
// tree until the next frame or two. Resolves with null on timeout.
export function waitForDownloadButton(
  doc: Document,
  timeoutMs: number
): Promise<HTMLButtonElement | HTMLAnchorElement | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = (): void => {
      const btn = findDownloadButton(doc);
      if (btn) {
        resolve(btn);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
