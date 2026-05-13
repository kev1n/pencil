import { html, render, type TemplateResult } from "lit-html";

import { extractCatalogLabel } from "../../../ctec-index/helpers";
import type { CtecAnalyticsStrategy } from "../../ctec-links/types";
import type { ModalCommentTone, ModalDisplayData } from "../modal-data";
import { preventAndStop, stopPropagation } from "../ui-shared";
import type { Section } from "./section";
import {
  COMMENTS_PAGE_SIZE,
  TONE_META,
  TOPIC_TONE_COLORS,
  TOPIC_TONE_LABELS,
  type AnalyticsModalCallbacks,
  type AnalyticsModalState,
  type ModalCommentSentimentFilter,
  type ModalCommentSort
} from "./types";

export type CommentsSectionProps = {
  doc: Document;
  data: ModalDisplayData;
  strategy: CtecAnalyticsStrategy;
  state: AnalyticsModalState;
  callbacks: AnalyticsModalCallbacks;
};

// Comments tab: rail of filter buttons (sentiment + frequent topics + term)
// alongside a main panel with search/sort toolbar, active filter chips,
// count, and the filtered comment-card list.
export const CommentsSection: Section<CommentsSectionProps> = {
  render({ doc, data, strategy, state, callbacks }) {
    return html`<div class="bc-paper-ctec-modal-comments">
      ${renderCommentsRail(data, state, callbacks)}
      ${renderCommentsMain(doc, data, strategy, state, callbacks)}
    </div>`;
  }
};

function renderCommentsRail(
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  // Sentiment, term, and topic all cross-filter each other: each rail's
  // counts respect the *other* two active filters but ignore its own, so
  // toggling the active selection in any rail still works.
  const topicMatches = (c: ModalDisplayData["comments"][number]) =>
    !state.commentsActiveTopic || c.topics.includes(state.commentsActiveTopic);
  const termFiltered = data.comments.filter(
    (c) =>
      (state.commentsTermFilter === "all" || c.term === state.commentsTermFilter) &&
      topicMatches(c)
  );
  const sentimentFiltered = data.comments.filter(
    (c) =>
      (state.commentsSentimentFilter === "all" ||
        c.tone === state.commentsSentimentFilter) &&
      topicMatches(c)
  );
  const sentimentCounts: Record<ModalCommentTone, number> = {
    pos: 0,
    mix: 0,
    neu: 0,
    neg: 0
  };
  for (const c of termFiltered) sentimentCounts[c.tone] += 1;

  const sentimentRows: Array<{
    key: ModalCommentSentimentFilter;
    label: string;
    count: number;
    color: string;
  }> = [
    { key: "all", label: "All", count: termFiltered.length, color: "var(--bc-color-sentiment-all-dot)" },
    { key: "pos", label: "Positive", count: sentimentCounts.pos, color: "var(--bc-color-sentiment-pos-fg)" },
    { key: "mix", label: "Mixed", count: sentimentCounts.mix, color: "var(--bc-color-sentiment-mix-fg)" },
    { key: "neu", label: "Neutral", count: sentimentCounts.neu, color: "var(--bc-color-sentiment-neu-fg)" },
    { key: "neg", label: "Critical", count: sentimentCounts.neg, color: "var(--bc-color-sentiment-neg-fg)" }
  ];

  const allCount = Math.max(termFiltered.length, 1);
  const allTerms = Array.from(new Set(data.comments.map((c) => c.term)));

  return html`<aside class="bc-paper-ctec-modal-rail">
    ${railHeader("Sentiment")}
    ${sentimentRows.map((row) => {
      const ratio = row.key === "all" ? 1 : row.count / allCount;
      return railButton(
        row.label,
        row.count,
        state.commentsSentimentFilter === row.key,
        () => callbacks.onCommentsSentimentChange(row.key),
        undefined,
        html`<span class="bc-paper-ctec-modal-rail-bar-wrap"
          ><span
            class="bc-paper-ctec-modal-rail-bar"
            style=${`width: ${Math.max(ratio * 100, 4)}%; background: ${row.color}`}
          ></span
        ></span>`,
        true
      );
    })}
    ${railHeader("Frequent topics")}
    ${railButton(
      "All topics",
      data.comments.length,
      !state.commentsActiveTopic,
      () => callbacks.onCommentsTopicChange(null)
    )}
    ${data.topics.length === 0
      ? html`<div class="bc-paper-ctec-modal-rail-empty"
          >Not enough comments yet to surface common phrases.</div
        >`
      : ""}
    ${data.topics.map((topic) => {
      const active = state.commentsActiveTopic === topic.label;
      return railButton(
        topic.label,
        topic.count,
        active,
        () => callbacks.onCommentsTopicChange(active ? null : topic.label),
        undefined,
        renderTopicSentimentBar(topic.sentiments),
        true
      );
    })}
    ${railHeader("Term")}
    ${railButton(
      "All terms",
      sentimentFiltered.length,
      state.commentsTermFilter === "all",
      () => callbacks.onCommentsTermFilterChange("all")
    )}
    ${allTerms.map((termLabel) => {
      const count = sentimentFiltered.filter((c) => c.term === termLabel).length;
      return railButton(
        termLabel,
        count,
        state.commentsTermFilter === termLabel,
        () => callbacks.onCommentsTermFilterChange(termLabel)
      );
    })}
  </aside>`;
}

