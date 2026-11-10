import { normalizeText } from "../augmentations/enrollment-navigation/term-picker";

const TIME_ZONE = "America/Chicago";
const MONTHS = "January February March April May June July August September October November December".split(" ");
const CENTRAL_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", hourCycle: "h23"
});
const DISPLAY_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric",
  hour: "numeric", minute: "2-digit", timeZoneName: "short"
});

export type Appointment = { label: string; startsAt: number; endsAt: number | null };

function parseCentralTime(text: string): number | null {
  // PeopleSoft uses a line break between the date and time, so textContent
  // may join the year and hour without whitespace.
  const match = /^(\w+) (\d{1,2}), (\d{4})\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(normalizeText(text));
  if (!match) return null;
  const [, monthName, dayText, yearText, hourText, minuteText, meridiem] = match;
  const year = Number(yearText);
  const month = MONTHS.indexOf(monthName!) + 1;
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!month || hour < 1 || hour > 12 || minute > 59) return null;
  const hour24 = hour % 12 + (meridiem?.toUpperCase() === "PM" ? 12 : 0);
  // Check both Central offsets against the time-zone database. Reject an
  // impossible or ambiguous local time rather than exporting a wrong event.
  const candidates = [5, 6].map((offset) => Date.UTC(year, month - 1, day, hour24 + offset, minute))
    .filter((candidate) => {
      const parts = new Map(CENTRAL_CLOCK.formatToParts(candidate).map(({ type, value }) => [type, Number(value)]));
      return parts.get("year") === year && parts.get("month") === month && parts.get("day") === day &&
        parts.get("hour") === hour24 && parts.get("minute") === minute;
    });
  return candidates.length === 1 ? candidates[0]! : null;
}

export function readAppointments(root: ParentNode): Appointment[] {
  const appointments: Appointment[] = [];
  const starts = root.querySelectorAll('[id="STDNT_ENRL_A_VW$scroll$0"] span[id^="ENRL_START$"]');
  for (const start of starts) {
    const row = start.closest("tr");
    const startsAt = parseCentralTime(start.textContent ?? "");
    if (!row || startsAt === null) continue;
    const label = normalizeText(row.querySelector('[id^="NW_DERIVED_SS_DESCR50$"]')?.textContent ?? "") ||
      "Registration";
    const endsAt = parseCentralTime(row.querySelector('[id^="ENRL_END$"]')?.textContent ?? "");
    appointments.push({ label, startsAt, endsAt: endsAt !== null && endsAt > startsAt ? endsAt : null });
  }
  return appointments;
}

export function formatAppointmentTime(time: number): string {
  return DISPLAY_TIME.format(time);
}

export function googleCalendarUrl(appointment: Appointment): string {
  const end = Math.min(appointment.startsAt + 15 * 60_000, appointment.endsAt ?? Infinity);
  const dates = [appointment.startsAt, end].map((time) => new Date(time).toISOString().replace(/[-:]|\.\d{3}/g, ""));
  const url = new URL("https://calendar.google.com/calendar/r/eventedit");
  url.search = new URLSearchParams({
    action: "TEMPLATE",
    text: `CAESAR ${appointment.label} opens`,
    dates: dates.join("/"),
    stz: TIME_ZONE,
    etz: TIME_ZONE,
    details: "Open CAESAR to register for classes."
  }).toString();
  return url.href;
}
