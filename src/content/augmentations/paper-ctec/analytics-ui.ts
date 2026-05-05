import { html, render } from "lit-html";

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
  // CTEC Analytics tab only surfaces once the user has actually loaded
  // CTECs for this class (or there's a cached aggregate to draw from).
  // Until then the side panel hides the tabs entirely and shows the
  // default paper.nu content.
  analyticsAvailable: boolean;
};

export function renderSideCardAnalytics(
  context: PaperCtecSideCardContext,
  data: SideCardAnalyticsRenderData,
  onSelectTab: (tab: "paper" | "analytics") => void,
  onOpenModal: () => void
): void {
  const header = ensureSideCardHeader(context.panel);

  if (!data.analyticsAvailable) {
    removeSideCardAnalyticsChrome(context.panel);
    restoreDefaultPanelChildren(context.panel, header);
    return;
  }

  const tabsRoot = ensureSideCardTabs(context.panel, header);
  const panelRoot = ensureSideCardAnalyticsPanel(context.panel, tabsRoot);

  renderSideCardTabs(tabsRoot, data.selectedTab, onSelectTab);
  applySideCardMode(context.panel, header, tabsRoot, panelRoot, data.selectedTab);

  // lit-html owns panelRoot's children. When Analytics isn't selected we
  // render an empty fragment (clears prior contents); when it is, the
  // launcher template lights up.
  render(
    data.selectedTab === "analytics" ? renderLauncher(onOpenModal) : html``,
    panelRoot
  );
}

function removeSideCardAnalyticsChrome(panel: HTMLElement): void {
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

function renderLauncher(onOpenModal: () => void) {
  return html`<div class="bc-paper-ctec-analytics-body">
    <div class="bc-paper-ctec-analytics-head">
      <div class="bc-paper-ctec-analytics-title">pencil.nu CTEC Analytics</div>
    </div>
    <div class="bc-paper-ctec-analytics-launcher">
      <div class="bc-paper-ctec-analytics-launcher-copy">
        Open the full analytics view to see term-by-term metrics,
        distributions, and student comments.
      </div>
      <button
        type="button"
        class="bc-paper-ctec-analytics-launcher-btn"
        @pointerdown=${(event: Event) => {
          preventAndStop(event);
          onOpenModal();
        }}
        @click=${preventAndStop}
      >Open Analytics ↗</button>
    </div>
  </div>`;
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
  const tabs: Array<{ key: "paper" | "analytics"; label: string }> = [
    { key: "paper", label: "Paper.nu" },
    { key: "analytics", label: "CTEC Analytics" }
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
