import { fetchTextViaBackground } from "../remote-fetch";
import { parseCartPage } from "./parse-cart-page";
import { getNewestRefresh, replaceTermFromCartPage } from "./storage";

const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour
export const CART_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A";

let inFlight: Promise<void> | null = null;

// Opportunistic reconcile: when the user lands on a CAESAR page and our
// cache hasn't been refreshed in over an hour, fetch the cart page in the
// background. Credentials flow with the request because the user is in a
// live PeopleSoft session on this tab. If the response isn't a recognizable
// cart page (login redirect, error, timeout warning), abort silently and
// leave `refreshedAt` untouched so we'll try again next CAESAR load.
//
// Caller in content/index.ts must gate on host = caesar.ent.northwestern.edu
// since we depend on the live session cookies.
export async function runOpportunisticReconcile(): Promise<void> {
  if (inFlight) return inFlight;

  const newest = getNewestRefresh();
  if (newest !== 0 && Date.now() - newest < STALE_AFTER_MS) return;

  inFlight = (async () => {
    try {
      const html = await fetchTextViaBackground(CART_URL).catch(() => null);
      if (!html) return;

      const doc = new DOMParser().parseFromString(html, "text/html");
      const parsed = parseCartPage(doc, html);
      if (!parsed) return;

      replaceTermFromCartPage(parsed.termId, parsed.cart, parsed.enrolled);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
