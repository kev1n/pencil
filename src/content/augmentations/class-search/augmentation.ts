import { logQuiet } from "../../../shared/log";
import {
  initCartCache,
  lookupBySignature,
  lookupClassNumber,
  readTermCart,
  recordOptimisticAdd,
  subscribe as subscribeCartCache,
  type CartEntry,
  type CartLookupHit
} from "../../cart-cache";
import type { Augmentation } from "../../framework";
import { isRetryablePeopleSoftTaskError, lookupClass } from "../../peoplesoft";
import {
  buildPeopleSoftCreditToast,
  formatPsCreditsWarning,
  initStorage as initSeatsNotesStorage,
  pruneEmptySeatsCache,
  readCachedEntry as readSeatsNotesCache,
  tryConsumePeopleSoftCredit,
  writeCachedEntry as writeSeatsNotesCache
} from "../seats-notes/storage";
import { toSeatsNotesResult, toFailure as seatsNotesFailure } from "../seats-notes/parser";
import { showToast } from "../seats-notes/toast";
import type { SeatsNotesResult, SeatsNotesSuccess } from "../seats-notes/types";

import {
  addSectionToCart,
  continueCartAddWithRelated,
  isCaesarAuthRequiredError,
  matchCaesarGroup,
  matchCaesarSection,
  searchCaesarCatalog,
  type CaesarCourseGroup,
  type CaesarSection,
  type CaesarSearchResult,
  type RelatedSectionOption
} from "./caesar-search";
import type {
  AuthPopupClosedMessage,
  OpenAuthPopupMessage,
  OpenAuthPopupResponse
} from "../../../shared/messages";
import {
  bareCatalogNumber,
  formatCourseIdForDisplay
} from "./catalog-format";
import {
  initCatalogCache,
  readCatalogCache,
  writeCatalogCache
} from "./catalog-cache";
import {
  applyFilters,
  buildCatalogIndex,
  formatInstructors,
  formatMeetingPattern,
  formatRoom,
  meetingPatternCount
} from "./filter";
import {
  getDataMapInfo,
  getPlanCourses,
  getSubjects,
  getTermCourses,
  listTerms,
  pruneStalePaperCaches,
  type DataMapInfo,
  type PaperCourse,
  type PaperSection,
  type PaperTermCourse,
  type SubjectInfo
} from "./paper-data";
import { STYLE_ID as CLASS_SEARCH_STYLE_ID, ensureStyles } from "./styles";
import {
  PAPER_DISCIPLINE_LABELS,
  PAPER_DISTRO_LABELS,
  type ResultRow,
  type SearchFilters
} from "./types";

const ROOT_ID = "better-caesar-class-search-root";
const TABS_ID = "better-caesar-class-search-tabs";
const HIDE_NATIVE_STYLE_ID = "better-caesar-class-search-hide-native";
const SEARCH_PAGE_ID = "SSR_CLSRCH_ENTRY";
const SEARCH_COMPONENT = "CLASS_SEARCH";

const TAB_STORAGE_KEY = "better-caesar:class-search:active-tab";
type TabId = "better" | "classic";

const INSTITUTION_DEFAULT = "NWUNV";

const CART_URL =
  "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A";

type CourseLiveCache = {
  status: "loading" | "ready" | "error";
  result?: CaesarSearchResult;
  error?: string;
};

type MountedState = {
  doc: Document;
  root: HTMLDivElement;
  panelEl: HTMLDivElement;
  resultsEl: HTMLDivElement;
  statusEl: HTMLDivElement;
  filters: SearchFilters;
  info: DataMapInfo;
  subjects: Record<string, SubjectInfo>;
  catalogIndex: Map<string, PaperCourse>;
  career: string;
  institution: string;
  loadedTerms: Map<string, PaperTermCourse[]>;
  searchDebounce: number | null;
  // Per-course CAESAR live data, keyed by `${termId}|${subject}|${bareCatalog}`.
  // Sections that share a bare catalog (e.g. "111-0" + "111-SG") come from
  // the same CAESAR search response.
  liveCache: Map<string, CourseLiveCache>;
  activeTab: TabId;
  // Per-section Add buttons currently mounted on screen. Keyed by
  // `${termId}|${subject}|${catalog}|${sectionLabel}` (the signature the
  // cart cache also uses) so a subscribe-driven repaint can find them
  // without walking the whole DOM. Buttons remove themselves from this
  // map when their <li> disconnects.
  cartButtons: Map<string, HTMLButtonElement>;
  // Unsubscribe from cart-cache change notifications. Called on unmount so
  // the listener doesn't leak across mount cycles.
  cartUnsubscribe: (() => void) | null;
  // Last tab `applyTabVisibility` actually applied to the DOM. Without
  // this, every mutation observer tick would re-toggle the native-hider
  // style and panel display.
  appliedTab: TabId | null;
};

export class ClassSearchAugmentation implements Augmentation {
  readonly id = "class-search";

  private mounted: MountedState | null = null;
  private mountInProgress = false;

  constructor() {
    void initSeatsNotesStorage().then(() => pruneEmptySeatsCache());
    void pruneStalePaperCaches();
    void initCartCache();
    void initCatalogCache();
  }

  cleanup(doc: Document = document): void {
    this.unmount(doc);
  }

