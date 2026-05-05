// In-page term-switcher dropdown + the underlying term-picker state fetch.
//
// Inject a dropdown into the enrollment workflow pages so the user can hop
// between terms without trekking back through the term selector. To populate
// it, we GET the term selector page in the background, parse its radio rows,
// and pair each radio with its term/career label cells.

import { runPeopleSoftTask } from "../../peoplesoft";

import { extractContextFromHtml, parseContext, persistContext } from "./state";
import { buildTermSelectorUrl, getPageId } from "./term-url";

export const TERM_PAGE_ID = "SSR_SSENRL_TERM";
export const TERM_SWITCHER_ID = "better-caesar-term-switcher";
export const TERM_RADIO_SELECTOR =
  "#SSR_DUMMY_RECV1\\$scroll\\$0 input[type='radio'][name^='SSR_DUMMY_RECV1$sels$']";
export const CONTINUE_BUTTON_SELECTOR = "#DERIVED_SSS_SCT_SSR_PB_GO";

export type TermOption = {
  value: string;
  term: string;
  career: string;
  label: string;
};

export type TermPickerState = {
  termSelectorUrl: string;
  options: TermOption[];
};

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function textById(doc: Document, id: string): string {
  const element = doc.getElementById(id);
  if (!element) return "";
  return normalizeText(element.textContent ?? "");
}

export function radioRowIndex(radio: HTMLInputElement): string {
  return radio.id.match(/\$(\d+)\$\$0$/)?.[1] ?? radio.value;
}

export function getTermLabelForRadio(
  doc: Document,
  radio: HTMLInputElement,
): string {
  return textById(doc, `TERM_CAR$${radioRowIndex(radio)}`);
}

export function isSummerTermLabel(label: string): boolean {
  return /\bsummer\b/i.test(label);
}

export function pickDefaultRadio(
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
    return radios[radios.length - 2] ?? null;
  }

  return radios.find((radio) => radio.checked) ?? lastRadio ?? null;
}

export function readCurrentTermSignature(
  doc: Document,
): { term: string; career: string } | null {
  const text = textById(doc, "DERIVED_REGFRM1_SSR_STDNTKEY_DESCR$11$");
  if (!text) return null;

  const [term = "", career = ""] = text.split("|").map((part) => part.trim());
  if (!term || !career) return null;

  return { term, career };
}

export function resolveTermSwitcherAnchor(doc: Document): Element | null {
  const changeTermButton = doc.querySelector<HTMLInputElement>(
    "#DERIVED_SSS_SCT_SSS_TERM_LINK",
  );
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

export type InjectTermSwitcherDeps = {
  getTermPickerState: (doc: Document) => Promise<TermPickerState | null>;
  onSwitch: (selected: TermOption, state: TermPickerState) => Promise<void>;
};

export function injectTermSwitcher(
  doc: Document,
  deps: InjectTermSwitcherDeps,
): void {
  if (doc.getElementById(TERM_SWITCHER_ID)) return;

  const anchor = resolveTermSwitcherAnchor(doc);
  if (!anchor) return;

  const wrapper = doc.createElement("div");
  wrapper.id = TERM_SWITCHER_ID;
  wrapper.className = "better-caesar-term-wrapper";

  const title = doc.createElement("div");
  title.className = "better-caesar-term-helper";
  title.textContent = "pencil.nu Term Switcher";

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

  void deps.getTermPickerState(doc).then((state) => {
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

      void deps.onSwitch(selected, state).catch((error: unknown) => {
        status.textContent =
          error instanceof Error ? `Switch failed: ${error.message}` : "Switch failed.";
        select.disabled = false;
      });
    });
  });
}

export async function fetchTermPickerState(
  doc: Document,
): Promise<TermPickerState | null> {
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
