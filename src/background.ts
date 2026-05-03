import { FEATURES_STORAGE_KEY } from "./content/settings";
import type {
  AbortFetchMessage,
  AuthPopupClosedMessage,
  FetchBinaryMessage,
  FetchTextMessage,
  OpenAuthPopupMessage,
  OpenAuthPopupResponse
} from "./shared/messages";

const FETCH_TIMEOUT_MS = 30_000;
const fetchControllers = new Map<string, AbortController>();

const CAESAR_REDIRECT_FEATURE_ID = "caesar-domain-redirect";
const CAESAR_REDIRECT_RULE_ID = 1;

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
  console.log("Better CAESAR extension installed.");
  void syncCaesarRedirectRule();
});

chrome.runtime.onStartup.addListener(() => {
  void syncCaesarRedirectRule();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!changes[FEATURES_STORAGE_KEY]) return;
  void syncCaesarRedirectRule();
});

async function syncCaesarRedirectRule(): Promise<void> {
  const result = await chrome.storage.local.get(FEATURES_STORAGE_KEY) as Record<string, unknown>;
  const raw = result[FEATURES_STORAGE_KEY];
  const settings = raw && typeof raw === "object" ? raw as Record<string, boolean> : {};
  const enabled = settings[CAESAR_REDIRECT_FEATURE_ID] ?? true;

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [CAESAR_REDIRECT_RULE_ID],
    addRules: enabled
      ? [
          {
            id: CAESAR_REDIRECT_RULE_ID,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
              redirect: {
                transform: { host: "caesar.ent.northwestern.edu" }
              }
            },
            condition: {
              requestDomains: ["caesar.northwestern.edu"],
              resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
            }
          }
        ]
      : []
  });
}

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
