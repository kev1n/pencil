import { logQuiet } from "../../../shared/log";
import { fetchTextViaBackground } from "../../remote-fetch";

const DATA_URL = "https://api-legacy.dilanxd.com/paper/data";
const SUBJECTS_URL = "https://api-legacy.dilanxd.com/paper/subjects";
const PLAN_URL = "https://cdn.dil.sh/paper-data/plan.json";
const TERM_URL = (termId: string) => `https://cdn.dil.sh/paper-data/${termId}.json`;

const STORAGE_PREFIX = "better-caesar:paper:";
const META_KEY = `${STORAGE_PREFIX}meta:v1`;
const SUBJECTS_KEY = `${STORAGE_PREFIX}subjects:v1`;
const PLAN_KEY = `${STORAGE_PREFIX}plan:v1`;
// v2: catalog now comes from per-term `n` (user-facing "111-3") instead of
// `i` (CAESAR's internal padded id "002333").
const CURRENT_TERM_CACHE_VERSION = 2;
const TERM_KEY = (termId: string) =>
  `${STORAGE_PREFIX}term:v${CURRENT_TERM_CACHE_VERSION}:${termId}`;
const PRUNE_VERSION_KEY = `${STORAGE_PREFIX}pruned:v1`;

export type TermSummary = {
  id: string;
  name: string;
  start?: string;
  end?: string;
};

export type DataMapInfo = {
  latest: string;
  subjects: string;
  plan: string;
  terms: Record<string, { name: string; updated: string; start?: string; end?: string }>;
};

export type SubjectInfo = {
  symbol: string;
  display: string;
  color?: string;
  schools?: string[];
};

type RawSubjects = {
  subjects: Record<string, { c?: string; d: string; s?: string[] }>;
};

export type PaperCourse = {
  id: string; // e.g. "COMP_SCI 111-0"
  subject: string;
  catalog: string; // e.g. "111-0"
  name: string;
  units: string;
  description?: string;
  prereqs?: string;
  distros?: string;
  disciplines?: string;
  school?: string;
  terms?: string[];
  repeatable?: boolean;
  topics?: Array<[string, string[]]>;
};

type RawPlanCourse = {
  i: string;
  n: string;
  u: string;
  r?: boolean;
  d?: string;
  p?: string;
  s?: string;
  f?: string;
  c?: string;
  t?: string[];
  o?: Array<[string, string[]]>;
};

type RawPlanData = {
  courses: RawPlanCourse[];
  legacy?: RawPlanCourse[];
};

export type PaperSection = {
  section_id: string;
  course_id: string;
  subject: string;
  catalog: string; // e.g. "111-0"
  number?: string; // sometimes shorter form, e.g. "111"
  title: string;
  topic?: string;
  section: string; // e.g. "1", "01", "20"
  component: string; // LEC, DIS, LAB, SEM, etc.
  meeting_days: (string | null)[];
  start_time: ({ h: number; m: number } | null)[];
  end_time: ({ h: number; m: number } | null)[];
  room: (string | null)[];
  start_date?: string;
  end_date?: string;
  capacity?: string;
  enrl_req?: string;
  descs?: Array<[string, string]>;
  distros?: string;
  disciplines?: string;
  school?: string;
  instructors?: Array<{
    name?: string;
    phone?: string;
    campus_address?: string;
    office_hours?: string;
    bio?: string;
    url?: string;
  }>;
};

export type PaperTermCourse = {
  course_id: string;
  subject: string;
  catalog: string;
  number?: string;
  title: string;
  school?: string;
  sections: PaperSection[];
};

type RawTermSection = {
  i: string;
  r?: Array<{ n?: string; p?: string; a?: string; o?: string; b?: string; u?: string }>;
  t: string;
  k?: string;
  u: string;
  n?: string;
  s: string;
  m: (string | null)[];
  x: ({ h: number; m: number } | null)[];
  y: ({ h: number; m: number } | null)[];
  l: (string | null)[];
  d?: string;
  e?: string;
  c: string;
  a?: string;
  q?: string;
  p?: Array<[string, string]>;
  o?: string;
  f?: string;
};

type RawTermCourse = {
  i: string;
  c?: string;
  t: string;
  u: string;
  n?: string;
  s?: RawTermSection[];
};

