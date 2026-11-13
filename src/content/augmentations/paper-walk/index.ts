import { logQuiet } from "../../../shared/log";
import { buildingOf, CAMPUS, meetingsOf, walkMinutes, type Building } from "../../campus/buildings";
import { BUILDING_SHAPES, FIELDS, MAP, OTHER_BUILDINGS, STREETS, WALKS, WATER } from "../../campus/campus-map";
import { el, ensureStyle, type Augmentation } from "../../framework";
import { formatCourseIdForDisplay } from "../class-search/catalog-format";
import { getTermCourses, type PaperSection } from "../class-search/paper-data";
import { readPaperScheduleSnapshot } from "../paper-combos/data";

const FEATURE_ID = "paper-walk";
const HOST_ID = "bc-paper-walk";
const STYLE_ID = "bc-paper-walk-style";
const HIDDEN_ATTR = "data-bc-paper-walk-hidden";
const SVG = "http://www.w3.org/2000/svg";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LANDMARKS = new Set(["Tech", "Library", "University Hall", "Kellogg Global Hub", "Annenberg Hall", "Fisk Hall"]);
const HUES = [212, 152, 28, 332, 268, 188, 48, 2, 104, 236];
// Seconds from one stop appearing to the next, and the rest before the walk
// draws itself again.
const STEP = 0.8;
const REST = 3;
// How often the saved schedule is read again while the page keeps changing.
const REREAD_MS = 1500;

const STYLES = `
  [${HIDDEN_ATTR}] { display: none !important; }
  #${HOST_ID} {
    position: relative; height: 100%; width: 100%; overflow: hidden; border-radius: inherit;
    font-family: var(--bc-font-body); color: var(--bc-color-text-strong);
    --map-water: hsl(208 60% 90%); --map-field: hsl(120 28% 88%);
  }
  [data-bc-mode="dark"] #${HOST_ID} { --map-water: hsl(210 32% 21%); --map-field: hsl(130 16% 22%); }
  #${HOST_ID} svg.bc-walk-map {
    display: block; width: 100%; height: 100%; background: var(--bc-color-surface-hover);
    cursor: grab; touch-action: none; user-select: none;
  }
  #${HOST_ID} svg.bc-walk-map:active { cursor: grabbing; }
  #${HOST_ID} .bc-walk-days { position: absolute; left: 6px; top: 6px; display: flex; gap: 2px; }
  #${HOST_ID} .bc-walk-days button, #${HOST_ID} .bc-walk-zoom button {
    font: 600 11px/1 var(--bc-font-body); padding: 5px 7px; border: 0; cursor: pointer;
    background: var(--bc-color-bg); color: var(--bc-color-text-muted);
    box-shadow: 0 0 0 1px var(--bc-color-border);
  }
  #${HOST_ID} .bc-walk-days button { border-radius: 999px; }
  #${HOST_ID} .bc-walk-days button[aria-pressed="true"] { background: var(--bc-color-text-strong); color: var(--bc-color-bg); }
  #${HOST_ID} .bc-walk-days button:disabled { opacity: 0.4; cursor: default; }
  #${HOST_ID} .bc-walk-zoom { position: absolute; right: 6px; top: 6px; display: flex; flex-direction: column; gap: 2px; }
  #${HOST_ID} .bc-walk-zoom button { border-radius: 6px; width: 24px; padding: 5px 0; }
  #${HOST_ID} .bc-walk-note {
    position: absolute; left: 6px; bottom: 6px; right: 6px; margin: 0; pointer-events: none;
    font-size: 10.5px; color: var(--bc-color-text-muted);
    text-shadow: 0 0 3px var(--bc-color-surface-hover), 0 0 3px var(--bc-color-surface-hover);
  }
  #${HOST_ID} .bc-walk-water { fill: var(--map-water); }
  #${HOST_ID} .bc-walk-field { fill: var(--map-field); }
  #${HOST_ID} .bc-walk-street { fill: none; stroke: var(--bc-color-bg); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  #${HOST_ID} .bc-walk-path { fill: none; stroke: var(--bc-color-border-strong); stroke-width: 0.7; stroke-dasharray: 1.5 2; opacity: 0.8; }
  #${HOST_ID} .bc-walk-building { fill: color-mix(in srgb, var(--bc-color-text-strong) 13%, var(--bc-color-surface-hover)); stroke: var(--bc-color-surface-hover); stroke-width: 0.8; }
  #${HOST_ID} .bc-walk-building.is-class { fill: color-mix(in srgb, var(--bc-color-text-strong) 24%, var(--bc-color-surface-hover)); }
  #${HOST_ID} .bc-walk-here .bc-walk-building { fill: hsl(var(--hue) 52% 48%); }
  #${HOST_ID} .bc-walk-dot { fill: var(--bc-color-border-strong); }
  #${HOST_ID} .bc-walk-mark { font-size: 9.5px; font-weight: 600; fill: var(--bc-color-text-muted); paint-order: stroke; stroke: var(--bc-color-surface-hover); stroke-width: 3px; }
  #${HOST_ID} .bc-walk-leg { fill: none; stroke: var(--bc-color-text-strong); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 1; }
  #${HOST_ID} .bc-walk-head { fill: none; stroke: var(--bc-color-text-strong); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  #${HOST_ID} .bc-walk-between { font-size: 10.5px; font-weight: 700; fill: var(--bc-color-bg); paint-order: stroke; stroke: var(--bc-color-text-strong); stroke-width: 5px; stroke-linejoin: round; }
  #${HOST_ID} .bc-walk-between.is-tight { fill: var(--bc-color-on-saturated); stroke: var(--bc-color-danger); }
  #${HOST_ID} .bc-walk-stop circle { fill: hsl(var(--hue) 52% 48%); stroke: var(--bc-color-surface-hover); stroke-width: 2; }
  #${HOST_ID} .bc-walk-num { font-size: 11.5px; font-weight: 700; fill: var(--bc-color-on-saturated); }
  #${HOST_ID} .bc-walk-name { font-size: 12px; font-weight: 600; fill: var(--bc-color-text-strong); paint-order: stroke; stroke: var(--bc-color-surface-hover); stroke-width: 4px; stroke-linejoin: round; }
`;

