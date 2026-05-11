import { logQuiet } from "../../../shared/log";
import type { Augmentation } from "../../framework";
import { el } from "../../framework/dom";
import type { EligibilityResult, ParsedPrereqMap } from "../../prereqs";
import { isFeatureEnabled } from "../../settings";
import { makeGridBadge, makeSearchBadge } from "./badges";
import {
  DEFAULT_PREREQ_FILTER_ENABLED,
  GRID_BADGE_CLASS,
  HIDDEN_CARD_ATTR,
  PREREQ_FILTER_ENABLED_STORAGE_KEY,
  PREREQ_FILTER_FEATURE_ID,
  PREREQ_FILTER_UNKNOWN_AS_ELIGIBLE_ID,
  SEARCH_BADGE_CLASS,
  SEARCH_SWITCH_ID,
  STATE_ATTR,
  TOOLTIP_ID
} from "./constants";
import { PREREQ_FILTER_CONFIG } from "./config";
import {
  buildHistoryMap,
  ensureParsedPrereqs,
  evaluateCourseId,
  getParsedNodeForCourseId,
  getRawForCourseId,
  resetDataLayer
} from "./data";
import {
  injectPrereqFilterStyles,
  removePrereqFilterStyles
} from "./styles";

const RENDERED_BADGE_ATTR = "data-bc-prereq-rendered";

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

function isEligibleWhenSwitchOn(
  state: EligibilityResult["state"],
  unknownIsEligible: boolean
): boolean {
  if (state === "no-data") return true; // never punish missing data
  if (state === "ready") return true;
  // Soft-eligible: consent + in-progress courses stay visible — the
  // student CAN take them, just with a caveat. Hiding them would
  // over-restrict the working set.
  if (state === "needs-consent" || state === "in-progress") return true;
  if (state === "unknown") return unknownIsEligible;
  return false;
}

// Heuristic: extract a course id like "COMP_SCI 211-0" or "COMP_SCI 211"
// from a search-result card. paper.nu typically renders the code in a bold
// element near the top; we walk candidate selectors and fall back to a
// regex over the card's full text.
const COURSE_CODE_RE = /\b([A-Z][A-Z_]+)\s+(\d{3}(?:-[A-Za-z0-9]+)?)\b/;

function extractCardCourseId(card: HTMLElement): string | null {
  for (const sel of PREREQ_FILTER_CONFIG.searchPanel.cardCodeCandidates) {
    const target = card.querySelector<HTMLElement>(sel);
    if (target) {
      const m = COURSE_CODE_RE.exec(target.textContent ?? "");
      if (m) return canonicalizeCourseId(m[1], m[2]);
    }
  }
  const m = COURSE_CODE_RE.exec(card.textContent ?? "");
  if (m) return canonicalizeCourseId(m[1], m[2]);
  return null;
}

function canonicalizeCourseId(subject: string, number: string): string {
  // paper.nu sometimes shows "COMP_SCI 211" without the section suffix; the
  // parsed-prereqs map is keyed by the full id ("COMP_SCI 211-0"). Try the
  // bare form first and let the lookup fall back via -0 suffix.
  return number.includes("-") ? `${subject} ${number}` : `${subject} ${number}-0`;
}

function lookupParsed(
  parsedMap: ParsedPrereqMap,
  courseId: string
): { id: string; record: NonNullable<ReturnType<ParsedPrereqMap["get"]>> } | null {
  const direct = parsedMap.get(courseId);
  if (direct) return { id: courseId, record: direct };
  // paper.nu / parser id mismatch fallback: try without the -0 suffix.
  if (courseId.endsWith("-0")) {
    const bare = courseId.slice(0, -2);
    const fallback = parsedMap.get(bare);
    if (fallback) return { id: bare, record: fallback };
  }
  return null;
}

export class PrereqFilterAugmentation implements Augmentation {
  readonly id = PREREQ_FILTER_FEATURE_ID;

  private parsedMap: ParsedPrereqMap | null = null;
  private historyMap: ReadonlyMap<string, ReturnType<typeof buildHistoryMap> extends Map<string, infer V> ? V : never> = new Map();
  private enabled: boolean = DEFAULT_PREREQ_FILTER_ENABLED;
  private unknownIsEligible = true;
  private switchEl: HTMLElement | null = null;
  private inFlightMount: Promise<void> | null = null;
  private switchLoaded = false;