type CachedSubjects = {
  updated: string;
  data: Record<string, SubjectInfo>;
};

type CachedPlan = {
  updated: string;
  courses: PaperCourse[];
};

type CachedTerm = {
  termId: string;
  updated: string;
  cachedAt: number;
  courses: PaperTermCourse[];
};

let infoPromise: Promise<DataMapInfo> | null = null;
let subjectsPromise: Promise<Record<string, SubjectInfo>> | null = null;
let planPromise: Promise<PaperCourse[]> | null = null;
const termPromises = new Map<string, Promise<PaperTermCourse[]>>();

export async function getDataMapInfo(): Promise<DataMapInfo> {
  if (infoPromise) return infoPromise;
  infoPromise = (async () => {
    const cached = await readCache<{ data: DataMapInfo; cachedAt: number }>(META_KEY);
    // Bust meta cache after 6 hours so we pick up new term updates without
    // requiring a popup-driven cache wipe.
    if (cached && Date.now() - cached.cachedAt < 6 * 60 * 60 * 1000) {
      return cached.data;
    }
    const text = await fetchTextViaBackground(DATA_URL);
    const data = JSON.parse(text) as DataMapInfo;
    await writeCache(META_KEY, { data, cachedAt: Date.now() });
    return data;
  })();
  return infoPromise;
}

export async function getSubjects(): Promise<Record<string, SubjectInfo>> {
  if (subjectsPromise) return subjectsPromise;
  subjectsPromise = (async () => {
    const info = await getDataMapInfo();
    const cached = await readCache<CachedSubjects>(SUBJECTS_KEY);
    if (cached && cached.updated === info.subjects) {
      return cached.data;
    }
    const text = await fetchTextViaBackground(SUBJECTS_URL);
    const raw = JSON.parse(text) as RawSubjects;
    const map: Record<string, SubjectInfo> = {};
    for (const symbol of Object.keys(raw.subjects)) {
      const entry = raw.subjects[symbol];
      map[symbol] = {
        symbol,
        display: entry.d,
        color: entry.c,
        schools: entry.s
      };
    }
    await writeCache(SUBJECTS_KEY, { updated: info.subjects, data: map } satisfies CachedSubjects);
    return map;
  })();
  return subjectsPromise;
}

export async function getPlanCourses(): Promise<PaperCourse[]> {
  if (planPromise) return planPromise;
  planPromise = (async () => {
    const info = await getDataMapInfo();
    const cached = await readCache<CachedPlan>(PLAN_KEY);
    if (cached && cached.updated === info.plan) {
      return cached.courses;
    }
    const text = await fetchTextViaBackground(PLAN_URL);
    const raw = JSON.parse(text) as RawPlanData;
    const courses: PaperCourse[] = [];
    const all = [...(raw.courses ?? []), ...(raw.legacy ?? [])];
    for (const c of all) {
      const split = splitCourseId(c.i);
      if (!split) continue;
      courses.push({
        id: c.i,
        subject: split.subject,
        catalog: split.catalog,
        name: c.n,
        units: c.u,
        description: c.d,
        prereqs: c.p,
        distros: c.s,
        disciplines: c.f,
        school: c.c,
        terms: c.t,
        repeatable: c.r,
        topics: c.o
      });
    }
    await writeCache(PLAN_KEY, { updated: info.plan, courses } satisfies CachedPlan);
    return courses;
  })();
  return planPromise;
}

