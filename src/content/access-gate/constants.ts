// Three-stage rollout, bucketed by the user's expected graduation year as
// reported by CAESAR (SAA_EXP_GRD_TRM_FL). Bucket boundaries are fixed in
// code; the per-bucket release timestamps are fetched from the remote
// schedule server (see server-client.ts) so they can be edited without
// shipping a new build.
//
// Bucket 0: graduating 2027 or earlier (most senior — unlocks first)
// Bucket 1: graduating 2028
// Bucket 2: graduating 2029 or later, or unknown grad year (open release)

export type Bucket = 0 | 1 | 2;

export const BUCKET_LABELS: readonly [string, string, string] = [
  "Class of 2027 and earlier",
  "Class of 2028",
  "Class of 2029 and later"
];

// Used when the remote schedule is unreachable. All buckets unlock at
// epoch 0, so the extension behaves as if no server existed: no kill, no
// banner, every bucket open. Tradeoff: an adversary who can block the
// schedule URL bypasses the kill switch — accepted per product call so a
// server outage doesn't break the extension for anyone.
export const FALLBACK_BUCKET_RELEASE_TIMESTAMPS: readonly [number, number, number] = [0, 0, 0];

export function bucketForGradYear(year: number | null): Bucket {
  if (year === null || !Number.isFinite(year)) return 2;
  if (year <= 2027) return 0;
  if (year === 2028) return 1;
  return 2;
}

// Still used by code.ts to derive the per-user HMAC override code.
export function normalizeLastName(raw: string): string {
  return raw
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}
