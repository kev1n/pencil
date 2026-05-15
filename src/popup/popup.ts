import { bootstrapTheme } from "../content/design";

import { initCacheButtons } from "./sections/cache";
import { initChangelogPanel } from "./sections/changelog";
import { initCourseHistorySection } from "./sections/course-history";
import { initCtecAccessStatus } from "./sections/ctec-access-status";
import { initFeatureToggles } from "./sections/feature-toggles";
import { initRecentTermsInput } from "./sections/recent-terms";
import { initThemePicker } from "./sections/theme";

void bootstrapTheme();
initChangelogPanel();
void initFeatureToggles();
initCacheButtons();
void initRecentTermsInput();
void initThemePicker();
void initCtecAccessStatus();
void initCourseHistorySection();
