// Surfaces what the extension knows about the user's CTEC access. Three
// states, hydrated from `ctec-index/access`:
//
//   • confirmed — we've reached a real CTEC results panel for this NetID.
//   • denied — CAESAR routed us to the NW_CTEC_MSG_FL "not authorized"
//     message page. Every CTEC code path short-circuits while this is
//     set; auto-expires after ACCESS_VERDICT_TTL_MS, and the popup's
//     "Clear CTEC cache" button wipes it immediately on demand.
//   • unknown — neither has happened yet (or the cached verdict expired
//     / was cleared).
//
// The status is read-only here — the row exists so the user can see why
// CTEC widgets are absent / muted on CAESAR + paper.nu.

import {
  ACCESS_VERDICT_TTL_MS,
  CTEC_ACCESS_CHECK_ENABLED,
  CTEC_ACCESS_STORAGE_KEY,
  type CtecAccessStatus
} from "../../content/ctec-index/access-shared";

const ROW_ID = "ctec-access-row";

type StatusView = {
  label: string;
  detail: string;
  pillText: string;
  pillModifier: "ok" | "warn" | "muted";
};

const STATUS_VIEWS: Record<CtecAccessStatus, StatusView> = {
  confirmed: {
    label: "CTEC access",
    detail: "Northwestern is serving CTEC reports to this NetID.",
    pillText: "OK",
    pillModifier: "ok"
  },
  denied: {
    label: "CTEC access",
    detail:
      "Northwestern revoked CTEC access for this NetID — finish your CTECs in the next collection period to restore it.",
    pillText: "No access",
    pillModifier: "warn"
  },
  unknown: {
    label: "CTEC access",
    detail:
      "Will be detected the first time a CTEC widget runs on CAESAR or paper.nu.",
    pillText: "Not checked yet",
    pillModifier: "muted"
  }
};

export async function initCtecAccessStatus(): Promise<void> {
  const root = document.getElementById(ROW_ID);
  if (!(root instanceof HTMLElement)) return;
  if (!CTEC_ACCESS_CHECK_ENABLED) {
    root.hidden = true;
    return;
  }

  await render(root, await readStatusOnce());

  // Live-refresh: any context (popup itself, content script, background)
  // writing or removing the access key bumps this row without a reload.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!(CTEC_ACCESS_STORAGE_KEY in changes)) return;
    void render(root, parseStatus(changes[CTEC_ACCESS_STORAGE_KEY]?.newValue));
  });
}

async function readStatusOnce(): Promise<CtecAccessStatus> {
  const raw = (await chrome.storage.local.get(CTEC_ACCESS_STORAGE_KEY))[
    CTEC_ACCESS_STORAGE_KEY
  ];
  return parseStatus(raw);
}

// Mirrors the parser in ctec-index/access.ts. Reimplemented (rather
// than imported) so the popup avoids access.ts's content-script-only
// side effects (chrome.storage hydration + onChanged listener).
function parseStatus(raw: unknown): CtecAccessStatus {
  if (!raw || typeof raw !== "object") return "unknown";
  const candidate = raw as { kind?: unknown; deniedAt?: unknown; confirmedAt?: unknown };
  if (candidate.kind === "denied" && typeof candidate.deniedAt === "number") {
    const age = Date.now() - candidate.deniedAt;
    return age > ACCESS_VERDICT_TTL_MS ? "unknown" : "denied";
  }
  if (candidate.kind === "confirmed" && typeof candidate.confirmedAt === "number") {
    const age = Date.now() - candidate.confirmedAt;
    return age > ACCESS_VERDICT_TTL_MS ? "unknown" : "confirmed";
  }
  return "unknown";
}

async function render(root: HTMLElement, status: CtecAccessStatus): Promise<void> {
  const view = STATUS_VIEWS[status];
  root.innerHTML = "";

  const labelGroup = document.createElement("div");
  labelGroup.className = "ctec-school-label";

  const labelTitle = document.createElement("span");
  labelTitle.className = "ctec-school-label-title";
  labelTitle.textContent = view.label;

  const labelHelp = document.createElement("span");
  labelHelp.className = "ctec-school-label-help";
  labelHelp.textContent = view.detail;

  labelGroup.append(labelTitle, labelHelp);

  const pill = document.createElement("span");
  pill.className = `ctec-access-pill ctec-access-pill--${view.pillModifier}`;
  pill.textContent = view.pillText;

  root.append(labelGroup, pill);
}
