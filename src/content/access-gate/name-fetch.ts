import { fetchTextResultViaBackground } from "../remote-fetch";
import { fetchGradYear } from "./grad-term-fetch";
import { writeStoredName, type StoredName } from "./storage";

const PROFILE_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/NW_SS_STUDENT.NW_SS_CUST_ACCT.GBL?NavColl=true&ICAGTarget=start";

const NAME_SPAN_ID = "NW_PRF_VW_NAME";

// Persistent backoff for failed paper.nu-side name fetches. Without it,
// paper.nu users who aren't signed in to CAESAR would re-hit CAESAR's
// profile page on every page load (the response is a login redirect,
// parseNameFromHtml returns null, no cache write) — a steady drip of
// pointless CAESAR traffic across the user base. Only enforced on
// paper.nu; on CAESAR itself we always attempt because the user's
// cookies are right there and a successful attempt clears the backoff
// for the next paper.nu visit.
const NAME_FETCH_FAILED_AT_KEY = "better-caesar:access-gate:name-fetch-failed-at:v1";
const FAILED_FETCH_BACKOFF_MS = 24 * 60 * 60 * 1000; // 24h

let inFlight: Promise<StoredName | null> | null = null;
let attemptedThisSession = false;

export function fetchAndCacheUserName(): Promise<StoredName | null> {
  if (inFlight) return inFlight;
  if (attemptedThisSession) return Promise.resolve(null);
  attemptedThisSession = true;
  inFlight = (async () => {
    try {
      if (!isCaesarHost() && (await isWithinFailureBackoff())) return null;
      const [nameResp, gradYear] = await Promise.all([
        fetchTextResultViaBackground(PROFILE_URL),
        fetchGradYear()
      ]);
      if (nameResp.status < 200 || nameResp.status >= 300) {
        await recordFailedAttempt();
        return null;
      }
      const parsed = parseNameFromHtml(nameResp.text);
      if (!parsed) {
        await recordFailedAttempt();
        return null;
      }
      const stored: StoredName = {
        lastName: parsed.lastName,
        fullName: parsed.fullName,
        fetchedAt: Date.now(),
        gradYear
      };
      await writeStoredName(stored);
      // Isolated try: a rejection from `remove` (rare, but possible on
      // quota/IO errors) must NOT bubble into the outer catch and trip
      // recordFailedAttempt — we just successfully wrote a name.
      try {
        await chrome.storage.local.remove(NAME_FETCH_FAILED_AT_KEY);
      } catch {
        // ignore — sentinel will expire on its own.
      }
      return stored;
    } catch {
      await recordFailedAttempt();
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function isCaesarHost(): boolean {
  try {
    return window.location.hostname === "caesar.ent.northwestern.edu";
  } catch {
    return false;
  }
}

async function isWithinFailureBackoff(): Promise<boolean> {
  try {
    const result = (await chrome.storage.local.get(NAME_FETCH_FAILED_AT_KEY)) as Record<
      string,
      unknown
    >;
    const raw = result[NAME_FETCH_FAILED_AT_KEY];
    if (typeof raw !== "number") return false;
    return Date.now() - raw < FAILED_FETCH_BACKOFF_MS;
  } catch {
    return false;
  }
}

async function recordFailedAttempt(): Promise<void> {
  try {
    await chrome.storage.local.set({ [NAME_FETCH_FAILED_AT_KEY]: Date.now() });
  } catch {
    // ignore storage errors
  }
}

function parseNameFromHtml(html: string): { lastName: string; fullName: string } | null {
  // Look for: <span ... id='NW_PRF_VW_NAME' ...>Last,First</span>
  const doc = new DOMParser().parseFromString(html, "text/html");
  const span = doc.getElementById(NAME_SPAN_ID);
  const text = span?.textContent?.trim();
  if (!text) return null;

  // Format is "Last,First" — but be defensive.
  const commaIdx = text.indexOf(",");
  const lastName = commaIdx === -1 ? text : text.slice(0, commaIdx).trim();
  if (!lastName) return null;
  return { lastName, fullName: text };
}
