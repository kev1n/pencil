import type { ModalCommentTone, ModalDisplayData } from "../modal-data";
import { preventAndStop, stopPropagation } from "../ui-shared";
import {
  TONE_META,
  TOPIC_TONE_COLORS,
  TOPIC_TONE_LABELS,
  type AnalyticsModalCallbacks,
  type AnalyticsModalState,
  type ModalCommentSentimentFilter,
  type ModalCommentSort
} from "./types";

// Comments tab: rail of filter buttons (sentiment + frequent topics + term)
// alongside a main panel with search/sort toolbar, active filter chips,
// count, and the filtered comment-card list.
export function renderComments(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const root = doc.createElement("div");
  root.className = "bc-paper-ctec-modal-comments";

  root.append(renderCommentsRail(doc, data, state, callbacks));
  root.append(renderCommentsMain(doc, data, state, callbacks));

  return root;
}

function renderCommentsRail(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const rail = doc.createElement("aside");
  rail.className = "bc-paper-ctec-modal-rail";

  rail.append(railHeader(doc, "Sentiment"));
  const sentimentRows: Array<{
    key: ModalCommentSentimentFilter;
    label: string;
    count: number;
    dot: string;
  }> = [
    { key: "all", label: "All", count: data.comments.length, dot: "#d8b6c8" },
    { key: "pos", label: "Positive", count: data.sentimentCounts.pos, dot: "#15803d" },
    { key: "mix", label: "Mixed", count: data.sentimentCounts.mix, dot: "#a16207" },
    { key: "neu", label: "Neutral", count: data.sentimentCounts.neu, dot: "#7a596a" },
    { key: "neg", label: "Critical", count: data.sentimentCounts.neg, dot: "#9f1239" }
  ];
  for (const row of sentimentRows) {
    const active = state.commentsSentimentFilter === row.key;
    const button = railButton(doc, row.label, row.count, active, () => {
      callbacks.onCommentsSentimentChange(row.key);
    });
    const dot = doc.createElement("span");
    dot.className = "bc-paper-ctec-modal-rail-dot";
    dot.style.background = row.dot;
    button.prepend(dot);
    rail.append(button);
  }

  rail.append(railHeader(doc, "Frequent topics"));
  rail.append(
    railButton(doc, "All topics", data.comments.length, !state.commentsActiveTopic, () => {
      callbacks.onCommentsTopicChange(null);
    })
  );
  if (data.topics.length === 0) {
    const empty = doc.createElement("div");
    empty.className = "bc-paper-ctec-modal-rail-empty";
    empty.textContent = "Not enough comments yet to surface common phrases.";
    rail.append(empty);
  }
  for (const topic of data.topics) {
    const active = state.commentsActiveTopic === topic.label;
    const button = railButton(doc, topic.label, topic.count, active, () => {
      callbacks.onCommentsTopicChange(active ? null : topic.label);
    });
    // Tone bar sits below the label/count so users can see at a glance
    // whether mentions of this phrase skew positive vs critical.
    button.append(renderTopicSentimentBar(doc, topic.sentiments));
    button.classList.add("has-sentiment");
    rail.append(button);
  }

  rail.append(railHeader(doc, "Term"));
  const allTerms = Array.from(new Set(data.comments.map((c) => c.term)));
  rail.append(
    railButton(
      doc,
      "All terms",
      data.comments.length,
      state.commentsTermFilter === "all",
      () => callbacks.onCommentsTermFilterChange("all")
    )
  );
  for (const termLabel of allTerms) {
    const count = data.comments.filter((c) => c.term === termLabel).length;
    const active = state.commentsTermFilter === termLabel;
    rail.append(
      railButton(doc, termLabel, count, active, () =>
        callbacks.onCommentsTermFilterChange(termLabel)
      )
    );
  }

  return rail;
}

function railHeader(doc: Document, text: string): HTMLElement {
  const header = doc.createElement("div");
  header.className = "bc-paper-ctec-modal-rail-header";
  header.textContent = text;
  return header;
}

