import type { CSSProperties } from "react";
import { formatInstructors } from "@ext/content/augmentations/class-search/filter";
import { PAPER_DISTRO_LABELS } from "@ext/content/augmentations/class-search/types";
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonToolbar } from "@ionic/react";
import { useEffect, useMemo, useState } from "react";
import type { RouteComponentProps } from "react-router-dom";
import {
  componentName,
  courseCode,
  Head,
  Icon,
  RatingChip,
  Mark,
  meetingLines,
  OffCampusNote,
  roomLines,
  Row,
  Section,
  Sep,
  Spin,
  Status,
  timeAgo,
  unitsLabel } from "../components/bits";
import { RatingsPrompt } from "../components/RatingsPrompt";
import { PrereqTree } from "../components/PrereqTree";
import { MiniWeekOf } from "../components/MiniWeek";
import { useCartAdd } from "../components/useCartAdd";
import { SectionSheet, type SheetTarget } from "../components/SectionSheet";
import { RegisterOne } from "../components/Register";
import { liveSectionFor, loadLiveCourse, useCart, useLiveCourse } from "../data/caesar";
import { loadCourse, loadTerms, selectedTerm, type CourseDetail, type PaperSection } from "../data/catalog";
import { addToSchedule, removeFromSchedule, usePlannedKeys } from "../data/schedule";
import { ctecIdentity, ctecStalled, loadCtec, overallRating, savedCtec, useCtecChanges, type CtecState } from "../data/ctec";
import type { AnalyticsModalSource } from "../data/analytics";
import { AnalyticsSheet } from "../components/AnalyticsSheet";
import { useStore } from "../data/store";
import { useTermClasses } from "../data/term-classes";
import { useSessionState } from "../platform/session-state";
import { describeError } from "../platform/sign-in";

type Params = { termId: string; subject: string; catalog: string };

const COMPONENT_ORDER = ["LEC", "SEM", "DIS", "LAB"];

function groupByComponent(sections: PaperSection[]): Array<[string, PaperSection[]]> {
  const groups = new Map<string, PaperSection[]>();
  for (const section of sections) {
    const list = groups.get(section.component) ?? [];
    list.push(section);
    groups.set(section.component, list);
  }
  const rank = (c: string) => (COMPONENT_ORDER.includes(c) ? COMPONENT_ORDER.indexOf(c) : COMPONENT_ORDER.length);
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([component, list]) => [
      component,
      list.sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }))
    ]);
}

export function CoursePage({ match, location }: RouteComponentProps<Params>) {
  // "_" stands for the term being planned; used by the launch-route aid.
  const planning = useStore(selectedTerm);
  const termId = match.params.termId === "_" ? (planning ?? "") : match.params.termId;
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/search" text="Search" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CourseView
          termId={termId}
          subject={decodeURIComponent(match.params.subject)}
          catalog={decodeURIComponent(match.params.catalog)}
          search={location.search}
        />
      </IonContent>
    </IonPage>
  );
}

