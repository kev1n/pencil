import { logQuiet } from "../../../shared/log";
import type { Augmentation } from "../../framework";
import {
  FEATURES_STORAGE_KEY,
  getDefaultFeatureEnabled,
  isFeatureEnabled
} from "../../settings";
import { enumerateCombinations, type EnumerateResult } from "./combinations";
import { PAPER_COMBOS_CONFIG } from "./config";
import {
  CARD_PIN_BUTTON_CLASS,
  DEFAULT_MAX_CREDITS,
  PAPER_COMBOS_ACTIVE_ID,
  PAPER_COMBOS_FEATURE_ID,
  STYLE_ID,
  TOP_BAR_ID
} from "./constants";
import { loadComboPool, type LoadComboPoolResult } from "./data";
import { sortCombinations } from "./scoring";
import { injectCombosStyles } from "./styles";
import type { ComboPool, Combination, ComboSection, CourseGroup } from "./types";
import {
  applyComboVisibility,
  ensureTopBar,
  renderTopBar,
  renderZones,
  setRootAttribute,
  unhideRealCards,
  attachZoneDragHandlers,
  type ZoneDragCallbacks
} from "./ui";
import {
  loadZones,
  saveZones,
  sectionConflictsWithZones,
  subscribeZoneChanges,
  type ProhibitedZone
} from "./zones";

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

function poolSignature(pool: ComboPool | null): string {
  if (!pool) return "";
  const ids = Array.from(pool.byId.keys()).sort();
  return `${pool.termId}|${ids.join(",")}`;
}

function loadResultPool(result: LoadComboPoolResult): ComboPool | null {
  return result.state === "ok" ? result.pool : null;
}