function railHeader(text: string): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-rail-header">${text}</div>`;
}

function railButton(
  label: string,
  count: number,
  active: boolean,
  onClick: () => void,
  prefix?: TemplateResult,
  suffix?: TemplateResult,
  hasSentiment?: boolean
): TemplateResult {
  const cls = `bc-paper-ctec-modal-rail-btn${active ? " is-active" : ""}${
    hasSentiment ? " has-sentiment" : ""
  }`;
  return html`<button
    type="button"
    class=${cls}
    @click=${(event: Event) => {
      preventAndStop(event);
      onClick();
    }}
  >${prefix ?? ""}<span class="bc-paper-ctec-modal-rail-label">${label}</span
    ><span class="bc-paper-ctec-modal-rail-count">${count}</span>${suffix ?? ""}</button>`;
}

// Tiny segmented bar showing tone distribution of comments containing a
// given frequent topic. Colors match the Sentiment rail dots — green
// (pos), amber (mix), gray (neu), red (neg).
function renderTopicSentimentBar(
  sentiments: Record<ModalCommentTone, number>
): TemplateResult {
  const total =
    sentiments.pos + sentiments.mix + sentiments.neu + sentiments.neg;
  if (total === 0) {
    return html`<div class="bc-paper-ctec-modal-rail-tone"></div>`;
  }

  const tooltip = (["pos", "mix", "neu", "neg"] as ModalCommentTone[])
    .filter((tone) => sentiments[tone] > 0)
    .map((tone) => `${sentiments[tone]} ${TOPIC_TONE_LABELS[tone]}`)
    .join(" · ");

  return html`<div class="bc-paper-ctec-modal-rail-tone" title=${tooltip}>
    ${(["pos", "mix", "neu", "neg"] as ModalCommentTone[]).map((tone) => {
      const value = sentiments[tone];
      if (value === 0) return "";
      return html`<div
        class="bc-paper-ctec-modal-rail-tone-seg"
        style=${`flex-grow: ${value}; background: ${TOPIC_TONE_COLORS[tone]}`}
      ></div>`;
    })}
  </div>`;
}

// Host elements (count label + comment list) are persisted across modal
// syncs via this per-document cache. ModalController.sync() runs on every
// paper.nu mutation; without the cache each render would create fresh
// hosts and lit-html's `${node}` interpolation would replace the
// previously-mounted nodes (visible flicker + event-handler churn on the
// "Show more" button). The `signature` field gates the imperative
// `renderCommentList` rebuild so unrelated syncs (background refresh,
// schedule mutation, …) don't repaint the list either.
const commentsHostCache = new WeakMap<
  Document,
  { list: HTMLElement; count: HTMLElement; signature: string }
