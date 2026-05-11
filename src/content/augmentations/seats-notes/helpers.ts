// Pure helpers shared across the seats-notes augmentation. The grid-level
// `queryTargetTables` from the pre-Wave-4 codebase is gone — the runtime now
// finds rows directly via `gridRowSelector`.

export function extractClassNumber(rawText: string): string | null {
  const match = rawText.match(/\((\d{4,10})\)/);
  if (match) return match[1];
  const digits = rawText.replace(/\D+/g, "");
  return digits.length >= 4 ? digits : null;
}

// Discussion / lab sub-rows render the class label inside a
// <span class="PSHYPERLINKDISABLED"> instead of an <a> because the row isn't
// independently selectable. We still inject Seats/Notes cells so the row's
// border and alternating background stay continuous, but the user-facing
// load button is shorter ("Load seats") since notes are typically empty for
// these sub-rows.
export function isDisabledClassRow(row: Element): boolean {
  return (
    row.querySelector(
      "span.PSHYPERLINKDISABLED[id^='P_CLASS_NAME$span$'], span.PSHYPERLINKDISABLED[id^='E_CLASS_NAME$span$']"
    ) !== null
  );
}

// Parses the CAESAR cart row label (e.g. "COMP_SCI 211-0 (12345)") into
// the subject + bare catalog. Both are best-effort — when either is missing
// the lookup falls back to UGRD-then-TGS inside `buildCareerCandidates`.
export function extractCourseIdentifier(text: string): {
  subject?: string;
  catalog?: string;
} {
  const subject = text.match(/\b([A-Z][A-Z_]+[A-Z])\b/)?.[1];
  const catalog = text.match(/\b(\d{3})-\d\b/)?.[1];
  return { subject, catalog };
}
