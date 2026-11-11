// Tone scorer for CTEC student comments: positive, mixed, neutral or critical.
//
// Everything runs in the page: a word-and-rule scorer, then a small fitted
// table that turns its output into a label. There is no language model
// here, so it has no idea what "like setting $5000 on fire" means. Treat
// the labels as a rough filter, not an authoritative reading.
//
// Step 1, rules (`scoreByRules`):
//   - Each sentence is scored on its own. Praise and complaint are added up
//     separately, so "great lecturer, but the textbook is useless" counts
//     on both sides instead of cancelling out.
//   - Known phrases are scored as one unit before single words are ("would
//     recommend this", "waste of time").
//   - Negation flips the next few words and weakens them: "not great" is a
//     complaint, but a milder one than "terrible".
//   - Around "but" and "although", the main clause counts more than the
//     conceded one.
//   - The first and last sentences count more, because that is where
//     students put their verdict.
//
// Step 2, the fitted table (`sentiment-model.ts`): a weight per tone for
// each feature from `toneFeatures`. The features are the rule totals, the
// course's own rating for that term, and whether each of about 60 common
// words appears. The rating matters because the rules cannot see a
// complaint written without complaint words ("the exams did not match the
// lectures"), and such comments are far more common in a course rated 3
// out of 6 than in one rated 5.5.
//
// The table is produced by `scripts/fit-sentiment-model.mjs` from labeled
// comments; see that file for how to refit. Measured against labels two
// readers agreed on, on seven courses neither the rules nor the table had
// seen: 79% agreement, against 67% for the keyword counter this replaced.
// When labels drift, fix the lexicon or refit rather than adding a rule
// for one example.

import {
  CONCESSION_CUES,
  CONTRAST_CUES,
  IGNORE,
  LEXICON,
  MODIFIERS,
  NEGATION_CUES,
  PHRASES,
  SOFTEN
} from "./sentiment-lexicon";
import { TONE_MODEL } from "./sentiment-model";

export type SentimentTone = "pos" | "neu" | "mix" | "neg";

// Complaints count this much more than praise. Students soften criticism
// and pad it with polite praise, so equal word weight under-reads it.
const COMPLAINT_WEIGHT = 2;
// Share of the total that must be praise for the rules to call a comment
// positive, and the share at or below which they call it critical.
const POSITIVE_SHARE = 0.55;
const CRITICAL_SHARE = 0.15;

const FIRST_SENTENCE_WEIGHT = 1.5;
const LAST_SENTENCE_WEIGHT = 1.25;

const CONCEDED_CLAUSE_WEIGHT = 0.5;
const MAIN_CLAUSE_WEIGHT = 1.5;

// Words after a negation cue that it still applies to. A comma ends it.
const NEGATION_WINDOW = 3;
// "not great" is weaker than "terrible"; "not bad" is faint praise.
const NEGATED_PRAISE_FACTOR = 0.75;
const NEGATED_COMPLAINT_FACTOR = 0.5;

const SOFTEN_FACTOR = 0.6;

// Stand-ins for a matched phrase inside a sentence, so the word loop can
// treat the phrase as one token.
const PHRASE_TOKEN_PREFIX = "zzph";
const COMMA = ",";

// Course ratings run 1 to 6. Centered near the typical course so an
// unrated comment (no rating features at all) reads as an average one.
const RATING_CENTER = 4.6;
const RATING_SCALE = 1.5;

// Prefix of the "this word appears" features, and of the same word when it
// follows a negation ("not helpful" is `w:!helpful`).
export const WORD_FEATURE_PREFIX = "w:";
const NEGATED_WORD_MARK = "!";

// `courseRating` is the course's own 1-to-6 rating for the term the comment
// comes from (see `courseRatingOf` in modal-comments.ts), when known.
export function classifySentiment(text: string, courseRating?: number | null): SentimentTone {
  if (!text.trim()) return "neu";

  const totals = TONE_MODEL.tones.map(() => 0);
  for (const [feature, value] of toneFeatures(text, courseRating)) {
    const weights = TONE_MODEL.weights[feature];
    if (!weights) continue;
    for (let tone = 0; tone < totals.length; tone++) totals[tone]! += weights[tone]! * value;
  }
  return TONE_MODEL.tones[totals.indexOf(Math.max(...totals))]!;
}

// Every feature the fitted table may weigh. Word features are emitted for
// every word in the comment; the table only holds weights for the few it
// kept, and the fitting script reads this same function, so the two cannot
// disagree about what a feature means.
export function toneFeatures(text: string, courseRating?: number | null): Map<string, number> {
  const normalized = normalize(text);
  const rules = scoreByRules(normalized);
  const total = rules.praise + COMPLAINT_WEIGHT * rules.complaint;
  const share = total === 0 ? 0.5 : rules.praise / total;

  const features = new Map<string, number>([
    ["bias", 1],
    ["praise", Math.log1p(rules.praise) / 3],
    ["complaint", Math.log1p(rules.complaint) / 3],
    ["share", share],
    ["noSignal", total === 0 ? 1 : 0],
    [`rules:${rules.tone}`, 1]
  ]);

  if (typeof courseRating === "number" && Number.isFinite(courseRating)) {
    const centered = (courseRating - RATING_CENTER) / RATING_SCALE;
    features.set("rating", centered);
    features.set("ratingTimesShare", centered * share);
    features.set("lowRating", Math.max(0, RATING_CENTER - courseRating));
  }

  let wordCount = 0;
  let negationRemaining = 0;
  for (const token of wordTokens(normalized)) {
    if (token === SENTENCE_END || token === COMMA) {
      negationRemaining = 0;
      continue;
    }
    wordCount += 1;
    if (NEGATION_CUES.has(token)) {
      negationRemaining = NEGATION_WINDOW;
      features.set(WORD_FEATURE_PREFIX + token, 1);
      continue;
    }
    const mark = negationRemaining > 0 ? NEGATED_WORD_MARK : "";
    features.set(WORD_FEATURE_PREFIX + mark + token, 1);
    if (negationRemaining > 0) negationRemaining -= 1;
  }
  features.set("length", Math.log1p(wordCount) / 6);

  return features;
}

