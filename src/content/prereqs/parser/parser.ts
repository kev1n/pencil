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
  AP_RE,
  BARE_STANDING_RE,
  CONCURRENT_REQUIRED_RE,
  CONDITIONAL_RE,
  COURSE_RE,
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
      text = (text.slice(0, chunkStart) + text.slice(chunkEnd))
        .replace(/[\s.,;]+$/g, "")
        .replace(/^[\s.,;]+/g, "")
        // "A and B, and must be taken concurrently with C" leaves a dangling "and".
        .replace(/[\s,;]+(?:and|or)$/i, "");
    }
  }

  // Re-apply trail strips after surgery.
  for (const pat of TRAIL_PATTERNS) {
    text = text.replace(pat, "");
  }
  // Strip leftover "(in order) to register/enroll for this course" anywhere mid-string.
  text = text.replace(
    /\s+(?:in\s+order\s+)?to\s+(?:register|enroll)\s+(?:for|in|into)\s+this\s+(?:course|class)\.?/gi,
    "."
  );
  // "with a (grade of) C- or better" / "and passed with at least a C-"
  // is a grade note on the course before it, not an alternative. Grades
  // the schema can hold become a "(C- or better)" modifier; others drop.
  text = text.replace(
    /\s+(?:and\s+passed\s+)?with\s+(?:an?\s+(?:grade\s+of\s+)?([A-D][+-]?)\s+or\s+(?:better|higher|above)\b|at\s+least\s+an?\s+([A-D][+-]?)(?!\w))/gi,
    (_m, g1: string | undefined, g2: string | undefined) => {
      const grade = (g1 ?? g2 ?? "").toUpperCase();
      return grade === "C-" || grade === "B-" ? ` (${grade} or better)` : "";
    }
  );
  // "A and B (C- or better)": the grade covers every course in the "and"
  // run, so it is copied onto each. The run never crosses an "or" or a
  // semicolon. After an "or", a comma in the run ("A or B, and C")
  // closes the alternatives group, so the run is left alone.
  text = text.replace(
    /(?<![A-Z_]\s)\b((?:[A-Z][A-Z_]+\s+)?\d{3}(?:-[A-Za-z0-9]+)?(?:(?:,\s*|,?\s+(?:and|AND)\s+)(?:[A-Z][A-Z_]+\s+)?\d{3}(?:-[A-Za-z0-9]+)?)*,?\s+(?:and|AND)\s+(?:[A-Z][A-Z_]+\s+)?\d{3}(?:-[A-Za-z0-9]+)?) (\([CB]- or better\))/g,
    (m: string, run: string, grade: string, offset: number, all: string) =>
      run.includes(",") && /\b(?:or|OR)\s+$/.test(all.slice(0, offset))
        ? m
        : run.replace(/(\d{3}(?:-[A-Za-z0-9]+)?)(?=,|\s+(?:and|AND)\s)/g, `$1 ${grade}`) + ` ${grade}`
  );
  // "an AP of 5 in the Spanish Language and Literature exams" is one
  // placement clause; its "and" is not a connective.
  text = text.replace(/\bAP\s+(?:score\s+)?of\s+\d\b[^,;]*/gi, (clause) =>
    hasCourse(clause) ? clause : clause.split(/\s+or\s+/i).map((c) => c.replace(/\s+and\s+/gi, " & ")).join(" or ")
  );
  // "AP 4 in Spanish, French or Italian" is one placement; its subject
  // list is not a list of requirements.
  text = text.replace(
    /\b(AP\s+(?:[Ss]core\s+)?(?:of\s+)?\d\s+in\s+)([A-Z][a-z]+(?:(?:,\s*|,?\s+(?:or|and)\s+)[A-Z][a-z]+)+)\b/g,
    (_m, head: string, list: string) => head + list.split(/,\s*|,?\s+(?:or|and)\s+/).join("/")
  );
  // "completed or currently enrolled in X", "prior completion of or
  // concurrent enrollment in X", "be enrolled in or have taken and passed
  // X": either way X is the requirement. Only at the start of a clause, so
  // a qualifier in front ("ISP students who have completed or...") stays.
  text = text.replace(
    /(?<=^|[,;]\s*|\band\s+)(?:(?:have\s+)?(?:prior\s+)?(?:completed|completion\s+of|taken)\s+or\s+(?:be\s+|are\s+)?(?:currently|concurrently|concurrent)\s+(?:enrolled|enrollment|registered|registration)(?:\s+in)?|(?:students?\s+)?(?:must\s+)?(?:currently\s+)?(?:be\s+)?(?:currently\s+)?enrolled(?:\s+in)?\s+or\s+(?:have\s+)?(?:taken|completed|passed)(?:\s+and\s+passed)?|(?:have\s+)?taken\s+and\s+passed)\s+/gi,
    ""
  );
  // "X or equivalent and Y": the equivalent belongs to X, not a new branch.
  text = text.replace(/\s+or\s+equivalent(?=,?\s+and\s)/gi, " (or equivalent)");
  // ", which may be taken concurrently" annotates the course before it.
  text = text.replace(/,?\s+which\s+(?:may|can)\s+be\s+taken\s+concurrently\b/gi, " (may be taken concurrently)");
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
  // "one of A, B, C" with no and/or in the list: the commas are alternatives.
  const oneOf = /^(.*?\b)(?:at least |any )?one of (?:the following(?: courses)?:?\s*)?([^;:]+)$/i.exec(text);
  if (oneOf && !hasCourse(oneOf[1]) && !/\b(?:and|or)\b/i.test(oneOf[2])) {
    text = oneOf[2].split(/\s*,\s*/).join(" or ");
  }

  let node = parseOrExpr(text, warnings, multiLwildcards);
  if (leadingGrade && node !== null) {
    node = annotateCourses(node, { minGrade: leadingGrade });
  }
  if (concurrentExtras.length > 0) {
    node = combineAll([node, ...concurrentExtras]);
  }
  return { parsed: node, warnings };
}

