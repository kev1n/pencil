// Paper.nu's catalog suffix conventions:
//   "-0"     — no sequence/variant; user-facing form is just the number
//   "-1"/"-2"/"-3" — multi-quarter sequence parts (e.g. CHINESE 111-3)
//   "-SG"/"-CN"/etc — non-credit / online / study group variants
// CAESAR's catalog text field stores just the number portion; the suffix
// shows up in the result-group title (e.g. "COMP_SCI  111-0 - …").

export function formatCatalogForDisplay(catalog: string): string {
  return catalog.replace(/-0$/, "");
}

export function formatCourseIdForDisplay(subject: string, catalog: string): string {
  return `${subject} ${formatCatalogForDisplay(catalog)}`;
}

export function bareCatalogNumber(catalog: string): string {
  const dash = catalog.indexOf("-");
  return dash === -1 ? catalog : catalog.slice(0, dash);
}