  // Shared CAESAR PS rate gate. Each user-initiated PS chain (Load CAESAR,
  // Details, Add to cart, related-section pick, detail Refresh) consumes
  // one credit from the seats-notes pool so a single-cap budget covers
  // every CAESAR PS surface in the extension. `owner` is just for the
  // background worker's credit-usage log.
  private consumePsCredit(owner: string): boolean {
    const credit = tryConsumePeopleSoftCredit(Date.now(), `class-search-${owner}`);
    if (!credit.ok) {
      showToast(buildPeopleSoftCreditToast(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return false;
    }
    return true;
  }

  run(doc: Document = document): void {
    if (!isSearchEntryPage(doc)) {
      this.unmount(doc);
      return;
    }

    if (this.mounted && this.mounted.doc === doc && doc.getElementById(ROOT_ID) && doc.getElementById(TABS_ID)) {
      // Re-apply visibility in case PeopleSoft swapped DOM under us.
      applyTabVisibility(this.mounted);
      return;
    }

    if (this.mountInProgress) return;
    void this.mount(doc);
  }

  private async mount(doc: Document): Promise<void> {
    this.mountInProgress = true;
    try {
      ensureStyles(doc);

      const placeholder = ensureRoot(doc);
      placeholder.innerHTML = "";
      placeholder.appendChild(buildLoadingShell(doc));

      let info: DataMapInfo;
      let subjects: Record<string, SubjectInfo>;
      let planCourses: PaperCourse[];
      try {
        [info, subjects, planCourses] = await Promise.all([
          getDataMapInfo(),
          getSubjects(),
          getPlanCourses()
        ]);
      } catch (error) {
        if (doc.getElementById(ROOT_ID)) {
          renderFatalError(
            placeholder,
            doc,
            error instanceof Error ? error.message : String(error)
          );
        }
        return;
      }

      if (!doc.getElementById(ROOT_ID) || !isSearchEntryPage(doc)) {
        return;
      }

      const career = readCareerFromNativeForm(doc) ?? "UGRD";
      const institution = readInstitutionFromNativeForm(doc) ?? INSTITUTION_DEFAULT;
      const initialTerm = readTermFromNativeForm(doc) ?? info.latest;

      const state: MountedState = {
        doc,
        root: placeholder,
        panelEl: doc.createElement("div"),
        resultsEl: doc.createElement("div"),
        statusEl: doc.createElement("div"),
        filters: {
          termId: initialTerm,
          query: ""
        },
        info,
        subjects,
        catalogIndex: buildCatalogIndex(planCourses),
        career,
        institution,
        loadedTerms: new Map(),
        searchDebounce: null,
        liveCache: new Map(),
        activeTab: readActiveTab(),
        cartButtons: new Map(),
        cartUnsubscribe: null,
        appliedTab: null
      };
      this.mounted = state;
      // Cart cache pushes here when CAESAR cart-page reconcile lands or
      // another tab made an optimistic add. Repaint Add-button badges and
      // re-render the empty-state "Your classes" cards if showing.
      state.cartUnsubscribe = subscribeCartCache(() => {
        this.repaintAllCartButtons(state);
        if (!hasAnyFilter(state.filters)) {
          this.renderMyClassesView(state);
        }
      });

      placeholder.innerHTML = "";
      placeholder.appendChild(this.buildTabs(state));
      state.panelEl.id = "better-caesar-class-search-panel";
      state.panelEl.appendChild(this.buildShell(state));
      placeholder.appendChild(state.panelEl);

      applyTabVisibility(state);

      void this.loadTermAndSearch(state);
    } finally {
      this.mountInProgress = false;
    }
  }

  private unmount(doc: Document): void {
    if (this.mounted?.searchDebounce !== null && this.mounted?.searchDebounce !== undefined) {
      window.clearTimeout(this.mounted.searchDebounce);
    }
    this.mounted?.cartUnsubscribe?.();
    this.mounted?.cartButtons.clear();
    const root = doc.getElementById(ROOT_ID);
    if (root) root.remove();
    const hider = doc.getElementById(HIDE_NATIVE_STYLE_ID);
    if (hider) hider.remove();
    doc.getElementById(CLASS_SEARCH_STYLE_ID)?.remove();
    this.mounted = null;
  }

  // ── Tab bar ───────────────────────────────────────────────────────────────

  private buildTabs(state: MountedState): HTMLElement {
    const { doc } = state;
    const wrap = doc.createElement("div");
    wrap.id = TABS_ID;
    wrap.className = "bc-cs-tabs";

    const better = this.buildTabButton(state, "better", "Sharper Search");
    const classic = this.buildTabButton(state, "classic", "Classic CAESAR");
    wrap.append(better, classic);
    return wrap;
  }

  private buildTabButton(state: MountedState, id: TabId, label: string): HTMLButtonElement {
    const { doc } = state;
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "bc-cs-tab";
    btn.dataset.tab = id;
    btn.textContent = label;
    btn.dataset.active = state.activeTab === id ? "true" : "false";
    btn.addEventListener("click", () => {
      if (state.activeTab === id) return;
      state.activeTab = id;
      writeActiveTab(id);
      const tabsEl = doc.getElementById(TABS_ID);
      tabsEl?.querySelectorAll<HTMLButtonElement>("button.bc-cs-tab").forEach((el) => {
        el.dataset.active = el.dataset.tab === id ? "true" : "false";
      });
      applyTabVisibility(state);
    });
    return btn;
  }

  // ── Shell ─────────────────────────────────────────────────────────────────

  private buildShell(state: MountedState): HTMLElement {
    const { doc } = state;

    const root = doc.createElement("div");
    root.className = "bc-cs-shell";

    const header = doc.createElement("div");
    header.className = "bc-cs-header";
    const title = doc.createElement("h1");
    title.className = "bc-cs-title";
    title.textContent = "Search for Classes";
    const subtitle = doc.createElement("div");
    subtitle.className = "bc-cs-subtitle";
    subtitle.innerHTML = `Catalog from <a href="https://paper.nu" target="_blank" rel="noopener">paper.nu</a> · live status fetched from CAESAR on demand`;
    header.append(title, subtitle);

    const card = doc.createElement("div");
    card.className = "bc-cs-card";

    const form = doc.createElement("div");
    form.className = "bc-cs-form";
    form.append(this.buildQueryField(state), this.buildTermField(state));

    state.statusEl.className = "bc-cs-status";
    state.statusEl.textContent = "";

    state.resultsEl.className = "bc-cs-results";

    card.append(form, state.statusEl);

    root.append(header, card, state.resultsEl);
    return root;
  }

  // ── Form fields ───────────────────────────────────────────────────────────

  private buildQueryField(state: MountedState): HTMLDivElement {
    const { doc } = state;
    const field = doc.createElement("div");
    field.className = "bc-cs-field bc-cs-field-query";
    const label = doc.createElement("label");
    label.htmlFor = "bc-cs-query";
    label.textContent = "Search";
    const input = doc.createElement("input");
    input.id = "bc-cs-query";
    input.className = "bc-cs-input bc-cs-input-query";
    input.placeholder = "comp_sci 111, machine learning, stat 21x, …";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      state.filters.query = input.value;
      this.scheduleSearch(state);
    });
    field.append(label, input);
    return field;
  }

  private buildTermField(state: MountedState): HTMLDivElement {
    const { doc } = state;
    const field = doc.createElement("div");
    field.className = "bc-cs-field";
    const label = doc.createElement("label");
    label.htmlFor = "bc-cs-term";
    label.textContent = "Term";
    const select = doc.createElement("select");
    select.id = "bc-cs-term";
    select.className = "bc-cs-select";

    const terms = listTerms(state.info);
    for (const term of terms) {
      const option = doc.createElement("option");
      option.value = term.id;
      option.textContent = term.name;
      if (term.id === state.filters.termId) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      state.filters.termId = select.value;
      void this.loadTermAndSearch(state);
    });

