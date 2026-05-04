import type { Augmentation } from "../../framework";
import { acquirePeopleSoftLock, releasePeopleSoftLock, runPeopleSoftTask } from "../../peoplesoft";

type EnrollmentContext = {
  ACAD_CAREER: string;
  INSTITUTION: string;
  STRM: string;
  EMPLID?: string;
};

type TermOption = {
  value: string;
  term: string;
  career: string;
  label: string;
};

type TermPickerState = {
  termSelectorUrl: string;
  options: TermOption[];
};

const TERM_PAGE_ID = "SSR_SSENRL_TERM";

const CONTEXT_STORAGE_KEY = "better-caesar:enrollment-context:v1";
const TARGET_TERM_VALUE_KEY = "better-caesar:target-term-value";

const TERM_RADIO_SELECTOR =
  "#SSR_DUMMY_RECV1\\$scroll\\$0 input[type='radio'][name^='SSR_DUMMY_RECV1$sels$']";
const CONTINUE_BUTTON_SELECTOR = "#DERIVED_SSS_SCT_SSR_PB_GO";

const STYLE_ID = "better-caesar-enrollment-nav-style";
const TERM_SWITCHER_ID = "better-caesar-term-switcher";
const SPINNER_OVERLAY_ID = "better-caesar-term-auto-continue-overlay";
const EARLY_MASK_ID = "better-caesar-early-term-mask";
const NAV_LOCK_OWNER = "enrollment-navigation";

export class EnrollmentNavigationAugmentation implements Augmentation {
  readonly id = "enrollment-navigation";

  private waitingForLoad = false;
  private lastSubmittedSignature: string | null = null;
  // Stickier than lastSubmittedSignature: once we click Continue while landed
  // on a particular URL, refuse to click again until the URL itself changes
  // (i.e. the user navigated away and came back, or PS gave us a new query).
  // Prevents a re-click loop if PS handles the click without navigating —
  // ICStateNum bumps on the response, so the signature would otherwise
  // differ and we'd click again every mutation tick.
  private submittedForUrl: string | null = null;
  private termStateCache: {
    fetchedAt: number;
    promise: Promise<TermPickerState | null>;
  } | null = null;

  cleanup(doc: Document = document): void {
    this.waitingForLoad = false;
    this.lastSubmittedSignature = null;
    releasePeopleSoftLock(NAV_LOCK_OWNER);
    doc.getElementById(TERM_SWITCHER_ID)?.remove();
    doc.getElementById(SPINNER_OVERLAY_ID)?.remove();
    doc.getElementById(EARLY_MASK_ID)?.remove();
    doc.getElementById(STYLE_ID)?.remove();
  }

  run(doc: Document = document): void {
    injectStyles(doc);
    this.persistContextFromKnownSources(doc);

    const pageId = getPageId(doc);
    if (isEnrollmentWorkflowPage(doc, pageId)) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      this.injectTermSwitcher(doc);
    }

    if (pageId !== TERM_PAGE_ID) {
      this.waitingForLoad = false;
      this.lastSubmittedSignature = null;
      this.submittedForUrl = null;
      hideTermSpinnerOverlay(doc);
      hideEarlyTermPageMask(doc);
      return;
    }

