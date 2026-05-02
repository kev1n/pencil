// Shared secret for HMAC-based unlock codes. Codes bind to a normalized last
// name, so a leaked secret only lets someone mint codes for *specific* names —
// not bypass the bucket gate broadly. Rotate by changing this string (existing
// codes will stop working).
export const ACCESS_GATE_SECRET = "better-caesar/v1/9c4d2f7e6b1a3082";
