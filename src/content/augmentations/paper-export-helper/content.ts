import type { CalendarApp } from "./types";

export type AppLink = {
  label: string;
  href: string;
};

export type AppContent = {
  steps: ReadonlyArray<string>;
  deepLink: AppLink | null;
  // Apple Calendar has no web import flow, so it gets a help link
  // instead of the primary deep-link CTA.
  helpLink: AppLink | null;
};

// Step copy is intentionally terse — three lines max per tab. Step 1
// always points back at our own Download button so the flow reads
// top-to-bottom. Step 2 names what happens next (auto-open) so the
// new tab isn't surprising.
export const APP_CONTENT: Record<CalendarApp, AppContent> = {
  google: {
    steps: [
      "Download the .ics.",
      "Google Calendar's import page opens. Click Select file and pick the .ics.",
      "Choose a destination calendar, then Import."
    ],
    deepLink: {
      label: "Open Google Calendar",
      href: "https://calendar.google.com/calendar/u/0/r/settings/export"
    },
    helpLink: {
      label: "Google's full instructions",
      href: "https://support.google.com/calendar/answer/37118"
    }
  },
  apple: {
    steps: [
      "Download the .ics.",
      "Mac: open Calendar, then File → Import…",
      "iPhone/iPad: open the file from Files or Downloads."
    ],
    deepLink: null,
    helpLink: {
      label: "Apple's full instructions",
      href: "https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac"
    }
  },
  outlook: {
    steps: [
      "Download the .ics.",
      "Outlook's Add Calendar page opens. Choose Upload from file and pick the .ics.",
      "Choose a destination calendar, then Import."
    ],
    deepLink: {
      label: "Open Outlook",
      href: "https://outlook.cloud.microsoft/calendar/addcalendar"
    },
    helpLink: {
      label: "Microsoft's full instructions",
      href: "https://support.microsoft.com/en-us/office/import-calendars-into-outlook-8e8364e1-400e-4c0f-a573-fe76b5a2d379"
    }
  }
};

export const CENTRAL_TIME_WARNING =
  "Set your calendar's time zone to Central Time (Chicago) before importing.";
