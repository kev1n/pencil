import type { PrereqNode, PrereqStanding, PrereqStandingScope } from "../types";
import { allOf, anyOf } from "./composers";
import { annotateCourses } from "./modifiers";
import { normalize } from "./normalize";
import {
  ANY_LEVEL_NO_COURSE_RE,
  AP_RE,
  APPLICATION_RE,
  BARE_STANDING_RE,
  CONSENT_ADVISER_RE,
  CONSENT_DEPT_RE,
  CONSENT_FACULTY_RE,
  CONSENT_INSTRUCTOR_RE,
  COUNT_LEVEL_RE,
  COURSE_RE,
  COURSE_RE_FULL,
  DEPT_APPROVAL_RE,
  GPA_RE,
  GRADE_OF_RE,
  LEVEL_OR_HIGHER_RE,
  LEVEL_WILD_RE,
  NONE_RE,
  NUM_LIST_PREFIX_RE,
  NUMBER_ONLY_RE,
  ONE_COURSE_FROM_RE,
  PLACEMENT_RE,
  PROGRAM_ENROLL_RE,
  RECOMMENDED_RE,
  STANDING_OR_ABOVE_RE,
  STANDING_RE,
  VARY_RE,
  WHOLE_STANDING_RE,
  WORD_COUNT
} from "./regex";

type WildcardNode = Extract<PrereqNode, { kind: "level-wildcard" }>;

function stripTrailingPunct(s: string): string {
  return s.replace(/[\s.,;]+$/g, "").replace(/^[\s.,;]+/g, "");
}

function normLevelTokens(s: string): string {
  // Maps "graduate-level" / "graduate level" / "first year" -> "graduate" / "first-year".
  let out = s.toLowerCase().replace(/ /g, "-");
  out = out.replace(/-level$/, "");
  return out;
}

const STANDING_LEVELS = new Set<string>([
  "first-year",
  "second-year",
  "sophomore",
  "junior",
  "senior",
  "advanced",
  "graduate",
  "freshman"
]);

function asStandingLevel(s: string): PrereqStanding | null {
  return STANDING_LEVELS.has(s) ? (s as PrereqStanding) : null;
}

export function tryWholeStanding(text: string): PrereqNode | null {
  const m = WHOLE_STANDING_RE.exec(text.trim());
  if (!m) return null;
  const lv1 = normLevelTokens(m[1]);
  const levels: string[] = [lv1];
  if (m[2]) levels.push(normLevelTokens(m[2]));
  let scope: PrereqStandingScope | undefined;
  if (m[3]) {
    let scopeText = m[3].trim();
    scopeText = scopeText.replace(/[,.]+$/g, "");
    if (
      /\b(consent|permission|approval)\b/i.test(scopeText) ||
      COURSE_RE.test(scopeText)
    ) {
      return null;
    }
    const parts = scopeText
      .split(/\s+or\s+|\s+and\s+|,\s*/i)
      .map((p) => p.trim())
      .filter(Boolean);
    const lowered = parts.map((p) => p.toLowerCase());
    if (parts.length === 1 && (lowered[0] === "major" || lowered[0] === "minor" || lowered[0] === "program")) {
      scope = { type: lowered[0] as "major" | "minor" | "program" };
    } else {
      scope = { type: "program", names: parts };
    }
  }
  const mk = (lvl: string): PrereqNode | null => {
    const sl = asStandingLevel(lvl);
    if (!sl) return null;
    const node: PrereqNode = { kind: "standing", level: sl };
    if (scope) (node as { scope?: PrereqStandingScope }).scope = scope;
    return node;
  };
  if (levels.length === 1) {
    return mk(levels[0]);
  }
  return anyOf(levels.map(mk));
}