    this.autoContinueTermPage(doc);
  }

  private persistContextFromKnownSources(doc: Document): void {
    const candidates = [window.location.href, ...extractUrlsFromInlineScripts(doc)];

    for (const candidate of candidates) {
      const context = parseContext(candidate);
      if (!context) continue;
      persistContext(context);
      return;
    }
  }

  private injectTermSwitcher(doc: Document): void {
    if (doc.getElementById(TERM_SWITCHER_ID)) return;

    const anchor = resolveTermSwitcherAnchor(doc);
    if (!anchor) return;

    const wrapper = doc.createElement("div");
    wrapper.id = TERM_SWITCHER_ID;
    wrapper.className = "better-caesar-term-wrapper";

    const title = doc.createElement("div");
    title.className = "better-caesar-term-helper";
    title.textContent = "Better CAESAR Term Switcher";

    const select = doc.createElement("select");
    select.className = "better-caesar-term-select";
    select.disabled = true;

    const loadingOption = doc.createElement("option");
    loadingOption.value = "";
    loadingOption.textContent = "Loading terms...";
    select.appendChild(loadingOption);

    const status = doc.createElement("div");
    status.className = "better-caesar-term-status";

    wrapper.appendChild(title);
    wrapper.appendChild(select);
    wrapper.appendChild(status);
    anchor.insertAdjacentElement("afterend", wrapper);

    void this.getTermPickerState(doc).then((state) => {
      select.textContent = "";

      if (!state || state.options.length === 0) {
        const option = doc.createElement("option");
        option.value = "";
        option.textContent = "No terms found";
        select.appendChild(option);
        status.textContent = "Term selector unavailable right now.";
        return;
      }

      for (const optionData of state.options) {
        const option = doc.createElement("option");
        option.value = optionData.value;
        option.textContent = optionData.label;
        select.appendChild(option);
      }

      const currentSignature = readCurrentTermSignature(doc);
      const matchedCurrent = currentSignature
        ? state.options.find(
            (option) =>
              normalizeText(option.term) === normalizeText(currentSignature.term) &&
              normalizeText(option.career) === normalizeText(currentSignature.career),
          )
        : null;

      if (matchedCurrent) {
        select.value = matchedCurrent.value;
      }

      select.disabled = false;
      select.addEventListener("change", () => {
        const selected = state.options.find((item) => item.value === select.value);
        if (!selected) return;

        status.textContent = "Switching term...";
        select.disabled = true;
        setTargetTermSelection(selected.value);

        void this.startLockedNavigation(() => {
          window.location.assign(state.termSelectorUrl);
        }).catch((error: unknown) => {
          clearTargetTermSelection();
          status.textContent =
            error instanceof Error ? `Switch failed: ${error.message}` : "Switch failed.";
          select.disabled = false;
        });
      });
    });
  }

  private async getTermPickerState(doc: Document): Promise<TermPickerState | null> {
    const now = Date.now();
    if (this.termStateCache && now - this.termStateCache.fetchedAt < 30_000) {
      return this.termStateCache.promise;
    }

    const promise = this.fetchTermPickerState(doc);
    this.termStateCache = { fetchedAt: now, promise };
    return promise;
  }

  private async fetchTermPickerState(doc: Document): Promise<TermPickerState | null> {
    const termSelectorUrl = buildTermSelectorUrl(doc);
    if (!termSelectorUrl) return null;

    return runPeopleSoftTask(
      "background",
      async () => {
        const res = await fetch(termSelectorUrl, {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) return null;

        const html = await res.text();
        const parser = new DOMParser();
        const nextDoc = parser.parseFromString(html, "text/html");

        if (getPageId(nextDoc) !== TERM_PAGE_ID) {
          const context = extractContextFromHtml(html) ?? parseContext(res.url);
          if (context) persistContext(context);
          return null;
        }

        const radios = Array.from(
          nextDoc.querySelectorAll<HTMLInputElement>(TERM_RADIO_SELECTOR),
        ).filter((radio) => !radio.disabled && radio.name);

        if (radios.length === 0) return null;

        const options: TermOption[] = [];
        for (const radio of radios) {
          const rowIndex = radioRowIndex(radio);
          const term = getTermLabelForRadio(nextDoc, radio);
          const career = textById(nextDoc, `CAREER$${rowIndex}`);
          const label = [term, career].filter(Boolean).join(" | ") || `Term ${radio.value}`;

          options.push({
            value: radio.value,
            term,
            career,
            label,
          });
        }

        return { termSelectorUrl, options };
      },
      { owner: "enrollment-navigation:term-picker" },
    );
  }

  private autoContinueTermPage(doc: Document): void {
    showTermSpinnerOverlay(doc);

    if (doc.readyState !== "complete") {
      if (this.waitingForLoad) return;
      this.waitingForLoad = true;
      window.addEventListener(
        "load",
        () => {
          this.waitingForLoad = false;
          this.run(document);
        },
        { once: true },
      );
      return;
    }

    const currentUrl = window.location.href;
    if (this.submittedForUrl === currentUrl) {
      // Already clicked Continue once for this landing. PS will either
      // navigate (next run sees pageId !== TERM_PAGE_ID and clears the
      // sentinel) or stall — in which case we'd rather leave the user on
      // the page than spam clicks at CAESAR.
      return;
    }

    const targetValue = getTargetTermSelection() ?? "";
    const signature = buildPageSignature(doc, targetValue);
    if (this.lastSubmittedSignature === signature) {
      return;
    }

    const radios = Array.from(
      doc.querySelectorAll<HTMLInputElement>(TERM_RADIO_SELECTOR),
    ).filter((radio) => !radio.disabled);
    const continueButton = doc.querySelector<HTMLInputElement>(
      CONTINUE_BUTTON_SELECTOR,
    );
    if (radios.length === 0 || !continueButton || continueButton.disabled) {
      clearTargetTermSelection();
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      hideTermSpinnerOverlay(doc);
      hideEarlyTermPageMask(doc);
      return;
    }

    const selectedRadio =
      (targetValue ? radios.find((radio) => radio.value === targetValue) : null) ??
      pickDefaultRadio(doc, radios);

    if (!selectedRadio) {
      clearTargetTermSelection();
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      hideTermSpinnerOverlay(doc);
      hideEarlyTermPageMask(doc);
      return;
    }

    this.lastSubmittedSignature = signature;
    this.submittedForUrl = currentUrl;
    clearTargetTermSelection();

    if (!selectedRadio.checked) {
      selectedRadio.checked = true;
      selectedRadio.setAttribute("checked", "checked");
    }

    window.setTimeout(() => {
      continueButton.click();
    }, 80);

    window.setTimeout(() => {
      if (getPageId(document) === TERM_PAGE_ID) {
        releasePeopleSoftLock(NAV_LOCK_OWNER);
        hideTermSpinnerOverlay(document);
        hideEarlyTermPageMask(document);
      }
    }, 10_000);
  }

  private async startLockedNavigation(navigate: () => void): Promise<void> {
    await acquirePeopleSoftLock(NAV_LOCK_OWNER, {
      waitForIdle: true,
      abortActive: true,
      ttlMs: 120_000,
    });

    try {
      navigate();
    } catch (error) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      throw error;
    }
  }
}

