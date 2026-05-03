import { isFeatureEnabled } from "../../settings";
import { extractSubjectAndCatalog } from "../ctec-links/helpers";
import { PAPER_CTEC_CONFIG } from "./config";
import {
  COMPACT_CARD_FEATURE_ID,
  SINGLE_SUMMARY_CARD_FEATURE_ID,
  WIDGET_CLASS
} from "./constants";
import { buildCourseKey, buildInstructorLastNameLabel } from "./identity";
import type { PaperCtecSideCardContext, PaperCtecTarget } from "./types";

type PaperCtecCandidate = Omit<PaperCtecTarget, "widget"> & {
  content: HTMLElement;
};

export function collectScheduleTargets(doc: Document): PaperCtecTarget[] {
  const candidates: PaperCtecCandidate[] = [];

  for (const card of Array.from(
    doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.scheduleCard)
  )) {
    const target = parseTarget(card);
    if (target) {
      candidates.push(target);
    } else {
      cleanupCardWidget(card);
    }
  }

  const selectedCandidates = isFeatureEnabled(SINGLE_SUMMARY_CARD_FEATURE_ID)
    ? selectCanonicalCandidates(candidates)
    : candidates;

  const selectedCards = new Set(selectedCandidates.map((candidate) => candidate.card));
  for (const candidate of candidates) {
    if (!selectedCards.has(candidate.card)) {
      cleanupCardWidget(candidate.card);
    }
  }

  return selectedCandidates.map((candidate) => ({
    card: candidate.card,
    widget: ensureWidget(candidate.content),
    titleHint: candidate.titleHint,
    params: candidate.params,
    key: candidate.key
  }));
}

export function extractSideCardContext(doc: Document): PaperCtecSideCardContext | null {
  const panel = doc.querySelector<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardPanel);
  if (!panel) return null;

  const typeText = panel.querySelector<HTMLElement>("p.flex-grow.text-sm.font-bold")
    ?.textContent?.trim() ?? "";
  if (!typeText.startsWith("SECTION INFO")) return null;

  const subjectLabel =
    panel.querySelector<HTMLElement>("p.text-2xl.font-bold")?.textContent?.trim() ?? "";
  const parsed = extractSubjectAndCatalog(subjectLabel);
  if (!parsed) return null;

  const instructorNames = getSideCardItemButtonTexts(panel, "INSTRUCTOR");
  const instructor = buildInstructorLastNameLabel(instructorNames);
  if (!instructor) return null;

  const subtitle =
    panel.querySelector<HTMLElement>("p.text-lg.font-light")?.textContent?.trim() ?? "";
  const topic = getSideCardItemText(panel, "TOPIC");
  const titleHint = topic && subtitle ? `${topic} - ${subtitle}` : subtitle || topic || "";
  const params = {
    classNumber: "",
    subject: parsed.subject,
    catalogNumber: parsed.catalogNumber,
    instructor
  } as const;

  return {
    panel,
    key: buildCourseKey(params, titleHint),
    params,
    titleHint
  };
}

export function readSideCardCommentQuery(context: PaperCtecSideCardContext): string | null {
  const input = context.panel.querySelector<HTMLInputElement>(
    'input[data-bc-paper-ctec-comment-search="1"]'
  );
  return input?.value ?? null;
}

function parseTarget(card: HTMLElement): PaperCtecCandidate | null {
  if (isPreviewCard(card)) return null;

  const content = findCardContent(card);
  if (!content) return null;

  const paragraphs = Array.from(content.querySelectorAll<HTMLParagraphElement>("p"));
  const courseLine = content.querySelector<HTMLParagraphElement>('[data-bc-paper-role="course"]') ?? paragraphs[0];
  const titleLine = content.querySelector<HTMLParagraphElement>('[data-bc-paper-role="title"]') ?? paragraphs[1];
  const instructorLine = content.querySelector<HTMLParagraphElement>('[data-bc-paper-role="instructor"]') ?? paragraphs[2];

  if (!courseLine || !instructorLine) return null;

  courseLine.dataset.bcPaperRole = "course";
  if (titleLine) titleLine.dataset.bcPaperRole = "title";
  instructorLine.dataset.bcPaperRole = "instructor";

  applyCardLayout(content, courseLine, titleLine ?? null, instructorLine);

  const parsed = extractSubjectAndCatalog(courseLine.textContent ?? "");
  if (!parsed) return null;

  const instructor = instructorLine.textContent?.trim() ?? "";
  if (!instructor) return null;

  const catalogNumber = parsed.catalogNumber;
  const titleHint = titleLine?.textContent?.trim() ?? "";
  const params = {
    classNumber: "",
    subject: parsed.subject,
    catalogNumber,
    instructor
  } as const;

  return {
    card,
    content,
    titleHint,
    params,
    key: buildCourseKey(params, titleHint)
  };
}

function isPreviewCard(card: HTMLElement): boolean {
  return card.classList.contains("opacity-60");
}

function selectCanonicalCandidates(candidates: PaperCtecCandidate[]): PaperCtecCandidate[] {
  const canonicalByKey = new Map<string, PaperCtecCandidate>();

  for (const candidate of candidates) {
    const existing = canonicalByKey.get(candidate.key);
    if (!existing || compareCardPriority(candidate, existing) < 0) {
      canonicalByKey.set(candidate.key, candidate);
    }
  }

  return Array.from(canonicalByKey.values());
}

