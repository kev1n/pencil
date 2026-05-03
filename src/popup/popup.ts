import { canonicalizeCodeInput, isCodeValidForLastName } from "../content/access-gate/code";
import { evaluateGate, type GateStatus } from "../content/access-gate";
import {
  ACCESS_GATE_CODE_KEY,
  ACCESS_GATE_NAME_KEY,
  clearStoredCode,
  readStoredName,
  writeStoredCode
} from "../content/access-gate/storage";
import { FEATURES_STORAGE_KEY, getDefaultFeatureEnabled } from "../content/settings";

const CTEC_INDEX_KEY = "better-caesar:ctec-index:v1";

type FeatureItem = {
  id: string;
  label: string;
  description: string;
};

type FeatureSection = {
  title: string;
  blurb: string;
  features: FeatureItem[];
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
        id: "paper-ctec-compact-card-stars",
        label: "Dense Card Stars",
        description: "Uses stars instead of numeric values in dense schedule cards."
      },
      {
        id: "paper-ctec-rating-percent",
        label: "Percent Ratings",
        description: "Shows CTEC ratings as a /100 percentage instead of the native /6 score."
      },
      {
        id: "paper-card-border-on-hover",
        label: "Card Border on Hover",
        description: "Disables Paper's hover-lift animation on schedule cards and shows a static border outline instead."
      }
    ]
  }
];

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

    const list = document.createElement("ul");
    list.className = "feature-list";

    for (const feature of section.features) {
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

    sectionEl.append(list);
    sectionsRoot.append(sectionEl);
  }
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