export function parseCourseList(text: string, mode: "any" | "all"): PrereqNode | null {
  text = normalize(text);
  const parts = text
    .split(/\s*,\s*(?:or\s+)?|\s+or\s+|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  let currentSubject: string | null = null;
  const courses: PrereqNode[] = [];
  for (const p of parts) {
    let m = COURSE_RE_FULL.exec(p);
    if (m) {
      currentSubject = m[1].toUpperCase();
      courses.push({
        kind: "course",
        subject: currentSubject,
        number: m[2],
        section: m[3] ? m[3].toUpperCase() : "0"
      });
      continue;
    }
    m = NUMBER_ONLY_RE.exec(p);
    if (m && currentSubject) {
      courses.push({
        kind: "course",
        subject: currentSubject,
        number: m[1],
        section: m[2] ? m[2].toUpperCase() : "0"
      });
      continue;
    }
    return null;
  }
  if (courses.length === 1) return courses[0];
  if (mode === "all") return allOf(courses);
  return anyOf(courses);
}

export function parseAtom(
  text: string,
  warnings: string[],
  multiLwildcards: WildcardNode[]
): PrereqNode | null {
  text = stripTrailingPunct(normalize(text));
  text = text.replace(NUM_LIST_PREFIX_RE, "").trim();
  text = text.replace(/^(?:or|and)\s+/i, "").trim();
  if (!text) return null;
  const low = text.toLowerCase();
  if (NONE_RE.test(text)) return { kind: "none" };

  const lw = /^LWMULTI(\d+)TOKEN$/.exec(text);
  if (lw) {
    const idx = parseInt(lw[1], 10);
    if (idx >= 0 && idx < multiLwildcards.length) {
      return multiLwildcards[idx];
    }
  }

  const bs = BARE_STANDING_RE.exec(text);
  if (bs) {
    const normLevel = (raw: string): string => {
      let w = raw.toLowerCase().trim();
      w = w.replace(/\s+students?$/, "");
      return w.replace(/s$/, "");
    };
    const levels: string[] = [normLevel(bs[1])];
    if (bs[2]) levels.push(normLevel(bs[2]));
    if (levels.length === 1) {
      const sl = asStandingLevel(levels[0]);
      if (sl) return { kind: "standing", level: sl };
    } else {
      const nodes = levels
        .map((l) => asStandingLevel(l))
        .filter((l): l is PrereqStanding => l !== null)
        .map<PrereqNode>((l) => ({ kind: "standing", level: l }));
      const r = anyOf(nodes);
      if (r) return r;
    }
  }

  const cor = /^co-?requisites?:?\s+(.+)$/i.exec(text);
  if (cor) {
    const sub = parseAtom(cor[1], warnings, multiLwildcards);
    if (sub !== null) {
      return annotateCourses(sub, { concurrent: "required" });
    }
  }

  // Course (single, full match)
  const cm = COURSE_RE_FULL.exec(text);
  if (cm) {
    return {
      kind: "course",
      subject: cm[1].toUpperCase(),
      number: cm[2],
      section: cm[3] ? cm[3].toUpperCase() : "0"
    };
  }

  // "grade of at least C- in COURSE"
  const go = GRADE_OF_RE.exec(text);
  if (go) {
    const grade = go[1].toUpperCase();
    const inner = go[2].trim();
    const sub = parseAtom(inner, warnings, multiLwildcards);
    if (sub && (sub.kind === "course" || sub.kind === "any" || sub.kind === "all")) {
      return annotateCourses(sub, { minGrade: grade });
    }
  }

  // "1 course from X, Y, Z"
  const ocf = ONE_COURSE_FROM_RE.exec(text);
  if (ocf) {
    const inner = ocf[1].trim().replace(/\.$/, "");
    const cl = parseCourseList(inner, "any");
    if (cl !== null) return cl;
  }

  // Course list with carry-over
  if (COURSE_RE.test(text)) {
    const cl = parseCourseList(text, low.includes(" or ") ? "any" : "all");
    if (cl !== null) return cl;
    // Fallback: take first course in the prose, unless it's negated.
    const m2 = COURSE_RE.exec(text);
    if (m2) {
      const ctx = text.toLowerCase();
      if (!ctx.includes("not required") && !ctx.includes("do not take") && !ctx.includes("not take")) {
        return {
          kind: "course",
          subject: m2[1].toUpperCase(),
          number: m2[2],
          section: m2[3] ? m2[3].toUpperCase() : "0"
        };
      }
    }
  }

  // Standing
  const st = STANDING_RE.exec(text);
  if (st) {
    let level = st[1].toLowerCase().replace(/ /g, "-");
    level = level.replace(/-level$/, "");
    const sl = asStandingLevel(level);
    if (sl) {
      const node: Extract<PrereqNode, { kind: "standing" }> = { kind: "standing", level: sl };
      const tail = text.slice(st.index + st[0].length);
      const smIn = /^\s*in\s+(?:the\s+)?(.+?)(?:\.|$)/i.exec(tail);
      if (smIn) {
        const scopeText = smIn[1].trim().replace(/[,.]+$/g, "");
        const scopeParts = scopeText
          .split(/\s+or\s+|\s+and\s+|,\s*/i)
          .map((p) => p.trim())
          .filter(Boolean);
        if (scopeParts.length > 0) {
          const lowered = scopeParts.map((p) => p.toLowerCase());
          const hasSpecial =
            scopeParts.length === 1 &&
            (lowered[0] === "major" || lowered[0] === "minor" || lowered[0] === "program");
          if (hasSpecial) {
            node.scope = { type: lowered[0] as "major" | "minor" | "program" };
          } else {
            node.scope = { type: "program", names: scopeParts };
          }
        }
      } else if (/\b(MMSS|ISP|kaplan|medill|kellogg|bienen)\b/.test(text)) {
        // Gate is case-sensitive (Python uses no re.I on the test); the
        // capture below uses re.I to also accept "Medill" → "Medill".
        const pm = /\b(MMSS|ISP|kaplan|medill|kellogg|bienen)\b/i.exec(text);
        if (pm) {
          node.scope = { type: "program", names: [pm[1]] };
        }
      }
      if (RECOMMENDED_RE.test(text)) node.recommended = true;
      return node;
    }
  }

  const sa = STANDING_OR_ABOVE_RE.exec(text);
  if (sa) {
    const sl = asStandingLevel(sa[1].toLowerCase());
    if (sl) return { kind: "standing", level: sl, orAbove: true };
  }

  // Consent (order matters — instructor before department)
  if (CONSENT_INSTRUCTOR_RE.test(text)) return { kind: "consent", source: "instructor" };
  if (CONSENT_DEPT_RE.test(text) || DEPT_APPROVAL_RE.test(text)) return { kind: "consent", source: "department" };
  if (CONSENT_ADVISER_RE.test(text)) return { kind: "consent", source: "program-adviser" };
  if (CONSENT_FACULTY_RE.test(text)) return { kind: "consent", source: "faculty" };
  if (APPLICATION_RE.test(text)) return { kind: "consent", source: "application" };

  // Placement
  if (PLACEMENT_RE.test(text)) {
    let exam: "chemistry" | "language" | "math" | "department" = "department";
    if (/\bchemistry\b/i.test(text)) exam = "chemistry";
    else if (/\blanguage\b/i.test(text)) exam = "language";
    else if (/\bmath\b/i.test(text)) exam = "math";
    const node: Extract<PrereqNode, { kind: "placement" }> = { kind: "placement", exam };
    if (low.includes("qualifying")) node.passed = true;
    return node;
  }
  if (AP_RE.test(text)) return { kind: "placement", exam: "AP" };

  // Program / membership
  const pe = PROGRAM_ENROLL_RE.exec(text);
  if (pe) {
    const name = pe[1].trim().replace(/[,.]+$/g, "");
    let rel: "enrolled-in" | "admitted-to" | "reserved-for" = "enrolled-in";
    if (/\badmission\b|\badmitted\b/i.test(text)) rel = "admitted-to";
    else if (/\breserved\b/i.test(text)) rel = "reserved-for";
    return { kind: "program", relation: rel, name };
  }

  // Count + level wildcard
  const cl = COUNT_LEVEL_RE.exec(text);
  if (cl) {
    const levels = [parseInt(cl[2], 10) * 100];
    if (cl[3]) levels.push(parseInt(cl[3], 10) * 100);
    return {
      kind: "level-wildcard",
      levels: Array.from(new Set(levels)).sort((a, b) => a - b),
      subjects: [cl[4].trim()],
      count: WORD_COUNT[cl[1].toLowerCase()]
    };
  }

  // GPA atom
  const gp = GPA_RE.exec(text);
  if (gp) {
    const val = parseFloat(gp[1] ?? gp[2]);
    const node: Extract<PrereqNode, { kind: "gpa" }> = { kind: "gpa", min: val };
    if (/\bcumulative\b/i.test(text)) node.scope = "overall";
    else if (/\bin\s+(?:the\s+)?major\b/i.test(text)) node.scope = "major";
    return node;
  }

  // Level wildcard variants
  const lw1 = LEVEL_WILD_RE.exec(text);
  if (lw1) {
    const levels = [parseInt(lw1[1], 10) * 100];
    if (lw1[2]) levels.push(parseInt(lw1[2], 10) * 100);
    return {
      kind: "level-wildcard",
      levels: levels.slice().sort((a, b) => a - b),
      subjects: [lw1[3].trim()]
    };
  }
  const lw2 = ANY_LEVEL_NO_COURSE_RE.exec(text);
  if (lw2) {
    return {
      kind: "level-wildcard",
      levels: [parseInt(lw2[1], 10) * 100],
      subjects: [lw2[2].trim()]
    };
  }
  const lw3 = LEVEL_OR_HIGHER_RE.exec(text);
  if (lw3) {
    return {
      kind: "level-wildcard",
      levels: [parseInt(lw3[1], 10) * 100],
      subjects: [],
      orHigher: true
    };
  }

  if (VARY_RE.test(low)) {
    return { kind: "raw", text, reason: "vary-by-topic" };
  }

  warnings.push("freeform");
  return { kind: "topic", topic: text };
}