function compareCardPriority(left: PaperCtecCandidate, right: PaperCtecCandidate): number {
  const dayDiff = getCardDayRank(left.card) - getCardDayRank(right.card);
  if (dayDiff !== 0) return dayDiff;

  const topDiff = getCardTopRank(left.card) - getCardTopRank(right.card);
  if (topDiff !== 0) return topDiff;

  const relation = left.card.compareDocumentPosition(right.card);
  if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function getCardDayRank(card: HTMLElement): number {
  const grid = card.closest<HTMLElement>(PAPER_CTEC_CONFIG.selectors.scheduleGrid);
  if (!grid) return Number.MAX_SAFE_INTEGER;

  let column: HTMLElement | null = card;
  while (column && column.parentElement !== grid) {
    column = column.parentElement;
  }
  if (!column) return Number.MAX_SAFE_INTEGER;

  const columnIndex = Array.from(grid.children).indexOf(column);
  if (columnIndex < 1) return Number.MAX_SAFE_INTEGER;
  return columnIndex - 1;
}

function getCardTopRank(card: HTMLElement): number {
  const top = Number.parseFloat(card.style.top);
  return Number.isFinite(top) ? top : Number.MAX_SAFE_INTEGER;
}

function findCardContent(card: HTMLElement): HTMLElement | null {
  const relative = Array.from(card.children).find(
    (child): child is HTMLDivElement =>
      child instanceof HTMLDivElement && child.classList.contains("relative")
  );
  if (!relative) return null;

  return (
    Array.from(relative.children).find(
      (child): child is HTMLDivElement => child instanceof HTMLDivElement
    ) ?? null
  );
}

function ensureWidget(content: HTMLElement): HTMLElement {
  const existing = content.querySelector<HTMLElement>(`.${WIDGET_CLASS}`);
  if (existing) return existing;

  const widget = content.ownerDocument.createElement("div");
  widget.className = WIDGET_CLASS;
  content.appendChild(widget);
  return widget;
}

function cleanupCardWidget(card: HTMLElement): void {
  // Analytics anchor button lives as a direct child of the outer card
  // (outside the .${WIDGET_CLASS} content) so it can hang below the card
  // edge — clean it up too whenever the widget itself is removed.
  card.querySelector<HTMLElement>(
    `:scope > .${WIDGET_CLASS}-analytics-anchor`
  )?.remove();

  const content = findCardContent(card);
  if (!content) return;

  content.querySelector<HTMLElement>(`.${WIDGET_CLASS}`)?.remove();
}

function applyCardLayout(
  content: HTMLElement,
  courseLine: HTMLParagraphElement,
  titleLine: HTMLParagraphElement | null,
  instructorLine: HTMLParagraphElement
): void {
  const compact = isFeatureEnabled(COMPACT_CARD_FEATURE_ID);

  content.classList.toggle("bc-paper-ctec-dense-card", compact);
  courseLine.classList.toggle("bc-paper-ctec-course-line", compact);
  titleLine?.classList.toggle("bc-paper-ctec-title-line", compact);
  instructorLine.classList.toggle("bc-paper-ctec-instructor-line", compact);

  let head = content.querySelector<HTMLElement>('[data-bc-paper-role="header"]');
  if (compact) {
    if (!head) {
      head = content.ownerDocument.createElement("div");
      head.dataset.bcPaperRole = "header";
      head.className = "bc-paper-ctec-card-head";
    }

    if (head.parentElement !== content) {
      content.insertBefore(head, titleLine ?? courseLine);
    }

    if (courseLine.parentElement !== head) {
      head.append(courseLine);
    }
    if (instructorLine.parentElement !== head) {
      head.append(instructorLine);
    }

    if (titleLine && titleLine.parentElement !== content) {
      const existingWidget = content.querySelector<HTMLElement>(`.${WIDGET_CLASS}`);
      if (existingWidget) {
        content.insertBefore(titleLine, existingWidget);
      } else {
        content.append(titleLine);
      }
    }
    return;
  }

  if (head) {
    const anchor = head;
    content.insertBefore(courseLine, anchor);
    if (titleLine && titleLine.parentElement !== content) {
      content.insertBefore(titleLine, anchor);
    }
    content.insertBefore(instructorLine, anchor);
    head.remove();
  }
}

function getSideCardItem(panel: HTMLElement, key: string): HTMLElement | null {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardItems)
  ).find((item) => {
    const label = item.querySelector<HTMLElement>("p.tracking-wider")?.textContent?.trim();
    return label === key;
  }) ?? null;
}

function getSideCardItemText(panel: HTMLElement, key: string): string {
  const item = getSideCardItem(panel, key);
  const valueContainer = item?.children[1];
  return valueContainer instanceof HTMLElement
    ? valueContainer.textContent?.replace(/\s+/g, " ").trim() ?? ""
    : "";
}

function getSideCardItemButtonTexts(panel: HTMLElement, key: string): string[] {
  const item = getSideCardItem(panel, key);
  if (!item) return [];

  return Array.from(item.querySelectorAll<HTMLButtonElement>("button"))
    .map((button) => button.textContent?.trim() ?? "")
    .filter(Boolean);
}
