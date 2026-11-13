// One term's classes in one list: what CAESAR has (enrolled, in the cart)
// together with what is only planned on this phone.
import { findTermCoursesByCatalog } from "@ext/content/augmentations/class-search/paper-data";
import { useEffect, useState } from "react";
import { useCart } from "./caesar";
import type { PaperSection } from "./catalog";
import { usePlanned } from "./schedule";

export type ClassState = "enrolled" | "cart" | "planned";

export type TermClass = {
  key: string;
  state: ClassState;
  subject: string;
  catalog: string;
  title: string;
  // Missing when CAESAR lists a section the catalog doesn't have.
  section: PaperSection | null;
  label: string;
  // CAESAR's class number, for classes CAESAR lists.
  classNumber?: string;
};

type CaesarClass = Omit<TermClass, "state" | "classNumber"> & { classNumber: string };

async function resolve(
  termId: string,
  entry: { classNumber: string; subject: string; catalog: string; sectionLabel: string; description?: string }
): Promise<CaesarClass> {
  const course = (await findTermCoursesByCatalog(termId, entry.subject, entry.catalog).catch(() => []))[0];
  // CAESAR writes "81", and an add made here writes "81-LEC".
  const [number, component] = entry.sectionLabel.split("-");
  const section =
    course?.sections.find((s) => s.section === entry.sectionLabel) ??
    course?.sections.find((s) => s.section === number && (!component || s.component === component)) ??
    null;
  return {
    key: `caesar-${entry.classNumber}`,
    classNumber: entry.classNumber,
    subject: entry.subject,
    catalog: course?.catalog ?? entry.catalog,
    title: section?.topic || course?.title || entry.description || "",
    section,
    label: entry.sectionLabel
  };
}

export function useTermClasses(termId: string | null): TermClass[] {
  const planned = usePlanned(termId);
  const term = useCart()?.byTerm[termId ?? ""];
  const [fromCaesar, setFromCaesar] = useState<CaesarClass[]>([]);

  useEffect(() => {
    let current = true;
    const entries = term ? [...Object.values(term.enrolled), ...Object.values(term.cart)] : [];
    void Promise.all(entries.map((entry) => resolve(termId!, entry))).then((list) => {
      if (current) setFromCaesar(list);
    });
    return () => {
      current = false;
    };
  }, [termId, term]);

  const out: TermClass[] = [];
  const seen = new Set<string>();
  for (const item of fromCaesar) {
    if (item.section) seen.add(item.section.section_id);
    out.push({ ...item, state: term?.enrolled[item.classNumber] ? "enrolled" : "cart" });
  }
  for (const entry of planned) {
    if (seen.has(entry.section.section_id)) continue;
    out.push({
      key: `plan-${entry.section.section_id}`,
      state: "planned",
      subject: entry.subject,
      catalog: entry.catalog,
      title: entry.section.topic || entry.title,
      section: entry.section,
      label: entry.section.section
    });
  }
  return out;
}