>();

// Fingerprint of everything `renderCommentList` branches on. Comment count
// + term count proxies for "underlying CTEC data changed"; the state/query
// pieces cover filters, sort, search, and pagination.
function commentsListSignature(
  data: ModalDisplayData,
  state: AnalyticsModalState,
  query: string,
  strategy: CtecAnalyticsStrategy
): string {
  return [
    data.comments.length,
    data.terms.length,
    state.commentsSentimentFilter,
    state.commentsActiveTopic ?? "",
    state.commentsTermFilter,
    state.commentsSortBy,
    state.commentsVisibleCount,
    query,
    strategy
  ].join("\x1f");
}

function renderCommentsMain(
  doc: Document,
  data: ModalDisplayData,
  strategy: CtecAnalyticsStrategy,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  // Imperative comment list + count: keystroke-driven local re-renders avoid
  // the cost of running the full modal sync on every input event. lit-html
  // splats the host elements via ${} interpolation; the host cache keeps the
  // same node identity across syncs so lit-html's diff doesn't replace them.
  let cache = commentsHostCache.get(doc);
  if (!cache) {
    const list = doc.createElement("div");
    list.className = "bc-paper-ctec-modal-comments-list";
    const count = doc.createElement("div");
    count.className = "bc-paper-ctec-modal-comments-count";
    cache = { list, count, signature: "" };
    commentsHostCache.set(doc, cache);
  }
  const { list: commentsList, count: countLabel } = cache;

  const draw = (query: string) => {
    const sig = commentsListSignature(data, state, query, strategy);
    if (cache!.signature === sig) return;
    cache!.signature = sig;
    renderCommentList(commentsList, countLabel, data, strategy, state, query);
  };
  draw(state.commentsQuery);

  const hasFilters =
    state.commentsActiveTopic ||
    state.commentsSentimentFilter !== "all" ||
    state.commentsTermFilter !== "all";

  return html`<main class="bc-paper-ctec-modal-comments-main">
    <div class="bc-paper-ctec-modal-comments-toolbar">
      <div class="bc-paper-ctec-modal-comments-search">
        <span class="bc-paper-ctec-modal-comments-search-icon">⌕</span>
        <input
          type="search"
          placeholder=${`Search ${data.comments.length} comments…`}
          class="bc-paper-ctec-modal-comments-input"
          data-bc-paper-ctec-modal-search="1"
          .value=${state.commentsQuery}
          @click=${stopPropagation}
          @keydown=${stopPropagation}
          @input=${(event: Event) => {
            const value = (event.target as HTMLInputElement).value;
            state.commentsQuery = value;
            state.commentsVisibleCount = COMMENTS_PAGE_SIZE;
            draw(value);
          }}
        />
      </div>
      <div class="bc-paper-ctec-modal-comments-sort">
        <span>Sort</span>
        <select
          class="bc-paper-ctec-modal-comments-sort-select"
          @click=${stopPropagation}
          @change=${(event: Event) => {
            callbacks.onCommentsSortChange(
              (event.target as HTMLSelectElement).value as ModalCommentSort
            );
          }}
        >
          <option value="recent" ?selected=${state.commentsSortBy === "recent"}>Most recent</option>
          <option value="mostPositive" ?selected=${state.commentsSortBy === "mostPositive"}>Most positive</option>
          <option value="mostCritical" ?selected=${state.commentsSortBy === "mostCritical"}>Most critical</option>
          <option value="longest" ?selected=${state.commentsSortBy === "longest"}>Longest</option>
          <option value="shortest" ?selected=${state.commentsSortBy === "shortest"}>Shortest</option>
        </select>
      </div>
    </div>
    <div class="bc-paper-ctec-modal-filter-chips">
      ${hasFilters
        ? html`<span class="bc-paper-ctec-modal-filter-label">Filtered:</span>
            ${state.commentsSentimentFilter !== "all"
              ? renderChip(sentimentLabel(state.commentsSentimentFilter), () =>
                  callbacks.onCommentsSentimentChange("all")
                )
              : ""}
            ${state.commentsActiveTopic
              ? renderChip(state.commentsActiveTopic, () =>
                  callbacks.onCommentsTopicChange(null)
                )
              : ""}
            ${state.commentsTermFilter !== "all"
              ? renderChip(state.commentsTermFilter, () =>
                  callbacks.onCommentsTermFilterChange("all")
                )
              : ""}
            <button
              type="button"
              class="bc-paper-ctec-modal-filter-clear"
              @click=${(event: Event) => {
                preventAndStop(event);
                callbacks.onCommentsSentimentChange("all");
                callbacks.onCommentsTopicChange(null);
                callbacks.onCommentsTermFilterChange("all");
              }}
            >Clear all</button>`
        : ""}
    </div>
    ${countLabel}
    ${commentsList}
  </main>`;
}

