import { augmentationRegistry } from "./augmentations/registry";
import { initModalCache } from "./augmentations/paper-ctec/modal-cache";
import { initCartCache, runOpportunisticReconcile } from "./cart-cache";
import {
  initCourseHistoryCache,
  runOpportunisticCourseHistoryReconcile
} from "./course-history";
import { mountCtecAccessDetector } from "./ctec-index/access-detector";
import { bootstrapTheme } from "./design";
import { AugmentationRunner } from "./framework";
import { registerLookupMessageHandler } from "./messaging";
import { mountTrafficIndicator } from "./peoplesoft/traffic-indicator";

void bootstrapTheme();
injectEarlyTermPageMask();
registerLookupMessageHandler();
void initCartCache();
// Hydrate course history on every host — the cache is read by the
// paper.nu prereq-filter augmentation to mark eligibility, not just
// CAESAR. Read-only on non-CAESAR hosts (no fetch); the opportunistic
// reconcile that actually pulls fresh data still gates on CAESAR.
const courseHistoryReady = initCourseHistoryCache();
initModalCache();
const augmentationRunner = new AugmentationRunner(augmentationRegistry);
augmentationRunner.start();
// First augmentation tick fires before storage hydration finishes; once
// the course-history cache lands, kick the runner so the prereq-filter
// re-evaluates with real data instead of an empty map.
void courseHistoryReady.then(() => augmentationRunner.requestRun());

// Opportunistic cart-cache reconcile. Only fires on CAESAR pages — we need
// the user's PeopleSoft session cookies to fetch the cart URL, and they
// only flow with the request when a CAESAR tab is loaded. Internally
// gates on a 1hr stale check so we don't hit CAESAR on every page load.
if (/caesar\.ent\.northwestern\.edu/i.test(window.location.host)) {
  void initCartCache().then(() => runOpportunisticReconcile());
  // Same opportunistic pattern as cart-cache: needs the live PeopleSoft
  // session cookies, gated on a 1hr stale check internally.
  void courseHistoryReady.then(() => runOpportunisticCourseHistoryReconcile());
  // Queue indicator is also CAESAR-only — paper.nu has its own
  // status-bar surface and doesn't drive the PeopleSoft mutex.
  mountTrafficIndicator(document);
  // Watches for the inline "not authorized to access CTECs" panel CAESAR
  // shows on the NU Manage Classes / CTEC pages. Self-disconnects once
  // the access flag flips.
  mountCtecAccessDetector(document);
}

function injectEarlyTermPageMask(): void {
  const url = new URL(window.location.href);
  const page = url.searchParams.get("PAGE") ?? url.searchParams.get("Page");
  if (page !== "SSR_SSENRL_TERM") return;

  const style = document.createElement("style");
  style.id = "better-caesar-early-term-mask";
  // Inline neutral colors — this paints on the very first frame, before
  // the design system's per-theme tokens are loaded, so `--bc-color-*`
  // vars would resolve to nothing. This is the documented exception to
  // the color-literal ban.
  // eslint-disable-next-line no-restricted-syntax
  style.textContent = `
    body > * { visibility: hidden !important; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background: #ffffff;
      z-index: 2147483646;
    }
    body::after {
      content: "Switching term...";
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      color: #66023c;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.2px;
      font-family: Helvetica, Arial, sans-serif;
    }
  `;

  const host = document.head ?? document.documentElement ?? document.body;
  if (!host) return;
  host.appendChild(style);
}
