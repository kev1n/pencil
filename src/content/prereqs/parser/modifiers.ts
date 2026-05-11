import type { PrereqMinGrade, PrereqNode, PrereqConcurrent } from "../types";
import { GRADE_RE } from "./regex";

export type ModifierGrade = { kind: "grade"; minGrade: string };
export type ModifierEquivalent = { kind: "equivalent" };
export type ModifierConcurrent = { kind: "concurrent"; concurrent: PrereqConcurrent };
export type Modifier = ModifierGrade | ModifierEquivalent | ModifierConcurrent;

export function classifyModifier(inner: string): Modifier | null {
  const s = inner.trim();
  const sl = s.toLowerCase();
  const m = GRADE_RE.exec(s);
  if (m && /^[A-D][+\-]?\s*or\s+(?:better|higher|above)$/i.test(s)) {
    return { kind: "grade", minGrade: m[1].toUpperCase() };
  }
  if (/^or\s+equivalent$/.test(sl)) {
    return { kind: "equivalent" };
  }
  if (sl.includes("concurrent registration") && (sl.includes("acceptable") || sl.includes("allowed"))) {
    return { kind: "concurrent", concurrent: "allowed" };
  }
  if (sl.includes("may be taken concurrently") || sl.includes("can be taken concurrently")) {
    return { kind: "concurrent", concurrent: "allowed" };
  }
  // Python: "taken concurrently" in sl or "concurrent" in sl and "register" in sl
  // Python `and` binds tighter than `or`, so this is:
  //   "taken concurrently" in sl OR ("concurrent" in sl AND "register" in sl)
  if (sl.includes("taken concurrently") || (sl.includes("concurrent") && sl.includes("register"))) {
    return { kind: "concurrent", concurrent: "required" };
  }
  return null;
}

export function extractParenModifiers(text: string): [string, Modifier[]] {
  const mods: Modifier[] = [];
  const out: string[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text[i] === "(") {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (text[j] === "(") depth++;
        else if (text[j] === ")") depth--;
        j++;
      }
      if (depth !== 0) {
        out.push(text[i]);
        i++;
        continue;
      }
      const inner = text.slice(i + 1, j - 1).trim();
      const mod = classifyModifier(inner);
      if (mod !== null) {
        mods.push(mod);
        out.push(`\x00${mods.length - 1}\x00`);
      } else {
        out.push(text.slice(i, j));
      }
      i = j;
    } else {
      out.push(text[i]);
      i++;
    }
  }
  return [out.join(""), mods];
}

export type CourseAnnotation = {
  minGrade?: string;
  equivalentOk?: boolean;
  concurrent?: PrereqConcurrent;
};

export function annotateCourses(node: PrereqNode | null, kw: CourseAnnotation): PrereqNode | null {
  if (!node || typeof node !== "object") return node;
  if (node.kind === "course") {
    const next: PrereqNode = { ...node };
    if (kw.minGrade !== undefined) {
      next.minGrade = kw.minGrade as PrereqMinGrade;
    }
    if (kw.equivalentOk !== undefined) {
      next.equivalentOk = kw.equivalentOk;
    }
    if (kw.concurrent !== undefined) {
      next.concurrent = kw.concurrent;
    }
    return next;
  }
  if (node.kind === "any" || node.kind === "all") {
    return {
      ...node,
      of: node.of
        .map((c) => annotateCourses(c, kw))
        .filter((c): c is PrereqNode => c !== null)
    };
  }
  return node;
}

export function applyModifiers(node: PrereqNode | null, mods: Modifier[]): PrereqNode | null {
  if (mods.length === 0 || node === null) return node;
  let cur: PrereqNode | null = node;
  for (const mod of mods) {
    if (mod.kind === "grade") {
      cur = annotateCourses(cur, { minGrade: mod.minGrade });
    } else if (mod.kind === "equivalent") {
      cur = annotateCourses(cur, { equivalentOk: true });
    } else if (mod.kind === "concurrent") {
      cur = annotateCourses(cur, { concurrent: mod.concurrent });
    }
  }
  return cur;
}

export function annotateNode(node: PrereqNode | null, kw: Record<string, unknown>): PrereqNode | null {
  if (!node || typeof node !== "object") return node;
  return { ...node, ...kw } as PrereqNode;
}
