import { describe, expect, it } from "vitest";

import { classifySentiment, toneFeatures, WORD_FEATURE_PREFIX } from "./sentiment";
import { LEXICON, PHRASES } from "./sentiment-lexicon";
import { TONE_MODEL } from "./sentiment-model";

// Invented comments, one per rule. Accuracy against real comments is
// measured offline on labeled data; these pin the rules themselves.
describe("classifySentiment", () => {
  it.each([
    ["", "neu"],
    ["Yes", "neu"],
    ["Three quizzes, a midterm and a final project.", "neu"],
    ["This class is hard and the workload is demanding.", "neu"],
    ["Amazing professor and a really fun class.", "pos"],
    ["Challenging but rewarding.", "pos"],
    ["I learned a lot and would definitely recommend this class.", "pos"],
    ["The exams were not too bad.", "neu"],
    ["I had to teach myself everything.", "neg"],
    ["Lectures were boring and the grading was unfair.", "neg"],
    ["Would not recommend this class.", "neg"],
    ["A complete waste of time.", "neg"],
    ["The lectures were hard to follow.", "neg"],
    ["The lectures were not helpful.", "neg"],
    ["Good class. The pace was slow and dull.", "mix"]
  ] as const)("%j is %s", (text, tone) => {
    expect(classifySentiment(text)).toBe(tone);
  });

  it("reads negation written with a curly apostrophe", () => {
    expect(classifySentiment("It wasn’t good.")).toBe("neg");
    expect(classifySentiment("It wasn't good.")).toBe("neg");
  });

  it("lets the main clause outweigh the conceded one", () => {
    expect(classifySentiment("The readings were tedious, but the class was amazing.")).toBe("pos");
    expect(classifySentiment("Although the readings were tedious, the class was amazing.")).toBe("pos");
  });

  it("softens a word after 'kind of'", () => {
    expect(classifySentiment("Good class. The pace was slow and dull.")).toBe("mix");
    expect(classifySentiment("Good class. The pace was kind of slow.")).toBe("pos");
  });
});

describe("course rating", () => {
  const text = "Great professor, but the exams were brutal.";

  it("reads the same comment more critically in a poorly rated course", () => {
    expect(classifySentiment(text, 5.5)).toBe("pos");
    expect(classifySentiment(text, 2.8)).toBe("neg");
  });

  it("is optional", () => {
    expect(classifySentiment(text)).toBe(classifySentiment(text, null));
  });

  it("never turns a comment with no signal into praise or complaint", () => {
    expect(classifySentiment("Three quizzes, a midterm and a final project.", 2.5)).toBe("neu");
  });
});

describe("fitted table", () => {
  it("only weighs features the scorer can emit", () => {
    const emitted = new Set<string>();
    for (const rating of [null, 4]) {
      for (const tone of ["Amazing class.", "Awful class.", "Good class. The pace was slow and dull.", "Yes"]) {
        for (const name of toneFeatures(tone, rating).keys()) emitted.add(name);
      }
    }
    for (const name of Object.keys(TONE_MODEL.weights)) {
      if (name.startsWith(WORD_FEATURE_PREFIX)) continue;
      expect(emitted.has(name), name).toBe(true);
    }
  });

  it("has one weight per tone for every feature", () => {
    for (const weights of Object.values(TONE_MODEL.weights)) {
      expect(weights).toHaveLength(TONE_MODEL.tones.length);
    }
  });
});

describe("sentiment lexicon", () => {
  it("leaves difficulty words unscored", () => {
    for (const word of ["hard", "difficult", "challenging", "demanding", "tough", "easy"]) {
      expect(LEXICON.has(word)).toBe(false);
    }
  });

  it("uses global patterns so every occurrence in a sentence is matched", () => {
    for (const [pattern] of PHRASES) expect(pattern.global).toBe(true);
  });
});
