import type { PrereqNode } from "../types";
import { parseAtom, parseCourseList } from "./atoms";
import { allOf, anyOf, combineAll, foldEquivalent } from "./composers";
import {
  applyModifiers,
  annotateCourses,
  annotateNode,
  extractParenModifiers
} from "./modifiers";
import {
  carrySubjects,
  expandMultiversion,
  extractMultiLevelWildcards,
  type ExtractedWildcard,
  normalize,
  stripProse
} from "./normalize";
import {
  BARE_STANDING_RE,
  CONCURRENT_REQUIRED_RE,
  CONDITIONAL_RE,
  EQUIV_RE,
  NONE_RE,
  RECOMMENDED_RE,
  TRAIL_PATTERNS
} from "./regex";
import {
  getOperatorChain,
  isAlternating,
  splitTopLevel,
  unwrapParens
} from "./splitters";
import { tryWholeStanding } from "./atoms";

type WildcardArr = ExtractedWildcard[];

function asStandingFromBare(raw: string): PrereqNode | null {
  const norm = (w: string): string => w.toLowerCase().replace(/s$/, "");
  const allowed = new Set(["freshman", "sophomore", "junior", "senior", "graduate", "advanced"]);
  let w = norm(raw);
  // "advanced students" -> "advanced student" -> "advanced"
  w = w.replace(/\s+student$/, "");
  if (!allowed.has(w)) return null;
  return { kind: "standing", level: w as Extract<PrereqNode, { kind: "standing" }>["level"] };
}

export function parseRoot(
  text: string,
  parentSubject: string | null
): { parsed: PrereqNode | null; warnings: string[] } {
  const warnings: string[] = [];
  text = normalize(text);
  if (NONE_RE.test(text)) {
    return { parsed: { kind: "none" }, warnings };
  }
  let leadingGrade: string | null;
  [text, leadingGrade] = stripProse(text);
  text = normalize(text);
  // Whole-text bare-standing pre-check (Reserved for Juniors and Seniors).
  const bs = BARE_STANDING_RE.exec(text);
  if (bs) {
    const levels: PrereqNode[] = [];
    const a = asStandingFromBare(bs[1]);
    if (a) levels.push(a);
    if (bs[2]) {
      const b = asStandingFromBare(bs[2]);
      if (b) levels.push(b);
    }
    if (levels.length === 1) return { parsed: levels[0], warnings };
    if (levels.length > 1) {
      const r = anyOf(levels);
      if (r) return { parsed: r, warnings };
    }
  }

  // Trailing concurrent extraction.
  const concurrentExtras: PrereqNode[] = [];
  const cm = CONCURRENT_REQUIRED_RE.exec(text);
  if (cm) {
    const chunk = cm[1];
    let chunkStart = cm.index;
    const chunkEnd = cm.index + cm[0].length;
    const lookback = Math.max(0, chunkStart - 30);
    const prefix = text.slice(lookback, chunkStart);
    const pm = /(?:should|must|may)\s+be\s*$/i.exec(prefix);
    if (pm) {
      chunkStart = lookback + pm.index;
    }
    const mode: "any" | "all" = /\bor\b/i.test(chunk) ? "any" : "all";
    let courses = parseCourseList(chunk, mode);
    if (courses !== null) {
      courses = annotateCourses(courses, { concurrent: "required" });
      if (courses) concurrentExtras.push(courses);
      text = (text.slice(0, chunkStart) + text.slice(chunkEnd)).replace(/[\s.,;]+$/g, "").replace(/^[\s.,;]+/g, "");
    }
  }

  // Re-apply trail strips after surgery.
  for (const pat of TRAIL_PATTERNS) {
    text = text.replace(pat, "");
  }
  // Strip leftover "to register/enroll for this course" anywhere mid-string.
  text = text.replace(/\s+to\s+register\s+for\s+this\s+course\.?/gi, ".");
  text = text.replace(/\s+to\s+enroll\s+in\s+this\s+course\.?/gi, ".");
  text = normalize(text).replace(/[\s.,;]+$/g, "").replace(/^[\s.,;]+/g, "");
  text = expandMultiversion(text);
  let multiLwildcards: WildcardArr;
  [text, multiLwildcards] = extractMultiLevelWildcards(text);
  // Prepend parent subject for leading bare-number references.
  if (parentSubject) {
    text = text.replace(
      /^(\d{3})(?:-([A-Za-z0-9]+))?(?!\s*-?\s*level\b)\b/,
      (m0) => `${parentSubject} ${m0}`
    );
  }
  text = carrySubjects(text);

  let node = parseOrExpr(text, warnings, multiLwildcards);
  if (leadingGrade && node !== null) {
    node = annotateCourses(node, { minGrade: leadingGrade });
  }
  if (concurrentExtras.length > 0) {
    node = combineAll([node, ...concurrentExtras]);
  }
  return { parsed: node, warnings };
}

