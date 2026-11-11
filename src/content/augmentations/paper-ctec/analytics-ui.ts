import { html, render } from "lit-html";

import { PAPER_CTEC_CONFIG } from "./config";
import {
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_TABS_CLASS
} from "./constants";
import type { PaperCtecSideCardContext } from "./types";
import { preventAndStop } from "./ui-shared";

// Paper.nu's Section Info panel gets a Paper.nu / CTECs tab pair, placed in
// the panel's own header row beside its link and close buttons. The CTECs
// tab hides Paper.nu's own content, widens the panel, and returns an empty
// host element that the analytics sheet (modal/view.ts) renders into, so
// there is one side panel on the page instead of two.

export const SIDECARD_WIDE_ATTR = "data-bc-ctec-wide";

type SideCardAnalyticsRenderData = {
  selectedTab: "paper" | "analytics";
  // CTEC Analytics tab only surfaces once the user has actually loaded
  // CTECs for this class (or there's a cached aggregate to draw from).
  // Until then the side panel hides the tabs entirely and shows the
  // default paper.nu content.
  analyticsAvailable: boolean;
};

export function renderSideCardAnalytics(
  context: PaperCtecSideCardContext,
  data: SideCardAnalyticsRenderData,
  onSelectTab: (tab: "paper" | "analytics") => void
): HTMLElement | null {
  const header = ensureSideCardHeader(context.panel);

  if (!data.analyticsAvailable) {
    removeSideCardAnalyticsChrome(context.panel);
    restoreDefaultPanelChildren(context.panel, header);
    return null;
  }

  const tabsRoot = ensureSideCardTabs(context.panel, header);
  const panelRoot = ensureSideCardAnalyticsPanel(
    context.panel,
    tabsRoot.parentElement === context.panel ? tabsRoot : header
  );

  renderSideCardTabs(tabsRoot, data.selectedTab, onSelectTab);
  applySideCardMode(context.panel, header, tabsRoot, panelRoot, data.selectedTab);

  const showing = data.selectedTab === "analytics";
  context.panel.parentElement?.toggleAttribute(SIDECARD_WIDE_ATTR, showing);
  return showing ? panelRoot : null;
}

function removeSideCardAnalyticsChrome(panel: HTMLElement): void {
  panel.parentElement?.removeAttribute(SIDECARD_WIDE_ATTR);
  panel.querySelector<HTMLElement>(`.${SIDECARD_TABS_CLASS}`)?.remove();
  panel.querySelector<HTMLElement>(`.${SIDECARD_ANALYTICS_PANEL_CLASS}`)?.remove();
}

function restoreDefaultPanelChildren(
  panel: HTMLElement,
  header: HTMLElement | null
): void {
  // applySideCardMode hides paper.nu's own panel content when the Analytics
  // tab is active. When we strip Analytics back out, those children must be
  // re-shown.
  for (const child of Array.from(panel.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === header) continue;
    if (child.hidden) child.hidden = false;
  }
}

function ensureSideCardHeader(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardHeader);
}

function ensureSideCardTabs(panel: HTMLElement, header: HTMLElement | null): HTMLElement {
  let tabsRoot = panel.querySelector<HTMLElement>(`.${SIDECARD_TABS_CLASS}`);
  if (!tabsRoot) {
    tabsRoot = panel.ownerDocument.createElement("div");
    tabsRoot.className = SIDECARD_TABS_CLASS;
    tabsRoot.setAttribute("role", "tablist");
  }

  // In the header row, right after Paper.nu's "Section Info" label, which
  // grows to push the tabs against the link and close buttons.
  const label = header?.firstElementChild;
  if (header && label) {
    if (label.nextSibling !== tabsRoot) header.insertBefore(tabsRoot, label.nextSibling);
    return tabsRoot;
  }

  insertAfter(panel, tabsRoot, header);
  return tabsRoot;
}

function ensureSideCardAnalyticsPanel(panel: HTMLElement, after: HTMLElement | null): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`.${SIDECARD_ANALYTICS_PANEL_CLASS}`);
  if (existing) {
    insertAfter(panel, existing, after);
    return existing;
  }

  const root = panel.ownerDocument.createElement("section");
  root.className = SIDECARD_ANALYTICS_PANEL_CLASS;
  insertAfter(panel, root, after);
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
  const tabs: Array<{ key: "paper" | "analytics"; label: string }> = [
    { key: "paper", label: "Paper.nu" },
    { key: "analytics", label: "CTECs" }
  ];

  render(
    html`${tabs.map((tab) => {
      const isActive = tab.key === selectedTab;
      const activate = (event: Event) => {
        preventAndStop(event);
        onSelectTab(tab.key);
      };
      return html`<button
        type="button"
        class=${`bc-paper-ctec-side-tab${isActive ? " is-active" : ""}`}
        role="tab"
        aria-selected=${isActive ? "true" : "false"}
        @pointerdown=${activate}
        @click=${preventAndStop}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          activate(event);
        }}
      >${tab.label}</button>`;
    })}`,
    tabsRoot
  );
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