function formatCredits(n: number): string {
  // Drop trailing .0 for whole-number budgets so the status reads "5
  // credits" not "5.0 credits".
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function statusFromLoadState(
  result: LoadComboPoolResult | null,
  enumerate: EnumerateResult | null
): string | undefined {
  if (!result) return "Reading schedule…";
  if (result.state === "no-schedule") {
    return "Add classes to your schedule to generate combinations.";
  }
  if (result.state === "no-term") return "No active term.";
  if (result.state === "term-data-missing") {
    return "Couldn't load term data — try again in a moment.";
  }
  if (enumerate?.conflictingPins) {
    return "Pinned sections conflict with each other. Unpin one to continue.";
  }
  if (enumerate && enumerate.combinations.length === 0) {
    return "No non-overlapping combinations possible. Try unpinning sections or raising Max.";
  }
  if (
    enumerate &&
    enumerate.combinations.length > 0 &&
    enumerate.effectiveCredits < enumerate.requestedCredits
  ) {
    const want = formatCredits(enumerate.requestedCredits);
    const got = formatCredits(enumerate.effectiveCredits);
    return `Couldn't fit ${want} credits without overlap — showing best ${got}-credit schedules.`;
  }
  if (enumerate && enumerate.combinations.length === 1) {
    return "Only one valid combination at this size. Add another section of a course (or lower Max) to see alternatives.";
  }
  if (enumerate?.truncated) {
    return "Showing the first batch of combinations — narrow the pool with pins to see more.";
  }
  return undefined;
}

export class PaperCombosAugmentation implements Augmentation {
  readonly id = PAPER_COMBOS_FEATURE_ID;

  private pool: ComboPool | null = null;
  private lastLoadResult: LoadComboPoolResult | null = null;
  private lastEnumerate: EnumerateResult | null = null;
  private combos: Combination[] = [];
  private cursor = 0;
  private maxCredits = DEFAULT_MAX_CREDITS;
  private pinnedByCourseId = new Map<string, string>();
  // Prohibited time zones drawn on the canvas. Persisted to
  // chrome.storage.local so they survive reloads. Sections whose
  // meeting blocks fall in any zone are excluded from combinations.
  private zones: ProhibitedZone[] = [];
  private zonesLoaded = false;
  private zonesUnsubscribe: (() => void) | null = null;
  private loading = false;
  // True when the bar (with the on-page toggle) is mounted on the
  // schedule page. Distinct from `featureMounted` — the bar is always
  // present on a paper.nu schedule page so users can flip the feature on
  // and off in-place; the data-pull / card-hiding side effects only run
  // when the user has the feature enabled.
  private barMounted = false;
  private featureMounted = false;
  private pinClickHandlerGrid: HTMLElement | null = null;
  private pinClickHandler: ((event: MouseEvent) => void) | null = null;
  private lastRenderSig: string | null = null;

  run(doc: Document = document): void {
    if (!isPaperHost()) return;
    const grid = doc.querySelector<HTMLElement>(
      PAPER_COMBOS_CONFIG.selectors.scheduleGrid
    );
    if (!grid) {
      // Off the schedule page entirely — tear down everything.
      if (this.barMounted) this.cleanup(doc);
      return;
    }

    this.mountBar(doc);
    const enabled = isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID);

    if (enabled) {
      this.mountFeature(doc, grid);
      this.scheduleLoad(doc);
    } else {
      this.unmountFeature(doc);
    }

    this.renderAll(doc, grid, enabled);
  }

  cleanup(doc: Document = document): void {
    setRootAttribute(doc, false);
    unhideRealCards(doc);
    const bar = doc.getElementById(TOP_BAR_ID);
    if (bar) bar.remove();
    const style = doc.getElementById(STYLE_ID);
    if (style) style.remove();
    this.detachPinClickHandler();
    this.detachZoneHandlers();
    if (this.zonesUnsubscribe) {
      this.zonesUnsubscribe();
      this.zonesUnsubscribe = null;
    }
    this.zonesLoaded = false;
    this.barMounted = false;
    this.featureMounted = false;
    this.lastRenderSig = null;
  }

  private mountBar(doc: Document): void {
    if (this.barMounted) return;
    injectCombosStyles(doc);
    this.barMounted = true;
  }

  private mountFeature(doc: Document, grid: HTMLElement): void {
    setRootAttribute(doc, true);
    this.attachPinClickHandler(doc, grid);
    this.attachZoneHandlers(doc, grid);
    this.ensureZonesLoaded(doc, grid);
    this.featureMounted = true;
  }

  private ensureZonesLoaded(doc: Document, grid: HTMLElement): void {
    if (this.zonesLoaded) return;
    this.zonesLoaded = true;
    void loadZones().then((zones) => {
      this.zones = zones;
      this.recomputeCombos();
      this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
    });
    if (!this.zonesUnsubscribe) {
      this.zonesUnsubscribe = subscribeZoneChanges(() => {
        // The cache inside zones.ts already updated to the new values;
        // pull from it via loadZones (returns the cached array).
        void loadZones().then((zones) => {
          this.zones = zones;
          this.recomputeCombos();
          this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
        });
      });
    }
  }

  // Tear down feature side effects (card-hiding, layout overrides, pin
  // buttons) without removing the bar — the user just toggled the
  // feature off in-place and the bar's toggle pill stays so they can
  // turn it back on.
  private unmountFeature(doc: Document): void {
    if (!this.featureMounted) return;
    setRootAttribute(doc, false);
    unhideRealCards(doc);
    this.detachPinClickHandler();
    this.detachZoneHandlers();
    this.featureMounted = false;
    // Reset cursor + pool-derived state so flipping the feature back on
    // re-derives from a clean slate.
    this.lastRenderSig = null;
  }

  // Persist the in-page active flag. The popup-level `paper-combos`
  // gate stays untouched — that's the user's "show this feature on
  // paper.nu at all" preference. We only flip the active state here.
  private async setFeatureEnabled(next: boolean): Promise<void> {
    try {
      const current = (await chrome.storage.local.get(FEATURES_STORAGE_KEY)) as
        Record<string, unknown>;
      const settings =
        (current[FEATURES_STORAGE_KEY] as Record<string, boolean>) ?? {};
      settings[PAPER_COMBOS_ACTIVE_ID] = next;
      await chrome.storage.local.set({ [FEATURES_STORAGE_KEY]: settings });
    } catch (err) {
      logQuiet("paper-combos.setFeatureEnabled", err);
    }
  }

  private attachPinClickHandler(doc: Document, grid: HTMLElement): void {
    if (this.pinClickHandlerGrid === grid && this.pinClickHandler) return;
    this.detachPinClickHandler();

    const handler = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>(`.${CARD_PIN_BUTTON_CLASS}`);
      if (!button) return;
      event.stopPropagation();
      event.preventDefault();
      const courseId = button.getAttribute("data-bc-paper-combos-course");
      const sectionId = button.dataset.bcCombosCardSection;
      if (!courseId || !sectionId) return;
      this.togglePin(doc, grid, courseId, sectionId);
    };

    grid.addEventListener("click", handler, true);
    this.pinClickHandlerGrid = grid;
    this.pinClickHandler = handler;
  }

  private detachPinClickHandler(): void {
    if (this.pinClickHandlerGrid && this.pinClickHandler) {
      this.pinClickHandlerGrid.removeEventListener(
        "click",
        this.pinClickHandler,
        true
      );
    }
    this.pinClickHandlerGrid = null;
    this.pinClickHandler = null;
  }

  private zoneHandlerDetach: (() => void) | null = null;

  private attachZoneHandlers(doc: Document, grid: HTMLElement): void {
    if (this.zoneHandlerDetach) return;
    const callbacks: ZoneDragCallbacks = {
      onZoneCreate: (zone) => {
        void this.addZone(doc, grid, zone);
      },
      onZoneRemove: (zoneId) => {
        void this.removeZone(doc, grid, zoneId);
      }
    };
    this.zoneHandlerDetach = attachZoneDragHandlers(doc, grid, callbacks);
  }

  private detachZoneHandlers(): void {
    if (this.zoneHandlerDetach) {
      this.zoneHandlerDetach();
      this.zoneHandlerDetach = null;
    }
  }

  private async addZone(
    doc: Document,
    grid: HTMLElement,
    zone: ProhibitedZone
  ): Promise<void> {
    this.zones = [...this.zones, zone];
    await saveZones(this.zones);
    this.recomputeCombos();
    this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
  }

  private async removeZone(
    doc: Document,
    grid: HTMLElement,
    zoneId: string
  ): Promise<void> {
    this.zones = this.zones.filter((z) => z.id !== zoneId);
    await saveZones(this.zones);
    this.recomputeCombos();
    this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
  }

  private async clearAllZones(
    doc: Document,
    grid: HTMLElement
  ): Promise<void> {
    if (this.zones.length === 0) return;
    this.zones = [];
    await saveZones(this.zones);
    this.recomputeCombos();
    this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
  }

  private scheduleLoad(doc: Document): void {
    if (this.loading) return;
    this.loading = true;
    void loadComboPool()
      .then((result) => {
        this.lastLoadResult = result;
        const nextPool = loadResultPool(result);
        const sigBefore = poolSignature(this.pool);
        const sigAfter = poolSignature(nextPool);
        if (sigBefore !== sigAfter) {
          this.pool = nextPool;
          this.recomputeCombos();
        }
      })
      .catch((err) => {
        logQuiet("paper-combos.load", err);
      })
      .finally(() => {
        this.loading = false;
        const grid = doc.querySelector<HTMLElement>(
          PAPER_COMBOS_CONFIG.selectors.scheduleGrid
        );
        if (grid && this.barMounted) {
          this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
        }
      });
  }

  private recomputeCombos(): void {
    if (!this.pool) {
      this.combos = [];
      this.lastEnumerate = null;
      this.cursor = 0;
      return;
    }
    this.pruneStalePins();
    if (this.maxCredits < 0.1) this.maxCredits = 0.5;

    // Build a zone-filtered pool: any section whose meeting blocks fall
    // in a prohibited zone is dropped from its course group, and a
    // course with no surviving sections is dropped entirely. byId stays
    // pruned in lockstep so the enumerator's pin lookup matches.
    const filteredPool = this.buildZoneFilteredPool(this.pool);

    const pinnedSectionIds = new Set(this.pinnedByCourseId.values());
    const result = enumerateCombinations(filteredPool, {
      maxCredits: this.maxCredits,
      pinnedSectionIds
    });
    this.lastEnumerate = result;
    this.combos = sortCombinations(result.combinations);
    if (this.cursor >= this.combos.length) this.cursor = 0;
  }

  private buildZoneFilteredPool(pool: ComboPool): ComboPool {
    if (this.zones.length === 0) return pool;
    const filteredGroups: CourseGroup[] = [];
    const filteredById = new Map<string, ComboSection>();
    for (const group of pool.groups) {
      const sections = group.sections.filter(
        (s) => !sectionConflictsWithZones(s, this.zones)
      );
      if (sections.length === 0) continue;
      filteredGroups.push({ ...group, sections });
      for (const section of sections) {
        filteredById.set(section.sectionId, section);
      }
    }
    return {
      termId: pool.termId,
      groups: filteredGroups,
      byId: filteredById
    };
  }

  // Pins evict themselves when (a) the section is gone from the canvas
  // pool entirely, (b) the course is no longer represented, or (c) the
  // pinned section now falls inside a prohibited zone. Cleanest UX —
  // drawing a zone over a pinned section silently unpins it instead of
  // leaving the user staring at "0 / 0".
  private pruneStalePins(): void {
    if (!this.pool) {
      this.pinnedByCourseId.clear();
      return;
    }
    for (const [courseId, sectionId] of Array.from(this.pinnedByCourseId)) {
      const group = this.pool.groups.find((g) => g.courseId === courseId);
      if (!group || !group.sections.some((s) => s.sectionId === sectionId)) {
        this.pinnedByCourseId.delete(courseId);
        continue;
      }
      const section = this.pool.byId.get(sectionId);
      if (section && sectionConflictsWithZones(section, this.zones)) {
        this.pinnedByCourseId.delete(courseId);
      }
    }
  }

  private computeRenderSig(
    currentCombo: Combination | null,
    enabled: boolean
  ): string {
    const poolSig = poolSignature(this.pool);
    const pinSig = Array.from(this.pinnedByCourseId)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("|");
    const comboSig = currentCombo
      ? `${currentCombo.sectionIds.join(",")}/${currentCombo.score.toFixed(3)}/${currentCombo.ratedCount}`
      : "-";
    const zoneSig = this.zones
      .map((z) => `${z.id}@${z.day}:${z.startMin}-${z.endMin}`)
      .sort()
      .join(",");
    return [
      String(enabled),
      poolSig,
      String(this.cursor),
      String(this.maxCredits),
      pinSig,
      zoneSig,
      String(this.combos.length),
      comboSig,
      this.lastLoadResult?.state ?? "",
      String(this.lastEnumerate?.truncated ?? false),
      String(this.lastEnumerate?.conflictingPins ?? false)
    ].join("::");
  }

  private renderAll(
    doc: Document,
    grid: HTMLElement,
    enabled: boolean
  ): void {
    const bar = ensureTopBar(doc, grid, {
      onPrev: () => this.cyclePrev(doc, grid),
      onNext: () => this.cycleNext(doc, grid),
      onMaxChange: (value) => this.setMax(doc, grid, value),
      onToggleFeature: (next) => {
        void this.setFeatureEnabled(next);
      }
    });
    const currentCombo = enabled ? this.combos[this.cursor] ?? null : null;

    // Card-visibility side effects only run when the feature is on.
    // setAttribute doesn't fire our childList-only MutationObserver, so
    // it's loop-safe inside the renderAll cycle even outside the dedupe.
    if (enabled && currentCombo && this.pool) {
      applyComboVisibility(
        doc,
        grid,
        this.pool,
        currentCombo,
        new Set(this.pinnedByCourseId.values())
      );
      this.attachPinClickHandler(doc, grid);
    } else {
      unhideRealCards(doc);
    }

    // Zones get re-painted unconditionally when the feature is on so they
    // survive paper.nu's React re-renders (which wipe everything inside
    // day columns). Only sourced from this.zones — read-only here.
    if (enabled) {
      renderZones(doc, grid, this.zones);
    } else {
      renderZones(doc, grid, []);
    }

    const sig = this.computeRenderSig(currentCombo, enabled);
    if (sig === this.lastRenderSig) return;
    this.lastRenderSig = sig;

    renderTopBar(doc, bar, {
      enabled,
      total: this.combos.length,
      cursor: this.cursor,
      score: currentCombo?.score ?? 0,
      ratedCount: currentCombo?.ratedCount ?? 0,
      totalSections: this.pool?.byId.size ?? 0,
      maxCredits: this.maxCredits,
      status: enabled
        ? statusFromLoadState(this.lastLoadResult, this.lastEnumerate)
        : undefined,
      truncated: this.lastEnumerate?.truncated ?? false,
      conflictingPins: this.lastEnumerate?.conflictingPins ?? false,
      defaultEnabled: getDefaultFeatureEnabled(PAPER_COMBOS_FEATURE_ID),
      zoneCount: this.zones.length
    }, {
      onClearZones: () => {
        void this.clearAllZones(doc, grid);
      }
    });
  }

  private cyclePrev(doc: Document, grid: HTMLElement): void {
    if (this.combos.length === 0) return;
    this.cursor = (this.cursor - 1 + this.combos.length) % this.combos.length;
    this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
  }

  private cycleNext(doc: Document, grid: HTMLElement): void {
    if (this.combos.length === 0) return;
    this.cursor = (this.cursor + 1) % this.combos.length;
    this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
  }

  private setMax(doc: Document, grid: HTMLElement, value: number): void {
    if (!Number.isFinite(value) || value < 0.5) return;
    this.maxCredits = value;
    this.recomputeCombos();
    this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
  }

  private togglePin(
    doc: Document,
    grid: HTMLElement,
    courseId: string,
    sectionId: string
  ): void {
    const existingPin = this.pinnedByCourseId.get(courseId);
    if (existingPin === sectionId) {
      this.pinnedByCourseId.delete(courseId);
    } else {
      this.pinnedByCourseId.set(courseId, sectionId);
    }

    this.recomputeCombos();
    this.renderAll(doc, grid, isFeatureEnabled(PAPER_COMBOS_ACTIVE_ID));
  }
}