function persistContext(context: EnrollmentContext): void {
  try {
    window.localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage errors.
  }
}

function readStoredContext(): EnrollmentContext | null {
  try {
    const raw = window.localStorage.getItem(CONTEXT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EnrollmentContext>;
    if (!parsed.ACAD_CAREER || !parsed.INSTITUTION || !parsed.STRM) return null;

    return {
      ACAD_CAREER: parsed.ACAD_CAREER,
      INSTITUTION: parsed.INSTITUTION,
      STRM: parsed.STRM,
      EMPLID: parsed.EMPLID,
    };
  } catch {
    return null;
  }
}

function parseContext(pathOrUrl: string): EnrollmentContext | null {
  let url: URL;
  try {
    url = new URL(pathOrUrl, window.location.origin);
  } catch {
    return null;
  }

  const ACAD_CAREER = url.searchParams.get("ACAD_CAREER") ?? "";
  const INSTITUTION = url.searchParams.get("INSTITUTION") ?? "";
  const STRM = url.searchParams.get("STRM") ?? "";
  const EMPLID = url.searchParams.get("EMPLID") ?? "";

  if (!ACAD_CAREER || !INSTITUTION || !STRM) return null;
  return {
    ACAD_CAREER,
    INSTITUTION,
    STRM,
    ...(EMPLID ? { EMPLID } : {}),
  };
}

function extractContextFromHtml(html: string): EnrollmentContext | null {
  const pattern = /(?:strCurrUrl|sHistURL|refererURL)\s*=\s*['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const candidate = match[1]?.trim();
    if (!candidate) continue;
    const context = parseContext(candidate);
    if (context) return context;
  }

  return null;
}

function getPageId(doc: Document): string | null {
  const pageInfo = doc.querySelector<HTMLElement>("#pt_pageinfo_win0");
  return pageInfo?.getAttribute("Page") ?? null;
}

function getComponentId(doc: Document): string | null {
  const pageInfo = doc.querySelector<HTMLElement>("#pt_pageinfo_win0");
  return pageInfo?.getAttribute("Component") ?? null;
}

function isEnrollmentWorkflowPage(doc: Document, pageId: string | null): boolean {
  if (pageId === TERM_PAGE_ID) return false;

  const component = getComponentId(doc);
  const value = (component ?? pageId ?? "").toUpperCase();
  if (!value.startsWith("SSR_SSENRL_")) return false;

  return (
    value === "SSR_SSENRL_CART" ||
    value === "SSR_SSENRL_DROP" ||
    value === "SSR_SSENRL_SWAP" ||
    value === "SSR_SSENRL_EDIT" ||
    value === "SSR_SSENRL_UPDT" ||
    value === "SSR_SSENRL_APPT"
  );
}

function extractUrlsFromInlineScripts(doc: Document): string[] {
  const urls = new Set<string>();
  const scriptEls = doc.querySelectorAll("script:not([src])");
  const pattern = /(?:strCurrUrl|sHistURL|refererURL)\s*=\s*['"]([^'"]+)['"]/g;

  for (const script of Array.from(scriptEls)) {
    const source = script.textContent ?? "";
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const value = match[1]?.trim();
      if (!value) continue;
      urls.add(value);
    }
  }

  return Array.from(urls);
}