function railButton(
  doc: Document,
  label: string,
  count: number,
  active: boolean,
  onClick: () => void
): HTMLElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = `bc-paper-ctec-modal-rail-btn${active ? " is-active" : ""}`;
  const labelEl = doc.createElement("span");
  labelEl.className = "bc-paper-ctec-modal-rail-label";
  labelEl.textContent = label;
  const countEl = doc.createElement("span");
  countEl.className = "bc-paper-ctec-modal-rail-count";
  countEl.textContent = String(count);
  button.append(labelEl, countEl);
  button.addEventListener("click", (event) => {
    preventAndStop(event);
    onClick();
  });
  return button;
}

// Tiny segmented bar showing tone distribution of comments containing a
// given frequent topic. Colors match the Sentiment rail dots — green
// (pos), amber (mix), gray (neu), red (neg).
function renderTopicSentimentBar(
  doc: Document,
  sentiments: Record<ModalCommentTone, number>
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-rail-tone";

  const total =
    sentiments.pos + sentiments.mix + sentiments.neu + sentiments.neg;
  if (total === 0) return wrapper;

  const tooltip = (["pos", "mix", "neu", "neg"] as ModalCommentTone[])
    .filter((tone) => sentiments[tone] > 0)
    .map((tone) => `${sentiments[tone]} ${TOPIC_TONE_LABELS[tone]}`)
    .join(" · ");
  wrapper.title = tooltip;

  for (const tone of ["pos", "mix", "neu", "neg"] as ModalCommentTone[]) {
    const value = sentiments[tone];
    if (value === 0) continue;
    const segment = doc.createElement("div");
    segment.className = "bc-paper-ctec-modal-rail-tone-seg";
    segment.style.flexGrow = String(value);
    segment.style.background = TOPIC_TONE_COLORS[tone];
    wrapper.append(segment);
  }
  return wrapper;
}

function renderCommentsMain(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const main = doc.createElement("main");
  main.className = "bc-paper-ctec-modal-comments-main";

  const toolbar = doc.createElement("div");
  toolbar.className = "bc-paper-ctec-modal-comments-toolbar";

  const searchWrap = doc.createElement("div");
  searchWrap.className = "bc-paper-ctec-modal-comments-search";
  const searchIcon = doc.createElement("span");
  searchIcon.textContent = "⌕";
  searchIcon.className = "bc-paper-ctec-modal-comments-search-icon";
  const input = doc.createElement("input");
  input.type = "search";
  input.placeholder = `Search ${data.comments.length} comments…`;
  input.className = "bc-paper-ctec-modal-comments-input";
  input.dataset.bcPaperCtecModalSearch = "1";
  input.value = state.commentsQuery;
  input.addEventListener("click", stopPropagation);
  input.addEventListener("keydown", stopPropagation);
  input.addEventListener("input", () => {
    renderCommentList(commentsList, countLabel, data, state, input.value);
  });
  searchWrap.append(searchIcon, input);
  toolbar.append(searchWrap);

  const sortWrap = doc.createElement("div");
  sortWrap.className = "bc-paper-ctec-modal-comments-sort";
  const sortLabel = doc.createElement("span");
  sortLabel.textContent = "Sort";
  const sortSelect = doc.createElement("select");
  sortSelect.className = "bc-paper-ctec-modal-comments-sort-select";
  for (const option of [
    { value: "recent", label: "Most recent" },
    { value: "longest", label: "Longest" },
    { value: "shortest", label: "Shortest" }
  ] as const) {
    const optEl = doc.createElement("option");
    optEl.value = option.value;
    optEl.textContent = option.label;
    if (state.commentsSortBy === option.value) optEl.selected = true;
    sortSelect.append(optEl);
  }
  sortSelect.addEventListener("click", stopPropagation);
  sortSelect.addEventListener("change", () => {
    callbacks.onCommentsSortChange(sortSelect.value as ModalCommentSort);
  });
  sortWrap.append(sortLabel, sortSelect);
  toolbar.append(sortWrap);

  main.append(toolbar);

  const filterChips = doc.createElement("div");
  filterChips.className = "bc-paper-ctec-modal-filter-chips";
  const hasFilters =
    state.commentsActiveTopic ||
    state.commentsSentimentFilter !== "all" ||
    state.commentsTermFilter !== "all";
  if (hasFilters) {
    const tag = doc.createElement("span");
    tag.className = "bc-paper-ctec-modal-filter-label";
    tag.textContent = "Filtered:";
    filterChips.append(tag);

    if (state.commentsSentimentFilter !== "all") {
      filterChips.append(
        renderChip(doc, sentimentLabel(state.commentsSentimentFilter), () =>
          callbacks.onCommentsSentimentChange("all")
        )
      );
    }
    if (state.commentsActiveTopic) {
      filterChips.append(
        renderChip(doc, state.commentsActiveTopic, () =>
          callbacks.onCommentsTopicChange(null)
        )
      );
    }
    if (state.commentsTermFilter !== "all") {
      filterChips.append(
        renderChip(doc, state.commentsTermFilter, () =>
          callbacks.onCommentsTermFilterChange("all")
        )
      );
    }
    const clear = doc.createElement("button");
    clear.type = "button";
    clear.className = "bc-paper-ctec-modal-filter-clear";
    clear.textContent = "Clear all";
    clear.addEventListener("click", (event) => {
      preventAndStop(event);
      callbacks.onCommentsSentimentChange("all");
      callbacks.onCommentsTopicChange(null);
      callbacks.onCommentsTermFilterChange("all");
    });
    filterChips.append(clear);
  }
  main.append(filterChips);

  const countLabel = doc.createElement("div");
  countLabel.className = "bc-paper-ctec-modal-comments-count";
  main.append(countLabel);

  const commentsList = doc.createElement("div");
  commentsList.className = "bc-paper-ctec-modal-comments-list";
  main.append(commentsList);

  renderCommentList(commentsList, countLabel, data, state, state.commentsQuery);

  return main;
}

