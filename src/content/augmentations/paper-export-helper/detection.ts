// Locate paper.nu's "Export schedule to calendar → Download" button.
// Paper.nu doesn't expose a stable test-id or aria-label on the button,
// so we anchor on the export modal's distinctive heading text first and
// then look for the "Download" button inside that subtree. This avoids
// colliding with other "Download" buttons that may live elsewhere on
// the page.

const HEADING_RE = /export\s+schedule\s+to\s+calendar/i;
const DOWNLOAD_BUTTON_RE = /^\s*download\s*$/i;

function findExportHeading(doc: Document): HTMLElement | null {
  for (const el of Array.from(
    doc.querySelectorAll<HTMLElement>("h1, h2, h3, h4")
  )) {
    if (HEADING_RE.test(el.textContent ?? "")) return el;
  }
  return null;
}

function findContainingDialog(node: HTMLElement): HTMLElement {
  return (
    node.closest<HTMLElement>("[role='dialog'], [aria-modal='true']") ??
    node.ownerDocument.body
  );
}

export function findExportDownloadButton(
  doc: Document
): HTMLButtonElement | HTMLAnchorElement | null {
  const heading = findExportHeading(doc);
  if (!heading) return null;
  const scope = findContainingDialog(heading);
  for (const btn of Array.from(
    scope.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(
      "button, a"
    )
  )) {
    if (DOWNLOAD_BUTTON_RE.test(btn.textContent ?? "")) return btn;
  }
  return null;
}
