export const ACCESS_GATE_SECRET = "better-caesar/v1/9c4d2f7e6b1a3082";

// Security review note:
// This value is intentionally bundled with the public extension. It is used
// only to make deterministic rollout/referral codes for a student's normalized
// last name. It is not an authentication secret, does not protect a backend,
// and does not grant access to CAESAR, CTEC reports, Paper data, or any
// Northwestern system. A user who derives a valid code can only unlock local
// Pencil UI early; all real data access still depends on that user's own
// authenticated Northwestern browser session. Treat this as product rollout
// logic, not as a security boundary. Rotating the string invalidates existing
// referral codes if the rollout scheme needs to change.
