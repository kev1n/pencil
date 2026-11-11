// Course renumberings and department renames. The prereq canonicalizer
// maps old ids forward to the current one; the CTEC lookup maps a current
// course back to its old ids, because CAESAR keeps evaluations filed
// under the number the course had when it was taught.
//
// Ids are paper.nu-shaped: "SUBJECT NUMBER-SECTION" ("COMP_SCI 214-0").

// Renumbered courses, old id -> current id. Sourced 2026-11-10 from
// department pages, archived catalog editions and registrar text; each
// line group names its evidence.
const COURSE_ALIASES: Readonly<Record<string, string>> = {
  // Organic chemistry: 210 -> 215 (Fall 2021), majors' 212 -> 217 and
  // labs 232 -> 237 (Fall 2023, catalog credit exclusions).
  "CHEM 210-1": "CHEM 215-1",
  "CHEM 210-2": "CHEM 215-2",
  "CHEM 210-3": "CHEM 215-3",
  "CHEM 210-A": "CHEM 215-A",
  "CHEM 210-B": "CHEM 215-B",
  "CHEM 210-C": "CHEM 215-C",
  "CHEM 212-1": "CHEM 217-1",
  "CHEM 212-2": "CHEM 217-2",
  "CHEM 212-3": "CHEM 217-3",
  "CHEM 232-1": "CHEM 237-1",
  "CHEM 232-2": "CHEM 237-2",
  // Biology core, 2021 (catalog "credit not allowed for both" pairs).
  "BIOL_SCI 215-0": "BIOL_SCI 201-0",
  "BIOL_SCI 215-CN": "BIOL_SCI 201-CN",
  "BIOL_SCI 219-0": "BIOL_SCI 202-0",
  "BIOL_SCI 219-CN": "BIOL_SCI 202-CN",
  "BIOL_SCI 217-0": "BIOL_SCI 310-0",
  "BIOL_SCI 220-0": "BIOL_SCI 233-0",
  "BIOL_SCI 221-0": "BIOL_SCI 232-0",
  "BIOL_SCI 222-0": "BIOL_SCI 234-0",
  "BIOL_SCI 308-0": "BIOL_SCI 301-0",
  // Calculus renumbering, Fall 2019 (math department calculus guide).
  "MATH 212-0": "MATH 218-1",
  "MATH 213-0": "MATH 218-2",
  "MATH 214-0": "MATH 218-3",
  "MATH 220-0": "MATH 220-1",
  "MATH 224-0": "MATH 220-2",
  "MATH 230-0": "MATH 230-1",
  "MATH 234-0": "MATH 230-2",
  // Earth and environmental sciences, 2025-26 (department descriptions).
  "ENVR_SCI 201-0": "EARTH 210-0",
  "ENVR_SCI 202-0": "EARTH 212-0",
  "ENVR_SCI 203-0": "EARTH 213-0",
  "EARTH 201-0": "EARTH 214-0",
  "EARTH 202-0": "EARTH 215-0",
  "EARTH 203-0": "EARTH 210-0",
  // Psychology, September 2025 (department "(formerly ...)" list).
  "PSYCH 205-0": "PSYCH 301-0",
  "PSYCH 204-0": "PSYCH 213-0",
  "PSYCH 212-0": "PSYCH 221-0",
  "PSYCH 218-0": "PSYCH 244-0",
  "PSYCH 245-0": "PSYCH 345-0",
  "PSYCH 314-0": "PSYCH 350-0",
  "PSYCH 316-0": "PSYCH 330-0",
  "PSYCH 335-0": "PSYCH 373-0",
  "PSYCH 357-0": "PSYCH 390-0",
  "PSYCH 358-0": "PSYCH 391-0",
  "PSYCH 359-0": "PSYCH 392-0",
  "PSYCH 361-0": "PSYCH 328-0",
  "PSYCH 363-0": "PSYCH 378-0",
  "PSYCH 376-0": "PSYCH 308-0",
  "PSYCH 377-0": "PSYCH 367-0",
  "ASTRON 220-0": "ASTRON 220-1",
  "ASTRON 425-0": "ASTRON 325-0",
  // Computer science: 214 -> 208 and 111 -> 180 (Fall 2026, department
  // course pages), 325-1 -> 325-0 (2023-24), old EECS 317 -> 217.
  "COMP_SCI 214-0": "COMP_SCI 208-0",
  "COMP_SCI 111-0": "COMP_SCI 180-0",
  "COMP_SCI 325-1": "COMP_SCI 325-0",
  "EECS 317-0": "COMP_SCI 217-0",
  "IEMS 202-0": "IEMS 302-0",
  // Spanish, 2022-23 (archived catalog editions).
  "SPANISH 197-0": "SPANISH 200-0",
  "SPANISH 207-0": "SPANISH 200-0",
  "SPANISH 203-0": "SPANISH 201-0",
  "SPANISH 220-0": "SPANISH 204-0",
  // Evening French, Fall 2021 ("formerly FRENCH 101-B").
  "FRENCH 101-A": "FRENCH 111-A",
  "FRENCH 101-B": "FRENCH 111-B",
  "FRENCH 101-C": "FRENCH 111-C",
  "FRENCH 102-A": "FRENCH 121-A",
  "FRENCH 102-B": "FRENCH 121-B",
  "FRENCH 102-C": "FRENCH 121-C",
  "PORT 121-3": "PORT 115-2",
  "ARABIC 311-2": "ARABIC 211-3",
  "GBL_HLTH 301-0": "GBL_HLTH 201-0",
  "COMP_LIT 210-0": "ENGLISH 220-0",
  // Theatre intro sequence, 2024-25 (major requirement tables), and the
  // 2018-19 pattern-drafting renumber.
  "THEATRE 140-1": "THEATRE 160-1",
  "THEATRE 140-2": "THEATRE 160-2",
  "THEATRE 120-0": "THEATRE 160-3",
  "THEATRE 364-1": "THEATRE 328-1",
  "THEATRE 364-2": "THEATRE 328-2",
  "THEATRE 364-3": "THEATRE 328-3",
  "SESP 195-0": "SESP 195-1",
  "MUS_TECH 259-0": "MUS_TECH 300-0",
  "MUS_COMP 111-0": "MUS_COMP 211-0"
};

