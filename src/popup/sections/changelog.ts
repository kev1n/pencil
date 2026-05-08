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
    summary.textContent = `Earlier versions (${olderEntries.length})`;
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

  const header = document.createElement("div");
  header.className = "changelog-header";

  const badge = document.createElement("span");
  badge.className = "changelog-version";
  badge.textContent = `v${entry.version}`;

  const date = document.createElement("span");
  date.className = "changelog-date";
  date.textContent = entry.date;

  header.append(badge, date);
  card.append(header);

  if (opts.headline) {
    const title = document.createElement("h2");
    title.className = "changelog-title";
    title.textContent = entry.headline ?? "What's new";
    card.append(title);
  } else if (entry.headline) {
    const sub = document.createElement("p");
    sub.className = "changelog-subhead";
    sub.textContent = entry.headline;
    card.append(sub);
  }

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
  tag.textContent = item.kind === "feat" ? "new" : "fix";

  const body = document.createElement("span");
  body.className = "changelog-text";
  body.textContent = item.text;

  li.append(tag, body);
  return li;
}
