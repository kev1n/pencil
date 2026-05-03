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
    for (const group of entry.commentGroups) {
      for (const comment of group.comments) {
        const text = comment.trim();
        if (!text) continue;
        raw.push({
          term: entry.term,
          instructor: entry.instructor,
          prompt: group.prompt,
          text,
          tone: classifySentiment(text),
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
