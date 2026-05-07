import { FEATURES_STORAGE_KEY, getDefaultFeatureEnabled } from "../../content/settings";

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
      features: FeatureItem[];
    }
  | {
      kind: "radio";
      title: string;
      blurb: string;
      options: RadioOption[];
      defaultOptionId: string;
    };

export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: "CAESAR",
    blurb: "Add richer enrollment, evaluation, and navigation tools directly inside CAESAR.",
    features: [
      {
        id: "seats-notes",
        label: "Seats & Notes",
        description: "Loads class notes, attributes, requirements, and seat details in shopping cart views."
      },
      {
        id: "ctec-links",
        label: "CTEC Links",
        description: "Adds inline professor evaluation history and links to matching CTEC reports."
      },
      {
        id: "enrollment-navigation",
        label: "Enrollment Terms",
        description: "Improves navigation across enrollment terms and related registration screens."
      },
      {
        id: "class-search",
        label: "Class Search",
        description: "Replaces CAESAR's class search with a paper.nu-powered UI that adds sections to your cart in place."
      }
    ]
  },
  {
    title: "Paper.nu",
    blurb: "Enhance the Paper schedule and section panel with Northwestern CTEC data.",
    features: [
      {
        id: "paper-ctec",
        label: "CTEC Integration",
        description: "Loads CTEC summaries into schedule cards and the expanded analytics panel."
      },
      {
        id: "paper-ctec-single-summary-card",
        label: "First Timeslot Only",
        description: "Shows the compact CTEC summary on only one schedule block per class, using the earliest timeslot."
      },
      {
        id: "paper-ctec-compact-cards",
        label: "Dense Cards",
        description: "Compresses the schedule card header to make more room for the compact CTEC row."
      },
      {
        id: "paper-card-border-on-hover",
        label: "Card Border on Hover",
        description: "Disables Paper's hover-lift animation on schedule cards and shows a static border outline instead."
      },
      {
        id: "paper-combos",
        label: "Schedule Combinations",
        description: "Cycle through every non-overlapping subset of the sections on your canvas, sorted by average CTEC rating."
      }
    ]
  },
  {
    kind: "radio",
    title: "Rating display",
    blurb: "How CTEC scores are formatted in schedule cards and the analytics KPI strip.",
    defaultOptionId: "default",
    options: [
      {
        id: "default",
        label: "Numeric (/6)",
        description: "Shows the raw mean rating on Northwestern's native 0–6 scale.",
        enables: []
      },
      {
        id: "percent",
        label: "Percent (/100)",
        description: "Converts the rating to a percentage of the 6-point scale (e.g. 5.4 → 90%).",
        enables: ["paper-ctec-rating-percent"]
      },
      {
        id: "stars",
        label: "Stars",
        description: "Renders the rating as filled stars instead of a number.",
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
  const sectionsRoot = document.getElementById("feature-sections");
  if (!sectionsRoot) return;

  for (const section of FEATURE_SECTIONS) {
    const sectionEl = document.createElement("section");
    sectionEl.className = "feature-section";

    const header = document.createElement("div");
    header.className = "feature-section-header";

    const title = document.createElement("h2");
    title.className = "feature-section-title";
    title.textContent = section.title;

    const blurb = document.createElement("p");
    blurb.className = "feature-section-blurb";
    blurb.textContent = section.blurb;

    header.append(title, blurb);
    sectionEl.append(header);

    if (section.kind === "radio") {
      sectionEl.append(renderRadioGroup(section, settings));
    } else {
      sectionEl.append(renderToggleList(section.features, settings));
    }

    sectionsRoot.append(sectionEl);
  }
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
