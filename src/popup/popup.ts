import { canonicalizeCodeInput, isCodeValidForLastName } from "../content/access-gate/code";
import { evaluateGate, type GateStatus } from "../content/access-gate";
import {
  ACCESS_GATE_CODE_KEY,
  ACCESS_GATE_NAME_KEY,
  clearStoredCode,
  readStoredName,
  writeStoredCode
} from "../content/access-gate/storage";
import {
  DEFAULT_RECENT_AGGREGATION_TERMS,
  FEATURES_STORAGE_KEY,
  MAX_RECENT_AGGREGATION_TERMS,
  MIN_RECENT_AGGREGATION_TERMS,
  RECENT_AGGREGATION_TERMS_STORAGE_KEY,
  getDefaultFeatureEnabled
} from "../content/settings";

const CTEC_INDEX_KEY = "better-caesar:ctec-index:v1";

type FeatureItem = {
  id: string;
  label: string;
  description: string;
};

// Single-select option group. Each option owns a list of feature IDs to
// turn on; every other option's IDs get turned off when this one is
// chosen. Lets us expose mutually-exclusive choices ("Stars vs Percent vs
// Default /6") that share the same boolean storage as the regular toggles
// without inventing a new storage key.
type RadioOption = {
  id: string;
  label: string;
  description: string;
  enables: string[];
};

type FeatureSection =
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

const FEATURE_SECTIONS: FeatureSection[] = [
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
        id: "caesar-domain-redirect",
        label: "Short Domain Redirect",
        description: "Sends caesar.northwestern.edu to caesar.ent.northwestern.edu so the short URL works."
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

async function init(): Promise<void> {
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

function renderToggleList(
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

    toggle.addEventListener("click", async () => {
      const next = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(next));
      toggle.className = `toggle ${next ? "on" : "off"}`;
      const current = await loadSettings();
      current[feature.id] = next;
      await saveSettings(current);
    });

    li.append(copy, toggle);
    list.append(li);
  }

  return list;
}

function renderRadioGroup(
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

    radio.addEventListener("click", async () => {
      setSelection(option.id);
      const current = await loadSettings();
      // Clear every flag this section owns, then enable just the ones the
      // chosen option declares. Keeps storage consistent with the radio
      // contract even if multiple flags were on previously.
      for (const id of RATING_DISPLAY_FEATURE_IDS) current[id] = false;
      for (const id of option.enables) current[id] = true;
      await saveSettings(current);
    });

    li.append(copy, radio);
    list.append(li);
    rows.push({ option, li, radio });
  }

  setSelection(initialId);
  return list;
}

async function initRecentTermsInput(): Promise<void> {
  const root = document.getElementById("recent-terms-row");
  if (!root) return;

  const stored = await chrome.storage.local.get(
    RECENT_AGGREGATION_TERMS_STORAGE_KEY
  ) as Record<string, unknown>;
  const raw = stored[RECENT_AGGREGATION_TERMS_STORAGE_KEY];
  const initial = clampRecent(typeof raw === "number" ? raw : DEFAULT_RECENT_AGGREGATION_TERMS);

  const label = document.createElement("label");
  label.className = "ctec-school-label";
  label.htmlFor = "recent-terms-input";

  const labelTitle = document.createElement("span");
  labelTitle.className = "ctec-school-label-title";
  labelTitle.textContent = "Recent terms aggregation";

  const labelHelp = document.createElement("span");
  labelHelp.className = "ctec-school-label-help";
  labelHelp.textContent =
    "How many of a course's most recent terms get averaged into the schedule-card chips and the analytics KPIs.";

  label.append(labelTitle, labelHelp);

  const input = document.createElement("input");
  input.id = "recent-terms-input";
  input.type = "number";
  input.className = "ctec-school-select";
  input.min = String(MIN_RECENT_AGGREGATION_TERMS);
  input.max = String(MAX_RECENT_AGGREGATION_TERMS);
  input.step = "1";
  input.value = String(initial);
  input.style.maxWidth = "80px";

  const persist = async (): Promise<void> => {
    const next = clampRecent(Number.parseInt(input.value, 10));
    input.value = String(next);
    await chrome.storage.local.set({
      [RECENT_AGGREGATION_TERMS_STORAGE_KEY]: next
    });
  };
  input.addEventListener("change", () => void persist());
  input.addEventListener("blur", () => void persist());

  root.append(label, input);
}

