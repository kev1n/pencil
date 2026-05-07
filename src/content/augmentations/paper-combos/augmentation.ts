import { logQuiet } from "../../../shared/log";
import type { Augmentation } from "../../framework";
import { isFeatureEnabled } from "../../settings";
import { enumerateCombinations, type EnumerateResult } from "./combinations";
import { PAPER_COMBOS_CONFIG } from "./config";
import {
  CARD_PIN_BUTTON_CLASS,
  DEFAULT_MAX_CLASSES,
  PAPER_COMBOS_FEATURE_ID,
  STYLE_ID,
  TOP_BAR_ID
} from "./constants";
import { loadComboPool, type LoadComboPoolResult } from "./data";
import { sortCombinations } from "./scoring";
import { injectCombosStyles } from "./styles";
import type { ComboPool, Combination } from "./types";
import {
  applyComboVisibility,
  ensureTopBar,
  renderTopBar,
  setRootAttribute,
  unhideRealCards
} from "./ui";

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
    return "No non-overlapping combinations possible. Try unpinning sections.";
  }
  // Dropped courses to fit: tell the user we couldn't pack everything in.
  if (
    enumerate &&
    enumerate.combinations.length > 0 &&
    enumerate.effectiveSize < enumerate.requestedSize
  ) {
    const dropped = enumerate.requestedSize - enumerate.effectiveSize;
    const noun = dropped === 1 ? "course" : "courses";
    return `Couldn't fit all ${enumerate.requestedSize} courses without overlap — showing best ${enumerate.effectiveSize}-class combos (${dropped} ${noun} dropped).`;
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
  // -1 means "use the course count as the max" — set on first load so the
  // user sees full-schedule combos by default and can lower it manually.
  private maxClasses = -1;
  private pinnedByCourseId = new Map<string, string>();
  private loading = false;
  private mounted = false;
  // The grid element we attached the on-card pin click handler to. Stored
  // so we can detach on cleanup (and skip re-attaching on every run).
  private pinClickHandlerGrid: HTMLElement | null = null;
  private pinClickHandler: ((event: MouseEvent) => void) | null = null;
  // Render-signature dedupe: every renderAll() call computes a string
  // capturing every input the bar's markup depends on. If unchanged since
  // the last render, we skip `bar.replaceChildren()` entirely — this is
  // what stops the runner's MutationObserver from looping on our own
  // bar updates (childList mutations from the bar would otherwise fire
  // observer → runAll → run() → renderAll → mutations → observer …).
  private lastRenderSig: string | null = null;

  run(doc: Document = document): void {
    if (!isPaperHost()) return;
    if (!isFeatureEnabled(PAPER_COMBOS_FEATURE_ID)) {
      if (this.mounted) this.cleanup(doc);
      return;
    }

    const grid = doc.querySelector<HTMLElement>(
      PAPER_COMBOS_CONFIG.selectors.scheduleGrid
    );
    if (!grid) {
      if (this.mounted) this.cleanup(doc);
      return;
    }

    this.mount(doc, grid);
    this.scheduleLoad(doc);
    this.renderAll(doc, grid);
  }

  cleanup(doc: Document = document): void {
    setRootAttribute(doc, false);
    unhideRealCards(doc);
    const bar = doc.getElementById(TOP_BAR_ID);
    if (bar) bar.remove();
    const style = doc.getElementById(STYLE_ID);
    if (style) style.remove();
    this.detachPinClickHandler();
    this.mounted = false;
    this.lastRenderSig = null;
  }

  private mount(doc: Document, grid: HTMLElement): void {
    injectCombosStyles(doc);
    setRootAttribute(doc, true);
    this.attachPinClickHandler(doc, grid);
    this.mounted = true;
  }

  // Delegated click handler on the schedule grid. Catches clicks on any
  // pin button we mounted inside paper.nu's cards — but stops propagation
  // first so paper.nu's onClick doesn't open the section detail panel.
  // Re-attached if the grid element changes between runs (paper.nu can
  // remount the grid wholesale when navigating between schedule views).
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
        if (grid && this.mounted) this.renderAll(doc, grid);
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
    const courseCount = this.pool.groups.length;
    if (this.maxClasses < 0) {
      // First load: snap to "all courses" by default so the canvas matches
      // what the user added. They can dial down via the input afterward.
      this.maxClasses = Math.min(
        courseCount,
        Math.max(courseCount, DEFAULT_MAX_CLASSES)
      );
    }
    if (this.maxClasses < 1) this.maxClasses = 1;
    if (this.maxClasses > courseCount && courseCount > 0) {
      this.maxClasses = courseCount;
    }
    const pinnedSectionIds = new Set(this.pinnedByCourseId.values());
    const result = enumerateCombinations(this.pool, {
      maxSize: this.maxClasses,
      pinnedSectionIds
    });
    this.lastEnumerate = result;
    this.combos = sortCombinations(result.combinations);
    if (this.cursor >= this.combos.length) this.cursor = 0;
  }

  private pruneStalePins(): void {
    if (!this.pool) {
      this.pinnedByCourseId.clear();
      return;
    }
    for (const [courseId, sectionId] of Array.from(this.pinnedByCourseId)) {
      const group = this.pool.groups.find((g) => g.courseId === courseId);
      if (!group || !group.sections.some((s) => s.sectionId === sectionId)) {
        this.pinnedByCourseId.delete(courseId);
      }
    }
  }

  private computeRenderSig(currentCombo: Combination | null): string {
    const poolSig = poolSignature(this.pool);
    const pinSig = Array.from(this.pinnedByCourseId)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("|");
    const comboSig = currentCombo
      ? `${currentCombo.sectionIds.join(",")}/${currentCombo.score.toFixed(3)}/${currentCombo.ratedCount}`
      : "-";
    return [
      poolSig,
      String(this.cursor),
      String(this.maxClasses),
      pinSig,
      String(this.combos.length),
      comboSig,
      this.lastLoadResult?.state ?? "",
      String(this.lastEnumerate?.truncated ?? false),
      String(this.lastEnumerate?.conflictingPins ?? false)
    ].join("::");
  }

  private renderAll(doc: Document, grid: HTMLElement): void {
    const bar = ensureTopBar(doc, grid, {
      onPrev: () => this.cyclePrev(doc, grid),
      onNext: () => this.cycleNext(doc, grid),
      onMaxChange: (value) => this.setMax(doc, grid, value)
    });
    const currentCombo = this.combos[this.cursor] ?? null;
    const courseCount = this.pool?.groups.length ?? 0;

    // applyComboVisibility runs unconditionally (outside the dedupe).
    // setAttribute doesn't fire our childList-only MutationObserver, so
    // it's loop-safe — and we need to re-stamp hide markers, layout
    // overrides, and pin buttons whenever paper.nu re-renders schedule
    // cards from scratch (which clears them).
    if (currentCombo && this.pool) {
      applyComboVisibility(
        doc,
        grid,
        this.pool,
        currentCombo,
        new Set(this.pinnedByCourseId.values())
      );
      // Re-attach the delegated handler if paper.nu swapped the grid.
      this.attachPinClickHandler(doc, grid);
    } else {
      unhideRealCards(doc);
    }

    const sig = this.computeRenderSig(currentCombo);
    if (sig === this.lastRenderSig) return;
    this.lastRenderSig = sig;

    const maxClassesUi = this.maxClasses < 0
      ? Math.max(1, courseCount)
      : this.maxClasses;

    renderTopBar(doc, bar, {
      total: this.combos.length,
      cursor: this.cursor,
      score: currentCombo?.score ?? 0,
      ratedCount: currentCombo?.ratedCount ?? 0,
      totalSections: this.pool?.byId.size ?? 0,
      maxClasses: maxClassesUi,
      maxAllowed: Math.max(1, courseCount),
      status: statusFromLoadState(this.lastLoadResult, this.lastEnumerate),
      truncated: this.lastEnumerate?.truncated ?? false,
      conflictingPins: this.lastEnumerate?.conflictingPins ?? false
    });
  }

  private cyclePrev(doc: Document, grid: HTMLElement): void {
    if (this.combos.length === 0) return;
    this.cursor = (this.cursor - 1 + this.combos.length) % this.combos.length;
    this.renderAll(doc, grid);
  }

  private cycleNext(doc: Document, grid: HTMLElement): void {
    if (this.combos.length === 0) return;
    this.cursor = (this.cursor + 1) % this.combos.length;
    this.renderAll(doc, grid);
  }

  private setMax(doc: Document, grid: HTMLElement, value: number): void {
    if (!Number.isFinite(value) || value < 1) return;
    this.maxClasses = Math.floor(value);
    this.recomputeCombos();
    this.renderAll(doc, grid);
  }

  // Pin behavior: clicking a card's pin button toggles the pin for that
  // specific section. If the same section was already pinned, click
  // unpins. If a different section of the same course was pinned (only
  // possible if the user pinned across cycles), click swaps the pin to
  // this section. Either way, the section the user just clicked is the
  // authoritative target — they're acting on what's visibly on screen.
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
    this.renderAll(doc, grid);
  }
}
