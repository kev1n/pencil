import { PAPER_CTEC_CONFIG } from "./config";
import {
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_TABS_CLASS
} from "./constants";
import type { PaperCtecSideCardContext } from "./types";
import { preventAndStop } from "./ui-shared";

// Side-panel CTEC Analytics tab is now a thin launcher into the full-screen
// modal. The rich rendering (aggregates, term picker, charts, comments,
// Refresh, Load-more) all lives in the modal — see modal-ui.ts. Clicking
// the tab in the side panel auto-opens the modal; the panel itself shows
// a single "Open Analytics" button so there's still something there if
// the user closes the modal while the tab is selected.

type SideCardAnalyticsRenderData = {
  selectedTab: "paper" | "analytics";
};

export function renderSideCardAnalytics(
  context: PaperCtecSideCardContext,
  data: SideCardAnalyticsRenderData,
  onSelectTab: (tab: "paper" | "analytics") => void,
  onOpenModal: () => void
): void {
  const header = ensureSideCardHeader(context.panel);
  const tabsRoot = ensureSideCardTabs(context.panel, header);
  const panelRoot = ensureSideCardAnalyticsPanel(context.panel, tabsRoot);

  renderSideCardTabs(tabsRoot, data.selectedTab, onSelectTab);
  applySideCardMode(context.panel, header, tabsRoot, panelRoot, data.selectedTab);

  const signature = data.selectedTab;
  if (panelRoot.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  panelRoot.replaceChildren();
  if (data.selectedTab !== "analytics") {
    panelRoot.dataset.bcPaperCtecSignature = signature;
    return;
  }

  panelRoot.append(renderLauncher(context.panel.ownerDocument, onOpenModal));
  panelRoot.dataset.bcPaperCtecSignature = signature;
}

function renderLauncher(doc: Document, onOpenModal: () => void): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-analytics-body";

  const head = doc.createElement("div");
  head.className = "bc-paper-ctec-analytics-head";

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-title";
  title.textContent = "Better CAESAR CTEC Analytics";
  head.append(title);
  wrapper.append(head);

  const launcher = doc.createElement("div");
  launcher.className = "bc-paper-ctec-analytics-launcher";

  const copy = doc.createElement("div");
  copy.className = "bc-paper-ctec-analytics-launcher-copy";
  copy.textContent =
    "Open the full analytics view to see term-by-term metrics, distributions, and student comments.";
  launcher.append(copy);

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "bc-paper-ctec-analytics-launcher-btn";
  button.textContent = "Open Analytics ↗";
  button.addEventListener("pointerdown", (event) => {
    preventAndStop(event);
    onOpenModal();
  });
  button.addEventListener("click", preventAndStop);
  launcher.append(button);

  wrapper.append(launcher);
  return wrapper;
}

function ensureSideCardHeader(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardHeader);
}

function ensureSideCardTabs(panel: HTMLElement, header: HTMLElement | null): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`.${SIDECARD_TABS_CLASS}`);
  if (existing) {
    insertAfter(panel, existing, header);
    return existing;
  }

  const tabsRoot = panel.ownerDocument.createElement("div");
  tabsRoot.className = SIDECARD_TABS_CLASS;
  tabsRoot.setAttribute("role", "tablist");

  insertAfter(panel, tabsRoot, header);
  return tabsRoot;
}

function ensureSideCardAnalyticsPanel(panel: HTMLElement, tabsRoot: HTMLElement): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`.${SIDECARD_ANALYTICS_PANEL_CLASS}`);
  if (existing) {
    insertAfter(panel, existing, tabsRoot);
    return existing;
  }

  const root = panel.ownerDocument.createElement("section");
  root.className = SIDECARD_ANALYTICS_PANEL_CLASS;
  insertAfter(panel, root, tabsRoot);
  return root;
}

function insertAfter(panel: HTMLElement, node: HTMLElement, reference: HTMLElement | null): void {
  if (!reference || reference.parentElement !== panel) {
    if (node.parentElement === panel && panel.firstElementChild === node) {
      return;
    }
    panel.prepend(node);
    return;
  }

  if (node.parentElement === panel && reference.nextSibling === node) {
    return;
  }

  panel.insertBefore(node, reference.nextSibling);
}

function renderSideCardTabs(
  tabsRoot: HTMLElement,
  selectedTab: "paper" | "analytics",
  onSelectTab: (tab: "paper" | "analytics") => void
): void {
  if (tabsRoot.dataset.bcPaperCtecSelectedTab === selectedTab && tabsRoot.childElementCount === 2) {
    return;
  }

  tabsRoot.replaceChildren();

  const tabs: Array<{ key: "paper" | "analytics"; label: string }> = [
    { key: "paper", label: "Paper.nu" },
    { key: "analytics", label: "CTEC Analytics" }
  ];

  for (const tab of tabs) {
    const button = tabsRoot.ownerDocument.createElement("button");
    button.type = "button";
    button.className = `bc-paper-ctec-side-tab${tab.key === selectedTab ? " is-active" : ""}`;
    button.textContent = tab.label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", tab.key === selectedTab ? "true" : "false");
    const activateTab = (event: Event) => {
      preventAndStop(event);
      onSelectTab(tab.key);
    };
    button.addEventListener("pointerdown", activateTab);
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      activateTab(event);
    });
    button.addEventListener("click", preventAndStop);
    tabsRoot.append(button);
  }

  tabsRoot.dataset.bcPaperCtecSelectedTab = selectedTab;
}

function applySideCardMode(
  panel: HTMLElement,
  header: HTMLElement | null,
  tabsRoot: HTMLElement,
  analyticsRoot: HTMLElement,
  selectedTab: "paper" | "analytics"
): void {
  analyticsRoot.hidden = selectedTab !== "analytics";

  for (const child of Array.from(panel.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === header || child === tabsRoot || child === analyticsRoot) continue;

    const shouldHide = selectedTab === "analytics";
    if (child.hidden !== shouldHide) {
      child.hidden = shouldHide;
    }
  }
}
