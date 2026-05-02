import type {
  AbortFetchMessage,
  AuthPopupClosedMessage,
  FetchTextMessage,
  OpenAuthPopupMessage,
  OpenAuthPopupResponse
} from "./shared/messages";

const FETCH_TIMEOUT_MS = 30_000;
const fetchControllers = new Map<string, AbortController>();

const POST_AUTH_URL_PATTERNS = [
  /^https:\/\/caesar\.ent\.northwestern\.edu\/psc\//i,
  /^https:\/\/northwestern\.bluera\.com\/northwestern\//i
];

const POST_AUTH_SETTLE_MS = 1500;

type TrackedPopup = {
  tabId: number;
  ownerTabId: number;
  initialUrl: string;
  hasNavigatedAway: boolean;
};

const trackedPopups = new Map<number, TrackedPopup>();
const ownerToPopup = new Map<number, number>();
const settleTimers = new Map<number, ReturnType<typeof setTimeout>>();

chrome.runtime.onInstalled.addListener(() => {
  console.log("Better CAESAR extension installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "fetch-text") {
    void handleFetchText(message as FetchTextMessage, sendResponse);
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

  const currentUrl = tab.url ?? info.url ?? "";
  if (currentUrl && currentUrl !== tracked.initialUrl) {
    tracked.hasNavigatedAway = true;
  }

  // Any URL/status change cancels a pending settle — keeps us from closing
  // mid-redirect when the SSO chain briefly visits a post-auth URL pattern.
  cancelSettleTimer(tabId);

  if (info.status !== "complete") return;
  if (!currentUrl) return;
  if (!tracked.hasNavigatedAway) return;
  if (!POST_AUTH_URL_PATTERNS.some((pattern) => pattern.test(currentUrl))) return;

  scheduleSettle(tabId, tracked.ownerTabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const tracked = trackedPopups.get(tabId);
  cancelSettleTimer(tabId);
  if (!tracked) return;
  forgetPopup(tabId);
  notifyOwner(tracked.ownerTabId, "user-closed");
});

function scheduleSettle(tabId: number, ownerTabId: number): void {
  const timer = setTimeout(() => {
    settleTimers.delete(tabId);
    void chrome.tabs
      .get(tabId)
      .then((latestTab) => {
        const latestUrl = latestTab.url ?? "";
        if (!POST_AUTH_URL_PATTERNS.some((pattern) => pattern.test(latestUrl))) return;
        forgetPopup(tabId);
        void chrome.tabs.update(ownerTabId, { active: true }).catch(() => undefined);
        void chrome.tabs.remove(tabId).catch(() => undefined);
        notifyOwner(ownerTabId, "succeeded");
      })
      .catch(() => undefined);
  }, POST_AUTH_SETTLE_MS);
  settleTimers.set(tabId, timer);
}

function cancelSettleTimer(tabId: number): void {
  const existing = settleTimers.get(tabId);
  if (existing === undefined) return;
  clearTimeout(existing);
  settleTimers.delete(tabId);
}

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
      ownerTabId,
      initialUrl: message.loginUrl,
      hasNavigatedAway: false
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
  cancelSettleTimer(tabId);
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