const SENTENCE_END = ".";

function wordTokens(normalized: string): string[] {
  return normalized
    .replace(/'/g, "")
    .replace(/[.!?;:\n]+/g, ` ${SENTENCE_END} `)
    .replace(/,/g, ` ${COMMA} `)
    .replace(/[^a-z0-9.,\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

type RuleScore = { praise: number; complaint: number; tone: SentimentTone };

function scoreByRules(normalized: string): RuleScore {
  const sentences = splitSentences(normalized);
  const last = sentences.length - 1;

  let praise = 0;
  let complaint = 0;
  sentences.forEach((sentence, index) => {
    const score = scoreSentence(sentence);
    let weight = 1;
    if (last > 0 && index === 0) weight *= FIRST_SENTENCE_WEIGHT;
    if (last > 0 && index === last) weight *= LAST_SENTENCE_WEIGHT;
    praise += score.praise * weight;
    complaint += score.complaint * weight;
  });

  const total = praise + COMPLAINT_WEIGHT * complaint;
  let tone: SentimentTone = "mix";
  if (total === 0) tone = "neu";
  else if (praise / total >= POSITIVE_SHARE) tone = "pos";
  else if (praise / total <= CRITICAL_SHARE) tone = "neg";
  return { praise, complaint, tone };
}

// CTEC text comes with curly apostrophes and en dashes. Left alone, "wasn’t"
// splits into "wasn" + "t" and the negation is lost.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[–—]/g, " - ");
}

// Newlines also end a sentence: students write multi-paragraph comments
// without closing periods.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;:])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(sentence: string): string[] {
  let cleaned = sentence.replace(/'/g, "").replace(/[^a-z0-9,\s]+/g, " ");
  PHRASES.forEach(([pattern], index) => {
    cleaned = cleaned.replace(pattern, ` ${PHRASE_TOKEN_PREFIX}${index} `);
  });
  return cleaned.replace(/,/g, ` ${COMMA} `).split(/\s+/).filter(Boolean);
}

// How much each position in the sentence counts, given where its contrast
// or concession cue sits.
function clauseWeights(tokens: string[]): (index: number) => number {
  const contrast = tokens.findIndex((t) => CONTRAST_CUES.has(t));
  if (contrast >= 0) {
    return (i) => (i < contrast ? CONCEDED_CLAUSE_WEIGHT : MAIN_CLAUSE_WEIGHT);
  }

  const concession = tokens.findIndex((t) => CONCESSION_CUES.has(t));
  if (concession < 0) return () => 1;

  // "Although X, Y": X runs up to the comma. "Y, although X": X runs to
  // the end.
  if (concession <= 1) {
    const comma = tokens.indexOf(COMMA, concession);
    const end = comma < 0 ? tokens.length : comma;
    return (i) => (i < end ? CONCEDED_CLAUSE_WEIGHT : MAIN_CLAUSE_WEIGHT);
  }
  return (i) => (i < concession ? MAIN_CLAUSE_WEIGHT : CONCEDED_CLAUSE_WEIGHT);
}

function scoreSentence(sentence: string): { praise: number; complaint: number } {
  const tokens = tokenize(sentence);
  const weightAt = clauseWeights(tokens);

  let praise = 0;
  let complaint = 0;
  let negationRemaining = 0;
  let multiplier = 1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (token === COMMA) {
      negationRemaining = 0;
      continue;
    }
    if (NEGATION_CUES.has(token)) {
      negationRemaining = NEGATION_WINDOW;
      continue;
    }

    let base = LEXICON.get(token);
    if (token.startsWith(PHRASE_TOKEN_PREFIX)) {
      const effect = PHRASES[Number(token.slice(PHRASE_TOKEN_PREFIX.length))]?.[1];
      if (effect === SOFTEN) {
        multiplier *= SOFTEN_FACTOR;
        continue;
      }
      if (effect === IGNORE) continue;
      base = effect;
    }

    if (base == null) {
      const modifier = MODIFIERS.get(token);
      if (modifier != null) {
        multiplier *= modifier;
        continue;
      }
    } else {
      let score = base * multiplier;
      if (negationRemaining > 0) {
        score *= -(score > 0 ? NEGATED_PRAISE_FACTOR : NEGATED_COMPLAINT_FACTOR);
      }
      score *= weightAt(i);
      if (score > 0) praise += score;
      else complaint -= score;
      multiplier = 1;
    }

    if (negationRemaining > 0) negationRemaining -= 1;
  }

  return { praise, complaint };
}
