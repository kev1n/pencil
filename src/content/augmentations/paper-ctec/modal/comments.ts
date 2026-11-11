// The words half of the sheet: tone filter + search (sticky), the phrases
// that keep coming up, then the comments themselves.

import { html, type TemplateResult } from "lit-html";

import { extractCatalogLabel } from "../../../ctec-index/helpers";
import { FACE_LABELS, faceIcon, type FaceTone } from "../../../design/icons";
import type { ModalComment, ModalCommentTone } from "../modal-data";
import { termLabel, type SheetContext } from "./common";
import { COMMENTS_PAGE_SIZE, type ModalCommentSentimentFilter } from "./types";

const TONES: ModalCommentTone[] = ["pos", "mix", "neu", "neg"];

const FACE_FOR: Record<ModalCommentTone, FaceTone> = {
  pos: "positive",
  mix: "mixed",
  neu: "neutral",
  neg: "critical"
};

type Topic = { label: string; count: number; tally: Record<ModalCommentTone, number> };

// A comment matches a search when the text contains it, or when it is one of
// the comment's extracted phrases (those are matched on normalized words, so
// "office-hours" still counts for "office hours").
function matches(comment: ModalComment, query: string): boolean {
  return comment.text.toLowerCase().includes(query) || comment.topics.includes(query);
}

// Phrases counted over the whole term, whatever is typed, so the row stays
// put while the student clicks around.
function topicsIn(comments: ModalComment[]): Topic[] {
  const found = new Map<string, Topic>();
  for (const comment of comments) {
    for (const label of comment.topics) {
      let topic = found.get(label);
      if (!topic) {
        topic = { label, count: 0, tally: { pos: 0, mix: 0, neu: 0, neg: 0 } };
        found.set(label, topic);
      }
      topic.count += 1;
      topic.tally[comment.tone] += 1;
    }
  }
  return [...found.values()]
    .filter((topic) => topic.count >= 2)
    .sort((a, b) => b.count - a.count);
}

function majorityTone(tally: Record<ModalCommentTone, number>): ModalCommentTone {
  return TONES.reduce((best, tone) => (tally[tone] > tally[best] ? tone : best));
}

// Comment text with search matches marked.
function marked(text: string, query: string): Array<string | TemplateResult> {
  if (!query) return [text];
  const out: Array<string | TemplateResult> = [];
  const low = text.toLowerCase();
  let from = 0;
  let at: number;
  while ((at = low.indexOf(query, from)) !== -1) {
    if (at > from) out.push(text.slice(from, at));
    out.push(html`<mark class="bc-sheet-q">${text.slice(at, at + query.length)}</mark>`);
    from = at + query.length;
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}

// The standard catch-all question adds nothing above a comment; any other
// question is shown so the answer reads in context.
const DEFAULT_PROMPT =
  "please summarize your reaction to this course focusing on the aspects that were most important to you";

function promptFor(comment: ModalComment): string {
  const normalized = comment.prompt
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?;:,]+$/u, "")
    .trim();
  return normalized === DEFAULT_PROMPT ? "" : comment.prompt.trim();
}

const SEARCH_ICON = html`<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
  <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5" />
  <path d="M10.4 10.4L13.6 13.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
</svg>`;

const CLEAR_ICON = html`<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
  <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
</svg>`;

