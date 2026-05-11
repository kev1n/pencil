import type { PrereqNode } from "../types";
import {
  BARE_INSTRUCTOR_TOPIC_RE,
  EQUIV_TOPIC_RE,
  OR_ABOVE_TOPIC_RE
} from "./regex";
import { annotateCourses } from "./modifiers";

// Stable JSON key for dedupe — must match Python's json.dumps(sort_keys=True).
function stableKey(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableKey).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableKey(obj[k]))
      .join(",") +
    "}"
  );
}

export function dedupeChildren(children: PrereqNode[]): PrereqNode[] {
  const seen = new Set<string>();
  const out: PrereqNode[] = [];
  for (const c of children) {
    const key = stableKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function allOf(children: Array<PrereqNode | null>): PrereqNode | null {
  const filtered = children.filter((c): c is PrereqNode => c !== null);
  if (filtered.length === 0) return null;
  const flat: PrereqNode[] = [];
  for (const c of filtered) {
    if (c.kind === "all") {
      for (const cc of c.of) flat.push(cc);
    } else {
      flat.push(c);
    }
  }
  const deduped = dedupeChildren(flat);
  if (deduped.length === 1) return deduped[0];
  return foldAndTopics({ kind: "all", of: deduped });
}

export function anyOf(children: Array<PrereqNode | null>): PrereqNode | null {
  const filtered = children.filter((c): c is PrereqNode => c !== null);
  if (filtered.length === 0) return null;
  const flat: PrereqNode[] = [];
  for (const c of filtered) {
    if (c.kind === "any") {
      for (const cc of c.of) flat.push(cc);
    } else {
      flat.push(c);
    }
  }
  const deduped = dedupeChildren(flat);
  if (deduped.length === 1) return deduped[0];
  return { kind: "any", of: deduped };
}

export function combineAll(children: Array<PrereqNode | null>): PrereqNode | null {
  return allOf(children);
}

export function foldEquivalent(node: PrereqNode | null): PrereqNode | null {
  if (!node || node.kind !== "any") return node;
  const children = [...node.of];
  const hasConsentSibling = children.some((c) => c.kind === "consent");
  const out: PrereqNode[] = [];
  for (const c of children) {
    if (c.kind === "topic") {
      const t = c.topic.trim();
      if (EQUIV_TOPIC_RE.test(t)) {
        if (out.length > 0) {
          const annotated = annotateCourses(out[out.length - 1], { equivalentOk: true });
          if (annotated) out[out.length - 1] = annotated;
        }
        continue;
      }
      if (OR_ABOVE_TOPIC_RE.test(t)) {
        const last = out[out.length - 1];
        if (last && last.kind === "standing") {
          out[out.length - 1] = { ...last, orAbove: true };
        }
        continue;
      }
      if (BARE_INSTRUCTOR_TOPIC_RE.test(t) && hasConsentSibling) {
        out.push({ kind: "consent", source: "instructor" });
        continue;
      }
    }
    out.push(c);
  }
  if (out.length === 0) return null;
  if (out.length === 1) return out[0];
  return { kind: "any", of: out };
}

export function foldAndTopics(node: PrereqNode | null): PrereqNode | null {
  if (!node || node.kind !== "all") return node;
  const children = [...node.of];
  const hasConsentSibling = children.some((c) => c.kind === "consent");
  const out: PrereqNode[] = [];
  for (const c of children) {
    if (c.kind === "topic") {
      const t = c.topic.trim();
      if (OR_ABOVE_TOPIC_RE.test(t)) {
        const last = out[out.length - 1];
        if (last && last.kind === "standing") {
          out[out.length - 1] = { ...last, orAbove: true };
        }
        continue;
      }
      if (BARE_INSTRUCTOR_TOPIC_RE.test(t) && hasConsentSibling) {
        out.push({ kind: "consent", source: "instructor" });
        continue;
      }
    }
    out.push(c);
  }
  if (out.length === 0) return null;
  if (out.length === 1) return out[0];
  return { kind: "all", of: out };
}
