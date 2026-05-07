import { createActionButton } from "../../framework";

import { CTEC_CELL_CLASS, CTEC_HEADER_CLASS } from "./constants";
import type { CtecLinkData } from "./types";

export const CTEC_LINKS_STYLES = `
	    .${CTEC_CELL_CLASS} {
	      padding: 4px 8px;
	      min-width: 180px;
	      max-width: 240px;
	      width: 180px;
	      vertical-align: top;
	      border-left: 2px solid var(--bc-color-accent-mid-border);
	      overflow: hidden;
	      box-sizing: border-box;
	    }
    .${CTEC_HEADER_CLASS} {
      min-width: 120px;
      color: var(--bc-color-accent-on);
      background: var(--bc-color-accent);
    }
	    .bc-ctec-widget {
	      font-size: var(--bc-font-11);
	      line-height: 1.6;
	      font-family: Helvetica, Arial, sans-serif;
	      min-width: 0;
	      overflow: hidden;
	    }
	    .bc-ctec-count {
	      font-weight: var(--bc-fw-bold);
	      color: var(--bc-color-accent);
	      margin-bottom: 1px;
	      overflow: hidden;
	      text-overflow: ellipsis;
	      white-space: nowrap;
	    }
	    .bc-ctec-link {
	      display: block;
	      color: var(--bc-color-accent);
	      text-decoration: none;
	      white-space: nowrap;
	      overflow: hidden;
	      text-overflow: ellipsis;
	    }
	    .bc-ctec-link:hover { text-decoration: underline; }
	    .bc-ctec-muted,
	    .bc-ctec-warn {
	      overflow: hidden;
	      text-overflow: ellipsis;
	    }
	    .bc-ctec-muted { color: var(--bc-color-text-subtle); }
	    .bc-ctec-warn { color: var(--bc-color-danger); }
    .bc-ctec-auth-link {
      color: var(--bc-color-accent);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-ctec-btn {
      margin-top: 2px;
      padding: 2px 6px;
      font-size: var(--bc-font-10);
      cursor: pointer;
      border: 1px solid var(--bc-color-accent);
      background: var(--bc-color-bg);
      color: var(--bc-color-accent);
      border-radius: var(--bc-radius-xs);
    }
    .bc-ctec-btn:hover { background: var(--bc-color-accent); color: var(--bc-color-accent-on); }
    .bc-ctec-expand {
      display: block;
      margin-top: 2px;
      padding: 0;
      font-size: var(--bc-font-10);
      cursor: pointer;
      border: none;
      background: none;
      color: var(--bc-color-text-subtle);
      text-decoration: underline;
    }
    .bc-ctec-expand:hover { color: var(--bc-color-accent); }
    .bc-ctec-fetch {
      padding: 2px 7px;
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-semibold);
      cursor: pointer;
      border: 1px solid var(--bc-color-accent);
      background: var(--bc-color-bg);
      color: var(--bc-color-accent);
      border-radius: var(--bc-radius-xs);
      letter-spacing: 0.3px;
    }
    .bc-ctec-fetch:hover { background: var(--bc-color-accent); color: var(--bc-color-accent-on); }
  `;

export function renderNoAccess(container: HTMLElement): void {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "bc-ctec-widget";
  root.appendChild(buildNoAccessMessage());
  container.appendChild(root);
}

export function renderDisabled(container: HTMLElement): void {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "bc-ctec-widget";
  const msg = document.createElement("div");
  msg.className = "bc-ctec-muted";
  msg.textContent = "—";
  root.appendChild(msg);
  container.appendChild(root);
}

function buildNoAccessMessage(): HTMLElement {
  const msg = document.createElement("div");
  msg.className = "bc-ctec-muted";
  msg.textContent = "No CTEC access";
  msg.title =
    "Northwestern has not authorized this NetID to view CTECs. Complete CTECs in the next collection period to restore access.";
  return msg;
}

export function renderFetchButton(container: HTMLElement, onFetch: () => void): void {
  container.innerHTML = "";
  // Load CTEC is a one-shot trigger: the runtime swaps the cell to the
  // loading-state render the moment we kick off the fetch, so the button
  // never sees its own success/error transitions. We still route through
  // createActionButton to enforce the synchronous-disable + click-once
  // contract — the runtime does the rest.
  const ab = createActionButton({
    doc: container.ownerDocument ?? document,
    label: "Load CTEC",
    loadingLabel: "Loading…",
    className: "bc-ctec-fetch",
    onClick: async () => {
      onFetch();
    }
  });
  container.appendChild(ab.element);
}

export function renderLoading(container: HTMLElement, message = "Loading CTEC…"): void {
  const existing = container.querySelector<HTMLElement>(".bc-ctec-loading-msg");
  if (existing) {
    existing.textContent = message;
    return;
  }
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = "bc-ctec-widget bc-ctec-muted bc-ctec-loading-msg";
  div.textContent = message;
  container.appendChild(div);
}

