import { bootstrapTheme } from "../content/design";

import {
  initGateRefreshOnStorageChange,
  renderGate
} from "./sections/access-gate";
import {
  initCacheButtons,
  initReconfirmGradYearButton,
  initRefreshScheduleButton
} from "./sections/cache";
import { initFeatureToggles } from "./sections/feature-toggles";
import { initRecentTermsInput } from "./sections/recent-terms";
import { initSchedulePanel } from "./sections/schedule-panel";
import { initThemePicker } from "./sections/theme";

void bootstrapTheme();
void initFeatureToggles();
initCacheButtons();
initReconfirmGradYearButton();
initRefreshScheduleButton();
void initRecentTermsInput();
void initThemePicker();
void renderGate();
void initSchedulePanel();
initGateRefreshOnStorageChange();
