import { CHANGELOG, type ChangelogEntry, type ChangelogItem } from "../changelog";

export function initChangelogPanel(): void {
  const root = document.getElementById("changelog");
  if (!(root instanceof HTMLElement)) return;
  if (CHANGELOG.length === 0) return;

  const version = chrome.runtime.getManifest().version;
  const headEntry =
    CHANGELOG.find((entry) => entry.version === version) ?? CHANGELOG[0];
  const olderEntries = CHANGELOG.filter((entry) => entry !== headEntry);

  root.innerHTML = "";
  root.append(renderEntry(headEntry, { headline: true }));

  if (olderEntries.length > 0) {
    const details = document.createElement("details");
    details.className = "changelog-history";
    const summary = document.createElement("summary");
    summary.className = "changelog-history-summary";
    summary.textContent = "Earlier versions";
    details.append(summary);
    for (const entry of olderEntries) {
      details.append(renderEntry(entry, { headline: false }));
    }
    root.append(details);
  }
}

function renderEntry(
  entry: ChangelogEntry,
  opts: { headline: boolean }
): HTMLElement {
  const card = document.createElement("section");
  card.className = opts.headline
    ? "changelog-card changelog-card--head"
    : "changelog-card changelog-card--past";

  // Headline first, then one quiet line of version and date.
  const meta = document.createElement("span");
  meta.className = "changelog-date";
  meta.textContent = `Version ${entry.version} · ${formatDate(entry.date)}`;

  const title = document.createElement(opts.headline ? "h2" : "p");
  title.className = opts.headline ? "changelog-title" : "changelog-subhead";
  title.textContent = entry.headline ?? (opts.headline ? "What's new" : `Version ${entry.version}`);

  const header = document.createElement("div");
  header.className = "changelog-header";
  header.append(title, meta);
  card.append(header);

  if (entry.items.length > 0) {
    const list = document.createElement("ul");
    list.className = "changelog-list";
    for (const item of entry.items) {
      list.append(renderItem(item));
    }
    card.append(list);
  }

  return card;
}

function renderItem(item: ChangelogItem): HTMLElement {
  const li = document.createElement("li");
  li.className = "changelog-item";

  const tag = document.createElement("span");
  tag.className =
    item.kind === "feat"
      ? "changelog-tag changelog-tag--feat"
      : "changelog-tag changelog-tag--fix";
  tag.textContent = item.kind === "feat" ? "New" : "Fixed";

  const body = document.createElement("span");
  body.className = "changelog-text";
  body.textContent = item.text;

  li.append(tag, body);
  return li;
}

// "2026-11-10" -> "Nov 10, 2026". Falls back to the raw string.
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return month && d && y ? `${month} ${d}, ${y}` : iso;
}
