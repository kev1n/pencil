// Two button-finders for paper.nu's export flow:
//
//   1) findExportButton — the top-level EXPORT button on the schedule view.
//      Anchors on the <p>EXPORT</p> label inside the button. This is the
//      one we intercept so our walkthrough takes over paper.nu's native
//      modal entirely.
//
//   2) findDownloadButton — the "Download" button inside paper.nu's
//      OWN export modal (the one EXPORT opens). We only use this AFTER
//      the user clicks our "Download .ics" CTA: bypass-clicking EXPORT
//      re-opens paper.nu's modal, then we click its Download button to
//      kick off the actual .ics export.

const EXPORT_LABEL_RE = /^\s*export\s*$/i;
const DOWNLOAD_BUTTON_RE = /^\s*download\s*$/i;

export function findExportButton(doc: Document): HTMLButtonElement | null {
  for (const btn of Array.from(
    doc.querySelectorAll<HTMLButtonElement>("button")
  )) {
    // Paper.nu's button has a child <p>EXPORT</p> (their convention for
    // icon+label buttons). Matching on the inner <p> text is more stable
    // than matching the button's full textContent (which also picks up
    // the SVG's accessible label, when paper.nu adds one).
    const labelEl = btn.querySelector("p");
    if (!labelEl) continue;
    if (EXPORT_LABEL_RE.test(labelEl.textContent ?? "")) return btn;
  }
  return null;
}

// Search the whole document for a Download button. Paper.nu's modal
// mounts as a portal at the end of <body>, not inside the EXPORT
// button's subtree, so we can't scope the lookup. The export modal is
// only open transiently, so this won't collide with stray "Download"
// buttons elsewhere on the page outside that window.
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
// click on EXPORT doesn't put the Download button in the tree until
// the next frame or two. Resolves with null on timeout.
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