function clampRecent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RECENT_AGGREGATION_TERMS;
  return Math.max(
    MIN_RECENT_AGGREGATION_TERMS,
    Math.min(MAX_RECENT_AGGREGATION_TERMS, Math.floor(value))
  );
}

function initClearCacheButton(): void {
  const btn = document.getElementById("clear-ctec-cache");
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.addEventListener("click", async () => {
    await chrome.storage.local.remove(CTEC_INDEX_KEY);
    btn.textContent = "Cleared!";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = "Clear CTEC cache";
      btn.disabled = false;
    }, 1500);
  });
}

void init();
initClearCacheButton();
void initRecentTermsInput();
void renderGate();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!changes[ACCESS_GATE_NAME_KEY] && !changes[ACCESS_GATE_CODE_KEY]) return;
  void renderGate();
});

async function renderGate(): Promise<void> {
  const root = document.getElementById("gate");
  if (!root) return;

  const status = await evaluateGate();
  root.innerHTML = "";
  root.append(buildGateNode(status));
}

function buildGateNode(status: GateStatus): HTMLElement {
  const card = document.createElement("div");

  if (status.kind === "needs-caesar") {
    card.className = "gate-card gate-card--warn";
    card.append(
      makeGateRow(
        "Sign in to CAESAR to enable",
        "Open caesar.ent.northwestern.edu and sign in. Better CAESAR will detect your account automatically."
      )
    );
    return card;
  }

  if (status.kind === "locked-bucket") {
    card.className = "gate-card gate-card--lock";
    const when = new Date(status.releaseAt).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    card.append(
      makeGateRow(
        `Available ${when}`,
        `Last names ${status.bucketLabel} unlock at that time. Have a code? Enter it below.`
      ),
      buildCodeForm(status.lastName)
    );
    return card;
  }

  card.className = "gate-card gate-card--ok";
  const reason = status.reason === "code" ? "Unlocked with code" : "Unlocked";
  card.append(makeGateRow(reason, `Signed in as ${status.lastName}.`));
  if (status.reason === "code") {
    const remove = document.createElement("button");
    remove.className = "gate-link";
    remove.textContent = "Remove code";
    remove.addEventListener("click", async () => {
      await clearStoredCode();
    });
    card.append(remove);
  }
  return card;
}

function makeGateRow(title: string, body: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "gate-copy";
  const t = document.createElement("div");
  t.className = "gate-title";
  t.textContent = title;
  const b = document.createElement("div");
  b.className = "gate-body";
  b.textContent = body;
  wrap.append(t, b);
  return wrap;
}

function buildCodeForm(lastName: string): HTMLElement {
  const form = document.createElement("form");
  form.className = "gate-form";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "XXX-XXX";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.maxLength = 8;
  input.className = "gate-input";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "gate-submit";
  submit.textContent = "Unlock";

  const status = document.createElement("div");
  status.className = "gate-status";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    const cleaned = canonicalizeCodeInput(input.value);
    if (cleaned.length === 0) return;
    const stored = await readStoredName();
    const target = stored?.lastName ?? lastName;
    const ok = await isCodeValidForLastName(cleaned, target);
    if (!ok) {
      status.textContent = "Code didn't match.";
      status.className = "gate-status gate-status--err";
      return;
    }
    await writeStoredCode(cleaned);
  });

  form.append(input, submit, status);
  return form;
}
