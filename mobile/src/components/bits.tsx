// Small shared pieces, each one a pattern from the CTEC analytics sheet.
import { formatCourseIdForDisplay } from "@ext/content/augmentations/class-search/catalog-format";
import { formatMeetingPattern, meetingPatternCount } from "@ext/content/augmentations/class-search/filter";
import { PAPER_CTEC_CONFIG } from "@ext/content/augmentations/paper-ctec/config";
import { pickMetricHue } from "@ext/content/augmentations/paper-ctec/widget-chips";
import { iconElement, seasonIcon, seasonOf } from "@ext/content/design/icons";
import type { CSSProperties, ReactNode } from "react";
import type { PaperSection } from "../data/catalog";
import { useSessionState } from "../platform/session-state";

export const RATING_MAX = PAPER_CTEC_CONFIG.aggregate.ratingScaleMax;

export function courseCode(subject: string, catalog: string): string {
  return formatCourseIdForDisplay(subject, catalog).replace(/_/g, " ");
}

const COMPONENT_NAMES: Record<string, string> = {
  LEC: "Lecture",
  DIS: "Discussion",
  LAB: "Lab",
  SEM: "Seminar",
  TUT: "Tutorial",
  PED: "Performance",
  STU: "Studio",
  IND: "Independent study",
  RSC: "Research",
  WKS: "Workshop",
  CLN: "Clinical",
  FLD: "Field study",
  PRA: "Practicum"
};

export function componentName(component: string): string {
  return COMPONENT_NAMES[component.toUpperCase()] ?? component;
}

export function meetingLines(section: PaperSection): string[] {
  const lines: string[] = [];
  // A time with no day (the catalog leaves out weekend days) says so.
  for (let i = 0; i < meetingPatternCount(section); i += 1)
    lines.push(formatMeetingPattern(section, i).replace(/^— /, "Day not listed, "));
  return [...new Set(lines)];
}

export function roomLines(section: PaperSection): string[] {
  return [...new Set(section.room.filter((room): room is string => Boolean(room)))];
}

export function unitsLabel(units: string): string {
  const n = Number(units);
  if (!Number.isFinite(n)) return units;
  return `${n} ${n === 1 ? "unit" : "units"}`;
}

// "COMP_SCI 111-0 or COMP_SCI 150-0" reads better as "COMP SCI 111 or COMP SCI 150".
export function tidyCourseText(text: string): string {
  return text.replace(/([A-Z])_([A-Z])/g, "$1 $2").replace(/(\d)[-_]0\b/g, "$1");
}

