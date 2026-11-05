// Upfront access probe. Single GET to the CTEC search panel URL with
// the NavColl query params CAESAR's UI uses for AJAX panel updates.
// Deauthorized NetIDs get the unauthorized message panel back
// (Page=NW_CTEC_MSG_FL + "You are not authorized to access CTECs"
// copy); authorized NetIDs get the real search form. Called from
// `fetchCtecLinksInternal` when access status is "unknown" — the result
// flips state to denied or confirmed and short-circuits every later
// CTEC code path.

import { fetchPeopleSoftGetResult } from "../peoplesoft/http";
import { CaesarConnectionError } from "../peoplesoft/connection";
import { logDebug, logQuiet } from "../../shared/log";

import {
  extractPeopleSoftPageId,
  getCtecAccessStatus,
  markCtecAccessConfirmed,
  markCtecAccessDenied
} from "./access";

const CTEC_ACCESS_PROBE_URL =
  "https://caesar.ent.northwestern.edu/psc/csnu/EMPLOYEE/SA/c/NWCT.NW_CT_PUB_SRCH_FL.GBL?NavColl=true&ICAJAX=1&ICAGTarget=start&ICAJAXTrf=true&ICPanelControlStyle=pst_side1-fixed%20pst_panel-mode%20";

const UNAUTHORIZED_TEXT = "you are not authorized to access ctecs";
const UNAUTHORIZED_PAGE_ID = "NW_CTEC_MSG_FL";
// Positive-confirmation marker. The CTEC search page renders this
// disclaimer for any authorized NetID; its presence is our signal that
// we actually landed on the real CTEC UI (not an SSO bounce, captive
// portal, or unrelated PeopleSoft response). Lowercased substring match
// — forgiving on whitespace and casing while still being specific
// enough that no other PeopleSoft page would carry it.
const AUTHORIZED_DISCLAIMER_TEXT =
  "intended solely for the use of faculty, staff and students of northwestern university";

// Dedup parallel Load CTEC clicks onto a single in-flight probe.
let inFlightProbe: Promise<void> | null = null;

export async function probeCtecAccess(): Promise<void> {
  if (getCtecAccessStatus() !== "unknown") return;
  if (inFlightProbe) return inFlightProbe;

  inFlightProbe = runProbe().finally(() => {
    inFlightProbe = null;
  });
  return inFlightProbe;
}

async function runProbe(): Promise<void> {
  logDebug("ctec-access:probe", "starting probe", { url: CTEC_ACCESS_PROBE_URL });

  let html: string;
  let status: number;
  try {
    const response = await fetchPeopleSoftGetResult(CTEC_ACCESS_PROBE_URL);
    html = response.text;
    status = response.status;
  } catch (err) {
    if (err instanceof CaesarConnectionError) throw err;
    // Stay unknown on network failure so the next click re-probes.
    logQuiet("ctec-access:probe", err);
    return;
  }

  const pageId = extractPeopleSoftPageId(html);
  // Normalize before substring matching: lowercase, decode the few HTML
  // entities PeopleSoft commonly emits between words (`&nbsp;`, numeric
  // forms), then collapse every run of whitespace to a single space. The
  // disclaimer constants below use single ASCII spaces, so anything
  // matching after this pass is robust to HTML-entity gaps and
  // multi-line wrapping.
  const normalized = normalizeHtmlForMatch(html);
  const hasUnauthorizedText = normalized.includes(UNAUTHORIZED_TEXT);
  const hasAuthorizedDisclaimer = normalized.includes(AUTHORIZED_DISCLAIMER_TEXT);

  logDebug("ctec-access:probe", "probe response", {
    status,
    bodyLength: html.length,
    pageId,
    hasUnauthorizedText,
    hasAuthorizedDisclaimer
  });

  if (hasUnauthorizedText || pageId === UNAUTHORIZED_PAGE_ID) {
    markCtecAccessDenied(`probe: unauthorized markers (pageId=${pageId ?? "null"})`);
    return;
  }
  if (hasAuthorizedDisclaimer) {
    markCtecAccessConfirmed(
      `probe: authorized disclaimer present (pageId=${pageId ?? "null"})`
    );
    return;
  }
  // Ambiguous response — neither a denial nor a positive confirmation.
  // Stay "unknown" so the next Load CTEC click re-probes; never grant
  // access on absence-of-denial alone.
  logDebug("ctec-access:probe", "ambiguous response — staying unknown", {
    pageId
  });
}

function normalizeHtmlForMatch(html: string): string {
  return html
    .toLowerCase()
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/\s+/g, " ");
}
