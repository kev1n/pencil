export function isBalanced(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

export function unwrapParens(text: string): string {
  text = text.trim();
  while (text.startsWith("(") && text.endsWith(")") && isBalanced(text.slice(1, -1))) {
    const inner = text.slice(1, -1);
    if (!isBalanced(inner)) break;
    text = inner.trim();
  }
  return text;
}

function isAlnum(ch: string): boolean {
  return /[\w]/.test(ch);
}

export function splitTopLevel(text: string, separators: string[]): string[] {
  // Match longer separators first so ", or " beats " or ".
  const seps = [...separators].sort((a, b) => b.length - a.length);
  const out: string[] = [];
  const buf: string[] = [];
  let depth = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === "(" || ch === "[") {
      depth++;
      buf.push(ch);
      i++;
      continue;
    }
    if (ch === ")" || ch === "]") {
      depth--;
      buf.push(ch);
      i++;
      continue;
    }
    if (depth === 0) {
      let matched: string | null = null;
      for (const s of seps) {
        if (text.slice(i, i + s.length).toLowerCase() === s.toLowerCase()) {
          if (/^[A-Za-z]/.test(s)) {
            const prev = i > 0 ? text[i - 1] : " ";
            const nxt = i + s.length < n ? text[i + s.length] : " ";
            if (isAlnum(prev) || isAlnum(nxt)) continue;
          }
          matched = s;
          break;
        }
      }
      if (matched !== null) {
        out.push(buf.join("").trim());
        buf.length = 0;
        i += matched.length;
        continue;
      }
    }
    buf.push(ch);
    i++;
  }
  out.push(buf.join("").trim());
  return out.filter((p) => p.length > 0);
}

export function getOperatorChain(text: string): [string[], string[]] {
  const leaves: string[] = [];
  const ops: string[] = [];
  const buf: string[] = [];
  let depth = 0;
  let i = 0;
  const n = text.length;
  // (sep, op). Order: longest first; comma forms before space forms.
  const SEPS: Array<[string, string]> = [
    [", and ", "and"],
    [", or ", "or"],
    [" and ", "and"],
    [" or ", "or"]
  ];
  while (i < n) {
    const ch = text[i];
    if (ch === "(" || ch === "[") {
      depth++;
      buf.push(ch);
      i++;
      continue;
    }
    if (ch === ")" || ch === "]") {
      depth--;
      buf.push(ch);
      i++;
      continue;
    }
    if (depth === 0) {
      let matched: [string, string] | null = null;
      for (const [sep, op] of SEPS) {
        if (text.slice(i, i + sep.length).toLowerCase() === sep.toLowerCase()) {
          matched = [sep, op];
          break;
        }
      }
      if (matched) {
        leaves.push(buf.join("").trim());
        ops.push(matched[1]);
        buf.length = 0;
        i += matched[0].length;
        continue;
      }
    }
    buf.push(ch);
    i++;
  }
  leaves.push(buf.join("").trim());
  return [leaves, ops];
}

export function isAlternating(ops: string[]): boolean {
  if (ops.length < 3) return false;
  for (let i = 1; i < ops.length; i++) {
    if (ops[i] === ops[i - 1]) return false;
  }
  return true;
}