  run(doc: Document = document): void {
    if (!isPaperHost()) return;
    if (!isFeatureEnabled(this.id)) {
      this.cleanup(doc);
      return;
    }

    injectPrereqFilterStyles(doc);
    this.unknownIsEligible = isFeatureEnabled(PREREQ_FILTER_UNKNOWN_AS_ELIGIBLE_ID);

    if (!this.switchLoaded) {
      this.switchLoaded = true;
      void this.loadEnabled();
    }

    if (!this.parsedMap && !this.inFlightMount) {
      this.inFlightMount = ensureParsedPrereqs()
        .then((m) => {
          this.parsedMap = m;
          this.historyMap = buildHistoryMap();
          this.inFlightMount = null;
          // Re-run now that data is available. The runner debounce will
          // fold any DOM mutations that happened during fetch.
          this.run(doc);
        })
        .catch((err) => {
          logQuiet("prereq-filter.ensureParsedPrereqs", err);
          this.inFlightMount = null;
        });
      return;
    }

    if (!this.parsedMap) return;

    // Refresh history each tick — cheap, and the cache may have been
    // populated by an opportunistic CAESAR reconcile after our first run.
    this.historyMap = buildHistoryMap();

    this.renderSearchPanel(doc);
    this.renderScheduleGrid(doc);
  }

  cleanup(doc: Document = document): void {
    // Remove every node, attribute, and dataset marker we ever wrote.
    for (const badge of Array.from(
      doc.querySelectorAll<HTMLElement>(`.${SEARCH_BADGE_CLASS}, .${GRID_BADGE_CLASS}`)
    )) {
      badge.remove();
    }
    for (const card of Array.from(doc.querySelectorAll<HTMLElement>(`[${HIDDEN_CARD_ATTR}]`))) {
      card.removeAttribute(HIDDEN_CARD_ATTR);
    }
    for (const card of Array.from(doc.querySelectorAll<HTMLElement>(`[${STATE_ATTR}]`))) {
      card.removeAttribute(STATE_ATTR);
    }
    for (const card of Array.from(doc.querySelectorAll<HTMLElement>(`[${RENDERED_BADGE_ATTR}]`))) {
      card.removeAttribute(RENDERED_BADGE_ATTR);
    }
    doc.getElementById(SEARCH_SWITCH_ID)?.remove();
    doc.getElementById(TOOLTIP_ID)?.remove();
    removePrereqFilterStyles(doc);
    this.switchEl = null;
    this.parsedMap = null;
    resetDataLayer();
  }

  // === Search panel ======================================================

  private renderSearchPanel(doc: Document): void {
    const list = this.findSearchList(doc);
    if (!list) return;
    this.ensureSwitch(doc, list);

    const cards = this.findSearchCards(list);
    let visibleCount = 0;
    let totalWithBadge = 0;

    for (const card of cards) {
      const courseId = extractCardCourseId(card);
      if (!courseId) {
        card.removeAttribute(HIDDEN_CARD_ATTR);
        continue;
      }
      const lookup = lookupParsed(this.parsedMap!, courseId);
      const result = lookup
        ? evaluateCourseId(lookup.id, this.parsedMap!, this.historyMap)
        : ({ state: "no-data", missing: [], notes: [] } as EligibilityResult);
      const raw = lookup ? getRawForCourseId(lookup.id, this.parsedMap!) : null;

      this.ensureSearchBadge(doc, card, result, raw, lookup?.id ?? null);
      totalWithBadge += 1;

      const eligible = !this.enabled
        || isEligibleWhenSwitchOn(result.state, this.unknownIsEligible);
      if (eligible) {
        card.removeAttribute(HIDDEN_CARD_ATTR);
        visibleCount += 1;
      } else {
        card.setAttribute(HIDDEN_CARD_ATTR, "1");
      }
    }

    this.updateSwitchLabel(visibleCount, totalWithBadge);
  }

  private findSearchList(doc: Document): HTMLElement | null {
    for (const sel of PREREQ_FILTER_CONFIG.searchPanel.resultsListCandidates) {
      const list = doc.querySelector<HTMLElement>(sel);
      if (list) return list;
    }
    return null;
  }

  private findSearchCards(list: HTMLElement): HTMLElement[] {
    for (const sel of PREREQ_FILTER_CONFIG.searchPanel.cardCandidates) {
      const cards = Array.from(list.querySelectorAll<HTMLElement>(sel));
      if (cards.length > 0) return cards;
    }
    return [];
  }

