import { el, injectModalStyles } from "../../framework";
import { APP_CONTENT, CENTRAL_TIME_WARNING } from "./content";
import { MODAL_ID } from "./constants";
import { injectExportHelperStyles } from "./styles";
import { CALENDAR_APPS, type CalendarApp } from "./types";

export type ModalCallbacks = {
  onDownload(): void;
  onClose(): void;
  onTabChange?(app: CalendarApp): void;
};

export type ModalHandle = {
  setActiveTab(app: CalendarApp): void;
  destroy(): void;
};

// Mount the walkthrough modal into `doc`. Returns a handle the caller
// uses to drive tab selection or tear the modal down. Idempotent — a
// second call while the modal is already mounted destroys the old one
// and returns a fresh handle.
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
  const actionsEl = el(doc, "div", { class: "bc-export-helper-actions" });

  let activeTab: CalendarApp = initialTab;

  const setActiveTab = (app: CalendarApp, persist: boolean = true): void => {
    const changed = activeTab !== app;
    activeTab = app;
    for (const [id, btn] of tabButtons.entries()) {
      btn.classList.toggle("is-active", id === app);
      btn.setAttribute("aria-selected", String(id === app));
    }
    renderTabContent(bodyEl, app);
    renderActions(actionsEl, app, callbacks);
    if (changed && persist) callbacks.onTabChange?.(app);
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

  card.append(closeBtn, eyebrow, title, lede, tabsRow, bodyEl, actionsEl);

  const backdrop = el(doc, "div", {
    class: "bc-modal",
    attrs: { id: MODAL_ID, role: "dialog", "aria-modal": "true" },
    on: { click: () => callbacks.onClose() }
  });
  backdrop.appendChild(card);

  doc.body.appendChild(backdrop);

  // Initial render — don't fire onTabChange for the bootstrap value
  // (it's the value the caller already knows about).
  setActiveTab(activeTab, false);

  return {
    setActiveTab: (app) => setActiveTab(app, true),
    destroy: () => {
      backdrop.remove();
    }
  };
}

function renderTabContent(host: HTMLElement, app: CalendarApp): void {
  const doc = host.ownerDocument;
  const content = APP_CONTENT[app];
  host.replaceChildren();

  host.appendChild(
    el(doc, "p", {
      class: "bc-export-helper-intro",
      text: content.intro
    })
  );

  const list = el(doc, "ol", { class: "bc-export-helper-steps" });
  for (const step of content.steps) {
    list.appendChild(el(doc, "li", { text: step }));
  }
  host.appendChild(list);

  host.appendChild(
    el(doc, "p", {
      class: "bc-export-helper-warning",
      text: CENTRAL_TIME_WARNING
    })
  );

  if (content.helpLink) {
    const help = el(doc, "p", { class: "bc-export-helper-help" });
    help.appendChild(doc.createTextNode("Need more detail? See "));
    help.appendChild(
      el(doc, "a", {
        text: content.helpLink.label,
        attrs: {
          href: content.helpLink.href,
          target: "_blank",
          rel: "noopener noreferrer"
        }
      })
    );
    help.appendChild(doc.createTextNode("."));
    host.appendChild(help);
  }
}

function renderActions(
  host: HTMLElement,
  app: CalendarApp,
  callbacks: ModalCallbacks
): void {
  const doc = host.ownerDocument;
  const content = APP_CONTENT[app];
  host.replaceChildren();

  host.appendChild(
    el(doc, "button", {
      class: "bc-btn bc-btn--primary bc-btn--soft bc-btn--fill",
      attrs: { type: "button" },
      text: "Download .ics",
      on: { click: () => callbacks.onDownload() }
    })
  );

  if (content.deepLink) {
    host.appendChild(
      el(doc, "a", {
        class: "bc-btn bc-btn--secondary-accent",
        attrs: {
          href: content.deepLink.href,
          target: "_blank",
          rel: "noopener noreferrer"
        },
        text: content.deepLink.label
      })
    );
  }

  host.appendChild(
    el(doc, "button", {
      class: "bc-btn bc-btn--ghost",
      attrs: { type: "button" },
      text: "Cancel",
      on: { click: () => callbacks.onClose() }
    })
  );
}