export function parseOrExpr(
  text: string,
  warnings: string[],
  multiLwildcards: WildcardArr
): PrereqNode | null {
  text = normalize(text).replace(/[\s.,;]+$/g, "").replace(/^[\s.,;]+/g, "");
  if (!text) return null;
  text = unwrapParens(text);

  const ws = tryWholeStanding(text);
  if (ws !== null) return ws;

  const condM = CONDITIONAL_RE.exec(text);
  if (condM) {
    const negated = Boolean(condM[1]);
    const program = condM[2];
    const consequentText = condM[3].trim();
    const consequent = parseOrExpr(consequentText, warnings, multiLwildcards);
    if (consequent !== null) {
      return {
        kind: "when",
        condition: {
          kind: "program-membership",
          program,
          negated
        },
        then: consequent
      };
    }
  }

  // Pair-binding (OR-tighter alternation).
  if (!text.includes(";")) {
    const [leaves, ops] = getOperatorChain(text);
    if (isAlternating(ops)) {
      const boundaryOp = ops[1];
      const innerOp = boundaryOp === "and" ? "or" : "and";
      const groups: string[][] = [[leaves[0]]];
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        const leaf = leaves[i + 1];
        if (op === boundaryOp) {
          groups.push([leaf]);
        } else {
          groups[groups.length - 1].push(leaf);
        }
      }
      const innerCtor = innerOp === "or" ? anyOf : allOf;
      const outerCtor = boundaryOp === "and" ? allOf : anyOf;
      const parsed: Array<PrereqNode | null> = [];
      for (const grp of groups) {
        if (grp.length === 1) {
          parsed.push(parseAndExpr(grp[0], warnings, multiLwildcards));
        } else {
          parsed.push(
            foldEquivalent(innerCtor(grp.map((g) => parseAndExpr(g, warnings, multiLwildcards))))
          );
        }
      }
      return foldEquivalent(outerCtor(parsed));
    }
  }

  // Top-level ';' precedence: OR-prefixed continues OR group, else starts AND segment.
  const semiParts = splitTopLevel(text, [";"]);
  if (semiParts.length > 1) {
    const items: Array<{ op: "first" | "or" | "and"; text: string }> = [];
    for (let idx = 0; idx < semiParts.length; idx++) {
      const p = semiParts[idx].replace(/[\s.,;]+$/g, "").replace(/^[\s.,;]+/g, "");
      if (idx === 0) {
        items.push({ op: "first", text: p });
        continue;
      }
      const ms = /^(or|and)\s+/i.exec(p);
      if (ms) {
        items.push({ op: ms[1].toLowerCase() as "or" | "and", text: p.slice(ms[0].length).trim() });
      } else {
        items.push({ op: "and", text: p });
      }
    }
    return buildAndorTree(items, warnings, multiLwildcards);
  }

  // Oxford-comma OR list.
  const hasOxford = splitTopLevel(text, [", or "]).length > 1;
  if (hasOxford) {
    const parts = splitTopLevel(text, [", or ", " or ", ", "]);
    if (parts.length > 1) {
      return foldEquivalent(anyOf(parts.map((p) => parseAndExpr(p, warnings, multiLwildcards))));
    }
  }

  // Plain " or ".
  const orParts = splitTopLevel(text, [", or ", " or "]);
  if (orParts.length > 1) {
    return foldEquivalent(anyOf(orParts.map((p) => parseAndExpr(p, warnings, multiLwildcards))));
  }

  return parseAndExpr(text, warnings, multiLwildcards);
}

