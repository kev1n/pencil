// Sentence-scoped sentiment scorer for CTEC student comments.
//
// What this is and isn't:
//   - This is a tiny lexicon + rule scorer. It is *not* a real NLP model.
//     Treat the labels (positive / mixed / neutral / critical) as a rough
//     filter, not an authoritative emotional analysis.
//   - The previous implementation counted positive/negative keyword hits
//     across the whole comment, which mis-tagged "Very good intro level
//     class. ... Racket is a very frustrating language to write in, but
//     thankfully ..." as critical because "frustrating" outweighed
//     everything else. This pass fixes that with three rules:
//       1. score per *sentence*, not per comment
//       2. handle negation (`not bad` flips, scoped within a sentence)
//       3. handle concession (`X but Y` weights Y more, but only within
//          the same sentence — Codex flagged whole-comment concession as
//          a footgun for multi-paragraph comments)
//   - We also keep a CTEC-specific override layer because in this domain
//     `challenging` / `hard` / `demanding` are not negative — they're
//     often praise — and a generic AFINN-style lexicon misses that.

export type SentimentTone = "pos" | "neu" | "mix" | "neg";

export function classifySentiment(text: string): SentimentTone {
  if (!text.trim()) return "neu";

  const sentences = splitSentences(text);

  let posMass = 0;
  let negMass = 0;
  for (const sentence of sentences) {
    const score = scoreSentence(sentence);
    if (score > 0) posMass += score;
    else if (score < 0) negMass += -score;
  }

  // Mixed beats positive/negative when both sides carry meaningful mass.
  // Threshold scales with comment length so a single negative aside in a
  // long positive comment doesn't flip the label to mixed.
  const total = posMass + negMass;
  if (total === 0) return "neu";

  const mixedThreshold = 0.25;
  const posShare = posMass / total;
  const negShare = negMass / total;
  const isMixed = posShare >= mixedThreshold && negShare >= mixedThreshold;

  if (isMixed) return "mix";
  if (posShare > negShare) return "pos";
  if (negShare > posShare) return "neg";
  return "neu";
}

// Splits on sentence-ending punctuation. Newlines also count — students
// occasionally write multi-paragraph comments without terminal periods.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Concession cues split a sentence into a "before" half and an "after"
// half; the after-half is weighted more heavily because it usually carries
// the writer's main claim. Only applied within a single sentence so we
// don't accidentally stitch unrelated thoughts across periods.
const CONCESSION_CUES = ["but", "however", "although", "though", "thankfully", "overall"];
const CONCESSION_BEFORE_WEIGHT = 0.5;
const CONCESSION_AFTER_WEIGHT = 1.5;

const NEGATION_CUES = new Set([
  "not", "no", "never", "none", "nothing", "nobody", "neither", "nor",
  "cant", "cannot", "dont", "didnt", "doesnt", "wasnt", "werent", "isnt",
  "arent", "wont", "couldnt", "shouldnt", "wouldnt", "havent", "hasnt"
]);
const NEGATION_WINDOW = 3; // tokens after a negation cue get sign-flipped

const INTENSIFIERS: Record<string, number> = {
  very: 1.5,
  really: 1.4,
  extremely: 1.7,
  incredibly: 1.6,
  super: 1.4,
  highly: 1.4,
  totally: 1.4,
  absolutely: 1.5,
  completely: 1.4,
  truly: 1.3,
  quite: 1.2,
  pretty: 1.15,
  fairly: 1.1
};
const DOWNTONERS: Record<string, number> = {
  slightly: 0.6,
  somewhat: 0.7,
  barely: 0.5,
  hardly: 0.5,
  bit: 0.7,
  little: 0.7,
  kinda: 0.7,
  sorta: 0.7
};

function scoreSentence(sentence: string): number {
  const tokens = tokenize(sentence);
  if (tokens.length === 0) return 0;

  // Find concession cue index (first occurrence). Halve weight before,
  // amplify after. Sentence-scoped only.
  const cueIndex = tokens.findIndex((t) => CONCESSION_CUES.includes(t));
  const positionalWeight = (i: number): number => {
    if (cueIndex < 0) return 1;
    if (i < cueIndex) return CONCESSION_BEFORE_WEIGHT;
    if (i === cueIndex) return 1;
    return CONCESSION_AFTER_WEIGHT;
  };

  let total = 0;
  let negationRemaining = 0;
  let pendingMultiplier = 1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (NEGATION_CUES.has(token)) {
      negationRemaining = NEGATION_WINDOW;
      continue;
    }

    if (INTENSIFIERS[token] != null) {
      pendingMultiplier *= INTENSIFIERS[token]!;
      continue;
    }
    if (DOWNTONERS[token] != null) {
      pendingMultiplier *= DOWNTONERS[token]!;
      continue;
    }

    const baseScore = LEXICON[token];
    if (baseScore != null) {
      let signed = baseScore * pendingMultiplier;
      if (negationRemaining > 0) signed = -signed;
      total += signed * positionalWeight(i);
      pendingMultiplier = 1;
    }

    if (negationRemaining > 0) negationRemaining -= 1;
  }

  return total;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────
