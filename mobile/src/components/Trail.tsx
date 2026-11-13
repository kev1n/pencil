import { useEffect, useMemo, useRef, useState } from "react";
import { buildingOf, CAMPUS, walkMinutes, type Building } from "../data/buildings";
import { BUILDING_SHAPES, FIELDS, MAP, OTHER_BUILDINGS, STREETS, WALKS, WATER } from "../data/campus-map";
import { meetingsOf } from "../data/schedule";
import { courseCode, Section, type ColorOf } from "./bits";
import type { Timed } from "./WeekGrid";

// Seconds from one stop appearing on the map to the next.
const STEP = 0.8;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// The map is the Evanston campus, north up, at a fixed scale so a building
// is in the same spot whatever day is showing. Its shapes are bundled with
// the app (data/campus-map.ts) and drawn in the app's own colours.
const MAP_W = MAP.width;
const MAP_H = MAP.height;
const at = (b: Building) => ({ x: (b.lon - MAP.west) * MAP.lonScale, y: (MAP.north - b.lat) * MAP.latScale });

const LANDMARKS = new Set(["Tech", "Library", "University Hall", "Kellogg Global Hub", "Annenberg Hall", "Fisk Hall"]);

type View = { x: number; y: number; k: number };
// Keeps a view inside the map.
function clampView(x: number, y: number, k: number): View {
  return { k, x: Math.min(Math.max(0, x), MAP_W - MAP_W / k), y: Math.min(Math.max(0, y), MAP_H - MAP_H / k) };
}

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

