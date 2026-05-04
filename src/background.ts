import type {
  AbortFetchMessage,
  AuthPopupClosedMessage,
  CreditUsedMessage,
  FetchBinaryMessage,
  FetchTextMessage,
  OpenAuthPopupMessage,
  OpenAuthPopupResponse
} from "./shared/messages";

const FETCH_TIMEOUT_MS = 30_000;
const fetchControllers = new Map<string, AbortController>();

// Failsafe circuit breaker: if we ever exceed CIRCUIT_BREAKER_MAX requests
// to NU institutional hosts within CIRCUIT_BREAKER_WINDOW_MS — regardless of
// which feature is responsible — refuse further fetches and reload the
// extension. Reloading invalidates content scripts in open tabs, so any
// runaway loop dies the moment its next sendMessage fails.
//
// NOT covered: direct same-origin fetches that bypass the background worker.
// Specifically, peoplesoft/http.ts (when running on caesar.ent) and the
// `fetch()` in enrollment-navigation/augmentation.ts call window.fetch
// directly. They won't increment this counter and won't be stopped by a
// runtime.reload(). If we ever need a true global limit, route every
// CAESAR/Bluera request through this worker.
const CIRCUIT_BREAKER_WINDOW_MS = 60_000;
const CIRCUIT_BREAKER_MAX = 50;
const CIRCUIT_BREAKER_HOSTS = new Set([
  "caesar.ent.northwestern.edu",
  "northwestern.bluera.com"
]);
const requestTimestamps: number[] = [];
let circuitTripped = false;

function isWatchedUrl(url: string): boolean {
  try {
    return CIRCUIT_BREAKER_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function recordAndCheckCircuitBreaker(url: string): boolean {
  if (!isWatchedUrl(url)) return true;
  if (circuitTripped) return false;

  const now = Date.now();
  const cutoff = now - CIRCUIT_BREAKER_WINDOW_MS;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
  requestTimestamps.push(now);

  if (requestTimestamps.length > CIRCUIT_BREAKER_MAX) {
    circuitTripped = true;
    console.error(
      `[pencil.nu] Circuit breaker tripped: ${requestTimestamps.length} ` +
        `requests to NU hosts in the last ${CIRCUIT_BREAKER_WINDOW_MS / 1000}s. ` +
        `Reloading extension as a failsafe.`
    );
    setTimeout(() => chrome.runtime.reload(), 100);
    return false;
  }
  return true;
}

const POST_AUTH_URL_PATTERNS = [
  /^https:\/\/caesar\.ent\.northwestern\.edu\/psc\//i,
  /^https:\/\/northwestern\.bluera\.com\/northwestern\//i
];

type TrackedPopup = {
  tabId: number;
  ownerTabId: number;
};

const trackedPopups = new Map<number, TrackedPopup>();
const ownerToPopup = new Map<number, number>();

chrome.runtime.onInstalled.addListener(() => {
  console.log("pencil.nu extension installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "fetch-text") {
    void handleFetchText(message as FetchTextMessage, sendResponse);
    return true;
  }
  if (message.type === "fetch-binary") {
    void handleFetchBinary(message as FetchBinaryMessage, sendResponse);
    return true;
  }
  if (message.type === "open-auth-popup") {
    void handleOpenAuthPopup(message as OpenAuthPopupMessage, sender, sendResponse);
    return true;
  }
  if (message.type === "abort-fetch") {
    const controller = fetchControllers.get((message as AbortFetchMessage).requestId);
    controller?.abort();
    return false;
  }
  if (message.type === "credit-used") {
    const m = message as CreditUsedMessage;
    const owner = m.owner ? ` owner=${m.owner}` : "";
    console.log(
      `[pencil.nu] credit used [${m.pool}]: ${m.remaining}/${m.cap} left${owner}`
    );
    return false;
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  const tracked = trackedPopups.get(tabId);
  if (!tracked) return;
  if (info.status !== "complete") return;

  const currentUrl = tab.url ?? "";
  if (!POST_AUTH_URL_PATTERNS.some((pattern) => pattern.test(currentUrl))) return;

  forgetPopup(tabId);
  void chrome.tabs.update(tracked.ownerTabId, { active: true }).catch(() => undefined);
  void chrome.tabs.remove(tabId).catch(() => undefined);
  notifyOwner(tracked.ownerTabId, "succeeded");
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const tracked = trackedPopups.get(tabId);
  if (!tracked) return;
  forgetPopup(tabId);
  notifyOwner(tracked.ownerTabId, "user-closed");
});

async function handleOpenAuthPopup(
  message: OpenAuthPopupMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: OpenAuthPopupResponse) => void
): Promise<void> {
  const ownerTabId = sender.tab?.id;
  if (ownerTabId === undefined) {
    sendResponse({ ok: false, error: "Missing sender tab" });
    return;
  }

  const existingPopupId = ownerToPopup.get(ownerTabId);
  if (existingPopupId !== undefined) {
    forgetPopup(existingPopupId);
    void chrome.tabs.remove(existingPopupId).catch(() => undefined);
  }

  try {
    const tab = await chrome.tabs.create({ url: message.loginUrl, active: true });
    if (tab.id === undefined) {
      sendResponse({ ok: false, error: "Tab created without id" });
      return;
    }
    trackedPopups.set(tab.id, {
      tabId: tab.id,
      ownerTabId
    });
    ownerToPopup.set(ownerTabId, tab.id);
    sendResponse({ ok: true, tabId: tab.id });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function forgetPopup(tabId: number): void {
  const tracked = trackedPopups.get(tabId);
  trackedPopups.delete(tabId);
  if (tracked && ownerToPopup.get(tracked.ownerTabId) === tabId) {
    ownerToPopup.delete(tracked.ownerTabId);
  }
}

function notifyOwner(ownerTabId: number, reason: AuthPopupClosedMessage["reason"]): void {
  const message: AuthPopupClosedMessage = { type: "auth-popup-closed", reason };
  void chrome.tabs.sendMessage(ownerTabId, message).catch(() => undefined);
}

async function handleFetchBinary(
  message: FetchBinaryMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  if (!recordAndCheckCircuitBreaker(message.url)) {
    sendResponse({ ok: false, error: "Circuit breaker tripped: too many requests." });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  if (message.requestId) {
    fetchControllers.set(message.requestId, controller);
  }
  try {
    const res = await fetch(message.url, {
      method: "GET",
      credentials: "include",
      redirect: "follow",
      signal: controller.signal
    });
    const buffer = await res.arrayBuffer();
    // Base64 encode in 32KB chunks to avoid stack overflow on large images.
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length)))
      );
    }
    sendResponse({
      ok: true,
      status: res.status,
      base64: btoa(binary),
      contentType: res.headers.get("content-type") ?? "",
      finalUrl: res.url
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    clearTimeout(timeout);
    if (message.requestId) {
      fetchControllers.delete(message.requestId);
    }
  }
}

async function handleFetchText(
  message: FetchTextMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  if (!recordAndCheckCircuitBreaker(message.url)) {
    sendResponse({ ok: false, error: "Circuit breaker tripped: too many requests." });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  if (message.requestId) {
    fetchControllers.set(message.requestId, controller);
  }

  try {
    const res = await fetch(message.url, {
      method: message.method ?? "GET",
      headers: message.headers,
      body: message.body,
      credentials: "include",
      redirect: "follow",
      signal: controller.signal
    });

    const text = await res.text();

    sendResponse({
      ok: true,
      status: res.status,
      text,
      finalUrl: res.url
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    clearTimeout(timeout);
    if (message.requestId) {
      fetchControllers.delete(message.requestId);
    }
  }
}
