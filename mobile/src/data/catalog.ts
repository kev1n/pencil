// The course catalog: Paper.nu's published data, loaded and searched with
// the extension's own code.
import { applyFilters, buildCatalogIndex } from "@ext/content/augmentations/class-search/filter";
import {
  getDataMapInfo,
  getPlanCourses,
  getSubjects,
  getTermCourseByKey,
  getTermCourses,
  listTerms,
  type PaperCourse,
  type PaperSection,
  type PaperTermCourse,
  type SubjectInfo,
  type TermSummary
} from "@ext/content/augmentations/class-search/paper-data";
import type { ResultRow } from "@ext/content/augmentations/class-search/types";
import { createStore } from "./store";

export type { PaperCourse, PaperSection, PaperTermCourse, ResultRow, SubjectInfo, TermSummary };

export type Terms = { terms: TermSummary[]; latest: string };

const TERM_KEY = "pencil.term";
export const selectedTerm = createStore<string | null>(localStorage.getItem(TERM_KEY));

export function selectTerm(termId: string): void {
  localStorage.setItem(TERM_KEY, termId);
  selectedTerm.set(termId);
}

let termsPromise: Promise<Terms> | null = null;
export function loadTerms(): Promise<Terms> {
  termsPromise ??= getDataMapInfo()
    .then((info) => {
      const terms = listTerms(info);
      const latest = info.latest in info.terms ? info.latest : (terms[0]?.id ?? "");
      if (!selectedTerm.get() || !(selectedTerm.get()! in info.terms)) selectTerm(latest);
      return { terms, latest };
    })
    .catch((error) => {
      termsPromise = null;
      throw error;
    });
  return termsPromise;
}

type Catalog = { index: Map<string, PaperCourse>; subjects: Record<string, SubjectInfo> };
let catalogPromise: Promise<Catalog> | null = null;
function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= Promise.all([getPlanCourses(), getSubjects()])
    .then(([courses, subjects]) => ({ index: buildCatalogIndex(courses), subjects }))
    .catch((error) => {
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
}

// Downloads the catalog and the term's sections if they are not saved yet.
export async function warmCatalog(termId: string): Promise<void> {
  await Promise.all([loadCatalog(), getTermCourses(termId)]);
}

export async function searchCourses(termId: string, query: string): Promise<ResultRow[]> {
  const [catalog, termCourses] = await Promise.all([loadCatalog(), getTermCourses(termId)]);
  return applyFilters(
    termCourses,
    catalog.index,
    catalog.subjects,
    { termId, query, disciplines: new Set() },
    "UGRD"
  );
}

export type CourseDetail = {
  course: PaperTermCourse | null;
  info: PaperCourse | null;
  subject: SubjectInfo | null;
};

export async function loadCourse(termId: string, subject: string, catalogNumber: string): Promise<CourseDetail> {
  const [catalog, course] = await Promise.all([
    loadCatalog(),
    getTermCourseByKey(termId, subject, catalogNumber)
  ]);
  return {
    course,
    info: catalog.index.get(`${subject} ${catalogNumber}`) ?? null,
    subject: catalog.subjects[subject] ?? null
  };
}

export async function subjectName(symbol: string): Promise<string> {
  return (await loadCatalog()).subjects[symbol]?.display ?? symbol;
}

// Course names for a list of "SUBJECT catalog" ids, for screens that only
// have CAESAR's bare identifiers.
export async function courseNames(ids: string[]): Promise<Record<string, string>> {
  const { index } = await loadCatalog();
  const out: Record<string, string> = {};
  for (const id of ids) {
    const name = index.get(id)?.name;
    if (name) out[id] = name;
  }
  return out;
}

// The subjects with classes in a term, for browsing without typing.
export async function termSubjects(termId: string): Promise<Array<{ symbol: string; name: string; count: number }>> {
  const [catalog, termCourses] = await Promise.all([loadCatalog(), getTermCourses(termId)]);
  const counts = new Map<string, number>();
  for (const course of termCourses) {
    if (course.sections.length > 0) counts.set(course.subject, (counts.get(course.subject) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([symbol, count]) => ({ symbol, name: catalog.subjects[symbol]?.display ?? symbol, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
