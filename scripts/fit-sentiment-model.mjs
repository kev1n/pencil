// Fits the comment-tone table in
// src/content/augmentations/paper-ctec/sentiment-model.ts.
//
//   node scripts/fit-sentiment-model.mjs <labeled.json> [--check-only]
//
// <labeled.json> is an array of
//   { "text": "...", "tone": "pos|mix|neu|neg", "course": "ECON 201", "rating": 4.3 }
// where `course` groups comments that share a class and `rating` is that
// class's 1-to-6 rating for the comment's term (null when unknown). CTEC
// comments are private to Northwestern, so the labeled file is not in the
// repo: keep it in a gitignored folder.
//
// The script first prints leave-one-course-out accuracy: for each course,
// fit on every other course and score that one. That is the number to
// trust, because comments from one course share vocabulary. It then fits on
// everything and writes the table. With --check-only it stops after the
// accuracy report.
//
// Features come from `toneFeatures` in sentiment.ts itself (bundled here on
// the fly), so the table and the code that reads it cannot drift apart.

import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCORER = path.join(ROOT, "src/content/augmentations/paper-ctec/sentiment.ts");
const OUTPUT = path.join(ROOT, "src/content/augmentations/paper-ctec/sentiment-model.ts");

const TONES = ["pos", "mix", "neu", "neg"];

// Word features kept in the shipped table. More words did not score better
// on held-out courses, and a short list stays readable.
const WORDS_KEPT = 60;
// A word is a candidate only if it shows up in this share of the courses,
// which keeps subject vocabulary ("chem", "racket") out of the table.
const MIN_COURSE_SHARE = 0.6;
// Rare tones get a boost so the fit does not just learn "most comments are
// positive": each tone is weighted by (average size / its size) ^ this.
const TONE_BALANCE = 0.5;
const L2 = 0.02;
const STEPS = 300;
const LEARNING_RATE = 0.05;

async function loadScorer() {
  const result = await build({
    entryPoints: [SCORER],
    bundle: true,
    format: "esm",
    write: false,
    logLevel: "silent"
  });
  const code = Buffer.from(result.outputFiles[0].text).toString("base64");
  return import(`data:text/javascript;base64,${code}`);
}

// Full-batch softmax regression with Adam. No randomness, so the same
// labeled file always produces the same table.
function fit(rows, featureNames) {
  const index = new Map(featureNames.map((name, i) => [name, i]));
  const width = featureNames.length;
  const tones = TONES.length;
  const weights = new Float64Array(width * tones);
  const examples = rows.map((row) => {
    const at = [];
    const value = [];
    for (const [name, v] of row.features) {
      const i = index.get(name);
      if (i != null) {
        at.push(i);
        value.push(v);
      }
    }
    return { at, value, tone: TONES.indexOf(row.tone) };
  });

  const sizes = TONES.map((_, t) => examples.filter((e) => e.tone === t).length);
  const balance = sizes.map((n) => (examples.length / (tones * Math.max(1, n))) ** TONE_BALANCE);

  const gradient = new Float64Array(weights.length);
  const mean = new Float64Array(weights.length);
  const variance = new Float64Array(weights.length);
  for (let step = 1; step <= STEPS; step++) {
    gradient.fill(0);
    for (const example of examples) {
      const p = probabilities(weights, example.at, example.value);
      for (let t = 0; t < tones; t++) {
        const delta = ((p[t] - (t === example.tone ? 1 : 0)) * balance[example.tone]) / examples.length;
        for (let k = 0; k < example.at.length; k++) {
          gradient[example.at[k] * tones + t] += delta * example.value[k];
        }
      }
    }
    for (let j = 0; j < weights.length; j++) {
      const g = gradient[j] + L2 * weights[j];
      mean[j] = 0.9 * mean[j] + 0.1 * g;
      variance[j] = 0.999 * variance[j] + 0.001 * g * g;
      const m = mean[j] / (1 - 0.9 ** step);
      const v = variance[j] / (1 - 0.999 ** step);
      weights[j] -= (LEARNING_RATE * m) / (Math.sqrt(v) + 1e-8);
    }
  }
  return { index, weights };
}

function probabilities(weights, at, value) {
  const scores = TONES.map(() => 0);
  for (let k = 0; k < at.length; k++) {
    for (let t = 0; t < scores.length; t++) scores[t] += weights[at[k] * scores.length + t] * value[k];
  }
  const top = Math.max(...scores);
  const exp = scores.map((s) => Math.exp(s - top));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((e) => e / sum);
}

