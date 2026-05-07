// Persistent queue indicator for the PeopleSoft traffic mutex.
//
// CAESAR-only surface. When a user fires off multiple things at once
// (e.g. "Load CTEC" on five classes plus a couple of refreshes), every
// call funnels through `runPeopleSoftTask`'s priority queue and the user
// sees no feedback while N-1 of them sit waiting. This module subscribes
// to `subscribeTraffic`, mounts a small fixed-position pill in the
// bottom-right, and lists what's running + what's queued so the wait stops
// looking like a hang.
//
// Hide threshold: depth >= 2. A single in-flight task isn't worth the
// chrome — it usually completes in the time it takes to read the pill.

import { el, ensureStyle } from "../framework/dom";

import {
  subscribeTraffic,
  type TaskInfo,
  type TrafficSnapshot
} from "./traffic";

const HOST_ID = "bc-traffic-indicator";
const STYLE_ID = "bc-traffic-indicator-style";

const STYLE_CSS = `
  #${HOST_ID} {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 2147483646;
    display: none;
    flex-direction: column;
    gap: 6px;
    max-width: min(360px, calc(100vw - 32px));
    padding: 10px 12px;
    border-radius: var(--bc-radius-md);
    background: var(--bc-color-accent-surface-tile);
    border: 1px solid var(--bc-color-accent-mid-border);
    color: var(--bc-color-accent-pressed);
    box-shadow: var(--bc-shadow-elev-2);
    font: 500 var(--bc-font-12)/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    pointer-events: none;
  }
  #${HOST_ID}.is-visible { display: flex; }
  #${HOST_ID} .bc-traffic-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: var(--bc-fw-semibold);
  }
  #${HOST_ID} .bc-traffic-spinner {
    width: 10px;
    height: 10px;
    border-radius: var(--bc-radius-circle);
    border: 2px solid currentColor;
    border-top-color: transparent;
    animation: bc-traffic-spin 900ms linear infinite;
  }
  #${HOST_ID} .bc-traffic-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--bc-font-11);
  }
  #${HOST_ID} .bc-traffic-item {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #${HOST_ID} .bc-traffic-item.is-active { font-weight: var(--bc-fw-semibold); }
  #${HOST_ID} .bc-traffic-item.is-pending { opacity: 0.75; }
  @keyframes bc-traffic-spin {
    to { transform: rotate(360deg); }
  }
`;

let unsubscribe: (() => void) | null = null;
let lastSignature = "";

// Show the pill once the queue is two-deep — single tasks are too
// transient to be worth the chrome.
const VISIBILITY_THRESHOLD = 2;

export function mountTrafficIndicator(doc: Document = document): void {
  if (unsubscribe) return;
  ensureStyle(doc, STYLE_ID, STYLE_CSS);
  unsubscribe = subscribeTraffic((snapshot) => render(doc, snapshot));
}

export function unmountTrafficIndicator(doc: Document = document): void {
  unsubscribe?.();
  unsubscribe = null;
  doc.getElementById(HOST_ID)?.remove();
  doc.getElementById(STYLE_ID)?.remove();
  lastSignature = "";
}

function render(doc: Document, snapshot: TrafficSnapshot): void {
  const host = ensureHost(doc);
  if (!host) return;

  if (snapshot.depth < VISIBILITY_THRESHOLD) {
    host.classList.remove("is-visible");
    host.replaceChildren();
    lastSignature = "";
    return;
  }

  const signature = snapshotSignature(snapshot);
  if (signature === lastSignature) return;
  lastSignature = signature;

  host.classList.add("is-visible");

  const headline = `${snapshot.depth} CAESAR ${snapshot.depth === 1 ? "task" : "tasks"} in flight`;

  const items: HTMLElement[] = [];
  if (snapshot.active) {
    items.push(buildItem(doc, snapshot.active, "active"));
  }
  for (const task of snapshot.pending) {
    items.push(buildItem(doc, task, "pending"));
  }

  host.replaceChildren(
    el(doc, "div", { class: "bc-traffic-header" }, [
      el(doc, "span", { class: "bc-traffic-spinner", attrs: { "aria-hidden": "true" } }),
      el(doc, "span", { text: headline })
    ]),
    el(doc, "ul", { class: "bc-traffic-list" }, items)
  );
}

function buildItem(doc: Document, task: TaskInfo, kind: "active" | "pending"): HTMLLIElement {
  const text = describeTask(task, kind);
  return el(doc, "li", {
    class: `bc-traffic-item is-${kind}`,
    text,
    attrs: { title: text }
  });
}

function describeTask(task: TaskInfo, kind: "active" | "pending"): string {
  const detail = task.label ?? humanizeOwner(task.owner) ?? "PeopleSoft request";
  return kind === "active" ? `Now: ${detail}` : `Queued: ${detail}`;
}

function humanizeOwner(owner?: string): string | null {
  if (!owner) return null;
  // Best-effort fallback: dashes/slashes → spaces, leave the rest alone.
  return owner.replace(/[-/]/g, " ");
}

function snapshotSignature(snapshot: TrafficSnapshot): string {
  const parts: string[] = [];
  parts.push(snapshot.active ? `a:${snapshot.active.id}:${snapshot.active.label ?? snapshot.active.owner ?? ""}` : "a:none");
  for (const task of snapshot.pending) {
    parts.push(`p:${task.id}:${task.label ?? task.owner ?? ""}`);
  }
  return parts.join("|");
}

function ensureHost(doc: Document): HTMLElement | null {
  const existing = doc.getElementById(HOST_ID);
  if (existing instanceof HTMLElement) return existing;

  const parent = doc.body ?? doc.documentElement;
  if (!parent) return null;

  const host = doc.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  parent.appendChild(host);
  return host;
}