function span(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

type Stop = { entry: Timed; start: number; end: number; room: string | null; place: Building | null };

// One day's classes as a walk across campus: numbered stops on a map, the
// path between them, and beside it the same walk as steps with how long each
// leg takes and how long there is to make it.
export function Trail({ entries, colorOf }: { entries: Timed[]; colorOf: ColorOf }) {
  // Classes left out of the walk, to see a day with and without them.
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const courses = useMemo(() => {
    const seen = new Map<string, Timed>();
    for (const entry of entries) if (meetingsOf(entry.section).length > 0) seen.set(`${entry.subject} ${entry.catalog}`, seen.get(`${entry.subject} ${entry.catalog}`) ?? entry);
    return [...seen.entries()];
  }, [entries]);
  const byDay = useMemo(() => {
    const days: Stop[][] = DAY_NAMES.map(() => []);
    for (const entry of entries) {
      if (off.has(`${entry.subject} ${entry.catalog}`)) continue;
      for (const m of meetingsOf(entry.section)) days[m.day]!.push({ entry, start: m.start, end: m.end, room: m.room, place: buildingOf(m.room) });
    }
    for (const day of days) day.sort((a, b) => a.start - b.start || a.end - b.end);
    return days;
  }, [entries, off]);

  const today = (new Date().getDay() + 6) % 7;
  // `?day=0` opens on Monday (launch-route development aid).
  const [chosen, setChosen] = useState<number | null>(() => {
    const day = (window as unknown as { launchParams?: URLSearchParams }).launchParams?.get("day");
    return day ? Number(day) : null;
  });
  const firstBusy = byDay.findIndex((d) => d.length > 0);
  const day = chosen ?? (byDay[today]!.length > 0 ? today : Math.max(0, firstBusy));
  // The walk is the day's classes that come one after another. A class that
  // overlaps one already in the walk is set aside and named under the steps;
  // leaving the other one out (the chips above) puts it back in.
  const stops: Stop[] = [];
  const aside: Array<{ stop: Stop; with: Stop }> = [];
  for (const stop of byDay[day]!) {
    const last = stops[stops.length - 1];
    if (last && stop.start < last.end) aside.push({ stop, with: last });
    else stops.push(stop);
  }
  const shownDays = DAY_NAMES.map((_, i) => i).filter((i) => i < 5 || byDay[i]!.length > 0);

  // The map opens framed on the day's walk and can be dragged about and
  // zoomed (the buttons, or a pinch). A view is the map point at its top
  // left and the zoom; `moved` is the one the student has set, until the
  // day or the classes change.
  const fit = useMemo(() => {
    const points = stops.filter((s) => s.place).map((s) => at(s.place!));
    if (points.length === 0) return { x: 0, y: 0, k: 1 };
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs) + 190;
    const h = Math.max(...ys) - Math.min(...ys) + 150;
    // Never quite the whole campus, so there is always somewhere to drag to.
    const k = Math.min(2.4, Math.max(1.25, Math.min(MAP_W / w, MAP_H / h)));
    return clampView((Math.min(...xs) + Math.max(...xs)) / 2 - MAP_W / k / 2, (Math.min(...ys) + Math.max(...ys)) / 2 - MAP_H / k / 2, k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, off, entries]);
  const [moved, setMoved] = useState<View | null>(null);
  useEffect(() => setMoved(null), [day, off, entries]);
  const view = moved ?? fit;
  const svg = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  // Zooms about a point of the map, given as fractions of what is showing.
  const zoom = (factor: number, fx = 0.5, fy = 0.5) =>
    setMoved((current) => {
      const v = current ?? fit;
      const k = Math.min(4, Math.max(1, v.k * factor));
      const cx = v.x + (MAP_W / v.k) * fx;
      const cy = v.y + (MAP_H / v.k) * fy;
      return clampView(cx - (MAP_W / k) * fx, cy - (MAP_H / k) * fy, k);
    });
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    // A trackpad pinch arrives as a wheel event with ctrl held. A plain
    // scroll is left alone so the page still scrolls past the map.
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const box = el.getBoundingClientRect();
      zoom(Math.exp(-event.deltaY * 0.01), (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  // The walk draws itself over and over: stop by stop, then it rests for
  // three seconds and starts again. `run` counts the drawings.
  const [run, setRun] = useState(0);
  const walked = `${day}|${[...off].join()}`;
  useEffect(() => {
    if (stops.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setRun((n) => n + 1), (stops.length * STEP + 3) * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walked, stops.length]);
  if (courses.length === 0) return null;

  // One marker per building, numbered with every stop made there.
  const markers = new Map<Building, { numbers: number[]; stop: Stop }>();
  stops.forEach((stop, index) => {
    if (!stop.place) return;
    const marker = markers.get(stop.place);
    if (marker) marker.numbers.push(index + 1);
    else markers.set(stop.place, { numbers: [index + 1], stop });
  });
  // The classes that meet on this day, left out or not.
  const todays = new Set(entries.filter((e) => meetingsOf(e.section).some((m) => m.day === day)).map((e) => `${e.subject} ${e.catalog}`));
  const toggle = (key: string) =>
    setOff((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  // Walks a set-aside class instead, by leaving out the ones it overlaps.
  const swapIn = (key: string) =>
    setOff((current) => {
      const next = new Set(current);
      const mine = byDay[day]!.filter((s) => `${s.entry.subject} ${s.entry.catalog}` === key);
      for (const other of byDay[day]!) {
        const otherKey = `${other.entry.subject} ${other.entry.catalog}`;
        if (otherKey !== key && mine.some((m) => m.start < other.end && other.start < m.end)) next.add(otherKey);
      }
      return next;
    });
  // The legs walked, in order, between stops that are on the map.
  const placed = stops.filter((s) => s.place);
  const legs = placed.slice(1).map((to, i) => ({ from: placed[i]!, to })).filter((leg) => leg.from.place !== leg.to.place);

  return (
    <Section first ctx="Walking times are estimates · map shapes © OpenStreetMap contributors">
      <div className="trail-pick">
        <div className="trail-days">
          {shownDays.map((i) => (
            <button key={i} className={`pill${i === day ? " is-on" : ""}`} disabled={byDay[i]!.length === 0 && i !== day} onClick={() => setChosen(i)}>
              {DAY_NAMES[i]}
            </button>
          ))}
        </div>
      </div>
      <div className="trail-classes">
        <span className="trail-hint">{DAY_NAMES[day]}’s classes, tick or untick to change the walk:</span>
        {courses.filter(([key]) => todays.has(key)).map(([key, entry]) => {
          const out = off.has(key);
          const overlapped = aside.some((a) => `${a.stop.entry.subject} ${a.stop.entry.catalog}` === key);
          return (
            <button
              key={key}
              role="checkbox"
              aria-checked={!out && !overlapped}
              className={`trail-class${out ? " is-off" : overlapped ? " is-aside" : ""}`}
              style={colorOf(entry.subject, entry.catalog)}
              title={out ? "Put back in the walk" : overlapped ? "Overlaps another class, so it is not in the walk" : "Leave out of the walk"}
              onClick={() => (overlapped ? swapIn(key) : toggle(key))}
            >
              <i className="trail-tick" />
              {courseCode(entry.subject, entry.catalog)}
              {overlapped && <em>overlaps</em>}
            </button>
          );
        })}
      </div>

      <div className="trail">
        <div className="trail-frame">
        <div className="trail-zoom">
          <button aria-label="Zoom in" disabled={view.k >= 4} onClick={() => zoom(1.5)}>
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 1.5v9M1.5 6h9" /></svg>
          </button>
          <button aria-label="Zoom out" disabled={view.k <= 1} onClick={() => zoom(1 / 1.5)}>
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1.5 6h9" /></svg>
          </button>
        </div>
        <svg
          ref={svg}
          className="trail-map"
          viewBox={`${view.x} ${view.y} ${MAP_W / view.k} ${MAP_H / view.k}`}
          role="img"
          aria-label={`Map of ${DAY_NAMES[day]}'s walk`}
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Not a pointer the page can capture; the drag still follows it over the map.
            }
          }}
          onPointerMove={(event) => {
            const from = drag.current;
            if (!from || from.id !== event.pointerId) return;
            const scale = MAP_W / view.k / event.currentTarget.getBoundingClientRect().width;
            const dx = (event.clientX - from.x) * scale;
            const dy = (event.clientY - from.y) * scale;
            drag.current = { ...from, x: event.clientX, y: event.clientY };
            setMoved((current) => {
              const v = current ?? fit;
              return clampView(v.x - dx, v.y - dy, v.k);
            });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onDoubleClick={() => setMoved(null)}
        >
          <path className="trail-water" d={WATER} />
          <path className="trail-field" d={FIELDS} />
          <path className="trail-street" d={STREETS} />
          <path className="trail-walk" d={WALKS} />
          <path className="trail-building" d={OTHER_BUILDINGS} />
          {CAMPUS.map((b) => {
            const shape = BUILDING_SHAPES[b.name];
            const marker = markers.get(b);
            const p = at(b);
            return (
              <g key={b.name} className={marker ? "trail-here" : undefined} style={marker ? colorOf(marker.stop.entry.subject, marker.stop.entry.catalog) : undefined}>
                {shape ? <path className="trail-building is-class" d={shape}><title>{b.name}</title></path> : <circle className="trail-dot" cx={p.x} cy={p.y} r={2.5} />}
                {/* A few well-known buildings are named, to place the rest by. */}
                {!marker && LANDMARKS.has(b.name) && <text className="trail-mark" x={p.x} y={p.y + 3.5} textAnchor="middle">{b.name}</text>}
              </g>
            );
          })}
          <text className="trail-lake" x={MAP_W - 34} y={MAP_H * 0.42} transform={`rotate(90 ${MAP_W - 34} ${MAP_H * 0.42})`} textAnchor="middle">Lake Michigan</text>
          {legs.map((leg, i) => {
            const a = at(leg.from.place!);
            const b = at(leg.to.place!);
            // Bowed to one side, so the way there and the way back don't overlap.
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const bow = Math.min(26, len * 0.18);
            const mx = (a.x + b.x) / 2 - ((b.y - a.y) / len) * bow;
            const my = (a.y + b.y) / 2 + ((b.x - a.x) / len) * bow;
            // Stops short of the markers at each end.
            const trim = (from: { x: number; y: number }, by: number) => {
              const d = Math.hypot(mx - from.x, my - from.y) || 1;
              return { x: from.x + ((mx - from.x) / d) * by, y: from.y + ((my - from.y) / d) * by };
            };
            const s = trim(a, 12);
            const e = trim(b, 15);
            // The break before the next class, written beside the middle of
            // the leg, on the outside of its bow, so the line stays readable.
            const gap = leg.to.start - leg.from.end;
            const tight = gap < walkMinutes(leg.from.place!, leg.to.place!);
            const nx = -(b.y - a.y) / len;
            const ny = (b.x - a.x) / len;
            const lx = (s.x + 2 * mx + e.x) / 4 + nx * 9;
            const ly = (s.y + 2 * my + e.y) / 4 + ny * 13;
            const anchor = nx > 0.35 ? "start" : nx < -0.35 ? "end" : "middle";
            // The way the leg is heading as it arrives, for its arrowhead.
            const turn = (Math.atan2(e.y - my, e.x - mx) * 180) / Math.PI;
            // Legs draw one after another, each as its stop is reached.
            const begin = (stops.indexOf(leg.to) - 1) * STEP + 0.25;
            return (
              <g key={`${walked}|${run}|${i}`}>
                <path
                  className="trail-leg"
                  d={`M${s.x} ${s.y}Q${mx} ${my} ${e.x} ${e.y}`}
                  pathLength={1}
                  style={{ animationDelay: `${begin}s` }}
                />
                <path
                  className="trail-head"
                  d="M-6 -4.5L1 0L-6 4.5"
                  transform={`translate(${e.x} ${e.y}) rotate(${turn})`}
                  style={{ animationDelay: `${begin + 0.5}s` }}
                />
                {/* A leg between next-door buildings is too short to write beside. */}
                {len >= 40 && <text className={`trail-between${tight ? " is-tight" : ""}`} x={lx} y={ly + 4} textAnchor={anchor} style={{ animationDelay: `${begin + 0.3}s` }}>
                  {gap === 0 ? "no break" : span(gap)}
                </text>}
              </g>
            );
          })}
          {[...markers.entries()].map(([place, marker]) => {
            const p = at(place);
            const label = marker.numbers.join("·");
            const left = p.x > MAP_W * 0.62;
            return (
              <g
                key={`${walked}|${run}|${place.name}`}
                className="trail-stop"
                style={{ ...colorOf(marker.stop.entry.subject, marker.stop.entry.catalog), animationDelay: `${(marker.numbers[0]! - 1) * STEP}s` }}
              >
                <circle cx={p.x} cy={p.y} r={label.length > 1 ? 13 : 11} />
                <text className="trail-num" x={p.x} y={p.y + 4} textAnchor="middle">{label}</text>
                <text className="trail-name" x={p.x + (left ? -17 : 17)} y={p.y + 4} textAnchor={left ? "end" : "start"}>{place.name}</text>
              </g>
            );
          })}
        </svg>
        </div>

        <ol className="trail-steps">
          {stops.length === 0 && <li className="note-text">No classes on {DAY_NAMES[day]}.</li>}
          {stops.map((stop, index) => {
            const next = stops[index + 1];
            const gap = next ? next.start - stop.end : 0;
            const walk = next && stop.place && next.place ? (stop.place === next.place ? 0 : walkMinutes(stop.place, next.place)) : null;
            const tight = walk !== null && gap < walk;
            return (
              <li key={`${stop.entry.key}-${stop.start}`} style={colorOf(stop.entry.subject, stop.entry.catalog)}>
                <span className="trail-n">{index + 1}</span>
                <div className="trail-what">
                  <span className="trail-time">{clock(stop.start)}–{clock(stop.end)}</span>
                  <b>{courseCode(stop.entry.subject, stop.entry.catalog)} {stop.entry.title}</b>
                  <span className="trail-room">{stop.room || "No room set"}{!stop.place && stop.room ? " · not on the map" : ""}</span>
                </div>
                {next && (
                  <p className={`trail-gap${tight ? " is-tight" : ""}`}>
                    {gap < 0 ? "Overlaps the next class" : gap === 0 ? "No break" : `${span(gap)} until the next class`}
                    {walk !== null && gap >= 0 && (walk === 0 ? " · same building" : ` · about ${walk} min walk${tight ? ", which is longer than the break" : ""}`)}
                  </p>
                )}
              </li>
            );
          })}
          {aside.map(({ stop, with: other }) => (
            <li key={`${stop.entry.key}-${stop.start}`} className="trail-clash">
              <b>Not in this walk: {courseCode(stop.entry.subject, stop.entry.catalog)}, {clock(stop.start)}–{clock(stop.end)}</b>
              <span>It overlaps {courseCode(other.entry.subject, other.entry.catalog)}, so only one of them can be walked.</span>
              <button className="link" onClick={() => swapIn(`${stop.entry.subject} ${stop.entry.catalog}`)}>
                Walk {courseCode(stop.entry.subject, stop.entry.catalog)} instead
              </button>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
