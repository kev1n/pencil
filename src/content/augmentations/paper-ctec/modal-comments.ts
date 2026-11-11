import type { CtecCourseAnalyticsEntry } from "../ctec-links/reports";
import type { CtecLinkParams } from "../ctec-links/types";
import type { ModalComment } from "./modal-data";
import {
  buildSuppressionTokens,
  extractFrequentTopics,
  matchTopics
} from "./modal-topics";
import { classifySentiment } from "./sentiment";

export function collectComments(
  entries: CtecCourseAnalyticsEntry[],
  params: CtecLinkParams,
  titleHint: string
): ModalComment[] {
  // Pass 1: collect raw comments with text + identity.
  type RawComment = Omit<ModalComment, "topics">;
  const raw: RawComment[] = [];
  for (const entry of entries) {
    const rating = courseRatingOf(entry);
    for (const group of entry.commentGroups) {
      for (const comment of group.comments) {
        const text = comment.trim();
        if (!text) continue;
        raw.push({
          term: entry.term,
          instructor: entry.instructor,
          description: entry.description,
          prompt: group.prompt,
          text,
          tone: classifySentiment(text, rating),
          length: text.length
        });
      }
    }
  }

  // Pass 2: extract a course-specific phrase list once across all comments,
  // then per-comment topic membership is just "which phrases does this comment
  // contain". This is the "Frequent topics" rail — phrases the corpus
  // surfaces, not a static keyword map.
  const suppress = buildSuppressionTokens(params, titleHint, raw);
  const frequentTopics = extractFrequentTopics(raw.map((r) => r.text), suppress);

  return raw.map((r) => ({ ...r, topics: matchTopics(r.text, frequentTopics) }));
}

// The term's own 1-to-6 rating, as the tone scorer expects it: the mean of
// the instruction and course ratings, whichever of the two the report has.
function courseRatingOf(entry: CtecCourseAnalyticsEntry): number | null {
  const means = [entry.metrics.instruction?.mean, entry.metrics.course?.mean].filter(
    (mean): mean is number => typeof mean === "number"
  );
  if (means.length === 0) return null;
  return means.reduce((sum, mean) => sum + mean, 0) / means.length;
}