function renderCommentList(
  container: HTMLElement,
  countLabel: HTMLElement,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  query: string
): void {
  const doc = container.ownerDocument;
  container.replaceChildren();

  let filtered = data.comments.filter((c) => {
    if (state.commentsSentimentFilter !== "all" && c.tone !== state.commentsSentimentFilter) {
      return false;
    }
    if (state.commentsActiveTopic && !c.topics.includes(state.commentsActiveTopic)) {
      return false;
    }
    if (state.commentsTermFilter !== "all" && c.term !== state.commentsTermFilter) {
      return false;
    }
    if (query.trim() && !c.text.toLowerCase().includes(query.trim().toLowerCase())) {
      return false;
    }
    return true;
  });
  if (state.commentsSortBy === "longest") {
    filtered = [...filtered].sort((a, b) => b.length - a.length);
  } else if (state.commentsSortBy === "shortest") {
    filtered = [...filtered].sort((a, b) => a.length - b.length);
  }

  const total = data.comments.length;
  const showingStrong = doc.createElement("strong");
  showingStrong.textContent = String(filtered.length);
  countLabel.replaceChildren(
    doc.createTextNode("Showing "),
    showingStrong,
    doc.createTextNode(` of ${total} comments`)
  );

  if (filtered.length === 0) {
    const empty = doc.createElement("div");
    empty.className = "bc-paper-ctec-modal-comments-empty";
    empty.textContent = "No comments match your filters.";
    container.append(empty);
    return;
  }

  // Active topic acts as a second highlight phrase alongside the search
  // query so users can see *where* in each comment the topic appears, not
  // just which comments contain it.
  const highlights = [query, state.commentsActiveTopic ?? ""].filter(
    (s): s is string => !!s.trim()
  );

  for (const comment of filtered) {
    container.append(
      renderCommentCard(doc, comment, highlights, state.commentsActiveTopic)
    );
  }
}

