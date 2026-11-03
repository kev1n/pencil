// Better/Classic tab state controller. Owns the tab id (memory + session
// storage), the native-hider <style> element that hides PeopleSoft's
// SSR_CLSRCH_ENTRY page, and the panel-display toggle that shows / hides
// our custom UI.
//
// Extracted from augmentation.ts (Wave 5e). Keeping the `appliedTab`
// short-circuit here means a mutation-observer-driven `applyVisibility()`
// after every PS DOM swap stays cheap — we only re-touch the DOM when the
// active tab actually changed.
//
// The controller does NOT own the tab buttons themselves (those still live
// in `augmentation.ts → buildTabs()`). Buttons call `setActive()` and then
// `applyVisibility()` to flip the UI; the controller manages the rest.

import { findNativeSearchContainer, readActiveTab, writeActiveTab } from "../page-detection";
import type { TabId } from "../types";

const HIDE_NATIVE_STYLE_ID = "better-caesar-class-search-hide-native";

export interface TabController {
  /** Returns the current tab id (memory mirror of session storage). */
  getActive(): TabId;
  /**
   * Sets the active tab and persists it to session storage. Does NOT
   * apply visibility — call `applyVisibility(panel)` afterward.
   */
  setActive(tab: TabId): void;
  /**
   * Idempotent: when the active tab matches the last applied state this
   * is a no-op (so mutation-observer ticks stay cheap). On change, toggles
   * the native-hider style and `panel.style.display`.
   */
  applyVisibility(panel: HTMLElement | null): void;
  /** Inject the native-hider <style> if not already present. */
  installNativeHider(doc: Document): void;
  /** Remove the native-hider <style> if present. */
  removeNativeHider(doc: Document): void;
  /**
   * Tear down any DOM the controller injected (the native-hider style).
   * Resets the appliedTab tracker so a fresh mount re-applies cleanly.
   */
  cleanup(doc: Document): void;
}

export type TabControllerDeps = {
  doc: Document;
  /** Optional callback fired when `setActive` actually changes the tab. */
  onTabChange?(tab: TabId): void;
};

export function createTabController(deps: TabControllerDeps): TabController {
  let activeTab: TabId = readActiveTab();
  // Last tab actually applied to the DOM. Without this, every mutation
  // observer tick would re-toggle the native-hider style and panel display.
  let appliedTab: TabId | null = null;

  function installNativeHider(doc: Document): void {
    if (doc.getElementById(HIDE_NATIVE_STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = HIDE_NATIVE_STYLE_ID;
    const containerId = findNativeSearchContainer(doc)?.id ?? "win0divPAGECONTAINER";
    style.textContent = `#${containerId}, #win0divPAGEBAR, #win0divPSPANELTABS { display: none !important; }`;
    (doc.head ?? doc.documentElement).appendChild(style);
  }

  function removeNativeHider(doc: Document): void {
    doc.getElementById(HIDE_NATIVE_STYLE_ID)?.remove();
  }

  return {
    getActive() {
      return activeTab;
    },
    setActive(tab) {
      if (activeTab === tab) return;
      activeTab = tab;
      writeActiveTab(tab);
      deps.onTabChange?.(tab);
    },
    applyVisibility(panel) {
      if (appliedTab === activeTab) return;
      appliedTab = activeTab;
      if (activeTab === "better") {
        installNativeHider(deps.doc);
        if (panel) panel.style.display = "";
      } else {
        removeNativeHider(deps.doc);
        if (panel) panel.style.display = "none";
      }
    },
    installNativeHider,
    removeNativeHider,
    cleanup(doc) {
      removeNativeHider(doc);
      appliedTab = null;
    }
  };
}