export function renderComments(ctx: SheetContext): TemplateResult {
  const { input, data, state, callbacks, term } = ctx;
  const typed = state.commentsQuery.trim();
  const query = typed.toLowerCase();

  const inTerm = term
    ? data.comments.filter((comment) => comment.term === term.term)
    : data.comments;
  const pool = query ? inTerm.filter((comment) => matches(comment, query)) : inTerm;
  const shown =
    state.commentsSentimentFilter === "all"
      ? pool
      : pool.filter((comment) => comment.tone === state.commentsSentimentFilter);
  const visible = shown.slice(0, state.commentsVisibleCount);
  const topics = topicsIn(inTerm);

  const toTop = (): void => {
    const section = ctx.sheet()?.querySelector<HTMLElement>(".bc-sheet-com");
    const body = section?.parentElement;
    if (section && body && body.scrollTop > section.offsetTop) {
      body.scrollTop = section.offsetTop;
    }
  };
  const setQuery = (value: string): void => {
    state.commentsQuery = value;
    state.commentsVisibleCount = COMMENTS_PAGE_SIZE;
    ctx.rerender();
    toTop();
  };

  const toneButton = (
    key: ModalCommentSentimentFilter,
    name: string
  ): TemplateResult => {
    const count =
      key === "all" ? pool.length : pool.filter((comment) => comment.tone === key).length;
    const on = state.commentsSentimentFilter === key;
    return html`<button
      type="button"
      role="tab"
      class=${`bc-sheet-tone${on ? " is-on" : ""}${count === 0 ? " is-empty" : ""}`}
      data-tone=${key}
      aria-selected=${on ? "true" : "false"}
      @click=${() => {
        callbacks.onCommentsSentimentChange(key);
        toTop();
      }}
    ><span class="bc-sheet-tone-name">${name}</span
      ><span class="bc-sheet-tone-n">${count}</span></button>`;
  };

  // In the broader views a comment also says whose section, or which
  // course, it came from.
  const origin = (comment: ModalComment): string => {
    if (input.strategy === "course") return comment.instructor.trim();
    if (input.strategy === "instructor") return extractCatalogLabel(comment.description);
    return "";
  };

  const item = (comment: ModalComment): TemplateResult => {
    const prompt = promptFor(comment);
    const from = origin(comment);
    return html`<article class="bc-sheet-c">
      ${faceIcon(FACE_FOR[comment.tone])}
      <div class="bc-sheet-c-main">
        ${prompt ? html`<p class="bc-sheet-c-prompt">${prompt}</p>` : ""}
        <p class="bc-sheet-c-text">${marked(comment.text, query)}</p>
        ${!term || from
          ? html`<div class="bc-sheet-c-meta">
              ${term ? "" : termLabel(comment.term)}${from
                ? html`<span>${from}</span>`
                : ""}
            </div>`
          : ""}
      </div>
    </article>`;
  };

  let list: TemplateResult | TemplateResult[];
  if (shown.length === 0) {
    const what = query
      ? `No comments mention “${typed}”`
      : state.commentsSentimentFilter === "all"
        ? "No comments"
        : `No ${FACE_LABELS[FACE_FOR[state.commentsSentimentFilter]].toLowerCase()} comments`;
    list = html`<p class="bc-sheet-empty">
      ${what}${term ? html` in ${termLabel(term.term)}` : ""}
    </p>`;
  } else {
    list = visible.map(item);
  }

  const remaining = shown.length - visible.length;

  return html`<section class="bc-sheet-com">
    <div class="bc-sheet-com-head">
      <h3 class="bc-sheet-sec-title">Comments</h3>
      <div class="bc-sheet-tones" role="tablist" aria-label="Tone">
        ${toneButton("all", "All")}
        ${TONES.map((tone) => toneButton(tone, FACE_LABELS[FACE_FOR[tone]]))}
      </div>
      <label class=${`bc-sheet-search${typed ? " has-value" : ""}`}>
        ${SEARCH_ICON}
        <input
          type="search"
          placeholder="Search comments"
          aria-label="Search comments"
          .value=${state.commentsQuery}
          @input=${(event: Event) => setQuery((event.target as HTMLInputElement).value)}
          @keydown=${(event: KeyboardEvent) => {
            // Keep typing away from the host page's shortcuts. Escape clears
            // the field first; pressed again it closes the sheet.
            if (event.key !== "Escape") {
              event.stopPropagation();
            } else if (state.commentsQuery) {
              event.stopPropagation();
              setQuery("");
            }
          }}
        />
        <button
          type="button"
          class="bc-sheet-search-clear"
          aria-label="Clear search"
          @click=${(event: Event) => {
            event.preventDefault();
            setQuery("");
            ctx.sheet()?.querySelector<HTMLInputElement>(".bc-sheet-search input")?.focus();
          }}
        >${CLEAR_ICON}</button>
      </label>
    </div>
    ${topics.length
      ? html`<div class="bc-sheet-topics">
          <div class="bc-sheet-topics-title">Often mentioned</div>
          <div class="bc-sheet-topic-row">
            ${topics.map((topic) => {
              const on = query === topic.label;
              return html`<button
                type="button"
                class=${`bc-sheet-topic${on ? " is-on" : ""}`}
                aria-pressed=${on ? "true" : "false"}
                title=${TONES.filter((tone) => topic.tally[tone] > 0)
                  .map(
                    (tone) =>
                      `${topic.tally[tone]} ${FACE_LABELS[FACE_FOR[tone]].toLowerCase()}`
                  )
                  .join(", ")}
                @click=${() => setQuery(on ? "" : topic.label)}
              >${faceIcon(FACE_FOR[majorityTone(topic.tally)], 14)}<span>${topic.label}</span
                ><span class="bc-sheet-topic-n">${topic.count}</span></button>`;
            })}
          </div>
        </div>`
      : ""}
    <div class="bc-sheet-com-list">
      ${list}
      ${remaining > 0
        ? html`<button
            type="button"
            class="bc-sheet-more"
            @click=${() => {
              state.commentsVisibleCount += COMMENTS_PAGE_SIZE;
              ctx.rerender();
            }}
          >Show ${Math.min(COMMENTS_PAGE_SIZE, remaining)} more (${remaining} left)</button>`
        : ""}
    </div>
  </section>`;
}
