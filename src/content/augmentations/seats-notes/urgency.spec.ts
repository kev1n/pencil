import { describe, expect, it } from "vitest";

import type { SeatsNotesSuccess } from "./types";
import { seatUrgency, tidyUnits } from "./urgency";

function details(seats: {
  capacity?: string | null;
  taken?: string | null;
  open?: string | null;
  waiting?: string | null;
}): SeatsNotesSuccess {
  return {
    ok: true,
    requestedClassNumber: "12345",
    criteriaClassNumber: "12345",
    classCapacity: seats.capacity ?? null,
    enrollmentTotal: seats.taken ?? null,
    availableSeats: seats.open ?? null,
    waitListCapacity: null,
    waitListTotal: seats.waiting ?? null,
    classAttributes: null,
    enrollmentRequirements: null,
    classNotes: null,
    isCombinedSection: false,
    combinedSectionRows: []
  };
}

describe("seatUrgency", () => {
  it("calls a class with plenty of room open", () => {
    expect(seatUrgency(details({ capacity: "100", taken: "40", open: "60" }))).toEqual({
      tone: "open",
      headline: "60 seats open",
      detail: "40 of 100 enrolled",
      filled: 0.4
    });
  });

  it("works out open seats from capacity and enrolled when CAESAR leaves them out", () => {
    const urgency = seatUrgency(details({ capacity: "30", taken: "10" }));
    expect(urgency?.headline).toBe("20 seats open");
  });

  it("turns to filling at a quarter of the class left", () => {
    expect(seatUrgency(details({ capacity: "100", taken: "74", open: "26" }))?.tone).toBe("open");
    const quarter = seatUrgency(details({ capacity: "100", taken: "75", open: "25" }));
    expect(quarter?.tone).toBe("filling");
    expect(quarter?.headline).toBe("25 seats left, filling up");
  });

  it("calls five or fewer seats the last ones, whatever the class size", () => {
    expect(seatUrgency(details({ capacity: "20", taken: "15", open: "5" }))).toMatchObject({ tone: "last", headline: "5 seats left" });
    expect(seatUrgency(details({ capacity: "20", taken: "14", open: "6" }))?.tone).toBe("open");
    expect(seatUrgency(details({ capacity: "20", taken: "19", open: "1" }))?.headline).toBe("1 seat left");
  });

  it("calls a tenth of a big class the last seats", () => {
    expect(seatUrgency(details({ capacity: "200", taken: "180", open: "20" }))?.tone).toBe("last");
    expect(seatUrgency(details({ capacity: "200", taken: "179", open: "21" }))?.tone).toBe("filling");
  });

  it("names the waitlist on a full class", () => {
    expect(seatUrgency(details({ capacity: "50", taken: "50", open: "0", waiting: "12" }))).toEqual({
      tone: "full",
      headline: "Full · 12 on the waitlist",
      detail: "50 of 50 enrolled",
      filled: 1
    });
  });

  it("says just Full when nobody is waiting", () => {
    expect(seatUrgency(details({ capacity: "50", taken: "50", open: "0", waiting: "0" }))?.headline).toBe("Full");
    expect(seatUrgency(details({ capacity: "50", taken: "50", open: "0" }))?.headline).toBe("Full");
  });

  it("falls back on the seat count alone without a capacity", () => {
    expect(seatUrgency(details({ open: "8" }))).toEqual({ tone: "open", headline: "8 seats open", detail: null, filled: 0 });
    expect(seatUrgency(details({ open: "3" }))?.tone).toBe("last");
    expect(seatUrgency(details({ open: "0" }))).toMatchObject({ tone: "full", filled: 1 });
  });

  it("gives nothing when CAESAR gave no seat numbers", () => {
    expect(seatUrgency(details({}))).toBeNull();
    expect(seatUrgency(details({ capacity: "  ", taken: "", open: "" }))).toBeNull();
  });
});

describe("tidyUnits", () => {
  it("makes one unit singular", () => {
    expect(tidyUnits("1 units")).toBe("1 unit");
    expect(tidyUnits("1.00 Units")).toBe("1 unit");
  });

  it("leaves other counts and missing units alone", () => {
    expect(tidyUnits("0.5 units")).toBe("0.5 units");
    expect(tidyUnits("1.5 units")).toBe("1.5 units");
    expect(tidyUnits(undefined)).toBeUndefined();
  });
});
