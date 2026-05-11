import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/prereqs-parsed.json";
import { parsePrereq } from "./parser";
import type { PrereqRecord } from "./types";

const RECORDS = fixture as PrereqRecord[];

const KNOWN_DIFFS = new Set<string>([
  // Document each entry with a one-line reason.
]);

function parentSubjectFromId(id: string): string | null {
  const m = /^([A-Z][A-Z_]+)/.exec(id);
  return m ? m[1] : null;
}

describe("prereqs parser parity", () => {
  let pass = 0;
  let fail = 0;
  const diffs: Array<{ id: string; expected: unknown; actual: unknown }> = [];

  for (const rec of RECORDS) {
    const parent = parentSubjectFromId(rec.id);
    it.concurrent(`parses ${rec.id}`, () => {
      const { parsed, warnings } = parsePrereq(rec.raw, parent);
      const actualParsed = JSON.parse(JSON.stringify(parsed));
      const expectedParsed = JSON.parse(JSON.stringify(rec.parsed));
      const matches =
        JSON.stringify(actualParsed) === JSON.stringify(expectedParsed) &&
        JSON.stringify(warnings) === JSON.stringify(rec.warnings);
      if (matches) {
        pass++;
      } else {
        fail++;
        diffs.push({ id: rec.id, expected: { parsed: rec.parsed, warnings: rec.warnings }, actual: { parsed, warnings } });
      }
      if (!KNOWN_DIFFS.has(rec.id)) {
        expect({ parsed: actualParsed, warnings }).toEqual({ parsed: expectedParsed, warnings: rec.warnings });
      }
    });
  }

  it("prints parity summary", () => {
    const total = RECORDS.length;
    const knownDiffs = KNOWN_DIFFS.size;
    const pct = total > 0 ? ((pass / total) * 100).toFixed(2) : "0";
    console.log(
      `\n[parity] pass=${pass} fail=${fail} total=${total} (${pct}%)  KNOWN_DIFFS=${knownDiffs}`
    );
    if (diffs.length > 0 && diffs.length <= 25) {
      console.log("[parity] first diffs:", diffs.slice(0, 25).map((d) => d.id));
    }
    expect(true).toBe(true);
  });
});