export async function getTermCourses(termId: string): Promise<PaperTermCourse[]> {
  const existing = termPromises.get(termId);
  if (existing) return existing;
  const job = (async () => {
    const info = await getDataMapInfo();
    const updated = info.terms[termId]?.updated ?? "";
    const cached = await readCache<CachedTerm>(TERM_KEY(termId));
    if (cached && cached.termId === termId && cached.updated === updated) {
      return cached.courses;
    }
    const text = await fetchTextViaBackground(TERM_URL(termId));
    const raw = JSON.parse(text) as RawTermCourse[];
    const courses: PaperTermCourse[] = raw.map((rc) => {
      // CAESAR's per-term JSON stores two course-level identifiers: `i` is
      // the internal padded number (e.g. "002333") and `n` is the
      // user-facing catalog ("111-3"). paper.nu displays courses as
      // `subject n`; we follow suit.
      const userFacingCatalog = rc.n ?? rc.i;
      return ({
      course_id: `${rc.u};${userFacingCatalog}`,
      subject: rc.u,
      catalog: userFacingCatalog,
      number: rc.n,
      title: rc.t,
      school: rc.c,
      sections: (rc.s ?? []).map((rs) => ({
        section_id: `${rs.u};${rs.i}`,
        course_id: `${rc.u};${userFacingCatalog}`,
        subject: rs.u,
        catalog: userFacingCatalog,
        number: rs.n ?? userFacingCatalog,
        title: rs.t,
        topic: rs.k,
        section: rs.s,
        component: rs.c,
        meeting_days: rs.m ?? [],
        start_time: rs.x ?? [],
        end_time: rs.y ?? [],
        room: rs.l ?? [],
        start_date: rs.d,
        end_date: rs.e,
        capacity: rs.a,
        enrl_req: rs.q,
        descs: rs.p,
        distros: rs.o,
        disciplines: rs.f,
        school: rc.c,
        instructors: rs.r?.map((r) => ({
          name: r.n,
          phone: r.p,
          campus_address: r.a,
          office_hours: r.o,
          bio: r.b,
          url: r.u
        }))
      }))
    });
    });
    await writeCache(TERM_KEY(termId), {
      termId,
      updated,
      cachedAt: Date.now(),
      courses
    } satisfies CachedTerm);
    return courses;
  })();
  termPromises.set(termId, job);
  job.catch(() => termPromises.delete(termId));
  return job;
}

// Force-refresh a term: drops the in-memory promise, the meta cache (so
// `info.terms[termId].updated` re-reads fresh), and the term-storage
// blob, then re-calls getTermCourses. Used by paper-combos when a
// section_id in paper.nu's data_schedule is missing from our cache —
// paper.nu shipped new sections and our `info.terms.updated` window
// hasn't ticked over yet. Cheap (one network round-trip), and the
// refreshed cache benefits every other augmentation too.
export async function refreshTermCourses(termId: string): Promise<PaperTermCourse[]> {
  termPromises.delete(termId);
  infoPromise = null;
  await chrome.storage.local.remove([META_KEY, TERM_KEY(termId)]);
  return getTermCourses(termId);
}

// Gated behind a sentinel so we don't pay `chrome.storage.local.get(null)`
// (which returns the full ~5MB plan blob) on every page load.
export async function pruneStalePaperCaches(): Promise<void> {
  try {
    const sentinel = (await chrome.storage.local.get(PRUNE_VERSION_KEY)) as Record<string, unknown>;
    if (sentinel[PRUNE_VERSION_KEY] === CURRENT_TERM_CACHE_VERSION) return;

    const all = await chrome.storage.local.get(null);
    const stale = Object.keys(all).filter((k) => {
      if (!k.startsWith(STORAGE_PREFIX)) return false;
      const m = /:term:v(\d+):/.exec(k);
      return m ? Number(m[1]) < CURRENT_TERM_CACHE_VERSION : false;
    });
    if (stale.length > 0) await chrome.storage.local.remove(stale);
    await chrome.storage.local.set({ [PRUNE_VERSION_KEY]: CURRENT_TERM_CACHE_VERSION });
  } catch (err) {
    // Opportunistic — not worth surfacing to the user.
    logQuiet("paper-data.prune", err);
  }
}

export function listTerms(info: DataMapInfo): TermSummary[] {
  return Object.entries(info.terms)
    .map(([id, t]) => ({ id, name: t.name, start: t.start, end: t.end }))
    .sort((a, b) => Number(b.id) - Number(a.id));
}

export function splitCourseId(id: string): { subject: string; catalog: string } | null {
  const idx = id.indexOf(" ");
  if (idx <= 0) return null;
  return { subject: id.slice(0, idx), catalog: id.slice(idx + 1) };
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const result = (await chrome.storage.local.get(key)) as Record<string, unknown>;
    const value = result[key];
    return (value ?? null) as T | null;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (err) {
    // Ignore storage errors (e.g. quota exceeded). The data layer falls back
    // to live fetches if persistence fails.
    logQuiet("paper-data.writeCache", err);
  }
}
