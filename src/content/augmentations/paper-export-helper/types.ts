// Each tab represents one calendar app's import flow. Tab content is
// filled in by a later commit — this file pins the union so the modal,
// content, and storage modules can refer to the same set.
export type CalendarApp = "google" | "apple" | "outlook";

export const CALENDAR_APPS: ReadonlyArray<{
  id: CalendarApp;
  label: string;
}> = [
  { id: "google", label: "Google Calendar" },
  { id: "apple", label: "Apple Calendar" },
  { id: "outlook", label: "Outlook" }
];

export const DEFAULT_CALENDAR_APP: CalendarApp = "google";
