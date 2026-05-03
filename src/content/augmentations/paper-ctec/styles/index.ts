import { STYLE_ID } from "../constants";
import { authModalStyles } from "./auth-modal";
import { cardStyles } from "./cards";
import { modalStyles } from "./modal";
import { modalChartStyles } from "./modal-charts";
import { modalCommentStyles } from "./modal-comments";
import { modalTermStyles } from "./modal-terms";
import { sideCardStyles } from "./side-card";
import { sideCardPanelStyles } from "./side-card-panel";
import { statusBarStyles } from "./status-bar";

// Single style injection point. Each module owns one topical chunk of the
// stylesheet so any single file stays comprehensible. Order matches the
// historical inline file: cards → status bar → side card → modal frame →
// modal charts → modal comments → modal terms → auth modal. Some later
// rules legitimately depend on cascade order (modal-terms responsive
// queries override modal-charts grid declarations), so keep the order.
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = [
    cardStyles(),
    statusBarStyles(),
    sideCardStyles(),
    sideCardPanelStyles(),
    modalStyles(),
    modalChartStyles(),
    modalCommentStyles(),
    modalTermStyles(),
    authModalStyles()
  ].join("\n");

  (document.head ?? document.documentElement).appendChild(style);
}