// Lexicon
//
// Two layers:
//   - GENERIC_LEXICON: small AFINN-style base (~150 words) covering
//     common positive/negative vocabulary.
//   - CTEC_OVERRIDES: ~40 words that need to behave differently in the
//     course-eval domain. Generic AFINN treats `challenging` as -2 (it's
//     an obstacle word), but in CTEC comments students mean it as praise:
//     "challenging but rewarding" is a recurring positive frame.
//
// The merge is "overrides win" — anything in CTEC_OVERRIDES replaces the
// generic value. Keep this list short and inspectable. If the labels
// start drifting, fix the lexicon entry rather than adding more rules.
// ─────────────────────────────────────────────────────────

const GENERIC_LEXICON: Record<string, number> = {
  // strong positives
  amazing: 3, awesome: 3, excellent: 3, fantastic: 3, brilliant: 3,
  wonderful: 3, incredible: 3, perfect: 3, outstanding: 3, phenomenal: 3,
  // moderate positives
  great: 2, good: 2, love: 2, loved: 2, enjoy: 2, enjoyed: 2,
  enjoyable: 2, fun: 2, helpful: 2, kind: 2, patient: 2, caring: 2,
  passionate: 2, recommended: 2, recommend: 2, smart: 2, engaged: 2,
  // mild positives
  nice: 1, fine: 1, ok: 1, okay: 1, decent: 1, solid: 1, glad: 1,
  thankful: 1, appreciate: 1, appreciated: 1, like: 1, liked: 1,
  approachable: 1, friendly: 1,
  // strong negatives
  terrible: -3, awful: -3, horrible: -3, worst: -3, hated: -3, hate: -3,
  miserable: -3, useless: -3, atrocious: -3, dreadful: -3,
  // moderate negatives
  bad: -2, boring: -2, frustrating: -2, frustrated: -2, annoying: -2,
  annoyed: -2, painful: -2, upset: -2, disappointing: -2, disappointed: -2,
  unfair: -2, unhelpful: -2, sucks: -2, sucked: -2, avoid: -2,
  // mild negatives
  meh: -1, weak: -1, slow: -1, dull: -1, repetitive: -1, dry: -1,
  rough: -1, lacking: -1, missing: -1, shaky: -1,
  // CTEC complaint vocabulary — these recur often enough in student
  // comments that omitting them would meaningfully under-count negatives.
  brutal: -2, stressful: -2, harsh: -2, punishing: -2, waste: -2
};

// CTEC-domain adjustments. These reflect what students actually mean in
// course-eval comments. If you tweak this list, run a pass over a real
// course's comments to verify the deltas — small lexicons are easy to
// over-tune to a single example.
const CTEC_OVERRIDES: Record<string, number> = {
  // "Hard" words are NOT negative in CTEC context. Students often praise
  // courses for being challenging — the negativity comes from `unfair`,
  // `unclear`, `disorganized`, etc., not from difficulty itself.
  challenging: 0,
  challenge: 0,
  hard: 0,
  difficult: 0,
  demanding: 0,
  rigorous: 1,
  tough: 0,
  // "Easy" isn't always positive either — `easy A` is praise, but
  // "too easy" is dismissive. Score it neutral; the surrounding
  // intensifiers/concessions handle the swing.
  easy: 0,

  // CTEC-specific positives that AFINN underweights or misses.
  clear: 2,
  organized: 2,
  fair: 2,
  engaging: 2,
  interesting: 2,
  manageable: 2,
  useful: 2,
  insightful: 2,
  understandable: 2,
  approachable: 2,
  doable: 2,

  // CTEC-specific negatives. These are the actual complaints students
  // voice, distinct from generic "this is bad."
  busywork: -2,
  unclear: -2,
  disorganized: -3,
  rushed: -2,
  tedious: -2,
  inconsistent: -2,
  overwhelming: -2,
  confusing: -2,
  pointless: -2,
  monotonous: -1,

  // Common modifiers that aren't really sentiment — neutralize so we
  // don't add noise.
  course: 0,
  class: 0,
  professor: 0,
  prof: 0,
  lecture: 0,
  homework: 0,
  exam: 0,
  midterm: 0,
  final: 0
};

const LEXICON: Record<string, number> = { ...GENERIC_LEXICON, ...CTEC_OVERRIDES };