  private ensureSwitch(doc: Document, list: HTMLElement): void {
    if (this.switchEl && doc.body.contains(this.switchEl)) return;
    const sw = el(doc, "button", {
      attrs: {
        id: SEARCH_SWITCH_ID,
        type: "button",
        title: "Hide courses you can't take yet",
        role: "switch",
        "aria-checked": String(this.enabled)
      },
      dataset: { on: this.enabled ? "1" : "0" },
      on: {
        click: (event: MouseEvent): void => {
          event.preventDefault();
          event.stopPropagation();
          void this.toggleEnabled(doc);
        }
      }
    });
    const knob = el(doc, "span", { class: "bc-switch-knob" });
    const label = el(doc, "span", { class: "bc-switch-label", text: "Eligible only" });
    const counter = el(doc, "span", { class: "bc-switch-count" });
    sw.append(knob, label, counter);
    const parent = list.parentElement;
    if (parent) parent.insertBefore(sw, list);
    else doc.body.appendChild(sw);
    this.switchEl = sw;
  }

  private updateSwitchLabel(visible: number, total: number): void {
    if (!this.switchEl) return;
    this.switchEl.dataset.on = this.enabled ? "1" : "0";
    this.switchEl.setAttribute("aria-checked", String(this.enabled));
    const counter = this.switchEl.querySelector(".bc-switch-count");
    if (counter) {
      counter.textContent = this.enabled ? `${visible}/${total}` : `${total}`;
    }
  }

  private ensureSearchBadge(
    doc: Document,
    card: HTMLElement,
    result: EligibilityResult,
    raw: string | null,
    courseIdInMap: string | null
  ): void {
    const sigDataset = result.state;
    if (card.getAttribute(STATE_ATTR) === sigDataset) {
      // Already painted with the same state — skip rerender to avoid churn.
      return;
    }
    card.setAttribute(STATE_ATTR, sigDataset);
    const existing = card.querySelector(`.${SEARCH_BADGE_CLASS}`);
    existing?.remove();
    const parsed = courseIdInMap
      ? getParsedNodeForCourseId(courseIdInMap, this.parsedMap!)
      : null;
    const badge = makeSearchBadge(doc, result, raw, parsed, this.historyMap);
    badge.style.marginRight = "6px";
    badge.style.verticalAlign = "middle";
    card.insertBefore(badge, card.firstChild);
  }

  private async loadEnabled(): Promise<void> {
    try {
      const result = (await chrome.storage.local.get(PREREQ_FILTER_ENABLED_STORAGE_KEY)) as Record<string, unknown>;
      const raw = result[PREREQ_FILTER_ENABLED_STORAGE_KEY];
      if (typeof raw === "boolean") this.enabled = raw;
    } catch (err) {
      logQuiet("prereq-filter.loadEnabled", err);
    }
  }

  private async toggleEnabled(doc: Document): Promise<void> {
    this.enabled = !this.enabled;
    try {
      await chrome.storage.local.set({ [PREREQ_FILTER_ENABLED_STORAGE_KEY]: this.enabled });
    } catch (err) {
      logQuiet("prereq-filter.persistEnabled", err);
    }
    this.run(doc);
  }

  // === Schedule grid ====================================================

  private renderScheduleGrid(doc: Document): void {
    const cards = Array.from(
      doc.querySelectorAll<HTMLElement>(PREREQ_FILTER_CONFIG.scheduleCard)
    );
    for (const card of cards) {
      const courseId = extractCardCourseId(card);
      if (!courseId) continue;
      const lookup = lookupParsed(this.parsedMap!, courseId);
      const result = lookup
        ? evaluateCourseId(lookup.id, this.parsedMap!, this.historyMap)
        : ({ state: "no-data", missing: [], notes: [] } as EligibilityResult);
      const raw = lookup ? getRawForCourseId(lookup.id, this.parsedMap!) : null;
      this.ensureGridBadge(doc, card, result, raw, lookup?.id ?? null);
    }
  }

  private ensureGridBadge(
    doc: Document,
    card: HTMLElement,
    result: EligibilityResult,
    raw: string | null,
    courseIdInMap: string | null
  ): void {
    const sig = `${result.state}`;
    if (card.getAttribute(RENDERED_BADGE_ATTR) === sig) return;
    card.setAttribute(RENDERED_BADGE_ATTR, sig);

    // Mount inside the same chip strip paper-ctec uses; fall back to a
    // floating absolute span if the strip isn't there.
    const host = card.querySelector<HTMLElement>(PREREQ_FILTER_CONFIG.scheduleCardChipHost);
    const existing = card.querySelector(`.${GRID_BADGE_CLASS}`);
    existing?.remove();
    const parsed = courseIdInMap
      ? getParsedNodeForCourseId(courseIdInMap, this.parsedMap!)
      : null;
    const badge = makeGridBadge(doc, result, raw, parsed, this.historyMap);
    if (host) {
      host.appendChild(badge);
      return;
    }
    badge.style.position = "absolute";
    badge.style.right = "6px";
    badge.style.top = "6px";
    card.appendChild(badge);
  }
}
