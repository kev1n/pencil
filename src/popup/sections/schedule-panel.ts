import { evaluateGate } from "../../content/access-gate";
import { BUCKET_LABELS, bucketForGradYear, type Bucket } from "../../content/access-gate/constants";
import { renderInlineMarkdown } from "../../content/access-gate/markdown";
import {
  SCHEDULE_CACHE_STORAGE_KEY,
  readCachedRemoteSchedule,
  type RemoteSchedule
} from "../../content/access-gate/server-client";
import { readStoredName } from "../../content/access-gate/storage";

export async function initSchedulePanel(): Promise<void> {
  const root = document.getElementById("schedule");
  if (!(root instanceof HTMLElement)) return;

  let schedule: RemoteSchedule | null = null;
  let userBucket: Bucket | null = null;
  let userGradYear: number | null = null;

  const reload = async (): Promise<void> => {
    schedule = await readCachedRemoteSchedule();
    const stored = await readStoredName();
    userGradYear = stored?.gradYear ?? null;
    userBucket = stored ? bucketForGradYear(stored.gradYear) : null;
    paint();
  };

  const paint = (): void => paintSchedulePanel(root, schedule, userBucket, userGradYear);

  // Trigger evaluateGate so the schedule cache gets populated/refreshed
  // before we read it — otherwise a fresh popup open could show empty.
  await evaluateGate();
  await reload();

  // Tick every second so the countdowns are live.
  setInterval(paint, 1000);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[SCHEDULE_CACHE_STORAGE_KEY]) return;
    void reload();
  });
}

function paintSchedulePanel(
  root: HTMLElement,
  schedule: RemoteSchedule | null,
  userBucket: Bucket | null,
  userGradYear: number | null
): void {
  root.innerHTML = "";

  const title = document.createElement("div");
  title.className = "schedule-title";
  title.textContent = "Bucket schedule";
  root.append(title);

  if (userBucket !== null) {
    const you = document.createElement("div");
    you.className = "schedule-you";
    const yearText = userGradYear !== null ? `class of ${userGradYear}` : "no grad year on file";
    you.textContent = `You're in ${BUCKET_LABELS[userBucket]} (${yearText}).`;
    root.append(you);
  }

  if (!schedule) {
    const empty = document.createElement("div");
    empty.className = "schedule-empty";
    empty.textContent = "Schedule not yet fetched. Open CAESAR or paper.nu to populate, or check the local server.";
    root.append(empty);
    return;
  }

  root.append(buildBroadcastRow("Kill switch", schedule.kill));
  root.append(buildBroadcastRow("Banner", schedule.banner));

  const list = document.createElement("ul");
  list.className = "schedule-list";

  const now = Date.now();
  for (let i = 0; i < 3; i += 1) {
    const li = document.createElement("li");
    li.className = "schedule-row";
    if (i === userBucket) li.classList.add("schedule-row--you");

    const label = document.createElement("span");
    label.className = "schedule-label";
    label.textContent = BUCKET_LABELS[i];
    if (i === userBucket) {
      const tag = document.createElement("span");
      tag.className = "schedule-you-tag";
      tag.textContent = "you";
      label.append(" ", tag);
    }

    const value = document.createElement("span");
    value.className = "schedule-value";
    const releaseAt = schedule.releases[i];
    const remaining = releaseAt - now;
    if (remaining <= 0) {
      value.textContent = "unlocked";
      value.classList.add("schedule-value--ok");
    } else {
      value.textContent = formatCountdown(remaining);
    }

    li.append(label, value);
    list.append(li);
  }

  root.append(list);
}

function buildBroadcastRow(label: string, broadcast: { id: string; message: string } | null): HTMLElement {
  const row = document.createElement("div");
  row.className = "schedule-broadcast";

  const head = document.createElement("div");
  head.className = "schedule-broadcast-head";
  const labelEl = document.createElement("span");
  labelEl.className = "schedule-broadcast-label";
  labelEl.textContent = label;
  const status = document.createElement("span");
  status.className = "schedule-broadcast-status";
  status.textContent = broadcast ? `active · id: ${broadcast.id}` : "inactive";
  status.classList.toggle("schedule-broadcast-status--active", !!broadcast);
  head.append(labelEl, status);

  row.append(head);

  if (broadcast) {
    const body = document.createElement("div");
    body.className = "schedule-broadcast-body";
    renderInlineMarkdown(body, broadcast.message);
    row.append(body);
  }

  return row;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600) % 24;
  const day = Math.floor(totalSec / 86400);
  return `${day}d ${hr}h ${min}m ${sec}s`;
}
