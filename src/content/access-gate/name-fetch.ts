import { fetchTextResultViaBackground } from "../remote-fetch";
import { writeStoredName, type StoredName } from "./storage";

const PROFILE_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/NW_SS_STUDENT.NW_SS_CUST_ACCT.GBL?NavColl=true&ICAGTarget=start";

const NAME_SPAN_ID = "NW_PRF_VW_NAME";

let inFlight: Promise<StoredName | null> | null = null;
let attemptedThisSession = false;

export function fetchAndCacheUserName(): Promise<StoredName | null> {
  if (inFlight) return inFlight;
  if (attemptedThisSession) return Promise.resolve(null);
  attemptedThisSession = true;
  inFlight = (async () => {
    try {
      const response = await fetchTextResultViaBackground(PROFILE_URL);
      if (response.status < 200 || response.status >= 300) return null;
      const parsed = parseNameFromHtml(response.text);
      if (!parsed) return null;
      const stored: StoredName = {
        lastName: parsed.lastName,
        fullName: parsed.fullName,
        fetchedAt: Date.now()
      };
      await writeStoredName(stored);
      return stored;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
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
