import { STYLE_ID } from "../constants";
import { injectModalStyles } from "../../../framework/modal";
import { cardStyles } from "./cards";
import { sheetStyles } from "./sheet";
import { sideCardStyles } from "./side-card";
import { sideCardPanelStyles } from "./side-card-panel";
import { statusBarStyles } from "./status-bar";

// Single style injection point. Each module owns one topical chunk of the
// stylesheet so any single file stays comprehensible: cards → status bar →
// side card → analytics sheet. The auth dialog chrome lives in
// framework/modal.ts and is injected as its own <style> via injectModalStyles().
export function injectStyles(): void {
  injectModalStyles();

  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = [
    cardStyles(),
    statusBarStyles(),
    sideCardStyles(),
    sideCardPanelStyles(),
    sheetStyles()
  ].join("\n");

  (document.head ?? document.documentElement).appendChild(style);
}
