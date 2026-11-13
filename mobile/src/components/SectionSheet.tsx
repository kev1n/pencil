import { formatDateRange, formatInstructors } from "@ext/content/augmentations/class-search/filter";
import { IonContent, IonModal } from "@ionic/react";
import { useEffect, useMemo, useState } from "react";
import { useWide } from "../platform/wide";
import type { AnalyticsModalSource } from "../data/analytics";
import {
  cachedSectionDetails,
  liveSectionFor,
  loadSectionDetails,
  resolveLiveSection,
  useCart,
  useLiveCourse,
  type SectionDetails
} from "../data/caesar";
import type { PaperSection, PaperTermCourse } from "../data/catalog";
import { ctecIdentity, loadCtec, overallRating, useCtec, type CtecState } from "../data/ctec";
import { addToSchedule, isPlanned, removeFromSchedule, usePlanned } from "../data/schedule";
import { getSessionState } from "../platform/session-state";
import { describeError } from "../platform/sign-in";
import { AnalyticsSheet } from "./AnalyticsSheet";
import { MiniWeek } from "./MiniWeek";
import { RegisterOne } from "./Register";
import { useCartAdd } from "./useCartAdd";
import {
  componentName,
  courseCode,
  Head,
  Icon,
  Mark,
  meetingLines,
  ratingStyle,
  RATING_MAX,
  roomLines,
  Section,
  Sep,
  Spin,
  tidyCourseText
} from "./bits";

export type SheetTarget = {
  termId: string;
  subject: string;
  catalog: string;
  title: string;
  section: PaperSection;
  // Launch-route development aid: actions to run as the sheet opens.
  auto?: string[];
};

// One section, as a bottom sheet: what it is, the two things a student does
// with it, then its CTECs, seats and details.
export function SectionSheet({ target, onClose }: { target: SheetTarget | null; onClose: () => void }) {
  const wide = useWide();
  return (
    <IonModal
      className="sheet"
      isOpen={target !== null}
      onDidDismiss={onClose}
      // A sheet that slides up on a phone; a dialog in a wide window.
      {...(wide ? {} : { initialBreakpoint: 0.8, breakpoints: [0, 0.8, 1] })}
    >
      {target && <SheetBody target={target} onClose={onClose} />}
    </IonModal>
  );
}

const NOT_LISTED = "CAESAR doesn’t list this section for the term.";

