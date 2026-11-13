// Keeps the plan the same on a student's own devices. Devices are paired by
// sharing one secret (a link or QR code); each then keeps an encrypted copy
// of the plan on the relay and merges what the others put there. The relay
// cannot read it. See sync-core.ts for the keys and the merge rule.
import { getTermCourses } from "@ext/content/augmentations/class-search/paper-data";
import { addToSchedule, onScheduleChange, removeFromSchedule, scheduleChanges } from "./schedule";
import { createStore, useStore } from "./store";
import { deriveKeys, isSecret, mergeDocs, newSecret, open, sameDoc, seal, type SyncDoc } from "./sync-core";

const RELAY: string = import.meta.env.VITE_SYNC_URL ?? "https://www.pencil.nu/sync";
const LINK = "https://pencil.nu/plan";
const KEY = "pencil-app:sync:v1";

type SyncState = { secret: string | null; syncedAt: number | null; problem: string | null };
const state = createStore<SyncState>({ secret: null, syncedAt: null, problem: null });

export function useSync(): SyncState {
  return useStore(state);
}

export function pairingLink(secret: string): string {
  return `${LINK}#k=${secret}`;
}

// The secret inside a pairing link, or null for any other text.
export function readPairingLink(text: string): string | null {
  const match = /(?:pencil\.nu\/plan\/?|pencilnu:\/\/plan\/?)#k=([A-Za-z0-9_-]+)/i.exec(text);
  return match && isSecret(match[1]) ? match[1] : null;
}

function localDoc(): SyncDoc {
  const { planned, removed } = scheduleChanges();
  const items: SyncDoc["items"] = {};
  for (const [key, at] of Object.entries(removed)) items[key] = { at, gone: true };
  for (const [key, entry] of Object.entries(planned)) items[key] = { at: entry.addedAt };
  return { v: 1, items };
}

// Brings this device's plan in line with the merged copy. A class this device
// cannot look up yet (catalog not loaded, off line) is left for a later pass;
// it stays in the merged copy either way.
async function applyToSchedule(merged: SyncDoc): Promise<void> {
  const { planned } = scheduleChanges();
  for (const [key, item] of Object.entries(merged.items)) {
    const [termId, sectionId] = key.split("|");
    const mine = planned[key];
    if (item.gone) {
      if (mine && mine.addedAt <= item.at) removeFromSchedule(termId, sectionId, item.at);
      continue;
    }
    if (mine) continue;
    const courses = await getTermCourses(termId).catch(() => []);
    const course = courses.find((c) => c.sections.some((s) => s.section_id === sectionId));
    const section = course?.sections.find((s) => s.section_id === sectionId);
    if (course && section) {
      addToSchedule({ termId, subject: course.subject, catalog: course.catalog, title: course.title, section }, item.at);
    }
  }
}

let running: Promise<void> | null = null;
let again = false;

async function syncOnce(secret: string): Promise<void> {
  const keys = deriveKeys(secret);
  const url = `${RELAY}/v1/${keys.id}`;
  const got = await fetch(url, { cache: "no-store" });
  if (!got.ok && got.status !== 404) throw new Error(`The sync service answered ${got.status}.`);
  const remote: SyncDoc = got.ok ? open(await got.text(), keys.key) : { v: 1, items: {} };
  const merged = mergeDocs(remote, localDoc());
  await applyToSchedule(merged);
  if (!sameDoc(merged, remote)) {
    const put = await fetch(url, { method: "PUT", headers: { "X-Write-Token": keys.writeToken }, body: seal(merged, keys.key) });
    if (!put.ok) throw new Error(`The sync service answered ${put.status}.`);
  }
}

// Runs one sync; a request made while one is running makes it run once more.
export function syncNow(): Promise<void> {
  const secret = state.get().secret;
  if (!secret) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = syncOnce(secret)
    .then(
      () => state.update((s) => ({ ...s, syncedAt: Date.now(), problem: null })),
      (error) => state.update((s) => ({ ...s, problem: error instanceof Error ? error.message : "Sync didn’t go through." }))
    )
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    });
  return running;
}

function saveSecret(secret: string | null): void {
  void (secret ? chrome.storage.local.set({ [KEY]: { secret } }) : chrome.storage.local.remove(KEY));
  state.set({ secret, syncedAt: null, problem: null });
}

// Starts syncing from this device and returns the secret to pair others with.
export function turnOnSync(): string {
  const secret = newSecret();
  saveSecret(secret);
  void syncNow();
  return secret;
}

// Pairs this device using a secret from another one. The two plans merge.
export function joinSync(secret: string): Promise<void> {
  saveSecret(secret);
  return syncNow();
}

// Stops syncing on this device only; the plan stays here and on the others.
export function leaveSync(): void {
  saveSecret(null);
}

export async function startSync(): Promise<void> {
  const saved = (await chrome.storage.local.get(KEY))[KEY] as { secret?: string } | undefined;
  if (saved?.secret && isSecret(saved.secret)) state.set({ secret: saved.secret, syncedAt: null, problem: null });
  let timer: ReturnType<typeof setTimeout> | undefined;
  onScheduleChange(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void syncNow();
  });
  setInterval(() => {
    if (!document.hidden) void syncNow();
  }, 60_000);
  void syncNow();
}