function buildTermSelectorUrl(doc: Document): string | null {
  const currentPage = getPageId(doc) ?? "";

  if (currentPage === TERM_PAGE_ID) {
    return window.location.href;
  }

  if (isEnrollmentWorkflowPage(doc, currentPage)) {
    try {
      const currentUrl = new URL(window.location.href);
      if (/SSR_SSENRL_[^.]+\.GBL/i.test(currentUrl.pathname)) {
        currentUrl.searchParams.set("Page", currentPage);
        if (!currentUrl.searchParams.get("Action")) {
          currentUrl.searchParams.set("Action", "A");
        }
        if (!currentUrl.searchParams.get("NavColl")) {
          currentUrl.searchParams.set("NavColl", "true");
        }
        if (!currentUrl.searchParams.get("ICAGTarget")) {
          currentUrl.searchParams.set("ICAGTarget", "start");
        }
        if (!currentUrl.searchParams.get("ICAJAXTrf")) {
          currentUrl.searchParams.set("ICAJAXTrf", "true");
        }
        currentUrl.searchParams.set("PAGE", TERM_PAGE_ID);
        return currentUrl.toString();
      }
    } catch {
      // Fall through to alternate discovery paths.
    }
  }

  const formAction = doc.querySelector<HTMLFormElement>("form[name='win0']")?.action;
  const candidates = [window.location.href, formAction];
  const context = readContextFromCandidates(candidates) ?? readStoredContext();
  if (!context) return null;

  let fallbackUrl: URL;
  try {
    fallbackUrl = new URL(window.location.href);
  } catch {
    return null;
  }

  if (/SA_LEARNER_SERVICES(?:_2)?\.[^.]+\.GBL/i.test(fallbackUrl.pathname)) {
    fallbackUrl.pathname = fallbackUrl.pathname.replace(
      /SA_LEARNER_SERVICES(?:_2)?\.[^.]+\.GBL/i,
      "SA_LEARNER_SERVICES_2.SSR_SSENRL_CART.GBL",
    );
  }

  fallbackUrl.searchParams.set("Page", "SSR_SSENRL_CART");
  fallbackUrl.searchParams.set("Action", "A");
  fallbackUrl.searchParams.set("ACAD_CAREER", context.ACAD_CAREER);
  fallbackUrl.searchParams.set("INSTITUTION", context.INSTITUTION);
  fallbackUrl.searchParams.set("STRM", context.STRM);
  if (context.EMPLID) {
    fallbackUrl.searchParams.set("EMPLID", context.EMPLID);
  }
  fallbackUrl.searchParams.set("NavColl", "true");
  fallbackUrl.searchParams.set("ICAGTarget", "start");
  fallbackUrl.searchParams.set("ICAJAXTrf", "true");
  fallbackUrl.searchParams.set("PAGE", TERM_PAGE_ID);
  return fallbackUrl.toString();
}

function readContextFromCandidates(
  candidates: Array<string | null | undefined>,
): EnrollmentContext | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const context = parseContext(candidate);
    if (context) return context;
  }
  return null;
}

function textById(doc: Document, id: string): string {
  const element = doc.getElementById(id);
  if (!element) return "";
  return normalizeText(element.textContent ?? "");
}

function radioRowIndex(radio: HTMLInputElement): string {
  return radio.id.match(/\$(\d+)\$\$0$/)?.[1] ?? radio.value;
}

function getTermLabelForRadio(doc: Document, radio: HTMLInputElement): string {
  return textById(doc, `TERM_CAR$${radioRowIndex(radio)}`);
}

function isSummerTermLabel(label: string): boolean {
  return /\bsummer\b/i.test(label);
}

function pickDefaultRadio(
  doc: Document,
  radios: HTMLInputElement[],
): HTMLInputElement | null {
  if (radios.length === 0) return null;

  const lastRadio = radios[radios.length - 1];
  if (
    lastRadio &&
    radios.length >= 2 &&
    isSummerTermLabel(getTermLabelForRadio(doc, lastRadio))
  ) {
    return radios[radios.length - 2];
  }

  return radios.find((radio) => radio.checked) ?? lastRadio ?? null;
}

