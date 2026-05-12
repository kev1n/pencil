import { describe, expect, it } from "vitest";

import type { LookupClassResponse } from "../../../../shared/messages";
import { toSeatsNotesResult } from "../parser";

// Trimmed-down replica of CAESAR's combined-section detail page (subset of
// the real response — only the IDs and labels our parser reads).
function makeDetailHtml(opts: {
  classCapacity?: string;
  enrollmentTotal?: string;
  rows: Array<{ name: string; component: string; classNumber: string; enrolled: string; waitlist: string; status: string }>;
}): string {
  const rowFragments = opts.rows
    .map(
      (row, i) => `
<span id='CLASS_NAME$${i}'>${row.name}\n\n${row.component} (${row.classNumber})</span>
<div id='win0divSTATUS$${i}'><img src="x" alt="${row.status}"></div>
<span id='DERIVED_CLS_CMB_ENRL_TOT$${i}'>${row.enrolled}</span>
<span id='DERIVED_CLS_CMB_WAIT_TOT$${i}'>${row.waitlist}</span>
`
    )
    .join("");
  return `
<span id='SSR_CLS_DTL_WRK_ENRL_CAPlbl'>Combined Section Capacity</span>
<span id='SSR_CLS_DTL_WRK_ENRL_CAP'>${opts.classCapacity ?? "60"}</span>
<span id='SSR_CLS_DTL_WRK_ENRL_TOT'>${opts.enrollmentTotal ?? "20"}</span>
${rowFragments}
`;
}

function makeResponse(html: string): LookupClassResponse {
  return {
    ok: true,
    requestedClassNumber: "16045",
    criteriaClassNumber: "16045",
    firstResultClassNumber: "16045",
    detailPageId: "SSR_CLSRCH_DTL",
    detailResponseText: html
  } as LookupClassResponse;
}

describe("seats-notes parser — combined section", () => {
  it("flags combined section + extracts per-section grid rows", () => {
    const html = makeDetailHtml({
      rows: [
        { name: "COMP_ENG 346-0-1", component: "LEC", classNumber: "12187", enrolled: "0", waitlist: "0", status: "Open" },
        { name: "COMP_SCI 346-0-1", component: "LEC", classNumber: "16045", enrolled: "20", waitlist: "0", status: "Closed" }
      ]
    });
    const result = toSeatsNotesResult(makeResponse(html));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isCombinedSection).toBe(true);
    expect(result.combinedSectionRows).toHaveLength(2);
    expect(result.combinedSectionRows[0]).toEqual({
      classNumber: "12187",
      label: "COMP_ENG 346-0-1",
      component: "LEC",
      status: "Open",
      enrolled: "0",
      waitlist: "0"
    });
    expect(result.combinedSectionRows[1]).toMatchObject({
      classNumber: "16045",
      label: "COMP_SCI 346-0-1",
      enrolled: "20",
      status: "Closed"
    });
  });

  it("returns empty combinedSectionRows when not a combined section", () => {
    const html = `
<span id='SSR_CLS_DTL_WRK_ENRL_CAPlbl'>Class Capacity</span>
<span id='SSR_CLS_DTL_WRK_ENRL_CAP'>30</span>
<span id='SSR_CLS_DTL_WRK_ENRL_TOT'>10</span>
`;
    const result = toSeatsNotesResult(makeResponse(html));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isCombinedSection).toBe(false);
    expect(result.combinedSectionRows).toEqual([]);
  });
});
