// How pressing a class's seat count is, in words and a tone. Shared by the
// extension's Paper.nu panel and the apps, so both say the same thing.
import type { SeatsNotesSuccess } from "./types";

export type SeatTone = "open" | "filling" | "last" | "full";

export type SeatUrgency = {
  tone: SeatTone;
  // "3 seats left", "Full · 12 on the waitlist".
  headline: string;
  // "97 of 100 enrolled", when CAESAR gives both numbers.
  detail: string | null;
  // Share of the class that is taken, 0 to 1, for a meter.
  filled: number;
};

function count(text: string | null): number | null {
  if (text === null || text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

// Null when CAESAR gave no usable seat numbers.
export function seatUrgency(details: SeatsNotesSuccess): SeatUrgency | null {
  const capacity = count(details.classCapacity);
  const taken = count(details.enrollmentTotal);
  const open = count(details.availableSeats) ?? (capacity !== null && taken !== null ? capacity - taken : null);
  if (open === null) return null;
  const waiting = count(details.waitListTotal) ?? 0;
  const share = capacity && capacity > 0 ? Math.max(0, open) / capacity : null;
  const filled = share === null ? (open > 0 ? 0 : 1) : 1 - share;
  const detail = capacity !== null && taken !== null ? `${taken} of ${capacity} enrolled` : null;
  const seats = (n: number) => `${n} ${n === 1 ? "seat" : "seats"}`;

  if (open <= 0) {
    return { tone: "full", headline: waiting > 0 ? `Full · ${waiting} on the waitlist` : "Full", detail, filled: 1 };
  }
  if (open <= 5 || (share !== null && share <= 0.1)) {
    return { tone: "last", headline: `${seats(open)} left`, detail, filled };
  }
  if (share !== null && share <= 0.25) {
    return { tone: "filling", headline: `${seats(open)} left, filling up`, detail, filled };
  }
  return { tone: "open", headline: `${seats(open)} open`, detail, filled };
}

// "1 units" from CAESAR reads as "1 unit".
export function tidyUnits(units: string | undefined): string | undefined {
  return units?.replace(/^1(\.0+)? units$/i, "1 unit");
}