    field.append(label, select);
    return field;
  }

  // ── Search execution ──────────────────────────────────────────────────────

  private scheduleSearch(state: MountedState): void {
    if (state.searchDebounce !== null) {
      window.clearTimeout(state.searchDebounce);
    }
    state.searchDebounce = window.setTimeout(() => {
      state.searchDebounce = null;
      this.runSearch(state);
    }, 120);
  }

  private async loadTermAndSearch(state: MountedState): Promise<void> {
    const termId = state.filters.termId;
    const cached = state.loadedTerms.get(termId);
    if (cached) {
      this.runSearch(state);
      return;
    }

    this.setStatus(state, "loading", `Loading ${state.info.terms[termId]?.name ?? termId} sections…`);
    try {
      const courses = await getTermCourses(termId);
      // User may have switched terms while the fetch was in flight.
      if (state.filters.termId !== termId) return;
      state.loadedTerms.set(termId, courses);
      this.setStatus(state, "ok", "");
      this.runSearch(state);
    } catch (error) {
      if (state.filters.termId !== termId) return;
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(state, "error", `Couldn't load term data: ${msg}`);
    }
  }

  private runSearch(state: MountedState): void {
    const courses = state.loadedTerms.get(state.filters.termId);
    if (!courses) return;
    const rows = applyFilters(courses, state.catalogIndex, state.subjects, state.filters, state.career);
    this.renderResults(state, rows);
  }

  private renderResults(state: MountedState, rows: ResultRow[]): void {
    const { doc } = state;
    state.resultsEl.innerHTML = "";

    if (!hasAnyFilter(state.filters)) {
      this.renderMyClassesView(state);
      return;
    }

    if (rows.length === 0) {
      const empty = doc.createElement("div");
      empty.className = "bc-cs-empty";
      empty.textContent = "No matches. Try loosening filters or switching terms.";
      state.resultsEl.appendChild(empty);
      this.setStatus(state, "ok", "0 results");
      return;
    }

    let totalSections = 0;
    for (const row of rows) {
      totalSections += row.sections.length;
      state.resultsEl.appendChild(this.buildCourseCard(state, row));
    }
    this.setStatus(
      state,
      "ok",
      `${rows.length} course${rows.length === 1 ? "" : "s"} · ${totalSections} section${totalSections === 1 ? "" : "s"}`
    );
  }

  // ── Empty-state "Your classes" view ──────────────────────────────────────

  // Renders compact cards for everything in the user's CAESAR cart +
  // current enrollment for the active term, surfaced when the search
  // box is empty so the user lands on a useful overview instead of a
  // hint string. The cards disappear automatically once a query starts
  // matching — `renderResults` re-routes to the search results path.
  private renderMyClassesView(state: MountedState): void {
    const { doc } = state;
    state.resultsEl.innerHTML = "";

    const termCart = readTermCart(state.filters.termId);
    const enrolled = termCart ? Object.values(termCart.enrolled) : [];
    const inCart = termCart ? Object.values(termCart.cart) : [];
    const courses = state.loadedTerms.get(state.filters.termId);
    const totalCourses = courses?.length ?? 0;

    if (enrolled.length === 0 && inCart.length === 0) {
      const hint = doc.createElement("div");
      hint.className = "bc-cs-empty";
      hint.textContent =
        'Start typing — try "comp_sci 111", "econ 21x", or "machine learning". Classes you add will show up here for quick reference.';
      state.resultsEl.appendChild(hint);
      this.setStatus(state, "ok", `Term loaded · ${totalCourses.toLocaleString()} courses available`);
      return;
    }

    if (enrolled.length > 0) {
      state.resultsEl.appendChild(
        this.buildMyClassesSection(state, "Enrolled", enrolled, "enrolled")
      );
    }
    if (inCart.length > 0) {
      state.resultsEl.appendChild(
        this.buildMyClassesSection(state, "In your cart", inCart, "in-cart")
      );
    }

    const total = enrolled.length + inCart.length;
    this.setStatus(
      state,
      "ok",
      `${total} class${total === 1 ? "" : "es"} on file · ${totalCourses.toLocaleString()} courses searchable`
    );
  }

  private buildMyClassesSection(
    state: MountedState,
    label: string,
    entries: CartEntry[],
    status: "in-cart" | "enrolled"
  ): HTMLElement {
    const { doc } = state;
    const wrap = doc.createElement("section");
    wrap.className = "bc-cs-myclasses";

    const heading = doc.createElement("div");
    heading.className = "bc-cs-myclasses-heading";
    const left = doc.createElement("span");
    left.className = "bc-cs-myclasses-label";
    left.textContent = label;
    const count = doc.createElement("span");
    count.className = "bc-cs-myclasses-count";
    count.textContent = `${entries.length}`;
    heading.append(left, count);
    wrap.appendChild(heading);

    const grid = doc.createElement("div");
    grid.className = "bc-cs-myclasses-grid";
    for (const entry of entries) {
      grid.appendChild(this.buildMyClassesCard(state, entry, status));
    }
    wrap.appendChild(grid);
    return wrap;
  }

  private buildMyClassesCard(
    state: MountedState,
    entry: CartEntry,
    status: "in-cart" | "enrolled"
  ): HTMLElement {
    const { doc } = state;
    const card = doc.createElement("div");
    card.className = "bc-cs-myclass-card";
    card.dataset.status = status;

    const header = doc.createElement("div");
    header.className = "bc-cs-myclass-head";
    const id = doc.createElement("span");
    id.className = "bc-cs-myclass-id";
    id.textContent = formatCourseIdForDisplay(entry.subject, entry.catalog);
    const sec = doc.createElement("span");
    sec.className = "bc-cs-myclass-section";
    sec.textContent = entry.sectionLabel;
    header.append(id, sec);

    const meta = doc.createElement("div");
    meta.className = "bc-cs-myclass-meta";
    const badge = doc.createElement("span");
    badge.className = "bc-cs-myclass-badge";
    badge.dataset.status = status;
    badge.textContent = status === "enrolled" ? "Enrolled" : "In cart";
    meta.append(badge);

    // Enrich with paper.nu data when we have it loaded — title at minimum,
    // plus instructor + meeting pattern if the section resolves cleanly.
    const courses = state.loadedTerms.get(state.filters.termId);
    const paper = courses ? findPaperSection(courses, entry) : null;
    if (paper?.course.title) {
      const title = doc.createElement("div");
      title.className = "bc-cs-myclass-title";
      title.textContent = paper.course.title;
      card.append(header, title, meta);
    } else {
      card.append(header, meta);
    }

    if (paper?.section) {
      const detail = doc.createElement("div");
      detail.className = "bc-cs-myclass-detail";
      const lines: string[] = [];
      const patterns = meetingPatternCount(paper.section);
      const meetings: string[] = [];
      for (let i = 0; i < patterns; i += 1) {
        const m = formatMeetingPattern(paper.section, i);
        if (m) meetings.push(m);
      }
      if (meetings.length > 0) lines.push(meetings.join(" · "));
      const instr = formatInstructors(paper.section);
      if (instr) lines.push(instr);
      if (lines.length > 0) {
        detail.textContent = lines.join(" — ");
        card.appendChild(detail);
      }
    }

    return card;
  }

  // ── Course card ──────────────────────────────────────────────────────────

  private buildCourseCard(state: MountedState, row: ResultRow): HTMLElement {
    const { doc } = state;
    const card = doc.createElement("div");
    card.className = "bc-cs-course";

    const head = doc.createElement("div");
    head.className = "bc-cs-course-head";
    const id = doc.createElement("div");
    id.className = "bc-cs-course-id";
    id.textContent = formatCourseIdForDisplay(row.course.subject, row.course.catalog);
    const title = doc.createElement("div");
    title.className = "bc-cs-course-title";
    title.textContent = row.course.title;
    const planEntry = state.catalogIndex.get(`${row.course.subject} ${row.course.catalog}`);
    const units = doc.createElement("div");
    units.className = "bc-cs-course-units";
    if (planEntry?.units) {
      units.textContent = `${planEntry.units} unit${planEntry.units === "1.00" ? "" : "s"}`;
    }
    head.append(id, title, units);

    const tags = doc.createElement("div");
    tags.className = "bc-cs-course-tags";
    if (row.course.school) {
      const t = doc.createElement("span");
      t.className = "bc-cs-tag";
      t.dataset.kind = "school";
      t.textContent = row.course.school;
      tags.appendChild(t);
    }
    if (planEntry?.distros) {
      for (const code of planEntry.distros) {
        const label = PAPER_DISTRO_LABELS[code];
        if (!label) continue;
        const t = doc.createElement("span");
        t.className = "bc-cs-tag";
        t.dataset.kind = "distro";
        t.textContent = `Dist ${code} · ${label}`;
        tags.appendChild(t);
      }
    }
    if (planEntry?.disciplines) {
      for (const code of planEntry.disciplines) {
        const label = PAPER_DISCIPLINE_LABELS[code];
        if (!label) continue;
        const t = doc.createElement("span");
        t.className = "bc-cs-tag";
        t.dataset.kind = "discipline";
        t.textContent = `Disc ${code} · ${label}`;
        tags.appendChild(t);
      }
    }

    // Refresh button — hidden until live data is loaded. Lets the user
    // bypass the 15-min catalog cache when they want fresher seat status.
    const refreshBtn = doc.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "bc-cs-refresh-btn";
    refreshBtn.dataset.role = "refresh-live";
    refreshBtn.title = "Refresh seat status from CAESAR";
    refreshBtn.setAttribute("aria-label", "Refresh seat status from CAESAR");
    refreshBtn.textContent = "↻";
    refreshBtn.style.display = "none";
    refreshBtn.addEventListener("click", () => {
      if (!this.consumePsCredit("refresh-live")) return;
      void this.refreshLiveData(state, row, card, refreshBtn);
    });
    tags.appendChild(refreshBtn);

    card.appendChild(head);
    card.appendChild(tags);

    if (planEntry?.description) {
      const desc = doc.createElement("div");
      desc.className = "bc-cs-course-desc";
      desc.textContent = planEntry.description;
      card.appendChild(desc);
    }

    const sectionList = doc.createElement("ul");
    sectionList.className = "bc-cs-section-list";
    for (const section of row.sections) {
      sectionList.appendChild(this.buildSectionRow(state, row, section));
    }
    card.appendChild(sectionList);

    // Eagerly paint live data on render. Try the in-memory cache first
    // (warmed by an earlier action this session), then fall back to the
    // persistent catalog cache (15-min TTL across sessions). Only on a
    // cold cache do section rows render without status badges, and the
    // first Details/Add click on the course populates them.
    const liveKey = liveCacheKey(state, row);
    const memHit = state.liveCache.get(liveKey);
    if (memHit?.status === "ready" && memHit.result) {
      this.applyLiveDataToCard(state, row, card, memHit.result);
    } else {
      const diskHit = readCatalogCache(
        state.filters.termId,
        row.course.subject,
        bareCatalogNumber(row.course.catalog)
      );
      if (diskHit) {
        state.liveCache.set(liveKey, { status: "ready", result: diskHit.result });
        this.applyLiveDataToCard(state, row, card, diskHit.result);
      }
    }

    return card;
  }

  // ── Section row ──────────────────────────────────────────────────────────

  private buildSectionRow(state: MountedState, row: ResultRow, section: PaperSection): HTMLLIElement {
    const { doc } = state;
    const li = doc.createElement("li");
    li.className = "bc-cs-section";
    li.dataset.sectionNumber = section.section;
    li.dataset.component = section.component;

    const idCell = doc.createElement("div");
    idCell.className = "bc-cs-section-id";
    idCell.textContent = section.section;

    const compCell = doc.createElement("div");
    compCell.className = "bc-cs-section-component";
    compCell.textContent = section.component;

    const timeCell = doc.createElement("div");
    timeCell.className = "bc-cs-section-time";
    const patterns = meetingPatternCount(section);
    for (let i = 0; i < patterns; i += 1) {
      const line = doc.createElement("div");
      line.textContent = formatMeetingPattern(section, i);
      timeCell.appendChild(line);
    }
    if (section.start_date && section.end_date) {
      const range = doc.createElement("div");
      range.className = "bc-cs-mute";
      range.textContent = `${section.start_date} – ${section.end_date}`;
      timeCell.appendChild(range);
    }

    const instructorCell = doc.createElement("div");
    instructorCell.className = "bc-cs-section-instructor";
    instructorCell.textContent = formatInstructors(section);

    const roomCell = doc.createElement("div");
    roomCell.className = "bc-cs-section-room";
    const rooms = new Set<string>();
    for (let i = 0; i < patterns; i += 1) {
      const room = formatRoom(section, i);
      if (room) rooms.add(room);
    }
    roomCell.textContent = rooms.size > 0 ? Array.from(rooms).join(" · ") : "";

    const liveCell = doc.createElement("div");
    liveCell.className = "bc-cs-section-live";
    liveCell.dataset.role = "live";
    liveCell.textContent = "";

    const actions = doc.createElement("div");
    actions.className = "bc-cs-section-actions";

    const detailsBtn = doc.createElement("button");
    detailsBtn.type = "button";
    detailsBtn.className = "bc-cs-details-btn";
    detailsBtn.textContent = "Details";
    detailsBtn.addEventListener("click", () => {
      void this.toggleSectionDetails(state, row, section, li, detailsBtn);
    });

    const addBtn = doc.createElement("button");
    addBtn.type = "button";
    addBtn.className = "bc-cs-add";
    addBtn.textContent = "Add to cart";
    addBtn.addEventListener("click", () => {
      void this.handleAdd(state, row, section, addBtn);
    });

    const sigKey = sectionSignatureKey(state, row, section);
    addBtn.dataset.sigKey = sigKey;
    state.cartButtons.set(sigKey, addBtn);
    this.applyCartStateToButton(state, row, section, addBtn);

    actions.append(detailsBtn, addBtn);

    li.append(idCell, compCell, timeCell, instructorCell, roomCell, liveCell, actions);
    return li;
  }

  // Resolve the cart-cache state for this section and update the button's
  // label / disabled / dataset.state. Class-number-keyed lookup is preferred
  // (we can resolve once we've loaded the live CAESAR data); if not yet
  // known, fall back to the (subject, catalog, sectionLabel) signature.
  private applyCartStateToButton(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): void {
    if (button.dataset.state === "loading") return; // mid-flight, leave alone

    const hit = this.lookupCacheForSection(state, row, section);
    if (!hit) {
      // Cache miss — restore idle if we previously painted a cached state.
      if (button.dataset.state === "in-cart" || button.dataset.state === "enrolled") {
        button.dataset.state = "";
        button.disabled = false;
        button.textContent = "Add to cart";
        button.title = "";
      }
      return;
    }
    if (hit.status === "enrolled") {
      button.dataset.state = "enrolled";
      button.disabled = true;
      button.textContent = "Enrolled";
      button.title = "You're enrolled in this class.";
    } else {
      button.dataset.state = "in-cart";
      button.disabled = true;
      button.textContent = "In cart";
      button.title = "This class is in your shopping cart.";
    }
  }

  private lookupCacheForSection(
    state: MountedState,
    row: ResultRow,
    section: PaperSection
  ): CartLookupHit | null {
    // Prefer the resolved CAESAR class number (live data), since it's the
    // canonical key the cache uses. If we haven't loaded live data yet,
    // fall back to a paper.nu-derived signature.
    const live = state.liveCache.get(liveCacheKey(state, row));
    if (live?.status === "ready" && live.result) {
      const group = matchCaesarGroup(live.result.groups, row.course.catalog);
      const caesarSection = group
        ? matchCaesarSection(group, section.section, section.component)
        : null;
      if (caesarSection) {
        return lookupClassNumber(state.filters.termId, caesarSection.classNumber);
      }
    }
    return lookupBySignature(
      state.filters.termId,
      row.course.subject,
      row.course.catalog,
      `${section.section}-${section.component}`
    );
  }

  private repaintAllCartButtons(state: MountedState): void {
    // Detached buttons (lists re-rendered between mount and now) get GC'd
    // here so the registry doesn't leak. We can't reliably recover the
    // ResultRow/PaperSection for a detached button anyway.
    for (const [key, button] of state.cartButtons) {
      if (!button.isConnected) {
        state.cartButtons.delete(key);
        continue;
      }
      // The button caches no row/section refs, but the cache lookup only
      // needs them to resolve via live data. Signature-based lookup works
      // off the dataset.sigKey alone.
      this.applyCartStateBySigKey(state, button);
    }
  }

  private applyCartStateBySigKey(state: MountedState, button: HTMLButtonElement): void {
    if (button.dataset.state === "loading") return;
    const sigKey = button.dataset.sigKey ?? "";
    const parsed = parseSignatureKey(sigKey);
    if (!parsed) return;

    const hit = lookupBySignature(
      parsed.termId,
      parsed.subject,
      parsed.catalog,
      parsed.sectionLabel
    );
    if (!hit) {
      if (button.dataset.state === "in-cart" || button.dataset.state === "enrolled") {
        button.dataset.state = "";
        button.disabled = false;
        button.textContent = "Add to cart";
        button.title = "";
      }
      return;
    }
    if (hit.status === "enrolled") {
      button.dataset.state = "enrolled";
      button.disabled = true;
      button.textContent = "Enrolled";
      button.title = "You're enrolled in this class.";
    } else {
      button.dataset.state = "in-cart";
      button.disabled = true;
      button.textContent = "In cart";
      button.title = "This class is in your shopping cart.";
    }
  }

  // ── Live CAESAR data: per-course search ──────────────────────────────────

  // Returns the catalog search groups for this course, going through
  // in-memory → persistent disk cache → CAESAR fetch. The PS credit is
  // consumed by the parent action (Details / Add to cart / refresh), not
  // here. Paints live cells on the card whenever a result becomes
  // available. `force` skips both caches for an explicit user refresh.
  private async ensureLiveData(
    state: MountedState,
    row: ResultRow,
    card: HTMLElement | null,
    options: { force?: boolean } = {}
  ): Promise<CaesarSearchResult | null> {
    const key = liveCacheKey(state, row);

    if (!options.force) {
      const memHit = state.liveCache.get(key);
      if (memHit?.status === "ready" && memHit.result) return memHit.result;

      const diskHit = readCatalogCache(
        state.filters.termId,
        row.course.subject,
        bareCatalogNumber(row.course.catalog)
      );
      if (diskHit) {
        state.liveCache.set(key, { status: "ready", result: diskHit.result });
        if (card) this.applyLiveDataToCard(state, row, card, diskHit.result);
        return diskHit.result;
      }
    }

    state.liveCache.set(key, { status: "loading" });
    try {
      const result = await withCaesarAuthRecovery(() =>
        searchCaesarCatalog({
          termId: state.filters.termId,
          institution: state.institution,
          subject: row.course.subject,
          bareCatalog: bareCatalogNumber(row.course.catalog)
        })
      );
      if (!result) {
        state.liveCache.delete(key);
        return null;
      }
      state.liveCache.set(key, { status: "ready", result });
      writeCatalogCache(
        state.filters.termId,
        row.course.subject,
        bareCatalogNumber(row.course.catalog),
        result
      );
      if (card) this.applyLiveDataToCard(state, row, card, result);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      state.liveCache.set(key, { status: "error", error: msg });
      showToast(`Couldn't load CAESAR data: ${msg}`, { tone: "error", durationMs: 5000 });
      return null;
    }
  }

  // Force-refresh the per-course catalog data, bypassing both caches, and
  // also invalidate any per-section seat caches the user has expanded so
  // the detail panel re-fetches with the same click.
  private async refreshLiveData(
    state: MountedState,
    row: ResultRow,
    card: HTMLElement,
    button: HTMLButtonElement
  ): Promise<void> {
    button.disabled = true;
    button.dataset.state = "loading";
    button.classList.add("is-spinning");

    const result = await this.ensureLiveData(state, row, card, { force: true });

    button.disabled = false;
    button.classList.remove("is-spinning");
    button.dataset.state = result ? "ready" : "error";

    if (!result) return;

    // Refresh any open detail panels in this card so seat counts also
    // update — the per-section seats-notes cache is keyed on classNumber
    // and outlives the catalog cache, so we explicitly invalidate the
    // sections we know about and re-render their open panels.
    const matchingGroup = matchCaesarGroup(result.groups, row.course.catalog);
    if (!matchingGroup) return;
    const detailRows = card.querySelectorAll<HTMLLIElement>("li.bc-cs-detail-row");
    for (const detailRow of Array.from(detailRows)) {
      const sectionLi = detailRow.previousElementSibling;
      if (!(sectionLi instanceof HTMLLIElement)) continue;
      const sectionNumber = sectionLi.dataset.sectionNumber ?? "";
      const component = sectionLi.dataset.component ?? "";
      const caesar = matchCaesarSection(matchingGroup, sectionNumber, component);
      if (!caesar) continue;
      const bareCatalog = bareCatalogNumber(row.course.catalog);
      void this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
    }
    showToast("Refreshed seat status from CAESAR.", { tone: "success", durationMs: 3000 });
  }

  private applyLiveDataToCard(
    state: MountedState,
    row: ResultRow,
    card: HTMLElement,
    result: CaesarSearchResult
  ): void {
    // Live data exists for this course → reveal the refresh affordance
    // (kept hidden until first paint so cold cards aren't cluttered).
    const refreshBtn = card.querySelector<HTMLButtonElement>(".bc-cs-refresh-btn");
    if (refreshBtn) refreshBtn.style.display = "";
    const matchingGroup = matchCaesarGroup(result.groups, row.course.catalog);
    const sectionLis = card.querySelectorAll<HTMLLIElement>("li.bc-cs-section");

    sectionLis.forEach((li) => {
      const live = li.querySelector<HTMLElement>("[data-role='live']");
      if (!live) return;
      const number = li.dataset.sectionNumber ?? "";
      const component = li.dataset.component ?? "";
      const caesar = matchingGroup ? matchCaesarSection(matchingGroup, number, component) : null;

      live.innerHTML = "";
      if (!caesar) {
        live.textContent = matchingGroup ? "(no CAESAR row)" : "(course not on CAESAR)";
        live.dataset.tone = "muted";
        return;
      }

      const status = state.doc.createElement("span");
      status.className = "bc-cs-status-pill";
      status.dataset.status = caesar.status;
      status.textContent = caesar.status;
      live.appendChild(status);

      // Live data resolved this section's class number — re-evaluate the
      // cart-cache state with the canonical key so the badge reflects any
      // hits that signature-only matching missed. The class number itself
      // is internal-only and never surfaced to the user.
      const addBtn = li.querySelector<HTMLButtonElement>(".bc-cs-add");
      if (addBtn) this.applyCartStateBySigKey(state, addBtn);
    });
  }

  // ── Per-section detail (seats / notes / requirements) ────────────────────

  private async toggleSectionDetails(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): Promise<void> {
    const { doc } = state;
    let detailRow = li.nextElementSibling instanceof HTMLLIElement && li.nextElementSibling.classList.contains("bc-cs-detail-row")
      ? (li.nextElementSibling as HTMLLIElement)
      : null;

    if (detailRow) {
      detailRow.remove();
      button.dataset.expanded = "false";
      button.textContent = "Details";
      return;
    }

    // Expansion is the entry point for one or more PS chains (live load +
    // detail lookup). One credit covers the whole click; the helpers below
    // run ungated.
    if (!this.consumePsCredit("details")) return;

    // Resolve the catalog search via cache (memory → disk → fetch).
    const card = li.closest<HTMLElement>(".bc-cs-course");
    const liveResult = await this.ensureLiveData(state, row, card);
    if (!liveResult) {
      showToast("Could not load CAESAR data for this course.", { tone: "error" });
      return;
    }

    const matchingGroup = matchCaesarGroup(liveResult.groups, row.course.catalog);
    const caesar = matchingGroup
      ? matchCaesarSection(matchingGroup, section.section, section.component)
      : null;
    if (!caesar) {
      showToast("No matching CAESAR section found.", { tone: "error" });
      return;
    }

    detailRow = doc.createElement("li");
    detailRow.className = "bc-cs-detail-row";
    li.parentElement?.insertBefore(detailRow, li.nextSibling);

    const bareCatalog = bareCatalogNumber(row.course.catalog);
    const cachedDisk = readSeatsNotesCache(caesar.classNumber);
    if (cachedDisk?.result) {
      this.renderDetailRow(state, detailRow, caesar, cachedDisk.result, cachedDisk.fetchedAt, () => {
        if (!this.consumePsCredit("refresh-detail")) return;
        void this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
      });
    } else {
      await this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
    }

    button.dataset.expanded = "true";
    button.textContent = "Hide";
  }

  private async fetchAndRenderDetail(
    state: MountedState,
    detailRow: HTMLLIElement,
    caesar: CaesarSection,
    bareCatalog: string
  ): Promise<void> {
    if (!detailRow.isConnected) return;
    this.renderDetailLoading(state, detailRow);
    try {
      // Hint TGS first for 4xx so lookupClass's career fallback list
      // doesn't waste a request trying UGRD on grad-only classes.
      const careerHint = isGradCatalog(bareCatalog) ? "TGS" : "UGRD";
      const lookupResponse = await lookupClass(
        {
          type: "lookup-class",
          classNumber: caesar.classNumber,
          careerHint
        },
        { priority: "background", owner: "class-search-detail" }
      );
      const result = toSeatsNotesResult(lookupResponse);
      const fetchedAt = Date.now();
      writeSeatsNotesCache(caesar.classNumber, { result, fetchedAt });
      if (detailRow.isConnected) {
        this.renderDetailRow(state, detailRow, caesar, result, fetchedAt, () => {
          if (!this.consumePsCredit("refresh-detail")) return;
          void this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
        });
      }
      const warning = formatPsCreditsWarning(fetchedAt);
      if (warning) {
        const verb = result.ok ? "Loaded" : "Tried";
        showToast(`${verb} section detail. ${warning}.`, { tone: "warn", durationMs: 5000 });
      }
    } catch (error) {
      if (isRetryablePeopleSoftTaskError(error)) return;
      const failure = seatsNotesFailure(error);
      if (detailRow.isConnected) {
        this.renderDetailRow(state, detailRow, caesar, failure, Date.now(), () => {
          if (!this.consumePsCredit("refresh-detail")) return;
          void this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
        });
      }
    }
  }

  private renderDetailLoading(state: MountedState, detailRow: HTMLLIElement): void {
    const { doc } = state;
    detailRow.innerHTML = "";
    const wrap = doc.createElement("div");
    wrap.className = "bc-cs-detail";
    const spinner = doc.createElement("span");
    spinner.className = "bc-cs-spinner";
    const text = doc.createElement("span");
    text.textContent = "Fetching seats and notes from CAESAR…";
    text.style.color = "var(--bc-text-muted)";
    wrap.append(spinner, text);
    detailRow.appendChild(wrap);
  }

  private renderDetailRow(
    state: MountedState,
    detailRow: HTMLLIElement,
    caesar: CaesarSection,
    result: SeatsNotesResult,
    fetchedAt: number,
    onRefresh: () => void
  ): void {
    const { doc } = state;
    detailRow.innerHTML = "";
    const wrap = doc.createElement("div");
    wrap.className = "bc-cs-detail";

    const header = doc.createElement("div");
    header.className = "bc-cs-detail-header";
    const headerBits: string[] = [];
    if (caesar.sectionLabel) headerBits.push(`<strong>${escapeHtml(caesar.sectionLabel)}</strong>`);
    if (caesar.daysTime) headerBits.push(escapeHtml(caesar.daysTime));
    if (caesar.room) headerBits.push(escapeHtml(caesar.room));
    header.innerHTML = headerBits.join(" · ");
    wrap.appendChild(header);

    if (!result.ok) {
      const err = doc.createElement("div");
      err.className = "bc-cs-detail-error";
      err.textContent = result.error ?? "Couldn't load CAESAR detail.";
      wrap.appendChild(err);
      wrap.appendChild(buildDetailFooter(doc, fetchedAt, onRefresh));
      detailRow.appendChild(wrap);
      return;
    }

    const stats = doc.createElement("div");
    stats.className = "bc-cs-detail-stats";
    appendStat(doc, stats, "Capacity", result.classCapacity);
    appendStat(doc, stats, "Enrolled", result.enrollmentTotal);
    appendStat(doc, stats, "Open seats", result.availableSeats);
    appendStat(doc, stats, "Wait cap", result.waitListCapacity);
    appendStat(doc, stats, "Wait total", result.waitListTotal);
    if (stats.children.length > 0) wrap.appendChild(stats);

    appendDetailBlock(doc, wrap, "Class Attributes", result.classAttributes);
    appendDetailBlock(doc, wrap, "Enrollment Requirements", result.enrollmentRequirements);
    appendDetailBlock(doc, wrap, "Class Notes", result.classNotes);

    if (result.classCapacity === null && hasNoEnrichedFields(result)) {
      const note = doc.createElement("div");
      note.className = "bc-cs-detail-note";
      note.textContent = "CAESAR did not return a detail panel for this section. Status from search-results page is shown above.";
      wrap.appendChild(note);
    }

    wrap.appendChild(buildDetailFooter(doc, fetchedAt, onRefresh));
    detailRow.appendChild(wrap);
  }

  // ── Add to cart ──────────────────────────────────────────────────────────

  private async handleAdd(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): Promise<void> {
    if (button.dataset.state === "success") return;
    // One credit covers the whole click — including any internal live-data
    // load needed before the cart-add chain can resolve the class number.
    if (!this.consumePsCredit("add")) return;
    button.disabled = true;
    button.dataset.state = "loading";
    button.textContent = "Loading…";

    // We need the 5-digit CAESAR class number for the cart-add chain.
    // Resolve via cache (memory → disk → fetch).
    const card = button.closest<HTMLElement>(".bc-cs-course");
    const liveResult = await this.ensureLiveData(state, row, card);
    let classNumber: string | null = null;
    if (liveResult) {
      const group = matchCaesarGroup(liveResult.groups, row.course.catalog);
      if (group) {
        classNumber =
          matchCaesarSection(group, section.section, section.component)?.classNumber ?? null;
      }
    }

    if (!classNumber) {
      button.dataset.state = "error";
      button.textContent = "Add to cart";
      button.disabled = false;
      showToast("Couldn't resolve the CAESAR class number for this section.", {
        tone: "error"
      });
      return;
    }

    button.textContent = "Adding…";

    const result = await withCaesarAuthRecovery(() =>
      addSectionToCart({
        classNumber,
        termId: state.filters.termId,
        institution: state.institution,
        bareCatalog: bareCatalogNumber(row.course.catalog)
      })
    );

    if (!result) {
      // Auth recovery toast already explained why; just reset the button so
      // the user can re-trigger once they've completed sign-in.
      button.dataset.state = "idle";
      button.textContent = "Add to cart";
      button.disabled = false;
      return;
    }

    // Side effect: fold the class-number search response into the live
    // cache so the row's status badge paints without a Load CAESAR call.
    const searchGroups = "searchGroups" in result ? result.searchGroups : undefined;
    if (searchGroups && searchGroups.length > 0) {
      mergeLiveCache(state, row, searchGroups);
      const card = button.closest<HTMLElement>(".bc-cs-course");
      const merged = state.liveCache.get(liveCacheKey(state, row));
      if (card && merged?.status === "ready" && merged.result) {
        this.applyLiveDataToCard(state, row, card, merged.result);
      }
    }

    if (result.ok) {
      button.dataset.state = "in-cart";
      button.textContent = "In cart";
      button.disabled = true;
      recordOptimisticAdd(state.filters.termId, {
        classNumber: result.classNumber,
        subject: row.course.subject,
        catalog: row.course.catalog,
        sectionLabel: `${section.section}-${section.component}`,
        capturedAt: Date.now()
      });
      const warning = formatPsCreditsWarning();
      const suffix = warning ? ` ${warning}.` : "";
      showToast(
        `Added ${formatCourseIdForDisplay(row.course.subject, row.course.catalog)} ${section.section}-${section.component} to your shopping cart.${suffix}`,
        {
          tone: "success",
          durationMs: 6000,
          action: {
            label: "View cart",
            run: () => {
              window.location.assign(CART_URL);
            }
          }
        }
      );
    } else if ("needsRelatedSection" in result) {
      // CAESAR is asking the user to pick a discussion/lab/recitation
      // before the cart-add can finalize. Drop a picker UI under the row
      // and pause the button until they choose.
      button.dataset.state = "needs-related";
      button.textContent = "Pick section…";
      button.disabled = true;
      this.openRelatedPicker(state, row, section, button, result);
    } else if (result.alreadyInCart) {
      // Friendlier UX: show the button as already-handled and surface a
      // pointer to the cart instead of a generic error.
      button.dataset.state = "in-cart";
      button.textContent = "In cart";
      button.disabled = true;
      if (result.classNumber) {
        recordOptimisticAdd(state.filters.termId, {
          classNumber: result.classNumber,
          subject: row.course.subject,
          catalog: row.course.catalog,
          sectionLabel: `${section.section}-${section.component}`,
          capturedAt: Date.now()
        });
      }
      const warning = formatPsCreditsWarning();
      const suffix = warning ? ` ${warning}.` : "";
      showToast(
        `${formatCourseIdForDisplay(row.course.subject, row.course.catalog)} ${section.section}-${section.component} is already in your shopping cart.${suffix}`,
        {
          tone: "info",
          durationMs: 5000,
          action: {
            label: "View cart",
            run: () => {
              window.location.assign(CART_URL);
            }
          }
        }
      );
    } else {
      button.dataset.state = "error";
      button.textContent = "Try again";
      button.disabled = false;
      const needsClassicFallback = /extra confirmation|preferences|related component/i.test(
        result.error ?? ""
      );
      showToast(result.error ?? "Couldn't add to cart.", {
        tone: "error",
        durationMs: 6000,
        action: needsClassicFallback
          ? {
              label: "Open Classic",
              run: () => {
                state.activeTab = "classic";
                writeActiveTab("classic");
                applyTabVisibility(state);
              }
            }
          : undefined
      });
    }
  }

  // ── Related-component picker (lab/discussion required) ──────────────────

  private openRelatedPicker(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement,
    pending: {
      classNumber: string;
      sectionLabel: string;
      courseTitle: string;
      relatedOptions: RelatedSectionOption[];
      continuationFormState: string;
      searchGroups: CaesarCourseGroup[];
    }
  ): void {
    const { doc } = state;
    const li = button.closest<HTMLLIElement>("li.bc-cs-section");
    if (!li) return;

    // Replace any earlier picker for this section so re-clicking Add doesn't
    // stack pickers.
    const next = li.nextElementSibling;
    if (next instanceof HTMLLIElement && next.classList.contains("bc-cs-related-row")) {
      next.remove();
    }

    const pickerLi = doc.createElement("li");
    pickerLi.className = "bc-cs-related-row";
    li.parentElement?.insertBefore(pickerLi, li.nextSibling);

    const wrap = doc.createElement("div");
    wrap.className = "bc-cs-related";

    const header = doc.createElement("div");
    header.className = "bc-cs-related-header";
    const title = doc.createElement("div");
    title.className = "bc-cs-related-title";
    title.textContent = `${formatCourseIdForDisplay(row.course.subject, row.course.catalog)} needs a related section`;
    const sub = doc.createElement("div");
    sub.className = "bc-cs-related-sub";
    sub.textContent = "Pick one to finish adding to your cart.";
    header.append(title, sub);

    const cancel = doc.createElement("button");
    cancel.type = "button";
    cancel.className = "bc-cs-related-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      pickerLi.remove();
      button.dataset.state = "";
      button.textContent = "Add to cart";
      button.disabled = false;
    });
    header.appendChild(cancel);
    wrap.appendChild(header);

    const list = doc.createElement("div");
    list.className = "bc-cs-related-list";
    for (const option of pending.relatedOptions) {
      list.appendChild(this.buildRelatedOptionRow(state, row, section, button, pickerLi, pending, option));
    }
    wrap.appendChild(list);

    pickerLi.appendChild(wrap);
  }

  private buildRelatedOptionRow(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement,
    pickerLi: HTMLLIElement,
    pending: {
      classNumber: string;
      sectionLabel: string;
      courseTitle: string;
      relatedOptions: RelatedSectionOption[];
      continuationFormState: string;
      searchGroups: CaesarCourseGroup[];
    },
    option: RelatedSectionOption
  ): HTMLElement {
    const { doc } = state;
    const item = doc.createElement("button");
    item.type = "button";
    item.className = "bc-cs-related-option";
    item.dataset.status = option.status;
    // Stash row-index for the click-handler lookup so we don't need a
    // user-visible class number in the option DOM to identify it.
    item.dataset.rowIndex = String(option.rowIndex);

    const left = doc.createElement("div");
    left.className = "bc-cs-related-option-left";
    const sec = doc.createElement("div");
    sec.className = "bc-cs-related-option-section";
    sec.textContent = option.section || "—";
    left.append(sec);

    const mid = doc.createElement("div");
    mid.className = "bc-cs-related-option-mid";
    const sched = doc.createElement("div");
    sched.textContent = option.schedule || "—";
    const room = doc.createElement("div");
    room.className = "bc-cs-mute";
    room.textContent = option.room || "";
    mid.append(sched, room);

    const right = doc.createElement("div");
    right.className = "bc-cs-related-option-right";
    const instr = doc.createElement("div");
    instr.className = "bc-cs-related-option-instr";
    instr.textContent = option.instructor || "—";
    const status = doc.createElement("span");
    status.className = "bc-cs-status-pill";
    status.dataset.status = option.status;
    status.textContent = option.status;
    right.append(instr, status);

    item.append(left, mid, right);
    item.addEventListener("click", () => {
      void this.handleRelatedPick(state, row, section, button, pickerLi, pending, option);
    });
    return item;
  }

  private async handleRelatedPick(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement,
    pickerLi: HTMLLIElement,
    pending: {
      classNumber: string;
      sectionLabel: string;
      courseTitle: string;
      relatedOptions: RelatedSectionOption[];
      continuationFormState: string;
      searchGroups: CaesarCourseGroup[];
    },
    option: RelatedSectionOption
  ): Promise<void> {
    if (!this.consumePsCredit("related-pick")) return;
    // Disable all option buttons while we run the continuation so the user
    // can't double-fire.
    const buttons = pickerLi.querySelectorAll<HTMLButtonElement>(".bc-cs-related-option");
    buttons.forEach((b) => {
      b.disabled = true;
      if (b.dataset.picked !== "true") b.style.opacity = "0.5";
    });
    const clicked = Array.from(buttons).find(
      (b) => b.dataset.rowIndex === String(option.rowIndex)
    );
    if (clicked) {
      clicked.dataset.picked = "true";
      clicked.style.opacity = "1";
      const stamp = state.doc.createElement("span");
      stamp.className = "bc-cs-related-option-progress";
      stamp.textContent = "Adding…";
      clicked.appendChild(stamp);
    }
    button.textContent = "Adding…";

    const result = await continueCartAddWithRelated({
      continuationFormState: pending.continuationFormState,
      selectedRowIndex: option.rowIndex,
      classNumber: pending.classNumber,
      sectionLabel: pending.sectionLabel,
      courseTitle: pending.courseTitle,
      searchGroups: pending.searchGroups
    });

    pickerLi.remove();

    if (result.ok) {
      button.dataset.state = "success";
      button.textContent = "Added ✓";
      button.disabled = true;
      const warning = formatPsCreditsWarning();
      const suffix = warning ? ` ${warning}.` : "";
      showToast(
        `Added ${formatCourseIdForDisplay(row.course.subject, row.course.catalog)} ${section.section}-${section.component} with section ${option.section} to your shopping cart.${suffix}`,
        {
          tone: "success",
          durationMs: 6000,
          action: {
            label: "View cart",
            run: () => {
              window.location.assign(CART_URL);
            }
          }
        }
      );
    } else if ("needsRelatedSection" in result) {
      // CAESAR served another picker after the first pick — rare, but
      // recurse so the user can finish.
      button.dataset.state = "needs-related";
      button.textContent = "Pick section…";
      button.disabled = true;
      this.openRelatedPicker(state, row, section, button, result);
    } else {
      button.dataset.state = "error";
      button.textContent = "Try again";
      button.disabled = false;
      showToast(result.error ?? "Couldn't add to cart.", {
        tone: "error",
        durationMs: 6000
      });
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  private setStatus(state: MountedState, kind: "loading" | "ok" | "error", message: string): void {
    const { statusEl, doc } = state;
    statusEl.innerHTML = "";
    statusEl.dataset.state = kind;
    if (kind === "loading") {
      const spinner = doc.createElement("span");
      spinner.className = "bc-cs-spinner";
      statusEl.appendChild(spinner);
    }
    const text = doc.createElement("span");
    text.textContent = message;
    statusEl.appendChild(text);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Module helpers (no `this` access)

function liveCacheKey(state: MountedState, row: ResultRow): string {
  return `${state.filters.termId}|${row.course.subject}|${bareCatalogNumber(row.course.catalog)}`;
}

// 4xx classes live under TGS even when undergrads can take them; this
// matches the heuristic in caesar-search.ts and ctec-links/subject-careers.
function isGradCatalog(bareCatalog: string): boolean {
  const num = parseInt(bareCatalog, 10);
  return Number.isFinite(num) && num >= 400;
}

// Look up the paper.nu course + section that a cart entry points to so
// the "Your classes" cards can render title + instructor + meetings.
// Tolerates paper.nu's catalog ("111") vs CAESAR's ("111-0") drift the
// same way `matchCaesarGroup` does.
function findPaperSection(
  courses: PaperTermCourse[],
  entry: CartEntry
): { course: PaperTermCourse; section: PaperSection } | null {
  const wantSubject = entry.subject;
  const wantCatalog = entry.catalog.toLowerCase();
  const wantStripped = wantCatalog.replace(/-0$/, "");
  const [wantSecNum, wantComp] = entry.sectionLabel.split("-");
  const normSec = (wantSecNum ?? "").replace(/^0+/, "") || "0";
  const normComp = (wantComp ?? "").toUpperCase();

  for (const course of courses) {
    if (course.subject !== wantSubject) continue;
    const have = course.catalog.toLowerCase();
    if (
      have !== wantCatalog &&
      have !== wantStripped &&
      have.replace(/-0$/, "") !== wantStripped
    ) {
      continue;
    }
    for (const section of course.sections) {
      const sNum = (section.section ?? "").replace(/^0+/, "") || "0";
      if (sNum !== normSec) continue;
      if ((section.component ?? "").toUpperCase() !== normComp) continue;
      return { course, section };
    }
  }
  return null;
}

// Cart-button registry key. Encodes everything we need to reverse-look up
// the section in the cart cache without holding a live reference to the
// ResultRow / PaperSection (those get GC'd as the user scrolls).
function sectionSignatureKey(
  state: MountedState,
  row: ResultRow,
  section: PaperSection
): string {
  return [
    state.filters.termId,
    row.course.subject,
    row.course.catalog,
    `${section.section}-${section.component}`
  ].join("\x1f");
}

function parseSignatureKey(
  key: string
): { termId: string; subject: string; catalog: string; sectionLabel: string } | null {
  const parts = key.split("\x1f");
  if (parts.length !== 4) return null;
  return {
    termId: parts[0]!,
    subject: parts[1]!,
    catalog: parts[2]!,
    sectionLabel: parts[3]!
  };
}

// Merge a partial search response (e.g. a single-row class-number search)
// into the live cache. Replaces matching sections by classNumber so a
// wider subject search's data isn't clobbered.
function mergeLiveCache(
  state: MountedState,
  row: ResultRow,
  incomingGroups: CaesarCourseGroup[]
): void {
  const key = liveCacheKey(state, row);
  const incomingMatch = matchCaesarGroup(incomingGroups, row.course.catalog);
  if (!incomingMatch) return;

  const existing = state.liveCache.get(key);
  if (!existing || existing.status !== "ready" || !existing.result) {
    state.liveCache.set(key, {
      status: "ready",
      result: { groups: incomingGroups }
    });
    return;
  }

  const existingGroups = existing.result.groups;
  const existingMatch = matchCaesarGroup(existingGroups, row.course.catalog);
  if (!existingMatch) {
    state.liveCache.set(key, {
      status: "ready",
      result: { groups: [...existingGroups, ...incomingGroups] }
    });
    return;
  }

  // Merge section-by-section, keyed on classNumber (every CAESAR section
  // has a unique 5-digit number within a term).
  const mergedSections = [...existingMatch.sections];
  for (const incomingSection of incomingMatch.sections) {
    const idx = mergedSections.findIndex(
      (s) => s.classNumber === incomingSection.classNumber
    );
    if (idx >= 0) mergedSections[idx] = incomingSection;
    else mergedSections.push(incomingSection);
  }

  const mergedGroup: CaesarCourseGroup = { ...existingMatch, sections: mergedSections };
  const mergedGroups = existingGroups.map((g) => (g === existingMatch ? mergedGroup : g));
  state.liveCache.set(key, { status: "ready", result: { groups: mergedGroups } });
}

function buildDetailFooter(
  doc: Document,
  fetchedAt: number,
  onRefresh: () => void
): HTMLElement {
  const footer = doc.createElement("div");
  footer.className = "bc-cs-detail-footer";

  const stamp = doc.createElement("span");
  stamp.className = "bc-cs-detail-stamp";
  stamp.textContent = `Loaded ${formatRelativeTime(fetchedAt)}`;
  stamp.title = new Date(fetchedAt).toLocaleString();
  footer.appendChild(stamp);

  const refresh = doc.createElement("button");
  refresh.type = "button";
  refresh.className = "bc-cs-detail-refresh";
  refresh.textContent = "Refresh";
  refresh.addEventListener("click", () => {
    refresh.disabled = true;
    refresh.textContent = "Refreshing…";
    void Promise.resolve(onRefresh());
  });
  footer.appendChild(refresh);

  return footer;
}

function formatRelativeTime(timestamp: number): string {
  const deltaSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (deltaSec < 5) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.round(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  const deltaDay = Math.round(deltaHr / 24);
  return `${deltaDay}d ago`;
}

function appendStat(
  doc: Document,
  parent: HTMLElement,
  label: string,
  value: string | null
): void {
  if (!value) return;
  const cell = doc.createElement("div");
  cell.className = "bc-cs-stat";
  const v = doc.createElement("div");
  v.className = "bc-cs-stat-value";
  v.textContent = value;
  const l = doc.createElement("div");
  l.className = "bc-cs-stat-label";
  l.textContent = label;
  cell.append(v, l);
  parent.appendChild(cell);
}

function appendDetailBlock(
  doc: Document,
  parent: HTMLElement,
  label: string,
  text: string | null
): void {
  if (!text) return;
  const block = doc.createElement("div");
  block.className = "bc-cs-detail-block";
  const heading = doc.createElement("div");
  heading.className = "bc-cs-detail-block-label";
  heading.textContent = label;
  const body = doc.createElement("div");
  body.className = "bc-cs-detail-block-body";
  body.textContent = text;
  block.append(heading, body);
  parent.appendChild(block);
}

function hasNoEnrichedFields(result: SeatsNotesSuccess): boolean {
  return (
    result.classCapacity === null &&
    result.enrollmentTotal === null &&
    result.availableSeats === null &&
    result.classAttributes === null &&
    result.enrollmentRequirements === null &&
    result.classNotes === null
  );
}

function isSearchEntryPage(doc: Document): boolean {
  const pageInfo = doc.getElementById("pt_pageinfo_win0");
  if (!pageInfo) return false;
  return (
    pageInfo.getAttribute("Component") === SEARCH_COMPONENT &&
    pageInfo.getAttribute("Page") === SEARCH_PAGE_ID
  );
}

function ensureRoot(doc: Document): HTMLDivElement {
  const existing = doc.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (existing) return existing;
  const root = doc.createElement("div");
  root.id = ROOT_ID;
  // .bc-cs-root carries every CSS custom property; nothing renders without it.
  root.className = "bc-cs-root";
  const anchor =
    doc.getElementById("win0divPAGECONTAINER") ??
    doc.querySelector(".PSPAGECONTAINER")?.closest("td") ??
    doc.body;
  const parent = anchor.parentElement ?? doc.body;
  parent.insertBefore(root, anchor);
  return root;
}

function applyTabVisibility(state: MountedState): void {
  if (state.appliedTab === state.activeTab) return;
  state.appliedTab = state.activeTab;
  if (state.activeTab === "better") {
    ensureNativeHider(state.doc);
    state.panelEl.style.display = "";
  } else {
    removeNativeHider(state.doc);
    state.panelEl.style.display = "none";
  }
}

function ensureNativeHider(doc: Document): void {
  if (doc.getElementById(HIDE_NATIVE_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = HIDE_NATIVE_STYLE_ID;
  style.textContent = `
    #win0divPAGECONTAINER { display: none !important; }
    #win0divPAGEBAR, #win0divPSPANELTABS { display: none !important; }
  `;
  (doc.head ?? doc.documentElement).appendChild(style);
}

function removeNativeHider(doc: Document): void {
  doc.getElementById(HIDE_NATIVE_STYLE_ID)?.remove();
}

function readActiveTab(): TabId {
  try {
    const raw = window.sessionStorage.getItem(TAB_STORAGE_KEY);
    if (raw === "classic") return "classic";
    return "better";
  } catch {
    return "better";
  }
}

function writeActiveTab(tab: TabId): void {
  try {
    window.sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch (err) {
    logQuiet("class-search.writeActiveTab", err);
  }
}

function readCareerFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "SSR_CLSRCH_WRK_ACAD_CAREER");
  if (select?.value) return select.value;
  const url = new URL(window.location.href);
  return url.searchParams.get("ACAD_CAREER");
}

function readInstitutionFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "CLASS_SRCH_WRK2_INSTITUTION");
  return select?.value ?? null;
}

function readTermFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "CLASS_SRCH_WRK2_STRM");
  return select?.value || null;
}

function findSelectByPrefix(doc: Document, prefix: string): HTMLSelectElement | null {
  const selects = doc.querySelectorAll<HTMLSelectElement>("select");
  for (const select of Array.from(selects)) {
    if (select.name?.startsWith(prefix)) return select;
  }
  return null;
}

function renderFatalError(root: HTMLElement, doc: Document, message: string): void {
  root.innerHTML = "";
  const wrap = doc.createElement("div");
  wrap.className = "bc-cs-root";
  const card = doc.createElement("div");
  card.className = "bc-cs-card";
  card.style.borderColor = "var(--bc-color-danger-border)";
  card.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;font-size:var(--bc-font-13);color:var(--bc-color-danger);">
      <strong>Couldn't load paper.nu catalog data.</strong>
      <span style="color:var(--bc-color-text-muted);">${escapeHtml(message)}</span>
      <span style="color:var(--bc-color-text-muted);font-size:var(--bc-font-12);">Reload the page to try again, or switch to Classic CAESAR using the tab above.</span>
    </div>
  `;
  wrap.appendChild(card);
  root.appendChild(wrap);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLoadingShell(doc: Document): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "bc-cs-root";
  const card = doc.createElement("div");
  card.className = "bc-cs-card";
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:var(--bc-color-text-muted);font-size:var(--bc-font-13);">
      <span class="bc-cs-spinner"></span>
      <span>Loading paper.nu catalog data…</span>
    </div>
  `;
  wrap.appendChild(card);
  return wrap;
}

function hasAnyFilter(filters: SearchFilters): boolean {
  return filters.query.trim().length > 0;
}

// Drives the SSO popup flow when CAESAR's PS session is dead and the silent
// re-handshake in `getEntryFormState()` couldn't recover it. Shows a toast,
// asks the background worker to open the login URL in a new tab, waits for
// the post-auth navigation pattern to fire, then re-runs `retry`. Returns
// `null` if the popup couldn't open or the user closed it without signing in.
let pendingAuthRecovery: Promise<unknown> | null = null;

async function recoverCaesarAuthAndRetry<T>(
  loginUrl: string,
  retry: () => Promise<T>
): Promise<T | null> {
  // Coalesce concurrent failures (e.g. Load CAESAR + Add to cart both racing
  // through `getEntryFormState()`) so we open exactly one popup tab. Late
  // arrivers wait for the same auth handshake but each runs their own retry.
  if (pendingAuthRecovery) {
    const ok = await pendingAuthRecovery.then(
      () => true,
      () => false
    );
    return ok ? await retry() : null;
  }

  const handshake = (async (): Promise<void> => {
    showToast("CAESAR session expired — opening sign-in…", {
      tone: "info",
      durationMs: 3500
    });

    const reasonPromise = new Promise<AuthPopupClosedMessage["reason"]>((resolve) => {
      const listener = (message: unknown): void => {
        if (
          message &&
          typeof message === "object" &&
          (message as { type?: string }).type === "auth-popup-closed"
        ) {
          chrome.runtime.onMessage.removeListener(listener);
          resolve((message as AuthPopupClosedMessage).reason);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
    });

    const request: OpenAuthPopupMessage = { type: "open-auth-popup", loginUrl };
    const response = (await chrome.runtime.sendMessage(request)) as
      | OpenAuthPopupResponse
      | undefined;
    if (!response?.ok) {
      throw new Error("Couldn't open the CAESAR sign-in tab.");
    }

    const reason = await reasonPromise;
    if (reason !== "succeeded") {
      throw new Error("CAESAR sign-in was canceled.");
    }
  })();

  pendingAuthRecovery = handshake;
  try {
    await handshake;
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), {
      tone: "error",
      durationMs: 5000
    });
    return null;
  } finally {
    pendingAuthRecovery = null;
  }

  return await retry();
}

async function withCaesarAuthRecovery<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch (error) {
    if (!isCaesarAuthRequiredError(error)) throw error;
    return await recoverCaesarAuthAndRetry(error.loginUrl, action);
  }
}

