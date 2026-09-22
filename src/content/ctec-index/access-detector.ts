// Passive DOM scanner for the "you are not authorized to access CTECs"
// panel CAESAR renders inline on the NW Manage Classes pages. Lets a
// deauthorized student see the No-access pill on plain CAESAR
// navigation, without first clicking Load CTEC. Confirmation stays
// network-only — the parent navigation page doesn't expose CTEC-specific
// content for users with access, so a DOM scan there can only produce
// a negative signal.

import { isCtecAccessDenied, markCtecAccessDenied } from "./access";
import { CTEC_ACCESS_CHECK_ENABLED } from "./access-shared";

const CAESAR_HOST_PATTERN = /caesar\.ent\.northwestern\.edu/i;
const UNAUTHORIZED_TEXT = "you are not authorized to access ctecs";
const UNAUTHORIZED_PAGE_ID = "NW_CTEC_MSG_FL";

export function mountCtecAccessDetector(doc: Document = document): void {
  if (!CTEC_ACCESS_CHECK_ENABLED) return;
  if (!CAESAR_HOST_PATTERN.test(doc.location.host)) return;

  scan(doc);
  if (isCtecAccessDenied()) return;

  const root = doc.body ?? doc.documentElement;
  if (!root) return;

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (isCtecAccessDenied()) {
      observer.disconnect();
      return;
    }
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan(doc);
      if (isCtecAccessDenied()) observer.disconnect();
    });
  });

  // attributeFilter: PeopleSoft flips Page / Component on an existing
  // pt_pageinfo element via in-place AJAX, so childList alone misses
  // the deauthorized swap.
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["Page", "Component"]
  });
}

function scan(doc: Document): void {
  // Page-id check first — it's an attribute on a single element so
  // querying for it is faster than walking textContent of the entire body.
  if (doc.querySelector(`[Page="${UNAUTHORIZED_PAGE_ID}"]`)) {
    markCtecAccessDenied("access-detector: Page=NW_CTEC_MSG_FL attribute found");
    return;
  }
  const text = doc.body?.textContent ?? "";
  if (!text) return;
  if (text.toLowerCase().includes(UNAUTHORIZED_TEXT)) {
    markCtecAccessDenied("access-detector: unauthorized panel text found");
  }
}