function SheetBody({ target, onClose }: { target: SheetTarget; onClose: () => void }) {
  const { termId, subject, catalog, title, section } = target;
  const planned = usePlanned(termId);
  const onSchedule = planned.some((p) => p.section.section_id === section.section_id);

  const live = useLiveCourse(termId, subject, catalog);
  const liveSection = liveSectionFor(live, section);
  const cart = useCart()?.byTerm[termId];
  const classNumber = liveSection?.classNumber ?? null;
  const inCart = classNumber ? Boolean(cart?.cart[classNumber]) : false;
  const enrolled = classNumber ? Boolean(cart?.enrolled[classNumber]) : false;

  const [details, setDetails] = useState<SectionDetails | null>(null);
  const [seatsBusy, setSeatsBusy] = useState(false);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const cartAdd = useCartAdd({ termId, subject, catalog });
  const cartBusy = cartAdd.busy !== null;
  const [analytics, setAnalytics] = useState<AnalyticsModalSource | null>(null);

  useEffect(() => {
    if (classNumber) setDetails((current) => current ?? cachedSectionDetails(classNumber));
  }, [classNumber]);

  const course = useMemo<PaperTermCourse>(
    () => ({ course_id: "", subject, catalog, title, sections: [] }),
    [subject, catalog, title]
  );
  const identity = useMemo(() => ctecIdentity(course, section), [course, section]);
  const ctec = useCtec(identity);
  const instructors = formatInstructors(section);

  async function checkSeats(quiet = false): Promise<void> {
    setSeatsBusy(true);
    setSeatsError(null);
    try {
      // Seats need CAESAR's class number, which comes with the live list.
      const number = classNumber ?? (await resolveLiveSection(termId, subject, catalog, section))?.classNumber;
      if (!number) throw new Error(NOT_LISTED);
      setDetails(await loadSectionDetails({ termId, subject, catalog, classNumber: number, quiet }));
    } catch (error) {
      setSeatsError(describeError(error));
    } finally {
      setSeatsBusy(false);
    }
  }

  function toggleSchedule(): void {
    if (onSchedule) {
      removeFromSchedule(termId, section.section_id);
    } else {
      addToSchedule({ termId, subject, catalog, title, section });
      onClose();
    }
  }

  const openAnalytics = () => {
    if (identity) setAnalytics({ key: identity.key, params: identity.params, titleHint: identity.titleHint, instructorName: instructors });
  };

  useEffect(() => {
    const auto = target.auto ?? [];
    // Seat counts load on their own once signed in and CAESAR is in reach.
    const session = getSessionState();
    if (auto.includes("seats") || (session.caesar === "in" && !session.unreachable)) void checkSeats(true);
    if (auto.includes("ctec") && identity) void loadCtec(identity);
    // CTECs load on their own too, unless they are already saved.
    else if (identity && ctec.status === "idle" && session.caesar === "in" && !session.unreachable) void loadCtec(identity, true);
    if (auto.includes("analytics")) setTimeout(openAnalytics, 900);
    if (auto.includes("plan") && !isPlanned(termId, section.section_id)) {
      addToSchedule({ termId, subject, catalog, title, section });
    }
    if (auto.includes("unplan")) removeFromSchedule(termId, section.section_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const facts = details?.ok ? details.facts : undefined;
  const rooms = roomLines(section);
  const times = meetingLines(section);
  const hasTags = Boolean(liveSection) || enrolled || inCart || onSchedule;

  return (
    <IonContent>
      <div className="sheet-body">
        <Head
          code={<>{courseCode(subject, catalog)}<Sep />{title}</>}
          title={section.topic || `${componentName(section.component)} ${section.section}`}
          meta={<>{section.topic && <>{componentName(section.component)} {section.section}<Sep /></>}{instructors}<Sep />{times.join(", ")}</>}
        />
        {hasTags && (
          <div className="tags" style={{ marginTop: -4, marginBottom: 12 }}>
            {liveSection && <Mark status={liveSection.status} />}
            {enrolled && <span className="tag">Enrolled</span>}
            {inCart && !enrolled && <span className="tag">In cart</span>}
            {onSchedule && <span className="tag plan">On your schedule</span>}
          </div>
        )}

        <div className="actions">
          <button className={`bc-btn ${onSchedule ? "bc-btn--secondary" : "bc-btn--primary"}`} onClick={toggleSchedule}>
            <Icon name="schedule" />{onSchedule ? "Remove" : "Add to schedule"}
          </button>
          {inCart && !enrolled && classNumber ? (
            // In the cart: the same spot now registers.
            <RegisterOne termId={termId} classNumber={classNumber} />
          ) : (
            <button className="bc-btn bc-btn--secondary" disabled={cartBusy || enrolled} onClick={() => void cartAdd.add(section, classNumber)}>
              {cartBusy ? <Spin /> : <><Icon name="cart" />{enrolled ? "Enrolled" : "Add to cart"}</>}
            </button>
          )}
        </div>
        <MiniWeek termId={termId} section={section} />

        {identity && (
          <Ctecs state={ctec} instructor={instructors} onLoad={() => void loadCtec(identity)} onOpen={openAnalytics} />
        )}

        <Seats details={details} busy={seatsBusy} error={seatsError} first={!identity} onCheck={() => void checkSeats()} />

        <Section title="Details" bare>
          <div className="fact">
            <span className="fact-label">When</span>
            <span className="fact-value">{times.map((line) => <div key={line}>{line}</div>)}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Where</span>
            <span className="fact-value">
              {rooms.length > 0 ? rooms.map((room) => <div key={room}>{room}</div>) : "To be announced"}
            </span>
          </div>
          <div className="fact">
            <span className="fact-label">Instructor</span>
            <span className="fact-value">{instructors}</span>
          </div>
          {section.start_date && section.end_date && (
            <div className="fact">
              <span className="fact-label">Dates</span>
              <span className="fact-value">{formatDateRange(section.start_date, section.end_date)}</span>
            </div>
          )}
          {(facts?.grading ?? liveSection?.grading) && (
            <div className="fact">
              <span className="fact-label">Grading</span>
              <span className="fact-value">{facts?.grading ?? liveSection?.grading}</span>
            </div>
          )}
          {([["Units", facts?.units], ["Comes with", facts?.components], ["Level", facts?.career], ["Session", facts?.session], ["Campus", facts?.campus]] as const).map(
            ([label, value]) => value && (
              <div key={label} className="fact">
                <span className="fact-label">{label}</span>
                <span className="fact-value">{value}</span>
              </div>
            )
          )}
          {section.capacity && (
            <div className="fact">
              <span className="fact-label">Class size</span>
              <span className="fact-value">{section.capacity} seats</span>
            </div>
          )}
          {details?.ok && details.classAttributes && (
            <div className="fact">
              <span className="fact-label">Counts for</span>
              <span className="fact-value">{details.classAttributes.split(/\n+/).map((line) => <div key={line}>{line}</div>)}</span>
            </div>
          )}
          {classNumber && (
            <div className="fact">
              <span className="fact-label">Class number</span>
              <span className="fact-value">{classNumber}</span>
            </div>
          )}
        </Section>

        {!details?.ok && section.enrl_req && (
          <Section title="Who can enroll">
            <p className="text">{tidyCourseText(section.enrl_req.replace(/^Enrollment Requirements:\s*/i, ""))}</p>
          </Section>
        )}

        {(section.descs ?? []).filter(([name, text]) => name !== "NO DATA" && text.trim()).map(([name, text]) => (
          <Section key={name} title={name === "Overview of class" ? "About this class" : name}>
            <More text={text} />
          </Section>
        ))}

        {(section.instructors ?? []).filter((who) => who.office_hours || who.bio || who.campus_address).map((who) => (
          <Section key={who.name} title={who.name ?? "Instructor"}>
            {who.office_hours && <div className="fact"><span className="fact-label">Office hours</span><span className="fact-value">{who.office_hours}</span></div>}
            {who.campus_address && <div className="fact"><span className="fact-label">Office</span><span className="fact-value">{who.campus_address}</span></div>}
            {who.bio && <More text={who.bio} />}
          </Section>
        ))}
      </div>

      <AnalyticsSheet source={analytics} onClose={() => setAnalytics(null)} />

      {cartAdd.picker}
    </IonContent>
  );
}

const RATINGS = [
  ["instruction", "Instruction"],
  ["course", "Course"],
  ["learned", "Learned"],
  ["challenging", "Challenge"],
  ["stimulating", "Interest"]
] as const;

// The sheet's own summary: overall rating and hours side by side, then one
// thin bar per question.
function Ctecs(props: { state: CtecState; instructor: string; onLoad: () => void; onOpen: () => void }) {
  const { state, instructor } = props;
  if (state.status !== "ready") {
    const busy = state.status === "loading";
    const text =
      state.status === "loading"
        ? state.message
        : state.status === "none"
          ? `No CTECs found for ${instructor} in this course.`
          : state.status === "no-access"
            ? "Northwestern unlocks CTECs once you’ve filled out your own evaluations."
            : state.status === "error"
              ? describeError(state.error)
              : `Ratings, hours and comments for ${instructor}.`;
    return (
      <Section
        first
        title="CTECs"
        ctx={
          busy ? <Spin /> : state.status === "none" ? (
            <button className="link" onClick={props.onOpen}>Other terms</button>
          ) : state.status === "no-access" ? null : (
            <button className="link" onClick={props.onLoad}>{state.status === "error" ? "Try again" : "Load"}</button>
          )
        }
      >
        <p className={`note-text${state.status === "error" ? " is-error" : ""}`}>{text}</p>
      </Section>
    );
  }

  const { metrics, aggregateParsedCount, lens } = state.aggregate;
  const overall = overallRating(state.aggregate);
  const hours = metrics.hours?.mean;
  const scope = lens === "course" ? "All instructors" : lens === "instructor" ? `${instructor}, all courses` : instructor;

  return (
    <>
      <div className="sum tap" role="button" tabIndex={0} onClick={props.onOpen} style={{ borderTop: "1px solid var(--bc-color-border)", paddingTop: 12 }}>
        <div className="sum-cell">
          <div className="sum-big">
            <span className={`sum-chip${overall === undefined ? " is-empty" : ""}`} style={overall === undefined ? undefined : ratingStyle(overall)}>
              {overall === undefined ? "n/a" : overall.toFixed(1)}
            </span>
            <span className="sum-unit">/ {RATING_MAX}</span>
          </div>
          <div className="sum-label">Overall rating</div>
        </div>
        <div className="sum-cell">
          <div className="sum-big">
            <span className="sum-num">{hours === undefined ? "n/a" : hours.toFixed(1)}</span>
            <span className="sum-unit">hrs</span>
          </div>
          <div className="sum-label">Work per week</div>
        </div>
      </div>
      <Section
        title="Ratings"
        ctx={<>{scope}<Sep />{aggregateParsedCount} {aggregateParsedCount === 1 ? "term" : "terms"}</>}
      >
        {RATINGS.map(([kind, label]) => {
          const value = metrics[kind]?.mean;
          return (
            <div key={kind} className="rate">
              <span className="rate-label">{label}</span>
              <span className="rate-bar">
                {value !== undefined && (
                  <span
                    className="rate-fill"
                    style={{ ...ratingStyle(value), width: `${Math.max(0, Math.min(100, ((value - 1) / (RATING_MAX - 1)) * 100))}%` }}
                  />
                )}
              </span>
              <span className={`rate-val${value === undefined ? " is-empty" : ""}`}>{value === undefined ? "n/a" : value.toFixed(1)}</span>
            </div>
          );
        })}
        {/* The way into the full CTEC view, drawn as the button it is. */}
        <button className="ctec-more" onClick={props.onOpen}>
          <Icon name="chart" />
          <span>
            <b>See the full breakdown</b>
            <small>Every term, the hours chart and what students wrote</small>
          </span>
          <Icon name="right" />
        </button>
      </Section>
    </>
  );
}

function Seats(props: { details: SectionDetails | null; busy: boolean; error: string | null; first: boolean; onCheck: () => void }) {
  const { details, busy, error } = props;
  const action = busy ? <Spin /> : <button className="link" onClick={props.onCheck}>{details?.ok ? "Refresh" : "Check"}</button>;

  if (!details?.ok) {
    return (
      <Section first={props.first} title="Seats" ctx={action}>
        <p className={`note-text${error ? " is-error" : ""}`}>
          {error ?? (details ? details.error : "Open seats, waitlist and notes, live from CAESAR.")}
        </p>
      </Section>
    );
  }

  const capacity = Number(details.classCapacity);
  const taken = Number(details.enrollmentTotal);
  const open = details.availableSeats ?? (Number.isFinite(capacity - taken) ? String(capacity - taken) : "–");
  const filled = capacity > 0 ? Math.min(100, Math.round((taken / capacity) * 100)) : 0;
  const waiting = Number(details.waitListTotal);
  return (
    <Section first={props.first} title={details.isCombinedSection ? "Seats, combined section" : "Seats"} ctx={action}>
      <div className="rate" style={{ gridTemplateColumns: "92px 1fr auto" }}>
        <span className="rate-label">{open} open</span>
        <span className="rate-bar"><span className="rate-fill ink" style={{ width: `${filled}%` }} /></span>
        <span className="rate-val" style={{ fontWeight: 400, color: "var(--bc-color-text-muted)" }}>
          {details.enrollmentTotal ?? "–"} of {details.classCapacity ?? "–"}
        </span>
      </div>
      {waiting > 0 && <p className="note-text">{waiting} on the waitlist</p>}
      {details.enrollmentRequirements && <LongText label="Requirements" text={details.enrollmentRequirements} />}
      {details.classNotes && <LongText label="Notes" text={details.classNotes} />}
    </Section>
  );
}

function LongText({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const tidy = tidyCourseText(text);
  return (
    <div className="fact" style={{ marginTop: 6 }}>
      <span className="fact-label">{label}</span>
      <span className="fact-value">
        <span className={`text${open ? "" : " clamp"}`} style={{ fontSize: 14 }}>{tidy}</span>
        {tidy.length > 120 && (
          <button className="link quiet" onClick={() => setOpen((v) => !v)}>{open ? "Show less" : "Show all"}</button>
        )}
      </span>
    </div>
  );
}

function More({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const tidy = text.trim();
  return (
    <>
      <p className={`text${open ? "" : " clamp"}`}>{tidy}</p>
      {tidy.length > 180 && (
        <button className="link quiet" onClick={() => setOpen((v) => !v)}>{open ? "Show less" : "Read more"}</button>
      )}
    </>
  );
}
