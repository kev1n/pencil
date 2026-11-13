// The parts of sync that are plain arithmetic: keys, encryption, merging.
// Paired devices share one secret. From it come the relay address, the write
// token and the encryption key; the relay (../../relay) sees only the first
// two and encrypted bytes.
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

// One entry per planned class, keyed "term|section". A removal stays as a
// marker so it wins over an older add on another device.
// `moved` is a forwarding note: this group joined another one, whose secret it
// names. A device that reads it merges its plan into that group and follows.
export type SyncDoc = { v: 1; items: Record<string, { at: number; gone?: true }>; moved?: string };

const text = new TextEncoder();
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

export function newSecret(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function isSecret(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export type SyncKeys = { id: string; writeToken: string; key: Uint8Array };

export function deriveKeys(secret: string): SyncKeys {
  const root = fromBase64Url(secret);
  const part = (label: string) => hkdf(sha256, root, undefined, text.encode(`pencil-sync ${label}`), 32);
  return { id: hex(part("address")), writeToken: hex(part("write")), key: part("encrypt") };
}

export function seal(doc: SyncDoc, key: Uint8Array): string {
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const sealed = xchacha20poly1305(key, nonce).encrypt(text.encode(JSON.stringify(doc)));
  const out = new Uint8Array(nonce.length + sealed.length);
  out.set(nonce);
  out.set(sealed, nonce.length);
  return toBase64Url(out);
}

// Throws if the blob was not sealed with this key or was altered.
export function open(blob: string, key: Uint8Array): SyncDoc {
  const bytes = fromBase64Url(blob);
  const plain = xchacha20poly1305(key, bytes.slice(0, 24)).decrypt(bytes.slice(24));
  const doc = JSON.parse(new TextDecoder().decode(plain)) as SyncDoc;
  if (doc?.v !== 1 || typeof doc.items !== "object") throw new Error("Unreadable sync data.");
  return doc;
}

// The newer change to each class wins; a removal wins a tie.
export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  const items = { ...a.items };
  for (const [key, theirs] of Object.entries(b.items)) {
    const mine = items[key];
    if (!mine || theirs.at > mine.at || (theirs.at === mine.at && theirs.gone)) items[key] = theirs;
  }
  return { v: 1, items };
}

export function sameDoc(a: SyncDoc, b: SyncDoc): boolean {
  const keys = Object.keys(a.items);
  if (keys.length !== Object.keys(b.items).length) return false;
  return keys.every((key) => b.items[key]?.at === a.items[key].at && !b.items[key].gone === !a.items[key].gone);
}
