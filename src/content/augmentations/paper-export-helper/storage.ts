import { logQuiet } from "../../../shared/log";
import {
  CALENDAR_APPS,
  DEFAULT_CALENDAR_APP,
  type CalendarApp
} from "./types";

// Storage prefix preserved from the project's original name — see
// `src/content/settings.ts` for the full rationale.
const LAST_TAB_KEY = "better-caesar:paper-export-helper:last-tab:v1";

const VALID_APPS: ReadonlySet<CalendarApp> = new Set(
  CALENDAR_APPS.map((a) => a.id)
);

function isCalendarApp(value: unknown): value is CalendarApp {
  return typeof value === "string" && VALID_APPS.has(value as CalendarApp);
}

// Last-selected calendar tab. Falls back to the default when storage is
// empty, unreadable, or holds a value we no longer recognize.
export async function loadLastTab(): Promise<CalendarApp> {
  try {
    const result = (await chrome.storage.local.get(LAST_TAB_KEY)) as Record<
      string,
      unknown
    >;
    const raw = result[LAST_TAB_KEY];
    if (isCalendarApp(raw)) return raw;
  } catch (err) {
    logQuiet("paper-export-helper.storage.load", err);
  }
  return DEFAULT_CALENDAR_APP;
}

// Fire-and-forget — callers don't await this on the hot path of a tab
// click; a storage hiccup just means the next session forgets the
// preference, which is harmless.
export function saveLastTab(app: CalendarApp): void {
  void chrome.storage.local.set({ [LAST_TAB_KEY]: app }).catch((err) => {
    logQuiet("paper-export-helper.storage.save", err);
  });
}