export function parseAndExpr(
  text: string,
  warnings: string[],
  multiLwildcards: WildcardArr
): PrereqNode | null {
  text = normalize(text).replace(/[\s.,;]+$/g, "").replace(/^[\s.,;]+/g, "");
  if (!text) return null;
  text = unwrapParens(text);
  const parts = splitTopLevel(text, [", and ", " and "]);
  if (parts.length > 1) {
    const children = parts.map((p) => parseCommaExpr(p, warnings, multiLwildcards));
    return allOf(children);
  }
  return parseCommaExpr(text, warnings, multiLwildcards);
}

export function parseCommaExpr(
  text: string,
  warnings: string[],
  multiLwildcards: WildcardArr
): PrereqNode | null {
  text = normalize(text).replace(/[\s.,;]+$/g, "").replace(/^[\s.,;]+/g, "");
  if (!text) return null;
  text = unwrapParens(text);
  const parts = splitTopLevel(text, [","]);
  if (parts.length > 1) {
    const children = parts
      .map((p) => parseModifierAware(p, warnings, multiLwildcards))
      .filter((c): c is PrereqNode => c !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return allOf(children);
  }
  return parseModifierAware(text, warnings, multiLwildcards);
}

export function parseModifierAware(
  text: string,
  warnings: string[],
  multiLwildcards: WildcardArr
): PrereqNode | null {
  text = normalize(text).replace(/[\s.,;]+$/g, "").replace(/^[\s.,;]+/g, "");
  if (!text) return null;
  const extracted = extractParenModifiers(text);
  const mods = extracted[1];
  let cleaned = extracted[0];
  cleaned = cleaned.replace(/\s*\x00\d+\x00\s*/g, " ").trim();
  const before = cleaned;
  const unwrapped = unwrapParens(cleaned);
  if (unwrapped !== before) {
    return applyModifiers(parseOrExpr(unwrapped, warnings, multiLwildcards), mods);
  }
  cleaned = unwrapped;
  let node = parseAtom(cleaned, warnings, multiLwildcards);
  node = applyModifiers(node, mods);
  if (node !== null && EQUIV_RE.test(text)) {
    node = annotateCourses(node, { equivalentOk: true });
  }
  if (node !== null && RECOMMENDED_RE.test(text)) {
    node = annotateNode(node, { recommended: true });
  }
  return node;
}

export function buildAndorTree(
  items: Array<{ op: "first" | "or" | "and"; text: string }>,
  warnings: string[],
  multiLwildcards: WildcardArr
): PrereqNode | null {
  const segments: string[][] = [];
  for (const { op, text } of items) {
    if (op === "or" && segments.length > 0) {
      segments[segments.length - 1].push(text);
    } else {
      segments.push([text]);
    }
  }
  const parsedSegments: Array<PrereqNode | null> = [];
  for (const seg of segments) {
    if (seg.length === 1) {
      parsedSegments.push(parseOrExpr(seg[0], warnings, multiLwildcards));
    } else {
      parsedSegments.push(
        foldEquivalent(anyOf(seg.map((s) => parseOrExpr(s, warnings, multiLwildcards))))
      );
    }
  }
  if (parsedSegments.length > 1) return allOf(parsedSegments);
  if (parsedSegments.length === 1) return parsedSegments[0];
  return null;
}
