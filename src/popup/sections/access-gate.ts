import { canonicalizeCodeInput, isCodeValidForLastName } from "../../content/access-gate/code";
import { evaluateGate, type GateStatus } from "../../content/access-gate";
import { bindActionButton } from "../../content/framework";
import { renderInlineMarkdown } from "../../content/access-gate/markdown";
import {
  ACCESS_GATE_CODE_KEY,
  ACCESS_GATE_NAME_KEY,
  clearStoredCode,
  readStoredName,
  writeStoredCode
} from "../../content/access-gate/storage";

export async function renderGate(): Promise<void> {
  const root = document.getElementById("gate");
  if (!root) return;

  const status = await evaluateGate();
  root.innerHTML = "";
  root.append(buildGateNode(status));
}

export function initGateRefreshOnStorageChange(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[ACCESS_GATE_NAME_KEY] && !changes[ACCESS_GATE_CODE_KEY]) return;
    void renderGate();
  });
}

function buildGateNode(status: GateStatus): HTMLElement {
  const card = document.createElement("div");

  if (status.kind === "needs-caesar") {
    card.className = "gate-card gate-card--warn";
    card.append(
      makeGateRow(
        "Sign in to CAESAR to enable",
        "Open caesar.ent.northwestern.edu and sign in. pencil.nu will detect your account automatically."
      )
    );
    return card;
  }

  if (status.kind === "killed") {
    card.className = "gate-card gate-card--lock";
    const wrap = document.createElement("div");
    wrap.className = "gate-copy";
    const t = document.createElement("div");
    t.className = "gate-title";
    t.textContent = "pencil.nu is disabled";
    const b = document.createElement("div");
    b.className = "gate-body";
    renderInlineMarkdown(b, status.message);
    wrap.append(t, b);
    card.append(wrap);
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
        `${status.bucketLabel} unlocks at that time. Have a code? Enter it below.`
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
    bindActionButton(remove, {
      label: "Remove code",
      loadingLabel: "Removing…",
      onClick: async () => {
        await clearStoredCode();
        return { kind: "idle" };
      }
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
