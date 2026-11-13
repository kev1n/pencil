// Pencil's sync relay. It keeps one small encrypted blob per group of paired
// devices and hands it back to whoever asks for that address. The address and
// the write token are both derived on the devices from a secret this relay
// never sees, and the blob is encrypted with a third key from the same
// secret, so nothing here can be read or tied to a person.
//
//   GET /v1/<id>   the blob, or 404
//   PUT /v1/<id>   replace it; the first write's X-Write-Token owns the address
const MAX_BYTES = 64 * 1024;
const KEEP_SECONDS = 400 * 24 * 60 * 60; // dropped after 400 days without a write

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Write-Token",
  "Access-Control-Max-Age": "86400"
};

function reply(status, body = "") {
  return new Response(body, { status, headers: { ...CORS, "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return reply(204);
    const match = /\/v1\/([0-9a-f]{64})$/.exec(new URL(request.url).pathname);
    if (!match) return reply(404);
    const id = match[1];

    if (request.method === "GET") {
      const blob = await env.BLOBS.get(id);
      return blob === null ? reply(404) : reply(200, blob);
    }

    if (request.method === "PUT") {
      const token = request.headers.get("X-Write-Token") ?? "";
      if (!/^[0-9a-f]{64}$/.test(token)) return reply(401);
      const body = await request.text();
      if (body.length === 0 || body.length > MAX_BYTES || !/^[A-Za-z0-9_-]+$/.test(body)) return reply(413);
      const owner = await sha256Hex(token);
      const existing = await env.BLOBS.getWithMetadata(id);
      if (existing.value !== null && existing.metadata?.owner !== owner) return reply(403);
      await env.BLOBS.put(id, body, { expirationTtl: KEEP_SECONDS, metadata: { owner } });
      return reply(204);
    }

    return reply(405);
  }
};