function hasCourse(text: string): boolean {
  return COURSE_RE.test(text) || /^\s*\d{3}\b/.test(text);
}

// "STAT 210 (B- or better)" -> "STAT 210-0"; null unless the text is one course.
function courseKey(text: string): string | null {
  const m = /^([A-Za-z][A-Za-z_]{1,})\s+(\d{3})(?:-([A-Za-z0-9]+))?(?:\s*\([^()]*\))?\.?$/.exec(text.trim());
  return m ? `${m[1].toUpperCase()} ${m[2]}-${(m[3] ?? "0").toUpperCase()}` : null;
}

function hasOr(text: string): boolean {
  return splitTopLevel(text, [" or "]).length > 1;
}

// True when a segment's commas clearly separate alternatives groups:
// no commas at all, an Oxford list ("A, B, or C"), or every comma chunk
// carrying its own " or " ("A or B, C or D").
function isOrGroupList(text: string): boolean {
  const chunks = splitTopLevel(text, [","]);
  if (chunks.length === 1) return true;
  if (splitTopLevel(text, [", or "]).length > 1) return true;
  return chunks.every(hasOr);
}

// "PHYSICS 135-1", "PHYSICS 135-2", "135-3": parts of one multi-quarter
// course, which a student needs all of.
function isOneSequence(items: readonly string[]): boolean {
  const numbers = new Set<string>();
  for (const item of items) {
    const m = /(\d{3})-[A-Za-z0-9]+/.exec(item);
    if (!m) return false;
    numbers.add(m[1]);
  }
  return numbers.size === 1 && items.length > 1;
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

  // "X and either A or B": each either-list is one group of
  // alternatives. "either:" opens a group that runs to the end, even
  // across "; or" segments; a bare "either" group stops at a semicolon.
  const eitherColon = splitTopLevel(text, [", and either: ", " and either: "]);
  const eitherParts =
    eitherColon.length === 2
      ? eitherColon
      : splitTopLevel(text, [";"]).length === 1
        ? splitTopLevel(text, [", and either ", " and either "])
        : [];
  if (eitherParts.length > 1) {
    return allOf(eitherParts.map((p) => parseOrExpr(p, warnings, multiLwildcards)));
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
    // "A; B; or consent of instructor": a closing non-course escape
    // hatch covers the whole list, not just the segment before it.
    const last = items[items.length - 1];
    if (
      last.op === "or" &&
      !hasCourse(last.text) &&
      items.slice(1, -1).some((it) => it.op === "and")
    ) {
      return foldEquivalent(
        anyOf([
          buildAndorTree(items.slice(0, -1), warnings, multiLwildcards),
          parseOrExpr(last.text, warnings, multiLwildcards)
        ])
      );
    }
    // "AP 4 in X; instructor permission, or placement test": an AP
    // clause, no course anywhere and a closing ", or" list, so the
    // semicolons separate items of one list of alternatives.
    if (
      items.every((it) => it.op === "first" || it.op === "and") &&
      items.some((it) => AP_RE.test(it.text)) &&
      !items.some((it) => hasCourse(it.text)) &&
      splitTopLevel(last.text, [", or "]).length > 1
    ) {
      return foldEquivalent(
        anyOf(items.map((it) => parseOrExpr(it.text, warnings, multiLwildcards)))
      );
    }
    return buildAndorTree(items, warnings, multiLwildcards);
  }

  // ", and " binds looser than " or ": "A or B, and C or D" is two
  // groups of alternatives that are both required.
  const commaAnd = splitTopLevel(text, [", and "]);
  if (
    commaAnd.length > 1 &&
    commaAnd.some(hasOr) &&
    commaAnd.every((p) => !hasOr(p) || isOrGroupList(p))
  ) {
    // "A, B, and C or graduate standing": a closing escape hatch covers
    // the whole list, not just its last item.
    const last = commaAnd[commaAnd.length - 1];
    const lastOr = splitTopLevel(last, [" or "]);
    const tail = lastOr[lastOr.length - 1];
    if (lastOr.length > 1 && !hasCourse(tail) && hasCourse(lastOr[0])) {
      const body = [...commaAnd.slice(0, -1), lastOr.slice(0, -1).join(" or ")];
      return foldEquivalent(
        anyOf([
          allOf(body.map((p) => parseOrExpr(p, warnings, multiLwildcards))),
          parseAndExpr(tail, warnings, multiLwildcards)
        ])
      );
    }
    return allOf(commaAnd.map((p) => parseOrExpr(p, warnings, multiLwildcards)));
  }

  // Comma lists that mix in " or " without any "and" or Oxford comma.
  const chunks = splitTopLevel(text, [","]);
  if (
    chunks.length > 1 &&
    splitTopLevel(text, [" and "]).length === 1 &&
    splitTopLevel(text, [", or "]).length === 1
  ) {
    const withOr = chunks.map(hasOr);
    const orCount = withOr.filter(Boolean).length;
    if (orCount === 1 && withOr[withOr.length - 1]) {
      // "A, B, C or D" is one list of alternatives — unless the comma
      // items are parts of one sequence ("135-1, 135-2, 135-3 or X"),
      // which are all required, or the tail is an escape hatch
      // ("A, B or consent of instructor"). Those keep the default
      // reading below.
      const orParts = splitTopLevel(chunks[chunks.length - 1], [" or "]);
      const tailIsCourse = orParts.every(hasCourse);
      if (tailIsCourse && !isOneSequence([...chunks.slice(0, -1), orParts[0]])) {
        const parts = splitTopLevel(text, [" or ", ","]);
        return foldEquivalent(anyOf(parts.map((p) => parseAndExpr(p, warnings, multiLwildcards))));
      }
    } else if (orCount >= 1) {
      // "A or B, C or D": each comma chunk is its own requirement. A run
      // of plain courses right before an all-course "or" chunk reads as
      // "A, B or C" above ("150, 151 or COMP_SCI 150, MATH 220-1"), with
      // the same sequence and escape-hatch exceptions.
      const groups: string[][] = [];
      let run: string[] = [];
      chunks.forEach((chunk, i) => {
        if (!withOr[i]) {
          run.push(chunk);
          return;
        }
        const orParts = splitTopLevel(chunk, [" or "]);
        if (
          run.length > 0 &&
          run.every(hasCourse) &&
          orParts.every(hasCourse) &&
          !isOneSequence([...run, orParts[0]])
        ) {
          groups.push([...run, chunk]);
        } else {
          groups.push(...run.map((r) => [r]), [chunk]);
        }
        run = [];
      });
      groups.push(...run.map((r) => [r]));
      return allOf(
        groups.map((g) =>
          foldEquivalent(anyOf(g.map((c) => parseOrExpr(c, warnings, multiLwildcards))))
        )
      );
    }
  }

  // Oxford-comma OR list.
  const hasOxford = splitTopLevel(text, [", or "]).length > 1;
  if (hasOxford) {
    const parts = splitTopLevel(text, [", or ", " or ", ", "]);
    // "A, B, C, or AP credit for B": the closing credit names the item it
    // stands in for. B and the items after it are the alternatives; what
    // comes before B is required. A trailing sentence after the target is
    // not part of it.
    const credit = /^(?:have\s+)?(.*\b(?:AP|placement)\b.*?)\s+for\s+(.+)$/i.exec(parts[parts.length - 1]);
    const target = credit ? courseKey(credit[2].split(/\.\s/)[0]) : null;
    const ti = target ? parts.slice(0, -1).findIndex((p) => courseKey(p) === target) : -1;
    if (credit && ti >= 0 && parts.length > 2) {
      const parse = (p: string) => parseAndExpr(p, warnings, multiLwildcards);
      return allOf([
        ...parts.slice(0, ti).map(parse),
        anyOf([...parts.slice(ti, -1).map(parse), parseAtom(credit[1], warnings, multiLwildcards)])
      ]);
    }
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