function readCurrentTermSignature(doc: Document): { term: string; career: string } | null {
  const text = textById(doc, "DERIVED_REGFRM1_SSR_STDNTKEY_DESCR$11$");
  if (!text) return null;

  const [term = "", career = ""] = text.split("|").map((part) => part.trim());
  if (!term || !career) return null;

  return { term, career };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function setTargetTermSelection(value: string): void {
  try {
    window.sessionStorage.setItem(TARGET_TERM_VALUE_KEY, value);
  } catch {
    // Ignore storage errors.
  }
}

function getTargetTermSelection(): string | null {
  try {
    return window.sessionStorage.getItem(TARGET_TERM_VALUE_KEY);
  } catch {
    return null;
  }
}

function clearTargetTermSelection(): void {
  try {
    window.sessionStorage.removeItem(TARGET_TERM_VALUE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function buildPageSignature(doc: Document, targetValue: string): string {
  const icStateNum =
    doc.querySelector<HTMLInputElement>("#ICStateNum")?.value ?? "";
  return `${window.location.href}|${icStateNum}|${targetValue}`;
}

function showTermSpinnerOverlay(doc: Document): void {
  if (doc.getElementById(SPINNER_OVERLAY_ID)) return;

  const overlay = doc.createElement("div");
  overlay.id = SPINNER_OVERLAY_ID;
  overlay.className = "better-caesar-term-overlay";

  const spinner = doc.createElement("div");
  spinner.className = "better-caesar-term-spinner";

  const text = doc.createElement("div");
  text.className = "better-caesar-term-overlay-text";
  text.textContent = "Switching term...";

  overlay.appendChild(spinner);
  overlay.appendChild(text);

  const host = doc.body ?? doc.documentElement;
  if (!host) return;
  host.appendChild(overlay);
}

function hideTermSpinnerOverlay(doc: Document): void {
  doc.getElementById(SPINNER_OVERLAY_ID)?.remove();
}

function hideEarlyTermPageMask(doc: Document): void {
  doc.getElementById(EARLY_MASK_ID)?.remove();
}

function resolveTermSwitcherAnchor(doc: Document): Element | null {
  const changeTermButton = doc.querySelector<HTMLInputElement>("#DERIVED_SSS_SCT_SSS_TERM_LINK");
  if (changeTermButton) {
    return (
      changeTermButton.closest("div[id^='win0divDERIVED_SSS_SCT_SSS_TERM_LINK']") ??
      changeTermButton.parentElement
    );
  }

  return (
    doc.querySelector("#win0divDERIVED_REGFRM1_SSR_STDNTKEY_DESCR") ??
    doc.querySelector("#win0divDERIVED_REGFRM1_TITLE1") ??
    doc.querySelector(".PAPAGETITLE")?.parentElement ??
    null
  );
}

function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .better-caesar-term-wrapper {
      margin-top: 6px;
      display: grid;
      gap: 4px;
      justify-items: start;
      max-width: 320px;
    }
    .better-caesar-term-helper {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      text-transform: uppercase;
      letter-spacing: 0.2px;
      color: var(--bc-color-accent);
    }
    .better-caesar-term-select {
      width: 100%;
      background: var(--bc-color-bg);
      color: var(--bc-color-accent-pressed);
      border: 1px solid var(--bc-color-accent);
      border-radius: var(--bc-radius-md);
      font-size: var(--bc-font-12);
      padding: 6px 8px;
    }
    .better-caesar-term-select:focus-visible {
      outline: 2px solid var(--bc-color-accent);
      outline-offset: 2px;
    }
    .better-caesar-term-status {
      min-height: 14px;
      font-size: var(--bc-font-10);
      color: var(--bc-color-accent);
    }
    .better-caesar-term-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 12px;
      background: var(--bc-color-surface-translucent-98);
    }
    .better-caesar-term-spinner {
      width: 28px;
      height: 28px;
      border-radius: var(--bc-radius-circle);
      border: 3px solid var(--bc-color-accent-mid-border);
      border-top-color: var(--bc-color-accent);
      animation: better-caesar-spin 0.8s linear infinite;
    }
    .better-caesar-term-overlay-text {
      color: var(--bc-color-accent);
      font-size: var(--bc-font-14);
      font-weight: var(--bc-fw-bold);
    }
    @keyframes better-caesar-spin {
      to { transform: rotate(360deg); }
    }
  `;

  const host = doc.head ?? doc.documentElement ?? doc.body;
  if (!host) return;
  host.appendChild(style);
}
