import { formatInstructors } from "@ext/content/augmentations/class-search/filter";
import { useEffect, useMemo, useState } from "react";
import type { PaperSection } from "../data/catalog";
import { overallRating, savedCtec } from "../data/ctec";
import { meetingsOf } from "../data/schedule";
import type { TermClass } from "../data/term-classes";
import { useWide } from "../platform/wide";
import { courseCode, ratingStyle, type ColorOf } from "./bits";

// Saturday and Sunday get a column only when a class meets then.
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type Timed = TermClass & { section: PaperSection };
// A class on the week (`entry`) or a section being considered (`ghost`).
type Block = { entry?: Timed; ghost?: PaperSection; start: number; end: number; lane: number; lanes: number };

// Lays out one day's meetings, putting overlapping ones side by side. The
// sections being considered take part, so one that overlaps a class sits
// beside it instead of over it.
function layoutDay(entries: Timed[], ghosts: PaperSection[], day: number): Block[] {
  const blocks: Block[] = [];
  for (const entry of entries) {
    for (const meeting of meetingsOf(entry.section)) {
      if (meeting.day === day) blocks.push({ entry, start: meeting.start, end: meeting.end, lane: 0, lanes: 1 });
    }
  }
  for (const ghost of ghosts) {
    for (const meeting of meetingsOf(ghost)) {
      if (meeting.day === day) blocks.push({ ghost, start: meeting.start, end: meeting.end, lane: 0, lanes: 1 });
    }
  }
  blocks.sort((a, b) => a.start - b.start || a.end - b.end);
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const close = () => {
    const lanes = Math.max(...cluster.map((b) => b.lane)) + 1;
    for (const block of cluster) block.lanes = lanes;
  };
  for (const block of blocks) {
    if (cluster.length > 0 && block.start >= clusterEnd) {
      close();
      cluster = [];
      clusterEnd = -1;
    }
    const taken = new Set(cluster.filter((b) => b.end > block.start).map((b) => b.lane));
    while (taken.has(block.lane)) block.lane += 1;
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.end);
  }
  if (cluster.length > 0) close();
  return blocks;
}

// The name a section being considered is coloured under: each one its own,
// apart from the course's colour, since each is a different choice.
export function optionKey(section: PaperSection): string {
  return `${section.catalog}#${section.component}-${section.section}`;
}

// The first instructor's last name, for a block with little room.
function lastName(section: PaperSection): string {
  const who = formatInstructors(section);
  return who === "Staff" ? "" : (who.split(", ")[0]!.split(" ").pop() ?? "");
}

function ratingOf(subject: string, catalog: string, title: string, section: PaperSection): number | undefined {
  return overallRating(savedCtec({ course_id: "", subject, catalog, title, sections: [] }, section));
}

function hourLabel(hour: number): string {
  if (hour === 12) return "12";
  return hour < 12 ? `${hour}` : `${hour - 12}`;
}

