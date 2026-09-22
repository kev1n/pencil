import { describe, expect, it } from "vitest";

import type { CtecIndexedEntry } from "../../ctec-index/types";
import { selectEntriesForTitle } from "./reports";

function entry(description: string, term = "2025 Fall"): CtecIndexedEntry {
  return {
    actionId: description,
    term,
    description,
    instructor: "Marcelo Worsley",
    blueraUrl: `https://example.test/${encodeURIComponent(description)}`,
    error: null,
    searchText: description.toLowerCase()
  };
}

describe("selectEntriesForTitle", () => {
  const multimodal = entry(
    "COMP_SCI 397-0-3 Special Projects in Computer Science: Multimodal Learning Analytics and Interaction Analysis"
  );
  const sports = entry(
    "COMP_SCI 397-0-8 Special Projects in Computer Science: Explorations in Sports Video Analytics"
  );
  const tangible = entry(
    "COMP_SCI 397-0-2 Special Projects in Computer Science: Tangible Interfaces"
  );

  it("ignores the shared course title when picking a special-topics section", () => {
    const result = selectEntriesForTitle(
      [multimodal, sports, tangible],
      "Multimodal Learning Analytics and Interaction Anal - Special Projects in Computer Science"
    );
    expect(result).toEqual([multimodal]);
  });

  it("drops other topics on real CAESAR descriptions for Worsley's 397s", () => {
    // Verbatim from a user's cached index.
    const sportsFall = entry(
      "COMP_SCI 397-0-2 Special Projects in Computer Science: Sports, Technology and Learning",
      "2025 Fall"
    );
    const sportsSpring = entry(
      "COMP_SCI 397-0-9 Special Projects in Computer Science: Sports, Technology and Learning",
      "2024 Spring"
    );
    const multimodalInterfaces = entry(
      "COMP_SCI 397-0-6 Special Projects in Computer Science: Advanced Multimodal Interfaces and Analytics",
      "2023 Spring"
    );
    const result = selectEntriesForTitle(
      [sportsFall, sportsSpring, multimodalInterfaces],
      "Multimodal Learning Analytics and Interaction Anal - Special Projects in Computer Science"
    );
    // None of these is the Multimodal Learning Analytics topic — the
    // closest ("Advanced Multimodal Interfaces and Analytics") shares two
    // of five topic words, not enough to count as the same course.
    expect(result).toEqual([]);
  });

  it("keeps every term of the matching topic", () => {
    const sportsFall = entry(
      "COMP_SCI 397-0-2 Special Projects in Computer Science: Sports, Technology and Learning",
      "2025 Fall"
    );
    const sportsSpring = entry(
      "COMP_SCI 397-0-9 Special Projects in Computer Science: Sports, Technology and Learning",
      "2024 Spring"
    );
    const other = entry(
      "COMP_SCI 397-0-6 Special Projects in Computer Science: Advanced Multimodal Interfaces and Analytics"
    );
    expect(
      selectEntriesForTitle(
        [sportsFall, sportsSpring, other],
        "Sports, Technology and Learning - Special Projects in Computer Science"
      )
    ).toEqual([sportsFall, sportsSpring]);
  });

  it("falls back to everything for non-topic catalogs when nothing matches", () => {
    const a = entry("COMP_SCI 214-0-1 Data Structures and Algorithms");
    const b = entry("COMP_SCI 214-0-1 Data Structures Management");
    expect(selectEntriesForTitle([a, b], "Completely Unrelated Wording")).toEqual([a, b]);
  });

  it("keeps everything when the hint only has the shared course title", () => {
    const all = [multimodal, sports, tangible];
    expect(selectEntriesForTitle(all, "Special Projects in Computer Science")).toEqual(all);
  });

  it("still narrows ordinary cross-listed titles", () => {
    const intro = entry("COMP_SCI 214-0-1 Data Structures and Algorithms");
    const other = entry("COMP_SCI 214-0-1 Intro to Robotics Lab");
    expect(selectEntriesForTitle([intro, other], "Data Structures & Algorithms")).toEqual([intro]);
  });
});