export function timeAgo(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

// "2027 Winter" -> "Winter ’27".
export function termShort(name: string): string {
  const season = seasonOf(name);
  const year = name.match(/\b\d{4}\b/)?.[0];
  if (!season || !year) return name;
  return `${season[0]!.toUpperCase()}${season.slice(1)} ’${year.slice(2)}`;
}

// The extension's drawn season icon for a term name.
export function SeasonIcon({ term, size = 13 }: { term: string; size?: number }) {
  const season = seasonOf(term);
  if (!season) return null;
  const svg = iconElement(document, seasonIcon(season, size)).outerHTML;
  return <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

// The colours the sheet gives a rating: a tinted chip, and a bar fill.
export function ratingStyle(value: number): CSSProperties {
  const hue = pickMetricHue(value, RATING_MAX, false);
  return {
    "--chip-bg": `hsl(${hue} 85% 80%)`,
    "--chip-fg": `hsl(${hue} 60% 16%)`,
    "--chip-bg-dark": `hsl(${hue} 55% 26%)`,
    "--chip-fg-dark": `hsl(${hue} 80% 90%)`,
    "--fill": `hsl(${hue} 78% 44%)`,
    "--fill-dark": `hsl(${hue} 70% 52%)`
  } as CSSProperties;
}

// Drawn like the extension's control icons: 16 grid, round caps.
const ICONS = {
  schedule: "M2.75 6.5h10.5M5.25 2v2.25M10.75 2v2.25M4 3.5h8a1.25 1.25 0 0 1 1.25 1.25v7.5A1.25 1.25 0 0 1 12 13.5H4a1.25 1.25 0 0 1-1.25-1.25v-7.5A1.25 1.25 0 0 1 4 3.5Z",
  left: "M10 3.5 5.5 8l4.5 4.5",
  right: "M6 3.5 10.5 8 6 12.5",
  shuffle: "M2 4.5h2.2c1.2 0 2.2.6 2.8 1.6l2 3.8c.6 1 1.6 1.6 2.8 1.6H14M12 9.5l2 2-2 2M2 11.5h2.2c.8 0 1.5-.3 2-.8M14 4.5h-2.2c-.8 0-1.5.3-2 .8M12 2.5l2 2-2 2",
  pin: "M6 2.5h4l-.5 4 2 2.5h-7l2-2.5-.5-4ZM8 9v4.5",
  cart: "M1.75 2.5h1.75l1.6 7.25h6.9l1.25-5H4.2M6 12.75v.05M11 12.75v.05",
  close: "M4 4l8 8M12 4l-8 8",
  chart: "M2.5 13.5h11M4.5 11V8M8 11V3.5M11.5 11V6"
};
export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="icon" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

// A saved rating as the sheet draws it: tinted chip, then hours a week.
export function RatingChip({ rating, hours }: { rating?: number; hours?: number }) {
  if (rating === undefined) return null;
  return (
    <>
      <span className="chip" style={ratingStyle(rating)}>{rating.toFixed(1)}</span>
      {hours !== undefined && <span className="chip-side"><b>{hours.toFixed(1)}</b> hrs</span>}
    </>
  );
}

export function Head({ code, title, meta, right }: { code?: ReactNode; title: ReactNode; meta?: ReactNode; right?: ReactNode }) {
  return (
    <header className="head">
      {code && (
        <div className="head-line">
          <span className="code">{code}</span>
          {right}
        </div>
      )}
      {right && !code ? (
        <div className="head-row">
          <h1 className="title">{title}</h1>
          {right}
        </div>
      ) : (
        <h1 className="title">{title}</h1>
      )}
      {meta && <p className="meta">{meta}</p>}
    </header>
  );
}

export function Sep() {
  return <span className="sep">·</span>;
}

export function Section(props: { title?: ReactNode; ctx?: ReactNode; first?: boolean; bare?: boolean; children: ReactNode }) {
  return (
    <section className={`sec${props.first ? " first" : ""}${props.bare ? " bare" : ""}`}>
      {(props.title || props.ctx) && (
        <div className="sec-head">
          <h2 className="sec-title">{props.title}</h2>
          {props.ctx && <span className="sec-ctx">{props.ctx}</span>}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function Row(props: {
  code?: ReactNode;
  title: ReactNode;
  about?: ReactNode;
  meta?: ReactNode;
  lead?: ReactNode;
  // Shown under the text, above the links.
  below?: ReactNode;
  // Links under the text; tapping one does not open the row.
  actions?: ReactNode;
  // The row chosen in a list that keeps its choice on screen.
  on?: boolean;
  // Set aside: still there, drawn faint.
  faint?: boolean;
  // Pointer over the row, or gone again.
  onHover?: (over: boolean) => void;
  onClick?: () => void;
}) {
  const hover = props.onHover && {
    onMouseEnter: () => props.onHover!(true),
    onMouseLeave: () => props.onHover!(false)
  };
  const cls = `row${props.on ? " is-on" : ""}${props.faint ? " is-faint" : ""}`;
  const inner = (
    <>
      {props.lead}
      <span className="row-body">
        {props.code && <span className="row-code">{props.code}</span>}
        <span className="row-title">{props.title}</span>
        {props.about && <span className="row-about">{props.about}</span>}
        {props.below}
        {props.actions && (
          <span className="row-actions" onClick={(event) => event.stopPropagation()}>{props.actions}</span>
        )}
      </span>
      {props.meta && <span className="row-meta">{props.meta}</span>}
    </>
  );
  if (!props.onClick) return <div className={cls} {...hover}>{inner}</div>;
  // A row holding its own links can't be a button itself.
  return props.actions ? (
    <div className={`${cls} tap`} role="button" tabIndex={0} onClick={props.onClick} {...hover}>{inner}</div>
  ) : (
    <button className={`${cls} tap`} onClick={props.onClick} {...hover}>{inner}</button>
  );
}

export function Mark({ status }: { status: string }) {
  const tone = status === "Open" ? "open" : status === "Closed" ? "closed" : status === "Wait List" ? "wait" : "";
  return <span className={`mark ${tone}`}>{status === "Wait List" ? "Waitlist" : status}</span>;
}

export function Spin() {
  return <span className="spin" aria-label="Loading" />;
}

// "Nothing here yet": a title, one line, at most one action.
export function Status({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="status">
      <div className="status-title">{title}</div>
      {children && <p className="status-text">{children}</p>}
      {action}
    </div>
  );
}

// Shown wherever live CAESAR data would be, when CAESAR can't be reached.
// One quiet line: saved classes are what most people came to look at.
export function OffCampusNote() {
  const { unreachable } = useSessionState();
  if (!unreachable) return null;
  return (
    <p className="note-text offline">
      <span className="offline-dot" />
      Connect to eduroam or GlobalProtect for seat and CTEC information.
    </p>
  );
}

// A steady colour for each course in a term, soft enough to sit on paper.
// Courses that would land on the same colour take the next free one, so a
// week of classes from one department still reads as separate classes.
const HUES = [212, 152, 28, 332, 268, 188, 48, 2, 104, 236];
export type ColorOf = (subject: string, catalog: string) => CSSProperties;
// `extras` are given colours after `courses`, from what is left, so adding
// or dropping them never changes a colour a course already has.
export function courseColors(
  courses: Array<{ subject: string; catalog: string }>,
  extras: Array<{ subject: string; catalog: string }> = []
): ColorOf {
  const slots = new Map<string, number>();
  const taken = new Set<number>();
  const keys = (list: Array<{ subject: string; catalog: string }>) => [...new Set(list.map((c) => `${c.subject} ${c.catalog}`))].sort();
  const first = keys(courses);
  for (const key of [...first, ...keys(extras).filter((k) => !first.includes(k))]) {
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    let slot = hash % HUES.length;
    for (let tries = 0; taken.has(slot) && tries < HUES.length; tries += 1) slot = (slot + 1) % HUES.length;
    taken.add(slot);
    slots.set(key, slot);
  }
  // theme.css turns the hue into the block's colours, light or dark.
  return (subject, catalog) => ({ "--hue": HUES[slots.get(`${subject} ${catalog}`) ?? 0] }) as CSSProperties;
}
