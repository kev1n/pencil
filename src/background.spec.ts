import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake extension APIs. `sessionStore` outlives a worker restart, the way
// chrome.storage.session does; everything else is rebuilt per start.
type Listener = (...args: unknown[]) => unknown;

const sessionStore: Record<string, unknown> = {};
let listeners: Record<string, Listener[]>;
let sentToTabs: Array<{ tabId: number; message: unknown }>;
let nextTabId: number;

function event(name: string) {
  return {
    addListener: (fn: Listener) => {
      (listeners[name] ??= []).push(fn);
    }
  };
}

function installChrome(): void {
  listeners = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      onInstalled: event("onInstalled"),
      onMessage: event("onMessage"),
      reload: vi.fn()
    },
    storage: {
      session: {
        get: async (key: string) =>
          key in sessionStore ? { [key]: structuredClone(sessionStore[key]) } : {},
        set: async (items: Record<string, unknown>) => {
          Object.assign(sessionStore, structuredClone(items));
        }
      }
    },
    tabs: {
      onUpdated: event("onUpdated"),
      onRemoved: event("onRemoved"),
      create: async () => ({ id: nextTabId++ }),
      update: async () => ({}),
      remove: async () => undefined,
      sendMessage: async (tabId: number, message: unknown) => {
        sentToTabs.push({ tabId, message });
      }
    }
  };
}

// A fresh import is a fresh worker: new in-memory maps, new listeners.
async function startWorker(): Promise<void> {
  installChrome();
  vi.resetModules();
  await import("./background");
}

async function openSignInTab(ownerTabId: number): Promise<number> {
  const response = await new Promise<{ ok: boolean; tabId: number }>((resolve) => {
    for (const fn of listeners.onMessage ?? []) {
      fn(
        { type: "open-auth-popup", loginUrl: "https://my-northwestern-bc.bluera.com/" },
        { tab: { id: ownerTabId } },
        resolve
      );
    }
  });
  expect(response.ok).toBe(true);
  return response.tabId;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  for (const key of Object.keys(sessionStore)) delete sessionStore[key];
  sentToTabs = [];
  nextTabId = 100;
});

describe("background sign-in tabs", () => {
  it("tells the waiting page about a sign-in that ends after the worker restarted", async () => {
    await startWorker();
    const signInTab = await openSignInTab(7);
    await settle();

    await startWorker();
    for (const fn of listeners.onUpdated ?? []) {
      fn(signInTab, { status: "complete" }, { url: "https://my-northwestern-bc.bluera.com/home" });
    }
    await settle();

    expect(sentToTabs).toEqual([
      { tabId: 7, message: { type: "auth-popup-closed", reason: "succeeded" } }
    ]);
  });

  it("tells the waiting page when the sign-in tab is closed after a restart", async () => {
    await startWorker();
    const signInTab = await openSignInTab(7);
    await settle();

    await startWorker();
    for (const fn of listeners.onRemoved ?? []) fn(signInTab);
    await settle();

    expect(sentToTabs).toEqual([
      { tabId: 7, message: { type: "auth-popup-closed", reason: "user-closed" } }
    ]);
    // Forgotten once handled: a second close says nothing.
    await startWorker();
    for (const fn of listeners.onRemoved ?? []) fn(signInTab);
    await settle();
    expect(sentToTabs).toHaveLength(1);
  });
});
