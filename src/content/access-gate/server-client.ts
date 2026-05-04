import { fetchTextResultViaBackground } from "../remote-fetch";
import { FALLBACK_BUCKET_RELEASE_TIMESTAMPS } from "./constants";

// Substituted at build time from BC_BUCKET_SCHEDULE_URL in .env. The build
// script also patches the URL's origin into the manifest's host_permissions
// so the background fetch is allowed.
export const BUCKET_SCHEDULE_URL = __BC_BUCKET_SCHEDULE_URL__;

const SCHEDULE_REFETCH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const SCHEDULE_STORAGE_KEY = "better-caesar:access-gate:bucket-schedule:v1";

// Wire format the schedule server must return:
//
//   {
//     "releases": [
//       "2026-06-01T17:00:00Z",
//       "2026-06-08T17:00:00Z",
//       "2026-06-15T17:00:00Z"
//     ],
//     "kill": {
//       "message": "Better CAESAR is paused. See [status](https://example.com/status)."
//     },
//     "banner": {
//       "message": "Heads up: CAESAR maintenance Fri 9pm. [Details](https://example.com/post)."
//     }
//   }
//
// `releases` — exactly three ISO-8601 timestamps, ordered:
//   [0] Class of 2027 and earlier
//   [1] Class of 2028
//   [2] Class of 2029 and later (open release)
// Bucket N unlocks once Date.now() >= Date.parse(releases[N]).
//
// `kill` — optional. If present, the extension is fully disabled (every
// augmentation is suppressed and a toast appears on CAESAR / paper.nu with
// `message`). The HMAC-code override does NOT bypass the kill switch.
//
// `banner` — optional. A passive informational strip that renders at the top
// of CAESAR and paper.nu pages. Doesn't disable anything.
//
// Both objects require `{ id, message }`. The `id` is the dismissal key:
// once a user clicks the toast / banner close, that id is cached in
// chrome.storage.local and won't show up again. Edit `message` while
// keeping the same `id` to fix typos without re-pestering everyone; bump
// `id` (e.g. "maint-2026-08-15") to force a re-show. The kill *behavior*
// applies regardless of toast dismissal — only the toast UI is hidden.
//
// `message` supports inline [text](url) links with http(s) URLs; everything
// else renders as plain text. Omit a key (or send null) to clear it.
//
// The server should serve this with permissive CORS (the extension fetches
// via the background worker, so any 200 response is fine) and a short
// cache-control max-age — the extension also caches client-side for 30 min.
export type Broadcast = { id: string; message: string };

export type BucketScheduleResponse = {
  releases: [string, string, string];
  kill?: Broadcast | null;
  banner?: Broadcast | null;
};

export type RemoteSchedule = {
  releases: readonly [number, number, number];
  kill: Broadcast | null;
  banner: Broadcast | null;
};

type CachedSchedule = {
  releaseAt: [number, number, number];
  kill: Broadcast | null;
  banner: Broadcast | null;
  fetchedAt: number;
};

export const SCHEDULE_CACHE_STORAGE_KEY = SCHEDULE_STORAGE_KEY;

const FALLBACK_SCHEDULE: RemoteSchedule = {
  releases: FALLBACK_BUCKET_RELEASE_TIMESTAMPS,
  kill: null,
  banner: null
};

export async function getRemoteSchedule(): Promise<RemoteSchedule> {
  const cached = await readCachedSchedule();
  if (cached && Date.now() - cached.fetchedAt < SCHEDULE_REFETCH_INTERVAL_MS) {
    return { releases: cached.releaseAt, kill: cached.kill, banner: cached.banner };
  }
  const fresh = await fetchSchedule();
  if (fresh) {
    await writeCachedSchedule({
      releaseAt: [fresh.releases[0], fresh.releases[1], fresh.releases[2]],
      kill: fresh.kill,
      banner: fresh.banner,
      fetchedAt: Date.now()
    });
    return fresh;
  }
  // Server unreachable AND cache is stale (>30min). Don't serve the stale
  // cache — fall back to the fully-open schedule so a long outage doesn't
  // leave yesterday's kill / banner active forever.
  return FALLBACK_SCHEDULE;
}

// Synchronous read of whatever's cached. Used by the banner mount to render
// without re-fetching; live updates come via chrome.storage.onChanged.
export async function readCachedRemoteSchedule(): Promise<RemoteSchedule | null> {
  const cached = await readCachedSchedule();
  if (!cached) return null;
  return { releases: cached.releaseAt, kill: cached.kill, banner: cached.banner };
}

async function fetchSchedule(): Promise<RemoteSchedule | null> {
  try {
    const response = await fetchTextResultViaBackground(BUCKET_SCHEDULE_URL);
    if (response.status < 200 || response.status >= 300) return null;
    const parsed = JSON.parse(response.text) as Partial<BucketScheduleResponse>;
    if (!Array.isArray(parsed.releases) || parsed.releases.length !== 3) return null;
    const out: number[] = [];
    for (const iso of parsed.releases) {
      const ms = typeof iso === "string" ? Date.parse(iso) : NaN;
      if (Number.isNaN(ms)) return null;
      out.push(ms);
    }
    return {
      releases: [out[0], out[1], out[2]],
      kill: parseMessageBlock(parsed.kill),
      banner: parseMessageBlock(parsed.banner)
    };
  } catch {
    return null;
  }
}

function parseMessageBlock(raw: unknown): Broadcast | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { id?: unknown; message?: unknown };
  if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;
  if (typeof candidate.message !== "string" || candidate.message.length === 0) return null;
  return { id: candidate.id, message: candidate.message };
}

async function readCachedSchedule(): Promise<CachedSchedule | null> {
  const result = (await chrome.storage.local.get(SCHEDULE_STORAGE_KEY)) as Record<string, unknown>;
  const raw = result[SCHEDULE_STORAGE_KEY];
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<CachedSchedule>;
  if (
    !Array.isArray(candidate.releaseAt) ||
    candidate.releaseAt.length !== 3 ||
    candidate.releaseAt.some((n) => typeof n !== "number")
  ) return null;
  return {
    releaseAt: candidate.releaseAt as [number, number, number],
    kill: parseMessageBlock(candidate.kill),
    banner: parseMessageBlock(candidate.banner),
    fetchedAt: typeof candidate.fetchedAt === "number" ? candidate.fetchedAt : 0
  };
}

async function writeCachedSchedule(value: CachedSchedule): Promise<void> {
  await chrome.storage.local.set({ [SCHEDULE_STORAGE_KEY]: value });
}