// Departments renamed with their numbers intact: African American
// Studies -> Black Studies (Fall 2023), Gender & Sexuality Studies
// GNDR_ST -> GSS (Fall 2026).
const SUBJECT_RENAMES: Readonly<Record<string, string>> = {
  AF_AM_ST: "BLK_ST",
  GNDR_ST: "GSS"
};

/** Maps a retired course id to its current number; other ids pass through. */
export function aliasCourseId(id: string): string {
  const direct = COURSE_ALIASES[id];
  if (direct) return direct;
  const space = id.indexOf(" ");
  const renamed = SUBJECT_RENAMES[id.slice(0, space)];
  return renamed ? `${renamed}${id.slice(space)}` : id;
}

const FORMER_IDS = new Map<string, string[]>();
for (const [former, current] of Object.entries(COURSE_ALIASES)) {
  FORMER_IDS.set(current, [...(FORMER_IDS.get(current) ?? []), former]);
}
const FORMER_SUBJECTS = new Map(
  Object.entries(SUBJECT_RENAMES).map(([former, current]) => [current, former])
);

/** Every id a current course used to carry; empty when it never changed. */
export function formerCourseIds(id: string): string[] {
  const former = [...(FORMER_IDS.get(id) ?? [])];
  const space = id.indexOf(" ");
  const oldSubject = FORMER_SUBJECTS.get(id.slice(0, space));
  if (oldSubject) former.push(`${oldSubject}${id.slice(space)}`);
  return former;
}
