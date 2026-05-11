import { logQuiet } from "../../shared/log";
import { fetchTextViaBackground } from "../remote-fetch";
import { parseCourseHistoryAjax } from "./parse";
import { readCourseHistory, writeCourseHistory } from "./storage";

const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour
const COURSE_HISTORY_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu_5/EMPLOYEE/SA/c/SSR_STUDENT_ACAD_REC_FL.SSR_CRSE_HIST_FL.GBL?Page=SSR_CRSE_HIST_FL&pslnkid=CS_S201605051911149930439391&ICAJAX=1&ICMDTarget=start&ICPanelControlStyle=%20pst_side1-fixed%20pst_panel-mode%20";

let inFlight: Promise<void> | null = null;

// Mirrors cart-cache's opportunistic-reconcile pattern: when the user is
// on a CAESAR page and our cached snapshot is older than STALE_AFTER_MS,
// fetch the SSR_CRSE_HIST_FL AJAX endpoint in the background. PeopleSoft
// session cookies flow through host_permissions, but only because the
// user has an active CAESAR tab — caller in content/index.ts must gate on
// host. If the response isn't a recognizable course-history fragment
// (login redirect, error envelope), abort silently and let the next page
// load try again.
export async function runOpportunisticCourseHistoryReconcile(): Promise<void> {
  if (inFlight) return inFlight;

  const cache = readCourseHistory();
  if (cache.refreshedAt !== 0 && Date.now() - cache.refreshedAt < STALE_AFTER_MS) {
    return;
  }

  inFlight = (async () => {
    try {
      const xml = await fetchTextViaBackground(COURSE_HISTORY_URL).catch((err) => {
        logQuiet("course-history.fetch", err);
        return null;
      });
      if (!xml) return;

      const entries = parseCourseHistoryAjax(xml);
      if (!entries) return;

      writeCourseHistory(entries);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
