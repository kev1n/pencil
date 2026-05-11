import {
  COURSE_HISTORY_STORAGE_KEY,
  initCourseHistoryCache,
  readCourseHistory,
  type CourseHistoryCache,
  type CourseHistoryEntry
} from "../../content/course-history";

// Naive read-only viewer for the cached CAESAR Course History snapshot.
// The cache is populated opportunistically by the content script when the
// user visits CAESAR; this panel just renders whatever's there. Empty
// state nudges the user to open CAESAR so the reconcile can fire.

export async function initCourseHistorySection(): Promise<void> {
  const button = document.getElementById("toggle-course-history");
  const panel = document.getElementById("course-history-panel");
  if (!(button instanceof HTMLButtonElement) || !panel) return;

  await initCourseHistoryCache();

  let open = false;

  const render = (): void => {
    panel.replaceChildren();
    if (!open) return;
    panel.append(renderPanel(readCourseHistory()));
  };

  const setOpen = (next: boolean): void => {
    open = next;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "Hide my courses" : "My courses";
    render();
  };

  button.addEventListener("click", () => setOpen(!open));

  // Live-update the panel when the content-script reconcile writes fresh
  // data into chrome.storage. Cheap because render is a full replace.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[COURSE_HISTORY_STORAGE_KEY]) return;
    if (open) render();
  });
}

function renderPanel(cache: CourseHistoryCache): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "course-history-body";

  if (cache.entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "course-history-empty";
    empty.textContent =
      "No courses cached yet. Open CAESAR (with this extension installed) and the list will populate within a minute.";
    wrap.append(empty);
    return wrap;
  }

  const meta = document.createElement("p");
  meta.className = "course-history-meta";
  meta.textContent = `${cache.entries.length} course${cache.entries.length === 1 ? "" : "s"} · last refreshed ${formatRelative(cache.refreshedAt)}`;
  wrap.append(meta);

  const groups = groupByTerm(cache.entries);
  for (const group of groups) {
    const section = document.createElement("section");
    section.className = "course-history-term";

    const heading = document.createElement("h3");
    heading.className = "course-history-term-title";
    heading.textContent = group.label;
    section.append(heading);

    const list = document.createElement("ul");
    list.className = "course-history-list";
    for (const entry of group.entries) list.append(renderRow(entry));
    section.append(list);

    wrap.append(section);
  }

  return wrap;
}

function renderRow(entry: CourseHistoryEntry): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "course-history-row";

  const left = document.createElement("div");
  left.className = "course-history-row-left";

  const code = document.createElement("span");
  code.className = "course-history-code";
  code.textContent = entry.catalog;

  const desc = document.createElement("span");
  desc.className = "course-history-desc";
  desc.textContent = entry.description;

  left.append(code, desc);

  const right = document.createElement("div");
  right.className = "course-history-row-right";

  if (entry.grade) {
    const grade = document.createElement("span");
    grade.className = "course-history-grade";
    grade.textContent = entry.grade;
    right.append(grade);
  }

  const status = document.createElement("span");
  status.className = `course-history-status course-history-status--${slugifyStatus(entry.status)}`;
  status.textContent = entry.status;
  right.append(status);

  if (entry.units !== null) {
    const units = document.createElement("span");
    units.className = "course-history-units";
    units.textContent = `${entry.units.toFixed(2)} u`;
    right.append(units);
  }

  li.append(left, right);
  return li;
}

type TermGroup = {
  label: string;
  sortKey: string;
  entries: CourseHistoryEntry[];
};

function groupByTerm(entries: CourseHistoryEntry[]): TermGroup[] {
  const map = new Map<string, TermGroup>();
  for (const entry of entries) {
    const key = entry.termLabel || "Unknown term";
    let group = map.get(key);
    if (!group) {
      group = {
        label: key,
        sortKey: entry.termStartDate ?? "0000-00-00",
        entries: []
      };
      map.set(key, group);
    }
    if (entry.termStartDate && entry.termStartDate > group.sortKey) {
      group.sortKey = entry.termStartDate;
    }
    group.entries.push(entry);
  }
  // Newest term first. Within a term, alphabetical by catalog so the
  // ordering is stable across renders.
  const groups = Array.from(map.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  for (const group of groups) {
    group.entries.sort((a, b) => a.catalog.localeCompare(b.catalog));
  }
  return groups;
}

function slugifyStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

function formatRelative(ts: number): string {
  if (!ts) return "never";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
