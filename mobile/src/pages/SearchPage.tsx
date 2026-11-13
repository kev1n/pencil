import { formatInstructors } from "@ext/content/augmentations/class-search/filter";
import { IonContent, IonHeader, IonInfiniteScroll, IonInfiniteScrollContent, IonPage, useIonRouter } from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import type { RouteComponentProps } from "react-router-dom";
import { courseCode, meetingLines, RatingChip, Row, Section, Sep, Spin, Status, termShort } from "../components/bits";
import { TermPills } from "../components/TermPills";
import { loadTerms, searchCourses, selectedTerm, termSubjects, warmCatalog, type ResultRow, type Terms } from "../data/catalog";
import { overallRating, savedCtec, useCtecChanges } from "../data/ctec";
import { useStore } from "../data/store";
import { describeError } from "../platform/sign-in";
import type { ColorOf } from "../components/bits";
import { useCourseHistory } from "../data/caesar";
import { loadEligibility } from "../data/prereqs";
import { device } from "../platform/native";

const PAGE = 40;
const RECENT_KEY = "pencil.recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function rememberSearch(query: string): void {
  const clean = query.trim();
  if (!clean) return;
  const next = [clean, ...readRecent().filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function instructorSummary(row: ResultRow): string {
  const names = new Set<string>();
  for (const section of row.sections) {
    const who = formatInstructors(section);
    if (who !== "Staff") for (const name of who.split(", ")) names.add(name.split(" ").slice(-1)[0]);
  }
  const list = [...names].slice(0, 3).join(", ");
  return list ? `${list}${names.size > 3 ? "…" : ""}` : "";
}

// When a course meets: the one time, both times, or how many to pick from.
function timeSummary(row: ResultRow): string {
  const first = row.sections[0]?.component;
  const times = new Set(row.sections.filter((s) => s.component === first).flatMap((s) => meetingLines(s)));
  if (times.size === 0) return "";
  if (times.size <= 2) return [...times].join(" or ");
  return `${times.size} times`;
}

type Subject = { symbol: string; name: string; count: number };

export type Picked = { subject: string; catalog: string };

// The search field and its results. A phone shows them as the Search screen;
// a wide window puts them down the left of Schedule, where `onPick` opens a
// course beside the week instead of on a screen of its own.
export function useSearch(opts: {
  initialQuery?: string;
  picked?: Picked | null;
  onPick?: (course: Picked) => void;
  // The colour of a course that is already on the week.
  onWeek?: (subject: string, catalog: string) => ReturnType<ColorOf> | undefined;
}) {
  const inline = Boolean(opts.onPick);
  const { picked } = opts;
  const termId = useStore(selectedTerm);
  const router = useIonRouter();
  const [terms, setTerms] = useState<Terms | null>(null);
  const [query, setQuery] = useState(opts.initialQuery ?? "");
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState(readRecent);
  const run = useRef(0);
  // With a course history saved, each result says whether its prerequisites are met.
  const history = useCourseHistory();
  const [eligibility, setEligibility] = useState<Awaited<ReturnType<typeof loadEligibility>> | null>(null);
  useEffect(() => {
    if (!history) {
      setEligibility(null);
      return;
    }
    let current = true;
    void loadEligibility().then((check) => {
      if (current) setEligibility(() => check);
    }, () => undefined);
    return () => {
      current = false;
    };
  }, [history]);
  useCtecChanges();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    loadTerms().then(setTerms, (e) => setError(describeError(e)));
  }, []);

  // The catalog downloads once, then lives on the phone.
  useEffect(() => {
    if (!termId) return;
    setReady(false);
    setError(null);
    warmCatalog(termId)
      .then(() => termSubjects(termId))
      .then((list) => {
        setSubjects(list);
        setReady(true);
      }, (e) => setError(describeError(e)));
  }, [termId]);

  useEffect(() => {
    if (!termId || !ready) return;
    const mine = ++run.current;
    if (!query.trim()) {
      setRows(null);
      return;
    }
    const timer = setTimeout(() => {
      searchCourses(termId, query).then(
        (found) => {
          if (mine !== run.current) return;
          setRows(found);
          setShown(PAGE);
        },
        (e) => setError(describeError(e))
      );
    }, 140);
    return () => clearTimeout(timer);
  }, [termId, query, ready]);

  const termName = terms?.terms.find((t) => t.id === termId)?.name ?? "";

  const top = (
        <div className="search-top">
          {!inline && <h1 className="title">Search</h1>}
          <label className={`field${query ? " has-value" : ""}`}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              type="search"
              value={query}
              placeholder={termName ? `Search ${termShort(termName)} classes` : "Search classes"}
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              onChange={(event) => setQuery(event.target.value)}
              onBlur={() => {
                rememberSearch(query);
                setRecent(readRecent());
              }}
            />
            {query && (
              <button className="field-clear" aria-label="Clear" onClick={() => setQuery("")}>
                <svg width="11" height="11" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            )}
          </label>
          <TermPills terms={terms} />
        </div>
  );
  const list = (
        <div className="screen">
          {error && (
            <Section bare>
              <Status title="Couldn’t load the catalog">{error}</Status>
            </Section>
          )}

          {!error && !ready && (
            <Section bare>
              <Status title={<><Spin /> Getting the {termName || "course"} catalog</>}>
                This happens once; after that it’s saved on your {device}.
              </Status>
            </Section>
          )}

          {ready && rows === null && (
            <>
              {recent.length > 0 && (
                <Section title="Recent">
                  <div className="topic-row">
                    {recent.map((q) => (
                      <button key={q} className="topic" onClick={() => setQuery(q)}>{q}</button>
                    ))}
                  </div>
                </Section>
              )}
              <Section title="Subjects" ctx="Or type a course, title or topic" bare>
                <div className="rows">
                  {subjects.map((subject) => (
                    <Row
                      key={subject.symbol}
                      title={subject.name}
                      meta={`${subject.symbol.replace(/_/g, " ")} · ${subject.count}`}
                      onClick={() => setQuery(`${subject.symbol.replace(/_/g, " ").toLowerCase()} `)}
                    />
                  ))}
                </div>
              </Section>
            </>
          )}

          {ready && rows !== null && rows.length === 0 && (
            <Section bare>
              <Status title="Nothing found">No {termName} course matches “{query.trim()}”.</Status>
            </Section>
          )}

          {ready && rows !== null && rows.length > 0 && (
            <div className="rows">
              {rows.slice(0, shown).map((row) => {
                const who = instructorSummary(row);
                const when = timeSummary(row);
                const count = row.sections.length;
                // Saved ratings, one per instructor. With several the row shows
                // their spread, since no single number speaks for the course.
                const saved = new Map<string, { rating: number; hours?: number }>();
                for (const section of row.sections) {
                  const ctec = savedCtec(row.course, section);
                  const rating = overallRating(ctec);
                  if (rating !== undefined) saved.set(formatInstructors(section), { rating, hours: ctec?.metrics.hours?.mean });
                }
                const ratings = [...saved.values()].sort((a, b) => a.rating - b.rating);
                const low = ratings[0];
                const high = ratings[ratings.length - 1];
                return (
                  <Row
                    key={row.course.course_id + row.course.catalog}
                    on={picked?.subject === row.course.subject && picked.catalog === row.course.catalog}
                    // In its schedule colour when it is already on your week.
                    lead={(() => {
                      const color = opts.onWeek?.(row.course.subject, row.course.catalog);
                      return color ? <span className="swatch" style={color} /> : undefined;
                    })()}
                    code={(() => {
                      const state = eligibility?.(row.course.subject, row.course.catalog);
                      return (
                        <>
                          {courseCode(row.course.subject, row.course.catalog)}
                          {(state === "ready" || state === "in-progress") && <span className="prereq ok">Prereqs met</span>}
                          {state === "blocked" && <span className="prereq no">Missing prereqs</span>}
                        </>
                      );
                    })()}
                    title={row.course.title}
                    about={who || when ? <>{when}{who && when && <Sep />}{who}</> : undefined}
                    meta={
                      <>
                        {ratings.length === 1 && <RatingChip rating={low!.rating} hours={low!.hours} />}
                        {ratings.length > 1 && (
                          <span className="chip-range">
                            <RatingChip rating={low!.rating} />–<RatingChip rating={high!.rating} />
                          </span>
                        )}
                        <span>{count} {count === 1 ? "section" : "sections"}</span>
                      </>
                    }
                    onClick={() => {
                      rememberSearch(query);
                      if (opts.onPick) opts.onPick({ subject: row.course.subject, catalog: row.course.catalog });
                      else router.push(
                        `/search/course/${termId}/${encodeURIComponent(row.course.subject)}/${encodeURIComponent(row.course.catalog)}`
                      );
                    }}
                  />
                );
              })}
            </div>
          )}
          {!inline && (
            <IonInfiniteScroll
              disabled={!rows || shown >= rows.length}
              onIonInfinite={(event) => {
                setShown((n) => n + PAGE);
                void event.target.complete();
              }}
            >
              <IonInfiniteScrollContent />
            </IonInfiniteScroll>
          )}
        </div>
  );

  // The side list has no infinite-scroll element: it asks for more near its end.
  const onScroll = (event: { currentTarget: HTMLElement }) => {
    const el = event.currentTarget;
    if (rows && shown < rows.length && el.scrollHeight - el.scrollTop - el.clientHeight < 400) setShown((n) => n + PAGE);
  };
  return { top, list, onScroll, termName };
}

export function SearchPage({ location }: RouteComponentProps) {
  // `?q=` pre-fills the search; used by the launch-route development aid.
  const search = useSearch({ initialQuery: new URLSearchParams(location.search).get("q") ?? "" });
  return (
    <IonPage>
      <IonHeader>{search.top}</IonHeader>
      <IonContent>{search.list}</IonContent>
    </IonPage>
  );
}
