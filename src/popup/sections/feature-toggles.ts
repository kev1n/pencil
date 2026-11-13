import {
  FEATURES_STORAGE_KEY,
  GROUP_CAESAR_ID,
  GROUP_MASTER_ID,
  GROUP_PAPER_ID,
  getDefaultFeatureEnabled
} from "../../content/settings";

// Per-feature row in a "toggles" section.
export type FeatureItem = {
  id: string;
  label: string;
  description: string;
};

// Single-select option group. Each option owns a list of feature IDs to
// turn on; every other option's IDs get turned off when this one is
// chosen. Lets us expose mutually-exclusive choices ("Stars vs Percent vs
// Default /6") that share the same boolean storage as the regular toggles
// without inventing a new storage key.
export type RadioOption = {
  id: string;
  label: string;
  description: string;
  enables: string[];
};

export type FeatureSection =
  | {
      kind?: "toggles";
      title: string;
      blurb: string;
      // When set, renders a section-level toggle in the header that gates
      // every feature in the section via the matching `group:*` flag in
      // settings.ts.
      groupId?: string;
      features: FeatureItem[];
    }
  | {
      kind: "radio";
      title: string;
      blurb: string;
      groupId?: string;
      options: RadioOption[];
      defaultOptionId: string;
    };

export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: "CAESAR",
    blurb: "Registration, seats and CTECs.",
    groupId: GROUP_CAESAR_ID,
    features: [
      {
        id: "seats-notes",
        label: "Seats and notes",
        description: "Open seats, class notes and requirements in your shopping cart."
      },
      {
        id: "ctec-links",
        label: "CTEC links",
        description: "Links to past CTEC reports for each class in your cart."
      },
      {
        id: "enrollment-navigation",
        label: "Term switcher",
        description: "Switch enrollment terms without going back through the term page."
      },
      {
        id: "caesar-go-to",
        label: "Bookmarks",
        description: "Shortcuts to common pages in the CAESAR header."
      },
      {
        id: "caesar-history",
        label: "Back Button",
        description: "Makes your browser's Back and Forward buttons move between CAESAR pages instead of leaving CAESAR."
      },
      {
        id: "caesar-history",
        label: "Back Button",
        description: "Makes your browser's Back and Forward buttons move between CAESAR pages instead of leaving CAESAR."
      },
      {
        id: "class-search",
        label: "Sharper Search",
        description: "A faster class search that adds sections to your cart in place."
      },
      {
        id: "course-history-view",
        label: "Course History by term",
        description: "Groups Course History by term, filters by subject and downloads a CSV."
      }
    ]
  },
  {
    title: "Paper.nu",
    blurb: "Your schedule and class search.",
    groupId: GROUP_PAPER_ID,
    features: [
      {
        id: "paper-brand",
        label: "\"with pencil\" mark",
        description: "A small tag by Paper.nu's logo that shows Pencil is on."
      },
      {
        id: "paper-enrollment-dates",
        label: "Enrollment Dates",
        description: "Show CAESAR registration dates and your appointments in the Paper.nu header."
      },
      {
        id: "paper-walk",
        label: "Walk between classes",
        description: "Replace Paper.nu's small map with your day's walk: numbered stops, the path between them and the break before each class."
      },
      {
        id: "paper-register",
        label: "Register from Paper.nu",
        description: "A Register button in the Paper.nu header that enrolls you in classes from your CAESAR cart."
      },
      {
        id: "paper-ctec",
        label: "CTECs on your schedule",
        description: "Ratings and hours on each schedule card, with full analytics a click away."
      },
      {
        id: "paper-ctec-single-summary-card",
        label: "One summary per class",
        description: "Shows the CTEC line on a class's first block of the week only."
      },
      {
        id: "paper-ctec-compact-cards",
        label: "Compact cards",
        description: "Tightens the card header to leave room for the CTEC line."
      },
      {
        id: "paper-card-border-on-hover",
        label: "Steady cards",
        description: "Outlines a card on hover instead of lifting it."
      },
      {
        id: "paper-combos",
        label: "Schedule combinations",
        description: "Adds the Combinations bar above your schedule. Switch it on there to step through schedules."
      },
      {
        id: "paper-hide-taken",
        label: "Hide classes you've taken",
        description: "Hides search results you've completed or transferred. Repeatable classes always show."
      },
      {
        id: "paper-export-helper",
        label: "Export tools",
        description: "Copy your schedule as Markdown, and a guide for importing it into a calendar."
      },
      {
        id: "prereq-filter",
        label: "Prerequisite check (beta)",
        description: "Marks classes whose prerequisites you've met. Paper.nu's requirement data can be out of date."
      },
      {
        id: "prereq-filter-unknown-as-eligible",
        label: "Keep unverified classes",
        description: "Keeps classes whose requirements can't be checked visible when you filter by prerequisites."
      }
    ]
  },
  {
    kind: "radio",
    title: "Rating display",
    blurb: "How CTEC ratings are written.",
    defaultOptionId: "default",
    options: [
      {
        id: "default",
        label: "Out of 6",
        description: "5.4 /6, Northwestern's own scale.",
        enables: []
      },
      {
        id: "percent",
        label: "Percent",
        description: "5.4 becomes 90%.",
        enables: ["paper-ctec-rating-percent"]
      },
      {
        id: "stars",
        label: "Stars",
        description: "Filled stars in place of a number.",
        enables: ["paper-ctec-compact-card-stars"]
      }
    ]
  }
];

