import { html, render } from "lit-html";

import { PAPER_CTEC_CONFIG } from "./config";
import {
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_CAESAR_PANEL_CLASS,
  SIDECARD_FOOT_CLASS,
  SIDECARD_TABS_CLASS
} from "./constants";
import type { PaperCtecSideCardContext } from "./types";
import { preventAndStop } from "./ui-shared";

// Paper.nu's Section Info panel gets Paper.nu / CAESAR / CTECs tabs, placed
// in the panel's own header row beside its link and close buttons. The
// CAESAR and CTECs tabs hide Paper.nu's own content and hand back an empty
// host element to draw into (CAESAR's facts for the class; the analytics
// sheet from modal/view.ts, which also widens the panel), so there is one
// side panel on the page instead of several.

export const SIDECARD_WIDE_ATTR = "data-bc-ctec-wide";

type Tab = "paper" | "caesar" | "analytics";

// `foot` is the seats-and-register bar under Paper.nu's own tab; the other
// two tabs draw that bar themselves.
export type SideCardHosts = { analytics: HTMLElement | null; caesar: HTMLElement | null; foot: HTMLElement | null };

type SideCardAnalyticsRenderData = {
  selectedTab: Tab;
  // CTEC Analytics tab only surfaces once the user has actually loaded
  // CTECs for this class (or there's a cached aggregate to draw from).
  // Until then the side panel hides the tabs entirely and shows the
  // default paper.nu content.
  analyticsAvailable: boolean;
};

export function renderSideCardAnalytics(
  context: PaperCtecSideCardContext,
  data: SideCardAnalyticsRenderData,
  onSelectTab: (tab: Tab) => void
): SideCardHosts {
  const header = ensureSideCardHeader(context.panel);
  const tabsRoot = ensureSideCardTabs(context.panel, header);
  const after = tabsRoot.parentElement === context.panel ? tabsRoot : header;
  const analyticsRoot = ensureSideCardPanel(context.panel, SIDECARD_ANALYTICS_PANEL_CLASS, after);
  const caesarRoot = ensureSideCardPanel(context.panel, SIDECARD_CAESAR_PANEL_CLASS, after);

  const footRoot = ensureSideCardPanel(context.panel, SIDECARD_FOOT_CLASS, null);
  // Paper.nu adds its own content after ours: the bar stays last.
  if (context.panel.lastElementChild !== footRoot) context.panel.append(footRoot);

  renderSideCardTabs(tabsRoot, data.selectedTab, data.analyticsAvailable, onSelectTab);
  applySideCardMode(context.panel, header, tabsRoot, { analytics: analyticsRoot, caesar: caesarRoot, foot: footRoot }, data.selectedTab);

  context.panel.parentElement?.toggleAttribute(SIDECARD_WIDE_ATTR, data.selectedTab === "analytics");
  return {
    analytics: data.selectedTab === "analytics" ? analyticsRoot : null,
    caesar: data.selectedTab === "caesar" ? caesarRoot : null,
    foot: data.selectedTab === "paper" ? footRoot : null
  };
}

export function removeSideCardChrome(panel: HTMLElement): void {
  panel.parentElement?.removeAttribute(SIDECARD_WIDE_ATTR);
  panel.querySelector<HTMLElement>(`.${SIDECARD_TABS_CLASS}`)?.remove();
  panel.querySelector<HTMLElement>(`.${SIDECARD_ANALYTICS_PANEL_CLASS}`)?.remove();
  panel.querySelector<HTMLElement>(`.${SIDECARD_CAESAR_PANEL_CLASS}`)?.remove();
  panel.querySelector<HTMLElement>(`.${SIDECARD_FOOT_CLASS}`)?.remove();
  for (const child of Array.from(panel.children)) {
    if (child instanceof HTMLElement && child.hidden) child.hidden = false;
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

function ensureSideCardPanel(panel: HTMLElement, className: string, after: HTMLElement | null): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`:scope > .${className}`);
  if (existing) return existing;
  const root = panel.ownerDocument.createElement("section");
  root.className = className;
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
  selectedTab: Tab,
  analyticsAvailable: boolean,
  onSelectTab: (tab: Tab) => void
): void {
  // CTECs shows once there is something to show for this class, and then
  // carries CAESAR's facts too; until then those get a tab of their own.
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "paper", label: "Paper.nu" },
    analyticsAvailable ? { key: "analytics", label: "CTECs" } : { key: "caesar", label: "CAESAR" }
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
  roots: { analytics: HTMLElement; caesar: HTMLElement; foot: HTMLElement },
  selectedTab: Tab
): void {
  if (roots.analytics.hidden !== (selectedTab !== "analytics")) roots.analytics.hidden = selectedTab !== "analytics";
  if (roots.caesar.hidden !== (selectedTab !== "caesar")) roots.caesar.hidden = selectedTab !== "caesar";
  if (roots.foot.hidden !== (selectedTab !== "paper")) roots.foot.hidden = selectedTab !== "paper";

  for (const child of Array.from(panel.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === header || child === tabsRoot || child === roots.analytics || child === roots.caesar || child === roots.foot) continue;

    const shouldHide = selectedTab !== "paper";
    if (child.hidden !== shouldHide) {
      child.hidden = shouldHide;
    }
  }
}
