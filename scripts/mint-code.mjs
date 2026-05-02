#!/usr/bin/env node
// Mint a Better CAESAR unlock code for a given last name.
//
// Usage:
//   node scripts/mint-code.mjs "Wang"
//   node scripts/mint-code.mjs "Smith-Jones"
//
// The output is a 6-character Crockford base32 code formatted as XXX-XXX,
// derived from HMAC-SHA256(SECRET, normalize(lastName)). Codes are bound to
// the specific name and only valid for that user.
//
// Keep the SECRET in src/content/access-gate/secret.ts in sync with what ships
// in the extension — this script reads it from that file.

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_CHARS = 6;

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: node scripts/mint-code.mjs \"<last name>\"");
  process.exit(1);
}

const secretSrc = await readFile(
  new URL("../src/content/access-gate/secret.ts", import.meta.url),
  "utf8"
);
const secretMatch = secretSrc.match(/ACCESS_GATE_SECRET\s*=\s*"([^"]+)"/);
if (!secretMatch) {
  console.error("Could not find ACCESS_GATE_SECRET in src/content/access-gate/secret.ts");
  process.exit(2);
}
const SECRET = secretMatch[1];

const normalized = normalizeLastName(args[0]);
if (normalized.length === 0) {
  console.error("Normalized last name is empty.");
  process.exit(3);
}

const code = computeCode(SECRET, normalized);
console.log(`Last name (normalized): ${normalized}`);
console.log(`Code:                   ${code}`);

function normalizeLastName(raw) {
  return raw.normalize("NFD").toLowerCase().replace(/[^a-z]/g, "");
}

function computeCode(secret, normalized) {
  const sig = createHmac("sha256", secret).update(normalized).digest();
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
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}