const RATING_DISPLAY_FEATURE_IDS = [
  "paper-ctec-rating-percent",
  "paper-ctec-compact-card-stars"
] as const;

async function loadSettings(): Promise<Record<string, boolean>> {
  const result = await chrome.storage.local.get(FEATURES_STORAGE_KEY) as Record<string, unknown>;
  const raw = result[FEATURES_STORAGE_KEY];
  if (raw && typeof raw === "object") return raw as Record<string, boolean>;
  return {};
}

async function saveSettings(settings: Record<string, boolean>): Promise<void> {
  await chrome.storage.local.set({ [FEATURES_STORAGE_KEY]: settings });
}

let writeQueue: Promise<void> = Promise.resolve();

export function updateSettings(
  mutate: (settings: Record<string, boolean>) => void
): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const settings = await loadSettings();
    mutate(settings);
    await saveSettings(settings);
  });
  return writeQueue;
}

export async function initFeatureToggles(): Promise<void> {
  const settings = await loadSettings();

  const masterRoot = document.getElementById("master-toggle");
  if (masterRoot) renderMasterToggle(masterRoot, settings);

  const sectionsRoot = document.getElementById("feature-sections");
  if (!sectionsRoot) return;

  for (const section of FEATURE_SECTIONS) {
    const sectionEl = document.createElement("section");
    sectionEl.className =
      section.kind === "radio"
        ? "feature-section feature-section--radio"
        : "feature-section";
    if (section.groupId) sectionEl.dataset.groupId = section.groupId;

    const header = document.createElement("div");
    header.className = "feature-section-header";

    const headerText = document.createElement("div");
    headerText.className = "feature-section-header-text";

    const title = document.createElement("h2");
    title.className = "feature-section-title";
    title.textContent = section.title;

    const blurb = document.createElement("p");
    blurb.className = "feature-section-blurb";
    blurb.textContent = section.blurb;

    headerText.append(title, blurb);
    header.append(headerText);

    if (section.groupId) {
      header.append(makeGroupToggle(section.groupId, section.title, settings));
    }

    sectionEl.append(header);

    if (section.kind === "radio") {
      sectionEl.append(renderRadioGroup(section, settings));
    } else {
      sectionEl.append(renderToggleList(section.features, settings));
    }

    if (section.groupId) {
      const groupOn = settings[section.groupId] ?? getDefaultFeatureEnabled(section.groupId);
      sectionEl.classList.toggle("is-off", !groupOn);
    }

    sectionsRoot.append(sectionEl);
  }
}

function renderMasterToggle(
  root: HTMLElement,
  settings: Record<string, boolean>
): void {
  const enabled = settings[GROUP_MASTER_ID] ?? getDefaultFeatureEnabled(GROUP_MASTER_ID);

  const copy = document.createElement("div");
  copy.className = "master-toggle-copy";

  const label = document.createElement("span");
  label.className = "master-toggle-label";
  label.textContent = "Pencil";

  const description = document.createElement("span");
  description.className = "master-toggle-description";
  description.textContent =
    "Turn Pencil off everywhere. Your choices below are kept.";

  copy.append(label, description);

  const toggle = makeGroupToggle(GROUP_MASTER_ID, "all features", settings);
  toggle.classList.add("master-toggle-switch");

  root.classList.toggle("is-off", !enabled);
  document.body.classList.toggle("bc-master-off", !enabled);
  root.append(copy, toggle);
}