export function renderCtecLinksWidget(
  container: HTMLElement,
  data: CtecLinkData,
  onRetry: () => void
): void {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "bc-ctec-widget";

  switch (data.state) {
    case "found": {
      const count = document.createElement("div");
      count.className = "bc-ctec-count";
      const evalWord = data.totalCount === 1 ? "evaluation" : "evaluations";
      count.textContent = `${data.totalCount} ${evalWord}`;
      root.appendChild(count);

      const INITIAL_SHOWN = 3;
      const distinctInstructors = new Set(data.entries.map((e) => e.instructor));
      const multiInstructor = distinctInstructors.size > 1;

      const renderLinks = (entries: typeof data.entries) => {
        for (const entry of entries) {
	        const a = document.createElement("a");
	          a.className = "bc-ctec-link";
	          a.href = entry.url;
	          a.target = "_blank";
	          a.rel = "noopener noreferrer";
          let label = `↗ ${entry.term}`;
          if (multiInstructor) label += ` — ${lastName(entry.instructor)}`;
	          const title = courseShortTitle(entry.description);
	          if (title) label += ` (${title})`;
	          a.textContent = label;
	          a.title = label;
	          root.appendChild(a);
	        }
	      };

      renderLinks(data.entries.slice(0, INITIAL_SHOWN));

      if (data.entries.length > INITIAL_SHOWN) {
        const remaining = data.entries.length - INITIAL_SHOWN;

        const extraContainer = document.createElement("div");
        extraContainer.style.display = "none";
        renderLinks(data.entries.slice(INITIAL_SHOWN));
        // Move the extra links into extraContainer
        const allLinks = root.querySelectorAll<HTMLElement>(".bc-ctec-link");
        allLinks.forEach((el, i) => { if (i >= INITIAL_SHOWN) extraContainer.appendChild(el); });
        root.appendChild(extraContainer);

        const expandBtn = document.createElement("button");
        expandBtn.type = "button";
        expandBtn.className = "bc-ctec-expand";
        expandBtn.textContent = `Show ${remaining} more`;
        expandBtn.addEventListener("click", () => {
          const isHidden = extraContainer.style.display === "none";
          extraContainer.style.display = isHidden ? "" : "none";
          expandBtn.textContent = isHidden ? "Show less" : `Show ${remaining} more`;
        });
        root.appendChild(expandBtn);
      }

      if (data.incomplete) {
        const warn = document.createElement("div");
        warn.className = "bc-ctec-warn";
        warn.style.marginTop = "3px";
        warn.style.fontSize = "10px";
        warn.textContent = "Results may be incomplete — ";
        const reloadLink = document.createElement("button");
        reloadLink.type = "button";
        reloadLink.className = "bc-ctec-expand";
        reloadLink.style.display = "inline";
        reloadLink.textContent = "reload";
        reloadLink.addEventListener("click", onRetry);
        warn.appendChild(reloadLink);
        root.appendChild(warn);
      }

      if (data.hasMore) {
        const loadMore = document.createElement("button");
        loadMore.type = "button";
        loadMore.className = "bc-ctec-expand";
        loadMore.textContent = "Load more terms";
        loadMore.addEventListener("click", onRetry);
        root.appendChild(loadMore);
      }
      break;
    }
    case "not-found": {
      const msg = document.createElement("div");
      msg.className = "bc-ctec-muted";
      msg.textContent = "No CTECs";
      root.appendChild(msg);
      break;
    }
    case "no-access": {
      root.appendChild(buildNoAccessMessage());
      break;
    }
    case "auth-required": {
      const msg = document.createElement("div");
      msg.className = "bc-ctec-warn";
      msg.textContent = "Auth required — ";
      const link = document.createElement("a");
      link.className = "bc-ctec-auth-link";
      link.href = data.loginUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Log in";
      msg.appendChild(link);
      root.appendChild(msg);
      root.appendChild(makeRetryButton(onRetry));
      break;
    }
    case "error": {
      const msg = document.createElement("div");
      msg.className = "bc-ctec-warn";
      msg.textContent = data.message.slice(0, 80);
      root.appendChild(msg);
      root.appendChild(makeRetryButton(onRetry));
      break;
    }
  }

  container.appendChild(root);
}

function makeRetryButton(onRetry: () => void): HTMLButtonElement {
  // The runtime swaps the cell to loading-state synchronously when fetch
  // kicks off, so this button is replaced before its own success/error
  // transitions can fire. createActionButton still buys us the sync-lock
  // + click-once guarantee.
  const ab = createActionButton({
    doc: document,
    label: "Retry",
    loadingLabel: "Loading…",
    className: "bc-ctec-btn",
    onClick: async () => {
      onRetry();
    }
  });
  return ab.element;
}

// Returns the last word of a name — used for compact multi-instructor labels.
// "Bridget McMullan" → "McMullan"
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

// Extracts a short course title from a CTEC description.
// "COMP_SCI 396-0-8 Special Topics: AI for Hybrid Narrative" → "AI for Hybrid Narrative"
// "DSGN 240-0-20 Introduction to Solid Modeling" → "Introduction to Solid Modeling"
function courseShortTitle(description: string): string {
  // Strip leading "SUBJECT NNN-N-N " prefix
  const stripped = description.replace(/^\S+\s+[\d][\d-]*\s*/, "").trim();
  // Prefer the part after the last colon (subtitle), if one exists
  const colonIdx = stripped.lastIndexOf(":");
  const title = colonIdx >= 0 ? stripped.slice(colonIdx + 1).trim() : stripped;
  return title.length > 40 ? title.slice(0, 38) + "…" : title;
}