// One course: its sections, description and prerequisites. A page of its
// own on a phone; the right-hand side of Search in a wide window.
export function CourseView({ termId, subject, catalog, search = "", onPreview, optionColor }: {
  termId: string;
  subject: string;
  catalog: string;
  search?: string;
  // Tells a week shown beside this view which sections to draw on it: the
  // one under the pointer, otherwise the course's first kind of section.
  onPreview?: (sections: PaperSection[]) => void;
  // The colour that week draws a section in, shown beside its row.
  optionColor?: (section: PaperSection) => CSSProperties | undefined;
}) {

  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [expanded, setExpanded] = useState(false);

  const live = useLiveCourse(termId, subject, catalog);
  const cart = useCart()?.byTerm[termId];
  const planned = usePlannedKeys();
  const session = useSessionState();
  const cartAdd = useCartAdd({ termId, subject, catalog });
  const termClasses = useTermClasses(termId);
  const ctecStates = useCtecChanges() as Record<string, CtecState>;
  // The full CTEC view (every term, hours, comments), opened from a rating.
  const [analytics, setAnalytics] = useState<AnalyticsModalSource | null>(null);

  // Ratings load on their own for the first few instructors, one at a time,
  // and never open a sign-in page. When the CTEC site wants a fresh sign-in
  // the loading stops and `stalled` holds the class to retry, behind a link.
  const [stalled, setStalled] = useState<NonNullable<ReturnType<typeof ctecIdentity>> | null>(null);
  const [ratingRuns, setRatingRuns] = useState(0);
  useEffect(() => {
    const course = detail?.course;
    if (!course || session.caesar !== "in" || session.unreachable) return;
    let current = true;
    const wanted = new Map<string, NonNullable<ReturnType<typeof ctecIdentity>>>();
    for (const section of course.sections) {
      const identity = ctecIdentity(course, section);
      if (identity && !savedCtec(course, section)) wanted.set(identity.key, identity);
    }
    void (async () => {
      for (const identity of [...wanted.values()].slice(0, 3)) {
        if (!current) return;
        await loadCtec(identity, true);
        if (current && ctecStalled(identity)) {
          setStalled(identity);
          return;
        }
      }
    })();
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, session.caesar, session.unreachable, ratingRuns]);

  // Open seats load on their own once signed in and CAESAR is in reach.
  useEffect(() => {
    if (termId && session.caesar === "in" && !session.unreachable && !live) void loadLiveCourse(termId, subject, catalog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId, subject, catalog, session.caesar, session.unreachable]);

  useEffect(() => {
    if (!termId) {
      void loadTerms();
      return;
    }
    loadCourse(termId, subject, catalog).then((loaded) => {
      setDetail(loaded);
      // `?sheet=LEC-1&do=check,seats` opens a section and runs actions; launch-route aid.
      const params = new URLSearchParams(search);
      const wanted = params.get("sheet");
      const auto = (params.get("do") ?? "").split(",").filter(Boolean);
      if (auto.includes("check")) void loadLiveCourse(termId, subject, catalog);
      const section = loaded.course?.sections.find((s) => `${s.component}-${s.section}` === wanted);
      if (section) setSheet({ termId, subject, catalog, title: loaded.course!.title, section, auto });
    }, (e) => setError(describeError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId, subject, catalog]);

  const groups = useMemo(() => groupByComponent([...(detail?.course?.sections ?? [])]), [detail]);
  const mainSections = groups[0]?.[1];
  useEffect(() => {
    onPreview?.(mainSections ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainSections]);
  const title = detail?.course?.title ?? detail?.info?.name ?? "";
  const info = detail?.info;
  const distros = (info?.distros ?? "").split("").map((d) => PAPER_DISTRO_LABELS[d]).filter(Boolean);
  const metaParts = [info?.units ? unitsLabel(info.units) : null, ...distros, info?.repeatable ? "Repeatable" : null].filter(
    (part): part is string => Boolean(part)
  );

  const seats =
    live?.status === "loading" ? (
      <Spin />
    ) : live?.status === "ready" ? (
      <>
        {!live.group && <>CAESAR sent no seat info<Sep /></>}
        <button className="link" onClick={() => void loadLiveCourse(termId, subject, catalog)}>
          {live.group ? "Refresh seats" : "Refresh"}
        </button>
      </>
    ) : (
      <button className="link" onClick={() => void loadLiveCourse(termId, subject, catalog)}>
        {session.caesar === "in" ? "Check open seats" : "Sign in for open seats"}
      </button>
    );

  return (
    <>
        <div className="screen">
          {error && <Status title="Couldn’t load this course">{error}</Status>}
          {!detail && !error && <Status title={<><Spin /> Loading</>} />}

          {detail && (
            <>
              <Head
                code={courseCode(subject, catalog)}
                title={title}
                meta={metaParts.map((part, i) => <span key={part}>{i > 0 && <Sep />}{part}</span>)}
              />

              <OffCampusNote />

              {stalled && (
                <RatingsPrompt
                  identity={stalled}
                  onDone={() => {
                    setStalled(null);
                    setRatingRuns((n) => n + 1);
                  }}
                />
              )}

              {!detail.course && (
                <Section first bare>
                  <Status title="Not offered this term" />
                </Section>
              )}

              {groups.map(([component, sections], index) => (
                <Section
                  key={component}
                  first={index === 0}
                  title={`${componentName(component)}${sections.length > 1 ? "s" : ""}`}
                  ctx={index === 0 ? seats : undefined}
                >
                  {index === 0 && live?.status === "error" && (
                    <p className="note-text is-error" style={{ marginBottom: 6 }}>{describeError(live.error)}</p>
                  )}
                  <div className="rows">
                    {sections.map((section) => {
                      const liveSection = liveSectionFor(live, section);
                      const number = liveSection?.classNumber;
                      const enrolled = number ? Boolean(cart?.enrolled[number]) : false;
                      const inCart = number ? Boolean(cart?.cart[number]) : false;
                      const onSchedule = `${termId}|${section.section_id}` in planned;
                      const rooms = roomLines(section);
                      const togglePlan = () =>
                        onSchedule
                          ? removeFromSchedule(termId, section.section_id)
                          : addToSchedule({ termId, subject, catalog, title, section });
                      const ctec = detail.course ? savedCtec(detail.course, section) : null;
                      const identity = detail.course ? ctecIdentity(detail.course, section) : null;
                      const ctecState = identity ? ctecStates[identity.key]?.status : undefined;
                      const openCtecs = () =>
                        identity &&
                        setAnalytics({
                          key: identity.key,
                          params: identity.params,
                          titleHint: identity.titleHint,
                          instructorName: formatInstructors(section)
                        });
                      return (
                        <Row
                          key={section.section_id}
                          lead={(() => {
                            const color = optionColor?.(section);
                            return color ? <span className="swatch" style={color} /> : undefined;
                          })()}
                          onHover={onPreview && ((over) => onPreview(over ? [section] : (mainSections ?? [])))}
                          // The week beside this view already shows the fit.
                          below={onPreview ? undefined : <MiniWeekOf classes={termClasses} section={section} compact />}
                          code={<>{componentName(section.component)} {section.section}{section.topic ? <><Sep />{section.topic}</> : null}</>}
                          title={formatInstructors(section)}
                          about={<>{meetingLines(section).join(", ")}{rooms.length > 0 && <><Sep />{rooms.join(", ")}</>}</>}
                          meta={
                            (liveSection || section.capacity || enrolled || inCart || onSchedule || onPreview) && (
                              <>
                                {enrolled && <span className="tag">Enrolled</span>}
                                {inCart && !enrolled && <span className="tag">In cart</span>}
                                {onSchedule && <span className="tag plan">Planned</span>}
                                {/* When the open/closed mark was read from CAESAR is on the section's own sheet. */}
                                {liveSection && <Mark status={liveSection.status} />}
                                {section.capacity && <span>{section.capacity} seats</span>}
                                {onPreview && <span className="row-hint">{onSchedule ? "Click to remove" : "Click to add"}</span>}
                              </>
                            )
                          }
                          actions={
                            <>
                              {/* The one button on the card: the rating, opening the full CTEC view. */}
                              {identity && ctec ? (
                                <button className="ctec-btn" onClick={openCtecs}>
                                  <RatingChip rating={overallRating(ctec)} hours={ctec.metrics.hours?.mean} />
                                  <span>See CTECs</span>
                                  <Icon name="right" />
                                </button>
                              ) : identity && ctecState === "none" ? (
                                <button className="ctec-btn is-none" onClick={openCtecs}>
                                  <span>No CTECs yet</span>
                                  <Icon name="right" />
                                </button>
                              ) : ctecState === "loading" ? (
                                <span className="ctec-btn is-busy"><Spin /> Loading ratings</span>
                              ) : null}
                              <span className="row-more">
                                {onPreview ? (
                                  // Beside the week, clicking the row itself plans the section.
                                  <button className="link quiet" onClick={() => setSheet({ termId, subject, catalog, title, section })}>
                                    Details
                                  </button>
                                ) : (
                                  <button className="link quiet" onClick={togglePlan}>
                                    <Icon name="schedule" />{onSchedule ? "Remove from schedule" : "Add to schedule"}
                                  </button>
                                )}
                                {enrolled ? null : inCart && number ? (
                                  <RegisterOne termId={termId} classNumber={number} link />
                                ) : cartAdd.busy === section.section_id ? (
                                  <Spin />
                                ) : (
                                  <button
                                    className="link quiet"
                                    disabled={cartAdd.busy !== null}
                                    onClick={() => void cartAdd.add(section, number ?? null)}
                                  >
                                    <Icon name="cart" />Add to cart
                                  </button>
                                )}
                              </span>
                            </>
                          }
                          on={Boolean(onPreview) && onSchedule}
                          onClick={onPreview ? togglePlan : () => setSheet({ termId, subject, catalog, title, section })}
                        />
                      );
                    })}
                  </div>
                </Section>
              ))}

              {info?.description && (
                <Section title="About" first={groups.length === 0}>
                  <p className={`text${expanded ? "" : " clamp"}`}>{info.description}</p>
                  {info.description.length > 180 && (
                    <button className="link quiet" onClick={() => setExpanded((v) => !v)}>
                      {expanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </Section>
              )}

              <PrereqTree
                subject={subject}
                catalog={catalog}
                raw={detail.course?.sections.find((sec) => sec.enrl_req)?.enrl_req ?? info?.prereqs}
                title={title}
                meta={metaParts.join(" · ")}
                about={info?.description}
                facts={
                  mainSections && mainSections.length > 0 ? (
                    <ul className="tree-facts">
                      {mainSections.slice(0, 4).map((section) => {
                        const liveSection = liveSectionFor(live, section);
                        const ctec = detail.course ? savedCtec(detail.course, section) : null;
                        return (
                          <li key={section.section_id}>
                            <b>{componentName(section.component)} {section.section}</b>
                            <span>{formatInstructors(section)}</span>
                            <span>{meetingLines(section).join(", ")}</span>
                            <RatingChip rating={overallRating(ctec)} hours={ctec?.metrics.hours?.mean} />
                            {liveSection && <Mark status={liveSection.status} />}
                            {section.capacity && <span>{section.capacity} seats</span>}
                          </li>
                        );
                      })}
                      {mainSections.length > 4 && <li>and {mainSections.length - 4} more</li>}
                    </ul>
                  ) : undefined
                }
              />
            </>
          )}
        </div>
        <SectionSheet target={sheet} onClose={() => setSheet(null)} />
        <AnalyticsSheet source={analytics} onClose={() => setAnalytics(null)} />
        {cartAdd.picker}
    </>
  );
}
