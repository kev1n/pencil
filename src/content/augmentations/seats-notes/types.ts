export type CombinedSectionRow = {
  // CAESAR class number (e.g. "16045") — the parenthesized integer in the
  // CLASS_NAME cell.
  classNumber: string;
  // Subject + catalog + section as one display label (e.g. "COMP_SCI 346-0-1").
  // CAESAR's CLASS_NAME also embeds the component (LEC/LAB/DIS) on the next
  // line; we keep the subject/catalog/section line and surface component
  // separately.
  label: string;
  component: string | null; // "LEC", "LAB", "DIS", "SEM", …
  status: string | null; // "Open", "Closed", "Wait List"
  enrolled: string | null; // per-section enrolled total
  waitlist: string | null; // per-section waitlist total
};

export type SeatsNotesSuccess = {
  ok: true;
  requestedClassNumber: string;
  criteriaClassNumber: string | null;
  classCapacity: string | null;
  enrollmentTotal: string | null;
  availableSeats: string | null;
  waitListCapacity: string | null;
  waitListTotal: string | null;
  classAttributes: string | null;
  enrollmentRequirements: string | null;
  classNotes: string | null;
  // CAESAR shows "Combined Section Capacity" instead of "Class Capacity"
  // when the section is cross-listed with another (e.g. COMP_SCI 346 + COMP_ENG 346).
  // The totals are pooled across both sections, so we can't tell how many
  // seats belong to this specific section.
  isCombinedSection: boolean;
  // Per-section breakdown from CAESAR's Combined Section grid. Empty array
  // for non-combined sections.
  combinedSectionRows: CombinedSectionRow[];
};

export type SeatsNotesFailure = {
  ok: false;
  error: string;
};

export type SeatsNotesResult = SeatsNotesSuccess | SeatsNotesFailure;