function renderCommentCard(
  doc: Document,
  comment: ModalDisplayData["comments"][number],
  highlights: string[],
  activeTopic: string | null
): HTMLElement {
  const tone = TONE_META[comment.tone];

  const card = doc.createElement("article");
  card.className = "bc-paper-ctec-modal-comment-card";
  card.style.borderLeftColor = tone.color;

  const meta = doc.createElement("div");
  meta.className = "bc-paper-ctec-modal-comment-meta";

  const left = doc.createElement("div");
  left.className = "bc-paper-ctec-modal-comment-meta-left";
  const tag = doc.createElement("span");
  tag.className = "bc-paper-ctec-modal-comment-tag";
  tag.style.color = tone.color;
  tag.style.background = tone.bg;
  const dot = doc.createElement("span");
  dot.className = "bc-paper-ctec-modal-comment-tag-dot";
  dot.style.background = tone.color;
  tag.append(dot, doc.createTextNode(tone.label));
  left.append(tag);

  const term = doc.createElement("span");
  term.className = "bc-paper-ctec-modal-comment-term";
  const termStrong = doc.createElement("strong");
  termStrong.textContent = comment.term;
  term.append(termStrong, doc.createTextNode(` · ${comment.instructor}`));
  left.append(term);
  meta.append(left);

  const length = doc.createElement("span");
  length.className = "bc-paper-ctec-modal-comment-length";
  length.textContent = `${comment.length} chars`;
  meta.append(length);
  card.append(meta);

  if (!isHiddenPrompt(comment.prompt)) {
    const prompt = doc.createElement("div");
    prompt.className = "bc-paper-ctec-modal-comment-prompt";
    prompt.textContent = `"${comment.prompt}"`;
    card.append(prompt);
  }

  const text = doc.createElement("div");
  text.className = "bc-paper-ctec-modal-comment-text";
  appendHighlighted(text, comment.text, highlights);
  card.append(text);

  // Heuristic clamp + show more / less.
  if (comment.text.length > 320) {
    text.classList.add("is-clamped");
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "bc-paper-ctec-modal-comment-toggle";
    toggle.textContent = "↓ Show more";
    toggle.addEventListener("click", (event) => {
      preventAndStop(event);
      const expanded = text.classList.toggle("is-clamped");
      toggle.textContent = expanded ? "↓ Show more" : "↑ Show less";
    });
    card.append(toggle);
  }

  if (comment.topics.length > 0) {
    const topics = doc.createElement("div");
    topics.className = "bc-paper-ctec-modal-comment-themes";
    for (const topic of comment.topics) {
      const chip = doc.createElement("span");
      chip.className = `bc-paper-ctec-modal-comment-theme${
        activeTopic === topic ? " is-active" : ""
      }`;
      chip.textContent = topic;
      topics.append(chip);
    }
    card.append(topics);
  }

  return card;
}

// Highlights any of the provided phrases inside `text`. Used for both the
// search query and the active frequent topic — same yellow ⟨mark⟩ for
// both. Phrases are deduped (case-insensitive) so when query == topic we
// don't double-wrap. Earliest match wins when phrases overlap, with the
// longer phrase preferred at the same position.
function appendHighlighted(
  container: HTMLElement,
  text: string,
  phrases: string[]
): void {
  const cleaned = Array.from(
    new Set(
      phrases
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length > 0)
    )
  );
  if (cleaned.length === 0) {
    container.textContent = text;
    return;
  }
  const lowerText = text.toLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    let bestStart = -1;
    let bestEnd = -1;
    for (const phrase of cleaned) {
      const found = lowerText.indexOf(phrase, cursor);
      if (found < 0) continue;
      const end = found + phrase.length;
      if (
        bestStart < 0 ||
        found < bestStart ||
        (found === bestStart && end > bestEnd)
      ) {
        bestStart = found;
        bestEnd = end;
      }
    }
    if (bestStart < 0) {
      container.append(text.slice(cursor));
      return;
    }
    if (bestStart > cursor) container.append(text.slice(cursor, bestStart));
    const mark = container.ownerDocument.createElement("mark");
    mark.textContent = text.slice(bestStart, bestEnd);
    mark.className = "bc-paper-ctec-modal-highlight";
    container.append(mark);
    cursor = bestEnd;
  }
}

function renderChip(
  doc: Document,
  label: string,
  onClear: () => void
): HTMLElement {
  const chip = doc.createElement("span");
  chip.className = "bc-paper-ctec-modal-filter-chip";
  chip.textContent = label;
  const x = doc.createElement("button");
  x.type = "button";
  x.textContent = "✕";
  x.className = "bc-paper-ctec-modal-filter-chip-x";
  x.addEventListener("click", (event) => {
    preventAndStop(event);
    onClear();
  });
  chip.append(x);
  return chip;
}

function sentimentLabel(filter: ModalCommentSentimentFilter): string {
  if (filter === "pos") return "Positive";
  if (filter === "neg") return "Critical";
  if (filter === "mix") return "Mixed";
  if (filter === "neu") return "Neutral";
  return "All";
}

const HIDDEN_PROMPTS = new Set<string>([
  "please summarize your reaction to this course focusing on the aspects that were most important to you"
]);

function isHiddenPrompt(prompt: string): boolean {
  const normalized = prompt
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?;:,]+$/u, "")
    .trim();
  return HIDDEN_PROMPTS.has(normalized);
}