// Imperative inner render so input keystrokes can repaint the comment list
// without triggering the full modal sync (which would teardown + rebuild
// the rail, toolbar, and other expensive subtrees).
function renderCommentList(
  container: HTMLElement,
  countLabel: HTMLElement,
  data: ModalDisplayData,
  strategy: CtecAnalyticsStrategy,
  state: AnalyticsModalState,
  query: string
): void {
  const doc = container.ownerDocument;

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
  } else if (state.commentsSortBy === "mostPositive") {
    const w: Record<ModalCommentTone, number> = { pos: 3, mix: 2, neu: 1, neg: 0 };
    filtered = [...filtered].sort((a, b) => w[b.tone] - w[a.tone]);
  } else if (state.commentsSortBy === "mostCritical") {
    const w: Record<ModalCommentTone, number> = { neg: 3, mix: 2, neu: 1, pos: 0 };
    filtered = [...filtered].sort((a, b) => w[b.tone] - w[a.tone]);
  }

  const visibleCount = Math.min(filtered.length, state.commentsVisibleCount);

  // Count label uses lit-html for the small dom write so we don't have to
  // hand-roll the strong+text builder.
  render(
    html`Showing <strong>${visibleCount}</strong> of ${filtered.length} comments`,
    countLabel
  );

  container.replaceChildren();

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

  for (let i = 0; i < visibleCount; i++) {
    container.append(
      renderCommentCard(doc, filtered[i]!, strategy, highlights, state.commentsActiveTopic)
    );
  }

  // Pagination: courses with hundreds of evals would otherwise build
  // thousands of nodes per tab switch. The "Show more" button extends
  // visibleCount in place and appends the next batch directly — no full
  // sync(), no rebuild of the rail or toolbar.
  if (visibleCount < filtered.length) {
    const more = doc.createElement("button");
    more.type = "button";
    more.className = "bc-paper-ctec-modal-comments-more";
    const renderMoreLabel = (rendered: number): void => {
      const remaining = filtered.length - rendered;
      const next = Math.min(COMMENTS_PAGE_SIZE, remaining);
      more.textContent = `Show ${next} more (${remaining} left)`;
    };
    renderMoreLabel(visibleCount);
    more.addEventListener("click", (event) => {
      preventAndStop(event);
      const currentRendered = state.commentsVisibleCount;
      const nextRendered = Math.min(filtered.length, currentRendered + COMMENTS_PAGE_SIZE);
      state.commentsVisibleCount = nextRendered;
      const fragment = doc.createDocumentFragment();
      for (let i = currentRendered; i < nextRendered; i++) {
        fragment.append(
          renderCommentCard(doc, filtered[i]!, strategy, highlights, state.commentsActiveTopic)
        );
      }
      container.insertBefore(fragment, more);
      render(
        html`Showing <strong>${nextRendered}</strong> of ${filtered.length} comments`,
        countLabel
      );
      if (nextRendered >= filtered.length) more.remove();
      else renderMoreLabel(nextRendered);
      // Patch the cached signature to match the new visibleCount so the
      // next modal sync sees a no-op draw() instead of rebuilding from
      // scratch (which would discard the just-appended cards).
      const cached = commentsHostCache.get(doc);
      if (cached) {
        cached.signature = commentsListSignature(data, state, query, strategy);
      }
    });
    container.append(more);
  }
}

