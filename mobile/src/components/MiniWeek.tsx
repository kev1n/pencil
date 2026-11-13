import type { PaperSection } from "../data/catalog";
import { meetingsOf } from "../data/schedule";
import { useTermClasses, type TermClass } from "../data/term-classes";
import { courseCode } from "./bits";

// Saturday and Sunday get a column only when a class meets then.
const ALL_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// A thumbnail of the week with this section dropped in: the term's other
// classes in grey, this one in ink, and any overlap in red. Approximate on
// purpose; it answers "does this fit?" at a glance.
export function MiniWeek({ termId, section }: { termId: string; section: PaperSection }) {
  return <MiniWeekOf classes={useTermClasses(termId)} section={section} />;
}

// The same thumbnail for a screen that already has the term's classes.
// `compact` is the smaller one used inside a list row.
export function MiniWeekOf(props: { classes: TermClass[]; section: PaperSection; compact?: boolean }) {
  const { section, compact } = props;
  const HEIGHT = compact ? 40 : 76;
  const others = props.classes.filter((c) => c.section && c.section.section_id !== section.section_id);
  const mine = meetingsOf(section);
  if (mine.length === 0) return null;

  const theirs = others.flatMap((c) =>
    meetingsOf(c.section!).map((m) => ({ ...m, name: courseCode(c.subject, c.catalog) }))
  );
  const all = [...mine, ...theirs];
  const DAYS = ALL_DAYS.slice(0, Math.max(5, ...all.map((m) => m.day + 1)));
  const first = Math.min(9 * 60, ...all.map((m) => m.start));
  const last = Math.max(17 * 60, ...all.map((m) => m.end));
  const place = (m: { start: number; end: number }) => ({
    top: ((m.start - first) / (last - first)) * HEIGHT,
    height: Math.max(3, ((m.end - m.start) / (last - first)) * HEIGHT)
  });
  const hits = (m: (typeof mine)[number]) => theirs.filter((t) => t.day === m.day && t.start < m.end && m.start < t.end);
  const clashing = [...new Set(mine.flatMap((m) => hits(m).map((t) => t.name)))];

  return (
    <div className={`mini${compact ? " compact" : ""}`}>
      <div className="mini-grid" style={{ gridTemplateColumns: `repeat(${DAYS.length}, 1fr)` }}>
        {DAYS.map((label, day) => (
          <div key={day} className="mini-day">
            {!compact && <span className="mini-label">{label}</span>}
            <div className="mini-col" style={{ height: HEIGHT }}>
              {theirs.filter((m) => m.day === day).map((m, i) => (
                <span key={i} className="mini-block" style={place(m)} />
              ))}
              {mine.filter((m) => m.day === day).map((m, i) => (
                <span key={`me${i}`} className={`mini-block me${hits(m).length > 0 ? " clash" : ""}`} style={place(m)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {(!compact || clashing.length > 0) && <p className={`note-text${clashing.length > 0 ? " is-error" : ""}`}>
        {clashing.length > 0
          ? `Overlaps with ${clashing.join(" and ")}.`
          : others.length > 0
            ? "Fits with the rest of your week."
            : "Nothing else in your week yet."}
      </p>}
    </div>
  );
}
