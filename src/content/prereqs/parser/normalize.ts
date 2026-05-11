import type { PrereqNode } from "../types";
import {
  COURSE_RE,
  MULTI_LEVEL_WILDCARD_RE,
  TRAIL_PATTERNS,
  WRAPPER_PATTERNS
} from "./regex";

export function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function stripProse(text: string): [string, string | null] {
  let grade: string | null = null;
  for (const pat of WRAPPER_PATTERNS) {
    const m = pat.exec(text);
    if (m) {
      text = text.slice(m[0].length);
      const g = m[1];
      if (g && /^([A-D][+\-]?|P)$/i.test(g)) {
        grade = g.toUpperCase();
      }
      break;
    }
  }
  for (const pat of TRAIL_PATTERNS) {
    text = text.replace(pat, "");
  }
  return [text.trim(), grade];
}

export function expandMultiversion(text: string): string {
  return text.replace(
    /\b((?:[A-Z][A-Z_]+\s+)?)(\d{3})-(\d)((?:,\s*\d)+)\b/g,
    (_match, subjPfx: string | undefined, num: string, first: string, rest: string) => {
      const sections = [first, ...rest.split(",").map((s) => s.trim()).filter(Boolean)];
      const prefix = subjPfx ?? "";
      return sections.map((s) => `${prefix}${num}-${s}`).join(", ");
    }
  );
}

export function carrySubjects(text: string): string {
  // Walks "atoms" separated by ", " / " or " / " and " / "; ", carrying
  // the most recently seen subject across bare-number references.
  const parts = text.split(/(\s+or\s+|\s+and\s+|,\s+|;\s+)/i);
  const out: string[] = [];
  let currentSubject: string | null = null;
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    if (idx % 2 === 1) {
      out.push(part);
      continue;
    }
    const seg = part;
    const cm = COURSE_RE.exec(seg);
    if (cm) {
      currentSubject = cm[1];
      out.push(seg);
      continue;
    }
    const bm = /^\s*(\d{3})(?:-([A-Z0-9]+))?\b/.exec(seg);
    if (bm && currentSubject) {
      out.push(`${currentSubject} ` + seg.replace(/^\s+/, ""));
      continue;
    }
    out.push(seg);
  }
  return out.join("");
}

export type ExtractedWildcard = Extract<PrereqNode, { kind: "level-wildcard" }>;

export function extractMultiLevelWildcards(text: string): [string, ExtractedWildcard[]] {
  const extracted: ExtractedWildcard[] = [];
  // Reset lastIndex defensively (the constant is /g/i).
  MULTI_LEVEL_WILDCARD_RE.lastIndex = 0;
  const newText = text.replace(MULTI_LEVEL_WILDCARD_RE, (...args) => {
    const m1 = args[1] as string;
    const m2 = args[2] as string | undefined;
    const m3 = args[3] as string;
    const levels = [parseInt(m1, 10) * 100];
    if (m2) levels.push(parseInt(m2, 10) * 100);
    const subjects = m3
      .split(/\s+or\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const node: ExtractedWildcard = {
      kind: "level-wildcard",
      levels: Array.from(new Set(levels)).sort((a, b) => a - b),
      subjects
    };
    extracted.push(node);
    return `LWMULTI${extracted.length - 1}TOKEN`;
  });
  return [newText, extracted];
}