type Entry = { key: string; code: string; title: string; section: PaperSection };
type Stop = { entry: Entry; start: number; end: number; room: string | null; place: Building | null };
type View = { x: number; y: number; w: number };

const at = (b: Building) => ({ x: (b.lon - MAP.west) * MAP.lonScale, y: (MAP.north - b.lat) * MAP.latScale });

function span(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

function svg<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const node = doc.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

// The day's classes that come one after another, each at its building. A
// class that overlaps one already in the walk is left out of it.
export function walkOf(entries: Entry[], day: number): Stop[] {
  const all: Stop[] = [];
  for (const entry of entries) {
    for (const m of meetingsOf(entry.section)) {
      if (m.day === day) all.push({ entry, start: m.start, end: m.end, room: m.room, place: buildingOf(m.room) });
    }
  }
  all.sort((a, b) => a.start - b.start || a.end - b.end);
  const stops: Stop[] = [];
  for (const stop of all) {
    const last = stops[stops.length - 1];
    if (!last || stop.start >= last.end) stops.push(stop);
  }
  return stops;
}

// Paper.nu: draws the day's classes as a walk across campus (numbered stops,
// the path between them, the break before each next class) in place of
// Paper.nu's own map at the foot of the side panel.
export class PaperWalkAugmentation implements Augmentation {
  readonly id = FEATURE_ID;
  private host?: HTMLElement;
  private theirs?: HTMLElement;
  private entries: Entry[] = [];
  private signature = "";
  private lastRead = 0;
  private reading = false;
  private day: number | null = null;
  private view: View | null = null;

  run(doc: Document = document): void {
    const { hostname } = doc.location;
    if (hostname !== "paper.nu" && hostname !== "www.paper.nu") return;

    // Paper.nu's own map (the wrapper round its Leaflet map) and the box
    // holding it.
    const theirs = doc.querySelector<HTMLElement>(".leaflet-container")?.parentElement ?? null;
    const box = theirs?.parentElement ?? this.host?.parentElement ?? null;
    if (!box) {
      if (this.host && !this.host.isConnected) this.cleanup(doc);
      return;
    }
    if (!this.host || this.host.parentElement !== box) {
      if (!theirs) return;
      this.cleanup(doc);
      ensureStyle(doc, STYLE_ID, STYLES);
      this.host = el(doc, "div", { attrs: { id: HOST_ID } });
      box.append(this.host);
      this.signature = "";
      this.lastRead = 0;
    }
    // Paper.nu may draw its map again in the same box: hide the new one too.
    if (theirs && theirs !== this.theirs) {
      this.theirs?.removeAttribute(HIDDEN_ATTR);
      theirs.setAttribute(HIDDEN_ATTR, "");
      this.theirs = theirs;
    }
    void this.refresh(doc);
  }

  cleanup(doc: Document = document): void {
    this.host?.remove();
    this.theirs?.removeAttribute(HIDDEN_ATTR);
    this.host = undefined;
    this.theirs = undefined;
    doc.getElementById(STYLE_ID)?.remove();
  }

  // Reads the saved schedule again, and redraws only when it has changed.
  private async refresh(doc: Document): Promise<void> {
    if (this.reading || Date.now() - this.lastRead < REREAD_MS) return;
    this.reading = true;
    try {
      const saved = await readPaperScheduleSnapshot();
      const signature = saved ? `${saved.termId}|${[...saved.sectionIds].sort().join()}` : "";
      if (signature === this.signature && this.host?.childElementCount) return;
      const entries: Entry[] = [];
      if (saved && saved.sectionIds.length > 0) {
        const wanted = new Set(saved.sectionIds);
        for (const course of await getTermCourses(saved.termId)) {
          for (const section of course.sections) {
            if (!wanted.has(section.section_id) || meetingsOf(section).length === 0) continue;
            entries.push({
              key: `${course.subject} ${course.catalog}`,
              code: formatCourseIdForDisplay(course.subject, course.catalog).replace(/_/g, " "),
              title: course.title,
              section
            });
          }
        }
      }
      this.signature = signature;
      this.entries = entries;
      this.view = null;
      this.draw(doc);
    } catch (error: unknown) {
      logQuiet(FEATURE_ID, error);
    } finally {
      this.lastRead = Date.now();
      this.reading = false;
    }
  }

  private draw(doc: Document): void {
    const host = this.host;
    if (!host) return;
    const entries = this.entries;
    const busy = DAY_NAMES.map((_, day) => walkOf(entries, day));
    const today = (new Date().getDay() + 6) % 7;
    const firstBusy = busy.findIndex((stops) => stops.length > 0);
    const day = this.day !== null && busy[this.day]!.length > 0 ? this.day : busy[today]!.length > 0 ? today : Math.max(0, firstBusy);
    const stops = busy[day]!;
    const hues = new Map<string, number>();
    for (const key of [...new Set(entries.map((entry) => entry.key))].sort()) hues.set(key, HUES[hues.size % HUES.length]!);

    // The view keeps the box's own shape, so the map fills it.
    const aspect = host.clientWidth > 0 ? host.clientHeight / host.clientWidth : 0.7;
    const clamp = (x: number, y: number, w: number): View => {
      const width = Math.min(MAP.width, Math.max(MAP.width / 4, w));
      return { w: width, x: Math.min(Math.max(0, x), MAP.width - width), y: Math.min(Math.max(0, y), MAP.height - width * aspect) };
    };
    const points = stops.filter((stop) => stop.place).map((stop) => at(stop.place!));
    const fit = ((): View => {
      if (points.length === 0) return clamp(40, 150, MAP.width * 0.8);
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const w = Math.max(Math.max(...xs) - Math.min(...xs) + 260, (Math.max(...ys) - Math.min(...ys) + 150) / aspect);
      const view = clamp(0, 0, w);
      return clamp((Math.min(...xs) + Math.max(...xs)) / 2 - view.w / 2, (Math.min(...ys) + Math.max(...ys)) / 2 - (view.w * aspect) / 2, view.w);
    })();
    const view = this.view ?? fit;

    const map = svg(doc, "svg", { class: "bc-walk-map", role: "img", "aria-label": `Map of ${DAY_NAMES[day]}'s walk between classes` });
    const frame = (v: View) => map.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.w * aspect}`);
    frame(view);
    map.append(
      svg(doc, "path", { class: "bc-walk-water", d: WATER }),
      svg(doc, "path", { class: "bc-walk-field", d: FIELDS }),
      svg(doc, "path", { class: "bc-walk-street", d: STREETS }),
      svg(doc, "path", { class: "bc-walk-path", d: WALKS }),
      svg(doc, "path", { class: "bc-walk-building", d: OTHER_BUILDINGS })
    );

    // One marker per building, numbered with every stop made there.
    const markers = new Map<Building, { numbers: number[]; stop: Stop }>();
    stops.forEach((stop, index) => {
      if (!stop.place) return;
      const marker = markers.get(stop.place);
      if (marker) marker.numbers.push(index + 1);
      else markers.set(stop.place, { numbers: [index + 1], stop });
    });
    for (const building of CAMPUS) {
      const marker = markers.get(building);
      const group = svg(doc, "g", marker ? { class: "bc-walk-here", style: `--hue:${hues.get(marker.stop.entry.key) ?? 212}` } : {});
      const shape = BUILDING_SHAPES[building.name as keyof typeof BUILDING_SHAPES];
      const p = at(building);
      if (shape) {
        const outline = svg(doc, "path", { class: "bc-walk-building is-class", d: shape });
        outline.append(svg(doc, "title", {}, building.name));
        group.append(outline);
      } else {
        group.append(svg(doc, "circle", { class: "bc-walk-dot", cx: p.x, cy: p.y, r: 2.5 }));
      }
      if (!marker && LANDMARKS.has(building.name)) {
        group.append(svg(doc, "text", { class: "bc-walk-mark", x: p.x, y: p.y + 3.5, "text-anchor": "middle" }, building.name));
      }
      map.append(group);
    }

    // Everything on the walk draws itself in turn, rests, and starts again.
    const cycle = (stops.length * STEP + REST) * 1000;
    const still = typeof map.animate !== "function" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || stops.length < 2;
    const appear = (node: SVGElement, beginSeconds: number, property: "opacity" | "strokeDashoffset" = "opacity") => {
      if (still) return;
      const from = property === "opacity" ? 0 : 1;
      const to = property === "opacity" ? 1 : 0;
      const start = Math.min(0.98, (beginSeconds * 1000) / cycle);
      const end = Math.min(0.99, start + 450 / cycle);
      node.animate(
        [
          { [property]: from, offset: 0 },
          { [property]: from, offset: start },
          { [property]: to, offset: end },
          { [property]: to, offset: 1 }
        ],
        { duration: cycle, iterations: Infinity }
      );
    };

    const placed = stops.filter((stop) => stop.place);
    placed.slice(1).forEach((to, i) => {
      const from = placed[i]!;
      if (from.place === to.place) return;
      const a = at(from.place!);
      const b = at(to.place!);
      // Bowed to one side, so the way there and the way back don't overlap.
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const bow = Math.min(26, len * 0.18);
      const mx = (a.x + b.x) / 2 - ((b.y - a.y) / len) * bow;
      const my = (a.y + b.y) / 2 + ((b.x - a.x) / len) * bow;
      const trim = (point: { x: number; y: number }, by: number) => {
        const d = Math.hypot(mx - point.x, my - point.y) || 1;
        return { x: point.x + ((mx - point.x) / d) * by, y: point.y + ((my - point.y) / d) * by };
      };
      const s = trim(a, 12);
      const e = trim(b, 15);
      const gap = to.start - from.end;
      const tight = gap < walkMinutes(from.place!, to.place!);
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const begin = (stops.indexOf(to) - 1) * STEP + 0.25;
      const leg = svg(doc, "path", { class: "bc-walk-leg", d: `M${s.x} ${s.y}Q${mx} ${my} ${e.x} ${e.y}`, pathLength: 1 });
      const head = svg(doc, "path", {
        class: "bc-walk-head",
        d: "M-6 -4.5L1 0L-6 4.5",
        transform: `translate(${e.x} ${e.y}) rotate(${(Math.atan2(e.y - my, e.x - mx) * 180) / Math.PI})`
      });
      appear(leg, begin, "strokeDashoffset");
      appear(head, begin + 0.5);
      map.append(leg, head);
      if (len >= 40) {
        const label = svg(
          doc,
          "text",
          {
            class: `bc-walk-between${tight ? " is-tight" : ""}`,
            x: (s.x + 2 * mx + e.x) / 4 + nx * 9,
            y: (s.y + 2 * my + e.y) / 4 + ny * 13 + 4,
            "text-anchor": nx > 0.35 ? "start" : nx < -0.35 ? "end" : "middle"
          },
          gap === 0 ? "no break" : span(gap)
        );
        appear(label, begin + 0.3);
        map.append(label);
      }
    });
    for (const [place, marker] of markers) {
      const p = at(place);
      const label = marker.numbers.join("·");
      const left = p.x > view.x + view.w * 0.62;
      const group = svg(doc, "g", { class: "bc-walk-stop", style: `--hue:${hues.get(marker.stop.entry.key) ?? 212}` });
      // Back-to-back classes in one building have no path to label, so the
      // break between them goes under the building's name.
      const stays = placed.slice(1).flatMap((to, i) => {
        const from = placed[i]!;
        if (from.place !== place || to.place !== place) return [];
        const gap = to.start - from.end;
        return [gap === 0 ? "no break" : `${span(gap)} break`];
      });
      const names = marker.numbers.map((n) => {
        const stop = stops[n - 1]!;
        return `${n}. ${stop.entry.code}, ${clock(stop.start)}–${clock(stop.end)}, ${stop.room ?? place.name}`;
      });
      group.append(
        svg(doc, "title", {}, names.join("\n")),
        svg(doc, "circle", { cx: p.x, cy: p.y, r: label.length > 1 ? 13 : 11 }),
        svg(doc, "text", { class: "bc-walk-num", x: p.x, y: p.y + 4, "text-anchor": "middle" }, label),
        svg(doc, "text", { class: "bc-walk-name", x: p.x + (left ? -17 : 17), y: p.y + 4, "text-anchor": left ? "end" : "start" }, place.name)
      );
      if (stays.length > 0) {
        group.append(
          svg(doc, "text", { class: "bc-walk-between", x: p.x + (left ? -17 : 17), y: p.y + 18, "text-anchor": left ? "end" : "start" }, stays.join(", "))
        );
      }
      appear(group, (marker.numbers[0]! - 1) * STEP);
      map.append(group);
    }

    // Dragging moves the map; the buttons zoom it; a double click frames the walk again.
    let current = view;
    const move = (next: View) => {
      current = next;
      this.view = next;
      frame(next);
    };
    let drag: { x: number; y: number; id: number } | null = null;
    map.addEventListener("pointerdown", (event) => {
      drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
      map.setPointerCapture?.(event.pointerId);
    });
    map.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const scale = current.w / (map.getBoundingClientRect().width || 1);
      move(clamp(current.x - (event.clientX - drag.x) * scale, current.y - (event.clientY - drag.y) * scale, current.w));
      drag = { ...drag, x: event.clientX, y: event.clientY };
    });
    const drop = () => (drag = null);
    map.addEventListener("pointerup", drop);
    map.addEventListener("pointercancel", drop);
    map.addEventListener("dblclick", () => {
      this.view = null;
      current = fit;
      frame(fit);
    });
    const zoom = (factor: number) => {
      const w = Math.min(MAP.width, Math.max(MAP.width / 4, current.w / factor));
      move(clamp(current.x + (current.w - w) / 2, current.y + ((current.w - w) * aspect) / 2, w));
    };

    const days = el(doc, "div", { class: "bc-walk-days" }, DAY_NAMES.map((name, i) => {
      if (i >= 5 && busy[i]!.length === 0) return null;
      return el(doc, "button", {
        text: name,
        attrs: { type: "button", "aria-pressed": String(i === day), disabled: busy[i]!.length === 0 && i !== day ? "" : undefined },
        on: {
          click: () => {
            this.day = i;
            this.view = null;
            this.draw(doc);
          }
        }
      });
    }));
    const zoomBox = el(doc, "div", { class: "bc-walk-zoom" }, [
      el(doc, "button", { text: "+", attrs: { type: "button", "aria-label": "Zoom in" }, on: { click: () => zoom(1.5) } }),
      el(doc, "button", { text: "−", attrs: { type: "button", "aria-label": "Zoom out" }, on: { click: () => zoom(1 / 1.5) } })
    ]);
    const off = stops.filter((stop) => !stop.place).length;
    const note =
      entries.length === 0
        ? "Add classes to your schedule to see your walk between them."
        : stops.length === 0
          ? `No classes on ${DAY_NAMES[day]}.`
          : off > 0
            ? `${off} ${off === 1 ? "class isn’t" : "classes aren’t"} on the map (no room yet, or off campus).`
            : "";
    host.replaceChildren(map, days, zoomBox, ...(note ? [el(doc, "p", { class: "bc-walk-note", text: note })] : []));
  }
}

export const paperWalkAugmentation = new PaperWalkAugmentation();