// The week as a grid of class blocks, with a line at the time right now.
// `ghosts` are sections being considered: drawn dashed over the week, red
// where they overlap a class already there.
export function WeekGrid(props: {
  entries: Timed[];
  hourPx: number;
  ghosts?: PaperSection[];
  colorOf: ColorOf;
  // The course whose blocks are picked out, when a screen has one chosen.
  selected?: { subject: string; catalog: string } | null;
  onOpen?: (entry: Timed) => void;
}) {
  const { entries, hourPx, onOpen, colorOf, selected } = props;
  const wide = useWide();
  // The short week on Search writes each block's code on one line.
  const compact = hourPx < 40;
  const ghosts = useMemo(
    () => (props.ghosts ?? []).filter((g) => !entries.some((e) => e.section.section_id === g.section_id)),
    [props.ghosts, entries]
  );
  // The time right now, redrawn each minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const { first, last, DAYS, days } = useMemo(() => {
    const all = [...entries.map((e) => e.section), ...ghosts].flatMap((section) => meetingsOf(section));
    const dayCount = Math.max(5, ...all.map((m) => m.day + 1));
    const first = all.length ? Math.min(9, Math.floor(Math.min(...all.map((m) => m.start)) / 60)) : 9;
    const last = all.length ? Math.max(17, Math.ceil(Math.max(...all.map((m) => m.end)) / 60)) : 17;
    const names = ALL_DAYS.slice(0, dayCount);
    return { first, last, DAYS: names, days: names.map((_, day) => layoutDay(entries, ghosts, day)) };
  }, [entries, ghosts]);

  // The hours stretch to take in the time right now, during the day.
  const nowHour = now.getHours();
  const daytime = nowHour >= 7 && nowHour < 22;
  const firstHour = daytime ? Math.min(first, nowHour) : first;
  const lastHour = daytime ? Math.max(last, nowHour + 1) : last;
  const today = (now.getDay() + 6) % 7;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = nowMinutes >= firstHour * 60 && nowMinutes <= lastHour * 60 ? ((nowMinutes - firstHour * 60) / 60) * hourPx : null;
  const height = (lastHour - firstHour) * hourPx;
  const place = (m: { start: number; end: number }) => ({
    top: ((m.start - firstHour * 60) / 60) * hourPx + 1,
    height: ((m.end - m.start) / 60) * hourPx - 2
  });

  return (
    <div className={`week${compact ? " compact" : ""}`} style={{ gridTemplateColumns: `26px repeat(${DAYS.length}, 1fr)` }}>
      <div />
      {DAYS.map((day, index) => (
        <div key={day} className={`week-head${index === today ? " today" : ""}`}>{day}</div>
      ))}
      <div className="week-hours" style={{ height }}>
        {Array.from({ length: lastHour - firstHour }, (_, i) => (
          <span key={i} style={{ top: i * hourPx }}>{i === 0 ? "" : hourLabel(firstHour + i)}</span>
        ))}
      </div>
      {days.map((blocks, day) => (
        <div key={day} className="week-day" style={{ height, backgroundSize: `100% ${hourPx}px` }}>
          {nowTop !== null && <i className={`week-now${day === today ? " today" : ""}`} style={{ top: nowTop }} />}
          {blocks.map((block, index) => {
            const side = {
              left: `${(block.lane / block.lanes) * 100}%`,
              // Leaves a sliver of the day's column showing either side.
              width: `calc(${100 / block.lanes}% - 5px)`
            };
            if (block.ghost) {
              const ghost = block.ghost;
              const clash = blocks.some((b) => b.entry && b.start < block.end && block.start < b.end);
              const rating = ratingOf(ghost.subject, ghost.catalog, ghost.title, ghost);
              const who = lastName(ghost);
              return (
                <span
                  key={`${ghost.section_id}-${index}`}
                  className={`week-ghost${clash ? " clash" : ""}`}
                  style={{ ...colorOf(ghost.subject, optionKey(ghost)), ...place(block), ...side }}
                >
                  <b>{courseCode(ghost.subject, ghost.catalog)}</b>
                  <span>{ghost.component} {ghost.section}{who && ` · ${who}`}</span>
                  {clash && <span className="over">Overlaps</span>}
                  {rating !== undefined && <i className="week-rate" style={ratingStyle(rating)}>{rating.toFixed(1)}</i>}
                </span>
              );
            }
            const entry = block.entry!;
            // The class's rating, where the block has room for it.
            const rating = ratingOf(entry.subject, entry.catalog, entry.title, entry.section);
            const roomy = block.lanes === 1 || block.end - block.start >= 75;
            const who = lastName(entry.section);
            // What fits: the code first, then the professor, then as much
            // of the course's name as the block has lines left for.
            const px = ((block.end - block.start) / 60) * hourPx - 2;
            const lines = compact ? Math.floor((px - 5) / 14) : wide ? Math.floor((px - 9) / 14.5) : Math.floor((px - 6) / 12);
            const rest = lines - (compact || wide ? 1 : 2);
            // With one line to spare the name takes it. The short week has
            // room for the professor beside the code.
            const whoOnTop = compact && block.lanes === 1;
            const whoFits = whoOnTop || (!compact && rest >= 2);
            const nameLines = !who || whoOnTop ? rest : Math.max(rest - 1, rest === 1 ? 1 : 0);
            const chip = rating !== undefined && roomy && (
              <i className={`week-rate${block.lanes === 1 ? " corner" : ""}`} style={ratingStyle(rating)}>{rating.toFixed(1)}</i>
            );
            const chipOnTop = compact || block.lanes === 1;
            return (
              <button
                key={`${entry.key}-${block.start}`}
                className={`week-block${selected?.subject === entry.subject && selected.catalog === entry.catalog ? " is-sel" : ""}`}
                style={{
                  ...colorOf(entry.subject, entry.catalog),
                  ...place(block),
                  ...side
                }}
                title={entry.title || undefined}
                disabled={!onOpen}
                onClick={() => onOpen?.(entry)}
              >
                <span className={`top${chipOnTop && chip ? " rated" : ""}`}>
                  <b>{entry.subject.replace(/_/g, " ")}</b>
                  <span className="num">
                    {courseCode("", entry.catalog).trim()}
                    {/* A lecture is the usual case and goes unsaid where room is short. */}
                    {(!wide || compact || entry.section.component !== "LEC") && ` ${entry.section.component}`}
                  </span>
                  {who && whoOnTop && <span className="who">{who}</span>}
                  {chipOnTop && chip}
                </span>
                {entry.title && nameLines >= 1 && (
                  <span className={`what${nameLines === 1 ? " one" : ""}`} style={{ WebkitLineClamp: nameLines }}>{entry.title}</span>
                )}
                {who && whoFits && !whoOnTop && <span className="who">{who}</span>}
                {!chipOnTop && chip}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