function predict(model, features) {
  const at = [];
  const value = [];
  for (const [name, v] of features) {
    const i = model.index.get(name);
    if (i != null) {
      at.push(i);
      value.push(v);
    }
  }
  const p = probabilities(model.weights, at, value);
  return TONES[p.indexOf(Math.max(...p))];
}

// Two passes: fit with every widely used word, keep the words whose
// weights separate the tones most, then fit again with just those.
function fitWithWordSelection(rows, wordPrefix) {
  const isWord = (name) => name.startsWith(wordPrefix);
  const courses = new Set(rows.map((r) => r.course));
  const seenIn = new Map();
  for (const row of rows) {
    for (const name of row.features.keys()) {
      if (!seenIn.has(name)) seenIn.set(name, new Set());
      seenIn.get(name).add(row.course);
    }
  }
  const names = [...seenIn.keys()];
  const dense = names.filter((name) => !isWord(name));
  const candidates = names.filter(
    (name) => isWord(name) && seenIn.get(name).size >= courses.size * MIN_COURSE_SHARE
  );

  const first = fit(rows, [...dense, ...candidates]);
  const spread = (name) => {
    const at = first.index.get(name) * TONES.length;
    const w = TONES.map((_, t) => first.weights[at + t]);
    const average = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.max(...w.map((x) => Math.abs(x - average)));
  };
  const kept = candidates
    .map((name) => [name, spread(name)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, WORDS_KEPT)
    .map(([name]) => name);

  const names2 = [...dense, ...kept];
  return { ...fit(rows, names2), names: names2 };
}

function accuracy(pairs) {
  return pairs.filter(([gold, guess]) => gold === guess).length / pairs.length;
}

function leaveOneCourseOut(rows, wordPrefix) {
  const courses = [...new Set(rows.map((r) => r.course))];
  const pairs = [];
  const perCourse = [];
  for (const course of courses) {
    const model = fitWithWordSelection(rows.filter((r) => r.course !== course), wordPrefix);
    const held = rows.filter((r) => r.course === course).map((r) => [r.tone, predict(model, r.features)]);
    pairs.push(...held);
    perCourse.push([course, held.length, accuracy(held)]);
  }
  return { overall: accuracy(pairs), perCourse, pairs };
}

function render(model, rowCount, courseCount) {
  const lines = model.names.map((name) => {
    const at = model.index.get(name) * TONES.length;
    const w = TONES.map((_, t) => Number(model.weights[at + t].toFixed(3)));
    return `    ${JSON.stringify(name)}: [${w.join(", ")}]`;
  });
  return `// Generated by scripts/fit-sentiment-model.mjs from ${rowCount} labeled comments
// across ${courseCount} courses. Do not edit by hand: refit instead.
//
// One row per feature from \`toneFeatures\` in sentiment.ts; the four numbers
// are that feature's weight toward each tone, in the order of \`tones\`. The
// tone with the largest weighted sum wins.

import type { SentimentTone } from "./sentiment";

export const TONE_MODEL: {
  tones: readonly SentimentTone[];
  weights: Readonly<Record<string, readonly number[]>>;
} = {
  tones: ${JSON.stringify(TONES)},
  weights: {
${lines.join(",\n")}
  }
};
`;
}

const [labeledPath, flag] = process.argv.slice(2);
if (!labeledPath) {
  console.error("usage: node scripts/fit-sentiment-model.mjs <labeled.json> [--check-only]");
  process.exit(1);
}

const scorer = await loadScorer();
const rows = JSON.parse(fs.readFileSync(labeledPath, "utf8")).map((row) => ({
  ...row,
  features: scorer.toneFeatures(row.text, row.rating)
}));
const courseCount = new Set(rows.map((r) => r.course)).size;

const held = leaveOneCourseOut(rows, scorer.WORD_FEATURE_PREFIX);
console.log(`${rows.length} comments, ${courseCount} courses`);
console.log(`leave-one-course-out accuracy: ${(held.overall * 100).toFixed(1)}%`);
for (const [course, n, acc] of held.perCourse) {
  console.log(`  ${course.padEnd(16)} ${String(n).padStart(4)}  ${(acc * 100).toFixed(0)}%`);
}
for (const tone of TONES) {
  const ofTone = held.pairs.filter(([gold]) => gold === tone);
  console.log(`  ${tone}: ${ofTone.filter(([, guess]) => guess === tone).length} of ${ofTone.length} found`);
}

if (flag !== "--check-only") {
  const model = fitWithWordSelection(rows, scorer.WORD_FEATURE_PREFIX);
  fs.writeFileSync(OUTPUT, render(model, rows.length, courseCount));
  console.log(`wrote ${path.relative(ROOT, OUTPUT)}`);
}
