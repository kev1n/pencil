import { el, injectModalStyles } from "../../framework";
import { MODAL_ID } from "./constants";
import { injectExportHelperStyles } from "./styles";
import { CALENDAR_APPS, type CalendarApp } from "./types";

export type ModalCallbacks = {
  onDownload(): void;
  onClose(): void;
};

export type ModalHandle = {
  setActiveTab(app: CalendarApp): void;
  destroy(): void;
};

// Mount the walkthrough modal into `doc`. Returns a handle the caller
// uses to drive tab selection or tear the modal down. Idempotent — a
// second call while the modal is already mounted no-ops and returns the
// previous handle.
export function openExportHelperModal(
  doc: Document,
  initialTab: CalendarApp,
  callbacks: ModalCallbacks
): ModalHandle {
  injectModalStyles(doc);
  injectExportHelperStyles(doc);

  const existing = doc.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const tabButtons = new Map<CalendarApp, HTMLButtonElement>();
  const bodyEl = el(doc, "div", { class: "bc-export-helper-body" });

  let activeTab: CalendarApp = initialTab;

  const setActiveTab = (app: CalendarApp): void => {
    activeTab = app;
    for (const [id, btn] of tabButtons.entries()) {
      btn.classList.toggle("is-active", id === app);
      btn.setAttribute("aria-selected", String(id === app));
    }
    renderTabContent(bodyEl, app);
  };

  const tabsRow = el(doc, "div", {
    class: "bc-tabs bc-tabs--pill bc-export-helper-tabs",
    attrs: { role: "tablist" }
  });
  for (const { id, label } of CALENDAR_APPS) {
    const btn = el(doc, "button", {
      class: "bc-tab",
      attrs: { type: "button", role: "tab", "aria-selected": "false" },
      text: label,
      on: {
        click: (event: MouseEvent): void => {
          event.preventDefault();
          setActiveTab(id);
        }
      }
    });
    tabButtons.set(id, btn);
    tabsRow.appendChild(btn);
  }

  const card = el(doc, "div", { class: "bc-modal-card bc-export-helper-card" });
  card.addEventListener("click", (event) => event.stopPropagation());

  const closeBtn = el(doc, "button", {
    class: "bc-modal-close",
    attrs: { type: "button", "aria-label": "Close" },
    text: "×",
    on: { click: () => callbacks.onClose() }
  });

  const eyebrow = el(doc, "p", {
    class: "bc-export-helper-eyebrow",
    text: "Export to calendar"
  });
  const title = el(doc, "h2", {
    class: "bc-export-helper-title",
    text: "Add your schedule to a calendar"
  });
  const lede = el(doc, "p", {
    class: "bc-export-helper-lede",
    text: "Pick your calendar app to see the steps, then download the .ics file and follow along."
  });

  const downloadBtn = el(doc, "button", {
    class: "bc-btn bc-btn--primary bc-btn--soft bc-btn--fill",
    attrs: { type: "button" },
    text: "Download .ics",
    on: { click: () => callbacks.onDownload() }
  });
  const cancelBtn = el(doc, "button", {
    class: "bc-btn bc-btn--secondary-accent",
    attrs: { type: "button" },
    text: "Cancel",
    on: { click: () => callbacks.onClose() }
  });
  const actions = el(doc, "div", { class: "bc-export-helper-actions" });
  actions.append(downloadBtn, cancelBtn);

  card.append(closeBtn, eyebrow, title, lede, tabsRow, bodyEl, actions);

  const backdrop = el(doc, "div", {
    class: "bc-modal",
    attrs: { id: MODAL_ID, role: "dialog", "aria-modal": "true" },
    on: { click: () => callbacks.onClose() }
  });
  backdrop.appendChild(card);

  doc.body.appendChild(backdrop);

  setActiveTab(activeTab);

  return {
    setActiveTab,
    destroy: () => {
      backdrop.remove();
    }
  };
}

// Per-tab content is wired in a later commit. This placeholder keeps
// the modal renderable end-to-end today.
function renderTabContent(host: HTMLElement, _app: CalendarApp): void {
  host.replaceChildren();
  host.appendChild(
    host.ownerDocument.createTextNode("Step-by-step instructions coming soon.")
  );
}
