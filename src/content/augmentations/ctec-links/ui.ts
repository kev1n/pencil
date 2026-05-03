import { CTEC_CELL_CLASS, CTEC_HEADER_CLASS, STYLE_ID } from "./constants";
import type { CtecLinkData } from "./types";

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
	    .${CTEC_CELL_CLASS} {
	      padding: 4px 8px;
	      min-width: 180px;
	      max-width: 240px;
	      width: 180px;
	      vertical-align: top;
	      border-left: 2px solid #d8b6c8;
	      overflow: hidden;
	      box-sizing: border-box;
	    }
    .${CTEC_HEADER_CLASS} {
      min-width: 120px;
      color: #fff;
      background: #66023c;
    }
	    .bc-ctec-widget {
	      font-size: 11px;
	      line-height: 1.6;
	      font-family: Helvetica, Arial, sans-serif;
	      min-width: 0;
	      overflow: hidden;
	    }
	    .bc-ctec-count {
	      font-weight: 700;
	      color: #66023c;
	      margin-bottom: 1px;
	      overflow: hidden;
	      text-overflow: ellipsis;
	      white-space: nowrap;
	    }
	    .bc-ctec-link {
	      display: block;
	      color: #66023c;
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
	    .bc-ctec-muted { color: #888; }
	    .bc-ctec-warn { color: #a00; }
    .bc-ctec-auth-link {
      color: #66023c;
      font-weight: 600;
    }
    .bc-ctec-btn {
      margin-top: 2px;
      padding: 2px 6px;
      font-size: 10px;
      cursor: pointer;
      border: 1px solid #66023c;
      background: white;
      color: #66023c;
      border-radius: 2px;
    }
    .bc-ctec-btn:hover { background: #66023c; color: white; }
    .bc-ctec-expand {
      display: block;
      margin-top: 2px;
      padding: 0;
      font-size: 10px;
      cursor: pointer;
      border: none;
      background: none;
      color: #888;
      text-decoration: underline;
    }
    .bc-ctec-expand:hover { color: #66023c; }
    .bc-ctec-fetch {
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #66023c;
      background: white;
      color: #66023c;
      border-radius: 2px;
      letter-spacing: 0.3px;
    }
    .bc-ctec-fetch:hover { background: #66023c; color: white; }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}

export function renderFetchButton(container: HTMLElement, onFetch: () => void): void {
  container.innerHTML = "";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bc-ctec-fetch";
  btn.textContent = "Load CTEC";
  btn.addEventListener("click", onFetch);
  container.appendChild(btn);
}

export function renderLoading(container: HTMLElement, message = "Loading CTEC\u2026"): void {
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

export function isCtecCellReady(container: HTMLElement): boolean {
  return container.dataset.ctecReady === "1";
}

export function markCtecCellReady(container: HTMLElement): void {
  container.dataset.ctecReady = "1";
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
          let label = `\u2197 ${entry.term}`;
          if (multiInstructor) label += ` \u2014 ${lastName(entry.instructor)}`;
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
        warn.textContent = "Results may be incomplete \u2014 ";
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
    case "auth-required": {
      const msg = document.createElement("div");
      msg.className = "bc-ctec-warn";
      msg.textContent = "Auth required \u2014 ";
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
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bc-ctec-btn";
  btn.textContent = "Retry";
  btn.addEventListener("click", onRetry);
  return btn;
}

export function ensureCtecHeader(table: HTMLTableElement): void {
  const headerRow = table.querySelector("tr");
  if (!headerRow) return;
  if (headerRow.querySelector(`.${CTEC_HEADER_CLASS}`)) return;
  const th = document.createElement("th");
  th.scope = "col";
  th.className = `PSLEVEL1GRIDCOLUMNHDR ${CTEC_HEADER_CLASS}`;
  th.textContent = "CTEC";
  headerRow.appendChild(th);
}

export function ensureCtecCell(row: HTMLTableRowElement): HTMLElement {
  const existing = row.querySelector<HTMLTableCellElement>(`.${CTEC_CELL_CLASS}`);
  if (existing) return existing;
  const td = document.createElement("td");
  // Inherit the row's existing cell class so PeopleSoft alternating-row styles apply.
  const rowCellClass = row.querySelector("td,th")?.className ?? "";
  td.className = rowCellClass ? `${rowCellClass} ${CTEC_CELL_CLASS}` : CTEC_CELL_CLASS;
  row.appendChild(td);
  return td;
}

export function isCtecCellDone(container: HTMLElement): boolean {
  return container.dataset.ctecDone === "1";
}

export function markCtecCellDone(container: HTMLElement): void {
  container.dataset.ctecDone = "1";
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
  return title.length > 40 ? title.slice(0, 38) + "\u2026" : title;
}