function renderCommentCard(
  doc: Document,
  comment: ModalDisplayData["comments"][number],
  strategy: CtecAnalyticsStrategy,
  highlights: string[],
  activeTopic: string | null
): HTMLElement {
  const tone = TONE_META[comment.tone];

  const card = doc.createElement("article");
  card.className = "bc-paper-ctec-modal-comment-card";
  card.style.borderLeftColor = tone.color;

  if (!isHiddenPrompt(comment.prompt)) {
    const prompt = doc.createElement("div");
    prompt.className = "bc-paper-ctec-modal-comment-prompt";
    prompt.textContent = `"${comment.prompt}"`;
    card.append(prompt);
  }

  const text = doc.createElement("div");
  text.className = "bc-paper-ctec-modal-comment-text is-clamped";
  appendHighlighted(text, comment.text, highlights);
  card.append(text);

  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.className = "bc-paper-ctec-modal-comment-toggle";
  toggle.textContent = "↓ Show more";
  toggle.hidden = true;
  toggle.addEventListener("click", (event) => {
    preventAndStop(event);
    const expanded = text.classList.toggle("is-clamped");
    toggle.textContent = expanded ? "↓ Show more" : "↑ Show less";
  });
  card.append(toggle);

  // Only show the toggle when the clamped text actually overflows — keeps
  // us from offering "Show more" on text that's already fully visible.
  requestAnimationFrame(() => {
    if (text.scrollHeight > text.clientHeight + 1) {
      toggle.hidden = false;
    } else {
      text.classList.remove("is-clamped");
    }
  });

  const footer = doc.createElement("div");
  footer.className = "bc-paper-ctec-modal-comment-footer";

  const term = doc.createElement("span");
  term.className = "bc-paper-ctec-modal-comment-term";
  term.textContent = comment.term;
  footer.append(term);

  const axisLabel = commentAxisLabel(comment, strategy);
  if (axisLabel) {
    const axis = doc.createElement("span");
    axis.className = "bc-paper-ctec-modal-comment-axis";
    axis.textContent = axisLabel;
    footer.append(axis);
  }

  for (const topic of comment.topics) {
    const chip = doc.createElement("span");
    chip.className = `bc-paper-ctec-modal-comment-theme${
      activeTopic === topic ? " is-active" : ""
    }`;
    chip.textContent = topic;
    footer.append(chip);
  }

  card.append(footer);

  return card;
}

function commentAxisLabel(
  comment: ModalDisplayData["comments"][number],
  strategy: CtecAnalyticsStrategy
): string {
  if (strategy === "course") return comment.instructor.trim();
  if (strategy === "instructor") return extractCatalogLabel(comment.description);
  return "";
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

function renderChip(label: string, onClear: () => void): TemplateResult {
  return html`<span class="bc-paper-ctec-modal-filter-chip"
    >${label}<button
      type="button"
      class="bc-paper-ctec-modal-filter-chip-x"
      @click=${(event: Event) => {
        preventAndStop(event);
        onClear();
      }}
    >✕</button></span
  >`;
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

// Backwards-compat shim.
export function renderComments(
  doc: Document,
  data: ModalDisplayData,
  strategy: CtecAnalyticsStrategy,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return CommentsSection.render({ doc, data, strategy, state, callbacks });
}
