import { logQuiet } from "../../../shared/log";
import type { Augmentation } from "../../framework";
import { el } from "../../framework/dom";
import type { EligibilityResult, ParsedPrereqMap } from "../../prereqs";
import { isFeatureEnabled, setFeatureEnabled } from "../../settings";
import { makeBadge } from "./badges";
import {
  DEFAULT_PREREQ_FILTER_ENABLED,
  HIDDEN_CARD_ATTR,
  POSITIONED_CARD_ATTR,
  PREREQ_BADGE_CLASS,
  PREREQ_FILTER_ENABLED_STORAGE_KEY,
  PREREQ_FILTER_FEATURE_ID,
  PREREQ_FILTER_MOUNT_ID,
  PREREQ_FILTER_UNKNOWN_AS_ELIGIBLE_ID,
  SEARCH_FILTER_BTN_ID,
  SEARCH_ROW_ID,
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
import { attachTooltip } from "./tooltip";

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
  // In-progress stays visible — you ARE enrolled in the prereq right
  // now, so you can take this course next term. Instructor-consent
  // courses are excluded from the filter on purpose: when the user
  // checks "Meets prereqs", they're asking for the no-friction set.
  if (state === "in-progress") return true;
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

// "COMP_SCI 211-0" → { subject: "COMP_SCI", number: "211-0" }. Used to
// build the target descriptor for the prereq-tree's top pill.
function splitCourseId(courseId: string): { subject: string; number: string } | null {
  const idx = courseId.lastIndexOf(" ");
  if (idx < 0) return null;
  return { subject: courseId.slice(0, idx), number: courseId.slice(idx + 1) };
}

// Group key for canonical-card selection on the schedule grid: collapse
// every section of the same course (LEC, LAB, DIS, sub-sections) onto a
// single key. "COMP_ENG 346-0", "COMP_ENG 346-1", "COMP_ENG 346-20" → all
// share key "COMP_ENG 346". Sequence courses (MATH 220-1 vs 220-2) keep
// their suffix and stay distinct only when the suffix is "-1" or higher
// AND a matching parsedMap entry exists — but for grouping cards on the
// schedule, dropping the suffix is fine since they share prereqs.
function courseCanonicalKey(courseId: string): string {
  const dashIdx = courseId.lastIndexOf("-");
  return dashIdx > 0 ? courseId.slice(0, dashIdx) : courseId;
}

// Lower = wins canonical slot. Day-column index first (Mon < Fri), then
// vertical position (earlier in day wins), then DOM order. Mirrors
// paper-ctec's compareCardPriority so the badge lands on the same cell
// paper-ctec picks as canonical for its analytics chip.
function compareGridCards(left: HTMLElement, right: HTMLElement): number {
  const dayDiff = gridDayRank(left) - gridDayRank(right);
  if (dayDiff !== 0) return dayDiff;
  const topDiff = gridTopRank(left) - gridTopRank(right);
  if (topDiff !== 0) return topDiff;
  const relation = left.compareDocumentPosition(right);
  if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function gridDayRank(card: HTMLElement): number {
  const grid = card.closest<HTMLElement>(".schedule-grid-cols");
  if (!grid) return Number.MAX_SAFE_INTEGER;
  let column: HTMLElement | null = card;
  while (column && column.parentElement !== grid) {
    column = column.parentElement;
  }
  if (!column) return Number.MAX_SAFE_INTEGER;
  const columnIndex = Array.from(grid.children).indexOf(column);
  // Column 0 is the hours rail; skip it.
  return columnIndex < 1 ? Number.MAX_SAFE_INTEGER : columnIndex - 1;
}

function gridTopRank(card: HTMLElement): number {
  const top = Number.parseFloat(card.style.top);
  return Number.isFinite(top) ? top : Number.MAX_SAFE_INTEGER;
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
  // Schedule-grid cards render `section.subject + section.number` where
  // paper.nu sometimes carries the section subdivision ("COMP_ENG 346-1"
  // for a LAB) instead of the catalog "-0". Sequence courses (MATH 220-1)
  // hit the direct-match branch above first — we only reach here when the
  // suffix isn't a real catalog id, so falling back to "-0" is safe.
  const dashIdx = courseId.lastIndexOf("-");
  if (dashIdx > 0) {
    const baseId = `${courseId.slice(0, dashIdx)}-0`;
    if (baseId !== courseId) {
      const fallback = parsedMap.get(baseId);
      if (fallback) return { id: baseId, record: fallback };
    }
  }
  return null;
}

export class PrereqFilterAugmentation implements Augmentation {
  // Mount id is intentionally distinct from PREREQ_FILTER_FEATURE_ID so
  // the runner doesn't tear the row down when the user flips the feature
  // off via the in-page switch or the popup. Behavior gating happens
  // inside run() by reading isFeatureEnabled(PREREQ_FILTER_FEATURE_ID).
  readonly id = PREREQ_FILTER_MOUNT_ID;

  private parsedMap: ParsedPrereqMap | null = null;
  private historyMap: ReadonlyMap<string, ReturnType<typeof buildHistoryMap> extends Map<string, infer V> ? V : never> = new Map();
  // Filter on = hide ineligible courses. Separate from the feature toggle
  // (which gates the whole augmentation via isFeatureEnabled). Lives in
  // PREREQ_FILTER_ENABLED_STORAGE_KEY.
  private enabled: boolean = DEFAULT_PREREQ_FILTER_ENABLED;
  private unknownIsEligible = true;
  // Single row that holds both the feature on/off switch and the
  // "Meets prereqs" filter button.
  private rowEl: HTMLElement | null = null;
  private switchEl: HTMLElement | null = null;
  private filterBtnEl: HTMLElement | null = null;
  private inFlightMount: Promise<void> | null = null;
  private switchLoaded = false;

  run(doc: Document = document): void {
    if (!isPaperHost()) return;

    injectPrereqFilterStyles(doc);
    this.unknownIsEligible = isFeatureEnabled(PREREQ_FILTER_UNKNOWN_AS_ELIGIBLE_ID);
    const featureOn = isFeatureEnabled(PREREQ_FILTER_FEATURE_ID);

    // Always-on path: mount the inline row whenever the search panel is
    // visible, regardless of the feature toggle. Left switch ("Prereqs
    // (Beta)") tracks the feature state in both directions.
    const list = this.findSearchList(doc);
    if (list) this.ensureRow(doc, list, featureOn);

    if (!featureOn) {
      // Feature off: tear down only the per-card work (badges, hidden-
      // card markers, the persisted parsedMap memo). The row + left
      // switch stay so users can flip the feature back on inline.
      this.cleanupFeatureSpecific(doc);
      return;
    }

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

  // Feature-specific teardown — runs when the user flips the experiment
  // off without exiting paper.nu. Removes everything except the always-
  // mounted row + left switch (those are torn down by the full cleanup()
  // method below, which only fires if the mount augmentation itself is
  // disabled).
  private cleanupFeatureSpecific(doc: Document): void {
    for (const badge of Array.from(
      doc.querySelectorAll<HTMLElement>(`.${PREREQ_BADGE_CLASS}`)
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
    for (const card of Array.from(doc.querySelectorAll<HTMLElement>(`[${POSITIONED_CARD_ATTR}]`))) {
      card.style.position = "";
      card.removeAttribute(POSITIONED_CARD_ATTR);
    }
    // Drop the filter switch — it has no meaning when the feature is
    // off. Re-mounting on toggle-on is handled by ensureRow.
    this.filterBtnEl?.remove();
    this.filterBtnEl = null;
    // Reset the parsed-prereqs memo so a fresh fetch happens when the
    // user re-enables (in case the term has updated meanwhile).
    this.parsedMap = null;
    resetDataLayer();
  }

  cleanup(doc: Document = document): void {
    // Remove every node, attribute, and dataset marker we ever wrote.
    for (const badge of Array.from(
      doc.querySelectorAll<HTMLElement>(`.${PREREQ_BADGE_CLASS}`)
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
    for (const card of Array.from(doc.querySelectorAll<HTMLElement>(`[${POSITIONED_CARD_ATTR}]`))) {
      card.style.position = "";
      card.removeAttribute(POSITIONED_CARD_ATTR);
    }
    doc.getElementById(SEARCH_ROW_ID)?.remove();
    doc.getElementById(SEARCH_SWITCH_ID)?.remove();
    doc.getElementById(SEARCH_FILTER_BTN_ID)?.remove();
    doc.getElementById(TOOLTIP_ID)?.remove();
    removePrereqFilterStyles(doc);
    this.rowEl = null;
    this.switchEl = null;
    this.filterBtnEl = null;
    this.parsedMap = null;
    resetDataLayer();
  }

  // === Search panel ======================================================

  private renderSearchPanel(doc: Document): void {
    const list = this.findSearchList(doc);
    if (!list) return;
    // Row + both switches are already mounted by the always-on path in
    // run(). Just paint badges on the cards below.

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

  // Mount the inline switch row (idempotent). The feature switch is
  // always present and reflects the current feature state; clicking it
  // flips PREREQ_FILTER_FEATURE_ID in central settings, the runner
  // re-applies, and this method updates UI accordingly. The filter
  // switch is only mounted when the feature is on.
  private ensureRow(doc: Document, list: HTMLElement, featureOn: boolean): void {
    if (!this.rowEl || !doc.body.contains(this.rowEl)) {
      this.mountRow(doc, list);
    }
    this.updateFeatureSwitchState(featureOn);
    if (featureOn) {
      this.ensureFilterSwitch(doc);
    } else if (this.filterBtnEl) {
      this.filterBtnEl.remove();
      this.filterBtnEl = null;
    }
  }

  private mountRow(doc: Document, list: HTMLElement): void {
    const row = el(doc, "div", { attrs: { id: SEARCH_ROW_ID } });

    const featureSwitch = el(doc, "button", {
      attrs: {
        id: SEARCH_SWITCH_ID,
        type: "button",
        role: "switch",
        "aria-checked": "false"
      },
      dataset: { on: "0" },
      on: {
        click: (event: MouseEvent): void => {
          event.preventDefault();
          event.stopPropagation();
          void this.toggleFeature();
        }
      }
    });
    const featureKnob = el(doc, "span", { class: "bc-switch-knob" });
    const featureLabel = el(doc, "span", { class: "bc-switch-label", text: "Prereqs (Beta)" });
    // Info icon — surfaces the experiment disclosure on hover. Click
    // stops propagation so it doesn't also toggle the parent switch.
    const featureInfo = el(doc, "span", {
      class: "bc-prereq-info",
      text: "i",
      attrs: {
        role: "img",
        "aria-label": "Experimental feature — read about the data quality caveat"
      },
      on: {
        click: (event: MouseEvent): void => {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    });
    attachTooltip(doc, featureInfo, () => buildExperimentInfoBody(doc));
    featureSwitch.append(featureKnob, featureLabel, featureInfo);
    row.append(featureSwitch);

    const parent = list.parentElement;
    if (parent) parent.insertBefore(row, list);
    else doc.body.appendChild(row);
    this.rowEl = row;
    this.switchEl = featureSwitch;
  }

  private updateFeatureSwitchState(featureOn: boolean): void {
    if (!this.switchEl) return;
    const onAttr = featureOn ? "1" : "0";
    if (this.switchEl.dataset.on !== onAttr) this.switchEl.dataset.on = onAttr;
    const ariaChecked = String(featureOn);
    if (this.switchEl.getAttribute("aria-checked") !== ariaChecked) {
      this.switchEl.setAttribute("aria-checked", ariaChecked);
    }
  }

  private ensureFilterSwitch(doc: Document): void {
    if (this.filterBtnEl && this.rowEl?.contains(this.filterBtnEl)) return;
    if (!this.rowEl) return;
    const filterSwitch = el(doc, "button", {
      attrs: {
        id: SEARCH_FILTER_BTN_ID,
        type: "button",
        title: "Show only courses whose prereqs you've fulfilled",
        role: "switch",
        "aria-checked": String(this.enabled)
      },
      dataset: { on: this.enabled ? "1" : "0" },
      on: {
        click: (event: MouseEvent): void => {
          event.preventDefault();
          event.stopPropagation();
          void this.toggleFilter(doc);
        }
      }
    });
    const filterKnob = el(doc, "span", { class: "bc-switch-knob" });
    const filterLabel = el(doc, "span", { class: "bc-switch-label", text: "Show Only Prereq Fulfilled" });
    const filterCount = el(doc, "span", { class: "bc-switch-count" });
    filterSwitch.append(filterKnob, filterLabel, filterCount);
    this.rowEl.appendChild(filterSwitch);
    this.filterBtnEl = filterSwitch;
  }

  private updateSwitchLabel(visible: number, total: number): void {
    if (!this.filterBtnEl) return;
    const onAttr = this.enabled ? "1" : "0";
    if (this.filterBtnEl.dataset.on !== onAttr) this.filterBtnEl.dataset.on = onAttr;
    const ariaChecked = String(this.enabled);
    if (this.filterBtnEl.getAttribute("aria-checked") !== ariaChecked) {
      this.filterBtnEl.setAttribute("aria-checked", ariaChecked);
    }
    const counter = this.filterBtnEl.querySelector(".bc-switch-count");
    if (!counter) return;
    const next = this.enabled ? `${visible}/${total}` : `${total}`;
    // CRITICAL: write only when the value actually changes. Assigning
    // textContent fires a `childList` mutation on document.body even when
    // the new value equals the old, which retriggers our own
    // MutationObserver → runAll → updateSwitchLabel → mutation → ... a
    // tight loop that manifests as the counter flickering.
    if (counter.textContent !== next) counter.textContent = next;
  }

  // Flip the feature toggle through the central settings store, the
  // same control surface as the popup. The storage observer wakes up
  // every other surface — popup display + augmentation runner — so the
  // two stay in lockstep.
  private async toggleFeature(): Promise<void> {
    try {
      const now = isFeatureEnabled(PREREQ_FILTER_FEATURE_ID);
      await setFeatureEnabled(PREREQ_FILTER_FEATURE_ID, !now);
    } catch (err) {
      logQuiet("prereq-filter.toggleFeature", err);
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
    const existing = card.querySelector(`.${PREREQ_BADGE_CLASS}`);
    existing?.remove();
    const parsed = courseIdInMap
      ? getParsedNodeForCourseId(courseIdInMap, this.parsedMap!)
      : null;
    const target = courseIdInMap ? splitCourseId(courseIdInMap) : null;
    const badge = makeBadge(doc, result, raw, parsed, this.historyMap, {
      parsedMap: this.parsedMap ?? undefined,
      target: target ? { ...target, state: result.state } : undefined
    });
    // Pin the badge to the card's bottom-right corner. SearchClass.tsx
    // doesn't include `relative`, so we set it ourselves and tag the card
    // so cleanup can revert only the ones we touched.
    if (!card.style.position) {
      card.style.position = "relative";
      card.setAttribute(POSITIONED_CARD_ATTR, "1");
    }
    badge.style.position = "absolute";
    badge.style.bottom = "8px";
    badge.style.right = "8px";
    badge.style.zIndex = "1";
    card.appendChild(badge);
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

  private async toggleFilter(doc: Document): Promise<void> {
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

    // Paper.nu renders every section (LEC + LAB + DIS) of a course as its
    // own grid cell. Prereqs are course-level (same for every section), so
    // we mount the badge on a single canonical cell per course — first by
    // day-column index, then by top-position within the day, then DOM
    // order. Mirrors paper-ctec's canonical-card selection (dom.ts).
    type GridCandidate = {
      card: HTMLElement;
      courseId: string;
      canonicalKey: string;
    };
    const candidatesByKey = new Map<string, GridCandidate>();

    for (const card of cards) {
      const courseId = extractCardCourseId(card);
      if (!courseId) continue;
      const canonicalKey = courseCanonicalKey(courseId);
      const candidate: GridCandidate = { card, courseId, canonicalKey };
      const existing = candidatesByKey.get(canonicalKey);
      if (!existing || compareGridCards(card, existing.card) < 0) {
        candidatesByKey.set(canonicalKey, candidate);
      }
    }

    const canonicalCards = new Set<HTMLElement>();
    for (const candidate of candidatesByKey.values()) {
      canonicalCards.add(candidate.card);
      const lookup = lookupParsed(this.parsedMap!, candidate.courseId);
      const result = lookup
        ? evaluateCourseId(lookup.id, this.parsedMap!, this.historyMap)
        : ({ state: "no-data", missing: [], notes: [] } as EligibilityResult);
      const raw = lookup ? getRawForCourseId(lookup.id, this.parsedMap!) : null;
      this.ensureGridBadge(doc, candidate.card, result, raw, lookup?.id ?? null);
    }

    // Any non-canonical card that previously hosted a badge (e.g. the
    // canonical card was just dragged away, or paper.nu rerendered) gets
    // its leftover badge stripped here so we never show duplicates.
    for (const card of cards) {
      if (canonicalCards.has(card)) continue;
      const stale = card.querySelector(`.${PREREQ_BADGE_CLASS}`);
      if (stale) stale.remove();
      card.removeAttribute(RENDERED_BADGE_ATTR);
    }
  }

  private ensureGridBadge(
    doc: Document,
    card: HTMLElement,
    result: EligibilityResult,
    raw: string | null,
    courseIdInMap: string | null
  ): void {
    // Re-render if state OR mount target changed. paper-ctec mounts its
    // actions anchor asynchronously, so the first tick may render the
    // badge in the absolute-fallback slot before the anchor exists — once
    // the anchor lands, we need to move the badge into it.
    const actionsAnchor = card.querySelector<HTMLElement>(
      PREREQ_FILTER_CONFIG.scheduleCardActionsAnchor
    );
    const sig = `${result.state}|${actionsAnchor ? "anchor" : "fallback"}`;
    if (card.getAttribute(RENDERED_BADGE_ATTR) === sig) return;
    card.setAttribute(RENDERED_BADGE_ATTR, sig);

    const existing = card.querySelector(`.${PREREQ_BADGE_CLASS}`);
    existing?.remove();
    const parsed = courseIdInMap
      ? getParsedNodeForCourseId(courseIdInMap, this.parsedMap!)
      : null;
    const target = courseIdInMap ? splitCourseId(courseIdInMap) : null;
    const badge = makeBadge(doc, result, raw, parsed, this.historyMap, {
      parsedMap: this.parsedMap ?? undefined,
      target: target ? { ...target, state: result.state } : undefined
    });
    // Grid-surface marker — paired with a CSS rule that overrides the
    // semi-transparent gate-bg tokens (used by the search panel) with a
    // solid background so the badge stays opaque on top of paper.nu's
    // translucent schedule cards (bg-opacity-60 in dark mode).
    badge.setAttribute("data-bc-prereq-surface", "grid");
    if (actionsAnchor) {
      // Prepend so the badge sits immediately to the left of the "+ Cart"
      // button (paper-ctec also prepends the cart button into this anchor,
      // and we want to land in front of it).
      actionsAnchor.prepend(badge);
      return;
    }
    // Fallback when paper-ctec isn't enabled / hasn't mounted its actions
    // anchor yet. Bottom-right corner of the card mirrors the search panel.
    badge.style.position = "absolute";
    badge.style.right = "6px";
    badge.style.bottom = "6px";
    card.appendChild(badge);
  }
}

// Tooltip body shown when the user hovers the (i) icon next to the
// in-page feature switch. Mirrors the popup-settings description so the
// disclosure lives in both places.
function buildExperimentInfoBody(doc: Document): HTMLElement {
  const wrap = el(doc, "div", { class: "bc-prereq-info-tip" });
  wrap.appendChild(
    el(doc, "strong", { class: "bc-tip-line", text: "Prereq Filter — experimental" })
  );
  wrap.appendChild(
    el(doc, "span", {
      class: "bc-tip-line",
      text:
        "Paints eligibility badges on Paper.nu search results + schedule cards based on your CAESAR course history."
    })
  );
  wrap.appendChild(
    el(doc, "span", {
      class: "bc-tip-line",
      text:
        "Data quality caveat: Paper.nu's data is sometimes out of sync with the actual course requirements."
    })
  );
  wrap.appendChild(
    el(doc, "span", {
      class: "bc-tip-line",
      text: "Tip: this switch and the popup setting control the same toggle."
    })
  );
  return wrap;
}