function makeGroupToggle(
  id: string,
  ariaLabel: string,
  settings: Record<string, boolean>
): HTMLButtonElement {
  const enabled = settings[id] ?? getDefaultFeatureEnabled(id);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.classList.add("toggle", enabled ? "on" : "off");
  toggle.setAttribute("aria-pressed", String(enabled));
  toggle.setAttribute("aria-label", `Toggle ${ariaLabel}`);
  toggle.dataset.groupToggle = id;

  toggle.addEventListener("click", () => {
    const next = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(next));
    toggle.classList.toggle("on", next);
    toggle.classList.toggle("off", !next);
    applyGroupVisualState(id, next);
    void updateSettings((current) => {
      current[id] = next;
    });
  });

  return toggle;
}

// Dim the gated rows when their group is off so users don't think their
// per-feature clicks are silently no-ops. Pure visual — storage stays
// untouched, so flipping the group back on restores every previous choice.
function applyGroupVisualState(groupId: string, enabled: boolean): void {
  if (groupId === GROUP_MASTER_ID) {
    const root = document.getElementById("master-toggle");
    root?.classList.toggle("is-off", !enabled);
    document.body.classList.toggle("bc-master-off", !enabled);
    return;
  }
  const section = document.querySelector<HTMLElement>(
    `.feature-section[data-group-id="${groupId}"]`
  );
  section?.classList.toggle("is-off", !enabled);
}

export function renderToggleList(
  features: FeatureItem[],
  settings: Record<string, boolean>
): HTMLElement {
  const list = document.createElement("ul");
  list.className = "feature-list";

  for (const feature of features) {
    const enabled = settings[feature.id] ?? getDefaultFeatureEnabled(feature.id);

    const li = document.createElement("li");
    li.className = "feature-row";

    const copy = document.createElement("div");
    copy.className = "feature-copy";

    const label = document.createElement("span");
    label.className = "feature-label";
    label.textContent = feature.label;

    const description = document.createElement("span");
    description.className = "feature-description";
    description.textContent = feature.description;

    copy.append(label, description);

    const toggle = document.createElement("button");
    toggle.className = `toggle ${enabled ? "on" : "off"}`;
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.setAttribute("aria-label", `Toggle ${feature.label}`);

    toggle.addEventListener("click", () => {
      const next = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(next));
      toggle.className = `toggle ${next ? "on" : "off"}`;
      void updateSettings((current) => {
        current[feature.id] = next;
      });
    });

    li.append(copy, toggle);
    list.append(li);
  }

  return list;
}

export function renderRadioGroup(
  section: Extract<FeatureSection, { kind: "radio" }>,
  settings: Record<string, boolean>
): HTMLElement {
  const list = document.createElement("ul");
  list.className = "feature-list";
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", section.title);

  // Resolve the currently-selected option from the boolean storage.
  // Earlier-listed options win on conflict; falls back to the section's
  // declared default when nothing matches.
  const initialId =
    section.options.find((option) =>
      option.enables.length > 0 &&
      option.enables.every(
        (id) => settings[id] ?? getDefaultFeatureEnabled(id)
      )
    )?.id ?? section.defaultOptionId;

  const rows: Array<{
    option: RadioOption;
    li: HTMLElement;
    radio: HTMLButtonElement;
  }> = [];

  const setSelection = (selectedId: string): void => {
    for (const row of rows) {
      const isSelected = row.option.id === selectedId;
      row.radio.classList.toggle("on", isSelected);
      row.radio.classList.toggle("off", !isSelected);
      row.radio.setAttribute("aria-checked", String(isSelected));
      row.li.classList.toggle("is-selected", isSelected);
    }
  };

  for (const option of section.options) {
    const li = document.createElement("li");
    li.className = "feature-row";

    const copy = document.createElement("div");
    copy.className = "feature-copy";

    const label = document.createElement("span");
    label.className = "feature-label";
    label.textContent = option.label;

    const description = document.createElement("span");
    description.className = "feature-description";
    description.textContent = option.description;

    copy.append(label, description);

    const radio = document.createElement("button");
    radio.type = "button";
    radio.className = "toggle radio off";
    radio.setAttribute("role", "radio");
    radio.setAttribute("aria-checked", "false");
    radio.setAttribute("aria-label", option.label);

    radio.addEventListener("click", () => {
      setSelection(option.id);
      void updateSettings((current) => {
        // Clear every flag this section owns, then enable just the ones the
        // chosen option declares. Keeps storage consistent with the radio
        // contract even if multiple flags were on previously.
        for (const id of RATING_DISPLAY_FEATURE_IDS) current[id] = false;
        for (const id of option.enables) current[id] = true;
      });
    });

    li.append(copy, radio);
    list.append(li);
    rows.push({ option, li, radio });
  }

  setSelection(initialId);
  return list;
}
