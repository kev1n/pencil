// Three-stage rollout, bucketed by the first letter of the user's normalized
// last name. Edit the timestamps below to schedule each wave.
//
// Bucket 0: A–H, Bucket 1: I–P, Bucket 2: Q–Z (roughly equal thirds by US
// last-name distribution). The boundaries are inclusive upper bounds on the
// first character (lowercase, ascii letters only).

export type Bucket = 0 | 1 | 2;

export const BUCKET_BOUNDARIES: readonly [string, string] = ["h", "p"];

export const BUCKET_LABELS: readonly [string, string, string] = ["A–H", "I–P", "Q–Z"];

// Release times in epoch ms. Anything <= now() unlocks the bucket.
// Default: all set to 2099, edit per launch plan.
export const BUCKET_RELEASE_TIMESTAMPS: readonly [number, number, number] = [
  Date.parse("2099-01-01T00:00:00Z"),
  Date.parse("2099-01-01T00:00:00Z"),
  Date.parse("2099-01-01T00:00:00Z")
];

export function normalizeLastName(raw: string): string {
  return raw
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function bucketForLastName(lastName: string): Bucket {
  const ch = normalizeLastName(lastName).charAt(0);
  if (!ch || ch <= BUCKET_BOUNDARIES[0]) return 0;
  if (ch <= BUCKET_BOUNDARIES[1]) return 1;
  return 2;
}
