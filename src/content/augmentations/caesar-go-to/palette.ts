import { el } from "../../framework";

export const DIALOG_ID = "bc-caesar-go-to";
export const TRIGGER_ID = "bc-caesar-go-to-trigger";
const LIST_ID = "bc-caesar-go-to-list";
const TITLE_ID = "bc-caesar-go-to-title";

const ICONS = {
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4",
  cart: "M3 4h2l2.4 11H18l2-7H6m3 11h.01m8 0h.01",
  calendar: "M4 6h16v14H4zM8 4v4m8-4v4M4 10h16",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2",
  file: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
  home: "m3 10 9-7 9 7M5 9v11h14V9m-9 11v-6h4v6",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm4-13-2.5 5.5L8 16l2.5-5.5L16 8Z"
};

export type Destination = {
  id: string;
  label: string;
  group: "Registration" | "Academic records" | "CAESAR";
  icon: keyof typeof ICONS;
  aliases?: string;
  navigate(closePalette: () => void): void;
};

const SVG_NS = "http://www.w3.org/2000/svg";

function icon(doc: Document, name: keyof typeof ICONS): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "bc-go-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICONS[name]);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.7");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

export function createPalette(doc: Document, readDestinations: () => Destination[]) {
  const mac = /Mac|iPhone|iPad/i.test(doc.defaultView?.navigator.platform ?? "");
  const trigger = el(doc, "button", {
    attrs: {
      id: TRIGGER_ID,
      type: "button",
      "aria-haspopup": "dialog",
      "aria-controls": DIALOG_ID,
      "aria-expanded": "false",
      "aria-keyshortcuts": "Meta+K Control+K"
    }
  }, [
    icon(doc, "compass"),
    "Go to…",
    el(doc, "kbd", { class: "bc-go-key", text: mac ? "⌘K" : "Ctrl K", attrs: { "aria-hidden": "true" } })
  ]);
  const dialog = el(doc, "dialog", { attrs: { id: DIALOG_ID, "aria-labelledby": TITLE_ID } });
  const input = el(doc, "input", {
    class: "bc-go-input",
    attrs: {
      type: "text",
      role: "combobox",
      "aria-label": "Find a CAESAR page",
      "aria-controls": LIST_ID,
      "aria-expanded": "true",
      "aria-autocomplete": "list",
      placeholder: "Find a page, like cart or appointments…",
      autocomplete: "off",
      spellcheck: "false",
      autofocus: ""
    }
  });
  const list = el(doc, "div", { class: "bc-go-list", attrs: { id: LIST_ID, role: "listbox", "aria-label": "CAESAR pages" } });
  const empty = el(doc, "p", {
    class: "bc-go-empty",
    text: "No matching pages. Try a different search.",
    attrs: { role: "status", hidden: "" }
  });
  const close = el(doc, "button", {
    class: "bc-go-close",
    text: "×",
    attrs: { type: "button", "aria-label": "Close Go to" },
    on: { click: () => dialog.close() }
  });
  dialog.append(el(doc, "div", { class: "bc-go-shell" }, [
    el(doc, "div", { class: "bc-go-header" }, [
      el(doc, "div", { class: "bc-go-title-row" }, [
        el(doc, "h2", { class: "bc-go-title", text: "Go to", attrs: { id: TITLE_ID } }),
        close
      ]),
      el(doc, "div", { class: "bc-go-search" }, [icon(doc, "search"), input])
    ]),
    list,
    empty,
    el(doc, "div", { class: "bc-go-footer" }, [
      el(doc, "span", { text: "Pencil for CAESAR" }),
      el(doc, "span", { class: "bc-go-footer-hints", attrs: { "aria-hidden": "true" } }, [
        el(doc, "kbd", { class: "bc-go-key", text: "↑ ↓" }), "Move",
        el(doc, "kbd", { class: "bc-go-key", text: "↵" }), "Open"
      ])
    ])
  ]));

  let destinations: Destination[] = [];
  let matches: Destination[] = [];
  let rows: HTMLDivElement[] = [];
  let selected = -1;

  function select(index: number): void {
    if (selected === index) return;
    rows[selected]?.setAttribute("aria-selected", "false");
    selected = index;
    const row = rows[index];
    if (row) {
      row.setAttribute("aria-selected", "true");
      input.setAttribute("aria-activedescendant", row.id);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function activate(destination: Destination): void {
    destination.navigate(() => dialog.close());
  }

  function render(): void {
    const words = input.value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    matches = destinations.filter((destination) => {
      const haystack = `${destination.label} ${destination.aliases ?? ""}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    const groups = new Map<Destination["group"], HTMLDivElement>();
    selected = -1;
    rows = matches.map((destination, index) => {
      let group = groups.get(destination.group);
      if (!group) {
        group = el(doc, "div", { attrs: { role: "group", "aria-label": destination.group } }, [
          el(doc, "div", {
            class: "bc-go-group-label",
            text: destination.group,
            attrs: { "aria-hidden": "true" }
          })
        ]);
        groups.set(destination.group, group);
      }
      const row = el(doc, "div", {
        class: "bc-go-option",
        attrs: { id: `bc-go-option-${destination.id}`, role: "option", "aria-selected": "false" },
        on: {
          pointermove: () => select(index),
          click: () => activate(destination)
        }
      }, [
        el(doc, "span", { class: "bc-go-option-icon" }, [icon(doc, destination.icon)]),
        el(doc, "span", { class: "bc-go-option-title", text: destination.label }),
        el(doc, "span", { class: "bc-go-arrow", text: "↵", attrs: { "aria-hidden": "true" } })
      ]);
      group.append(row);
      return row;
    });
    list.replaceChildren(...groups.values());
    list.hidden = rows.length === 0;
    empty.hidden = rows.length !== 0;
    input.setAttribute("aria-expanded", String(rows.length > 0));
    if (rows.length) select(0);
    else input.removeAttribute("aria-activedescendant");

  }

  function toggle(): void {
    if (dialog.open) {
      dialog.close();
      return;
    }
    destinations = readDestinations();
    input.value = "";
    render();
    dialog.showModal();
    trigger.setAttribute("aria-expanded", "true");
    input.focus({ preventScroll: true });
  }

  trigger.addEventListener("click", toggle);
  input.addEventListener("input", render);
  input.addEventListener("keydown", (event) => {
    if (event.isComposing || !rows.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      select((selected + direction + rows.length) % rows.length);
      rows[selected]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      activate(matches[selected]!);
    }
  });
  dialog.addEventListener("close", () => {
    trigger.setAttribute("aria-expanded", String(dialog.open));
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  return { trigger, dialog, toggle };
}
