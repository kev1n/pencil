import { normalizeLastName } from "./constants";
import { ACCESS_GATE_SECRET } from "./secret";

// Crockford base32 alphabet (no I, L, O, U) for unambiguous typing.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_BITS = 30;
const CODE_CHARS = 6;

export const CODE_FORMAT_HINT = "XXX-XXX";

export async function computeCodeForLastName(lastName: string): Promise<string> {
  const normalized = normalizeLastName(lastName);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(ACCESS_GATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(normalized))
  );

  // Take the first 30 bits of the HMAC output.
  let n =
    (BigInt(sig[0]) << 22n) |
    (BigInt(sig[1]) << 14n) |
    (BigInt(sig[2]) << 6n) |
    (BigInt(sig[3]) >> 2n);

  let out = "";
  for (let i = 0; i < CODE_CHARS; i += 1) {
    out = ALPHABET[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return formatCode(out);
}

export function formatCode(raw: string): string {
  const cleaned = canonicalizeCodeInput(raw);
  if (cleaned.length !== CODE_CHARS) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

// Strip dashes/whitespace, uppercase, and map common Crockford-confused
// characters to the alphabet. This makes typed input forgiving.
export function canonicalizeCodeInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/I/g, "1")
    .replace(/L/g, "1")
    .replace(/O/g, "0");
}

export async function isCodeValidForLastName(
  inputCode: string,
  lastName: string
): Promise<boolean> {
  const expected = canonicalizeCodeInput(await computeCodeForLastName(lastName));
  const actual = canonicalizeCodeInput(inputCode);
  if (actual.length !== CODE_CHARS) return false;
  return actual === expected;
}

export { CODE_BITS, CODE_CHARS };
