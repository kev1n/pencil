import { useSync } from "../data/sync";
import { formatInstructors } from "@ext/content/augmentations/class-search/filter";
import { IonContent, IonPage, IonRefresher, IonRefresherContent, useIonToast } from "@ionic/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { componentName, courseCode, Head, Icon, meetingLines, OffCampusNote, ratingStyle, RatingChip, Row, Section, Sep, Spin, Status, courseColors, timeAgo } from "../components/bits";
import { RatingsPrompt } from "../components/RatingsPrompt";
import { RegDates } from "../components/RegDates";
import { SectionSheet, type SheetTarget } from "../components/SectionSheet";
import { TermPills } from "../components/TermPills";
import { optionKey, WeekGrid, type Timed } from "../components/WeekGrid";
import { loadSectionDetails, refreshCart, spendCredit, useCart, useSavedSeats } from "../data/caesar";
import { loadTerms, selectedTerm, type PaperSection, type Terms } from "../data/catalog";
import {
  buildCombos,
  DEFAULT_SORT_MODE,
  loadCredits,
  loadSortMode,
  rateCombo,
  saveCredits,
  saveSortMode,
  SORT_MODE_LABELS,
  type Combos,
  type CreditsPrefs,
  type SortMode
} from "../data/combos";
import { termShort } from "../components/bits";
import { ctecIdentity, ctecStalled, loadCtec, overallRating, savedCtec, useCtecChanges } from "../data/ctec";
import { meetingsOf } from "../data/schedule";
import { useStore } from "../data/store";
import { useTermClasses, type ClassState, type TermClass } from "../data/term-classes";
import { useSessionState } from "../platform/session-state";
import { useWide } from "../platform/wide";
import { describeError, signInToCaesar } from "../platform/sign-in";
import { device } from "../platform/native";
import { CourseView } from "./CoursePage";
import { useSearch, type Picked } from "./SearchPage";

const GROUPS: Array<[ClassState, string]> = [
  ["enrolled", "Enrolled"],
  ["cart", "In your CAESAR cart"],
  ["planned", "Planned"]
];

export function SchedulePage() {
  const syncing = useSync().secret !== null;
  const wide = useWide();
  const termId = useStore(selectedTerm);
  const classes = useTermClasses(termId);
  const session = useSessionState();
  const cartTerm = useCart()?.byTerm[termId ?? ""];
  const [toast] = useIonToast();
  const [terms, setTerms] = useState<Terms | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const signedIn = session.caesar === "in";

  useEffect(() => {
    loadTerms().then(setTerms, () => undefined);
  }, []);

  const seatsOf = useSavedSeats();

  // Ratings for the classes on the schedule load on their own, one at a
  // time, within the same request budget as everything else. They never
  // open a sign-in page.
  // Set when the CTEC site wants a fresh sign-in; holds the class to retry.
  const [stalled, setStalled] = useState<NonNullable<ReturnType<typeof ctecIdentity>> | null>(null);
  const [ratingRuns, setRatingRuns] = useState(0);
  const unrated = classes.filter((c) => c.section).map((c) => c.key).join("|");
  useEffect(() => {
    if (!signedIn || session.unreachable) return;
    let current = true;
    void (async () => {
      for (const entry of classes) {
        if (!current || !entry.section) continue;
        const course = { course_id: "", subject: entry.subject, catalog: entry.catalog, title: entry.title, sections: [] };
        const identity = ctecIdentity(course, entry.section);
        if (!identity || savedCtec(course, entry.section)) continue;
        try {
          spendCredit("app-ctec");
        } catch {
          return;
        }
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
  }, [unrated, signedIn, session.unreachable, ratingRuns]);
  // How far a "Check seats" run has got, as "3 of 11".
  const [checking, setChecking] = useState<string | null>(null);

  // Asks CAESAR for the seat count of every class in the cart, one by one.
  async function checkSeats(): Promise<void> {
    const cart = classes.filter((c) => c.state === "cart" && c.classNumber);
    try {
      for (const [index, entry] of cart.entries()) {
        setChecking(`${index + 1} of ${cart.length}`);
        await loadSectionDetails({ termId: termId!, subject: entry.subject, catalog: entry.catalog, classNumber: entry.classNumber! });
      }
    } catch (error) {
      void toast({ message: describeError(error), duration: 4000, position: "top" });
    } finally {
      setChecking(null);
    }
  }

  // Launch-route development aid: `?show=cart` scrolls to the cart list and
  // `&do=seats` runs the seat check.
  const cartCount = classes.filter((c) => c.state === "cart").length;
  useEffect(() => {
    const params = (window as unknown as { launchParams?: URLSearchParams }).launchParams;
    if (cartCount === 0 || params?.get("show") !== "cart") return;
    params.delete("show");
    setTimeout(() => document.querySelector("[data-group=cart]")?.scrollIntoView(), 300);
    if (params.get("do") === "seats") void checkSeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartCount]);

  async function refresh(): Promise<void> {
    setBusy(true);
    try {
      await refreshCart();
    } catch (error) {
      void toast({ message: describeError(error), duration: 4000, position: "top" });
    } finally {
      setBusy(false);
    }
  }

  // Ask CAESAR once on arrival when signed in and nothing is saved yet.
  const anyCart = useCart() !== null;
  useEffect(() => {
    if (signedIn && !anyCart && !busy) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Combinations: every way the term's classes fit without overlapping.
  // While on, the week and the list show one combination at a time.
  const [combosOn, setCombosOn] = useState(
    () => (window as unknown as { launchParams?: URLSearchParams }).launchParams?.get("combos") === "1"
  );
  const [combos, setCombos] = useState<Combos | null>(null);
  const [comboIndex, setComboIndex] = useState(0);
  const [credits, setCredits] = useState<CreditsPrefs | null>(null);
  const [sort, setSort] = useState<SortMode>(DEFAULT_SORT_MODE);
  // Sections the student wants in every combination.
  const [pins, setPins] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    void loadCredits().then(setCredits);
    void loadSortMode().then(setSort);
  }, []);
  useEffect(() => setPins(new Set()), [termId]);
  const ctecChanges = useCtecChanges();
  const classKeys = classes.map((c) => `${c.key}:${c.state}`).join("|");
  useEffect(() => {
    if (!combosOn || !credits || !termId) return;
    let current = true;
    void buildCombos(termId, classes, { credits, sort, pins }).then((built) => {
      if (!current) return;
      setCombos(built);
      setComboIndex((index) => Math.min(index, Math.max(0, built.list.length - 1)));
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combosOn, credits, sort, pins, termId, classKeys, ctecChanges]);
  const combo = combosOn ? (combos?.list[comboIndex] ?? null) : null;
  const inCombo = useMemo(() => (combo ? new Set(combo.sectionIds) : null), [combo]);
  const comboRating = useMemo(() => (combo ? rateCombo(combo) : null), [combo, ctecChanges]);
  const step = (by: number) => {
    const total = combos?.list.length ?? 0;
    if (total > 0) setComboIndex((index) => (index + by + total) % total);
  };
  const changeCredits = (next: CreditsPrefs) => {
    const clean = { maxCredits: Math.max(0.5, next.maxCredits), minCredits: Math.max(0, Math.min(next.minCredits, next.maxCredits)) };
    setCredits(clean);
    void saveCredits(clean);
  };
  const togglePin = (sectionId: string) =>
    setPins((current) => {
      const next = new Set(current);
      if (!next.delete(sectionId)) next.add(sectionId);
      return next;
    });

  // In a wide window the search is down the left of this screen, and a
  // class picked there, on the week or in the list opens in a panel beside
  // it, with the schedule staying as it is on the right. `?q=` and `?pick=SUBJECT/catalog`
  // set them at launch (development aid).
  const launch = (window as unknown as { launchParams?: URLSearchParams }).launchParams;
  const [picked, setPicked] = useState<Picked | null>(() => {
    const [subject, catalog] = (launch?.get("pick") ?? "").split("/");
    return subject && catalog ? { subject, catalog } : null;
  });
  // Picking the open class again closes it.
  const pick = (course: Picked) =>
    setPicked((now) => (now && now.subject === course.subject && now.catalog === course.catalog ? null : course));
  // The class in the panel. It outlives `picked` by a moment, so the panel
  // still has its class while it slides shut.
  const [shown, setShown] = useState<Picked | null>(picked);
  useEffect(() => {
    if (picked) return setShown(picked);
    const timer = setTimeout(() => setShown(null), 320);
    return () => clearTimeout(timer);
  }, [picked]);
  const [preview, setPreview] = useState<PaperSection[]>([]);
  // Another term has other classes: close the open one.
  const pickedTerm = useRef(termId);
  useEffect(() => {
    if (pickedTerm.current && pickedTerm.current !== termId) setPicked(null);
    pickedTerm.current = termId;
  }, [termId]);
  // The picked class gets the colour it would have once on the schedule.
  // The opened course's sections of its first kind (its lectures, say): the
  // choices drawn dashed on the week. Each has a colour of its own, since
  // each is a different class to be in. `preview` narrows to one on hover.
  const [options, setOptions] = useState<PaperSection[]>([]);
  useEffect(() => {
    if (preview.length !== 1 || options.length === 0) setOptions(preview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);
  const colorOf = useMemo(
    () =>
      courseColors(classes, [
        ...(picked ? [picked] : []),
        ...options.map((section) => ({ subject: section.subject, catalog: optionKey(section) }))
      ]),
    [classes, picked, options]
  );
  // Another course has other sections.
  useEffect(() => {
    setOptions([]);
    setPreview([]);
  }, [picked?.subject, picked?.catalog]);
  const pickedOnWeek = Boolean(picked && classes.some((c) => c.subject === picked.subject && c.catalog === picked.catalog));
  // A course already on the week keeps the week as it is: its other
  // sections show only one at a time, while the pointer is on their row.
  const ghosts = !picked || (pickedOnWeek && preview.length !== 1) ? [] : preview;
  const search = useSearch({
    initialQuery: launch?.get("q") ?? "",
    picked,
    onPick: wide ? pick : undefined,
    onWeek: (subject, catalog) =>
      classes.some((c) => c.subject === subject && c.catalog === catalog) ? colorOf(subject, catalog) : undefined
  });
  const timed = useMemo(
    () => classes.filter((c): c is Timed => c.section !== null && (!inCombo || inCombo.has(c.section.section_id))),
    [classes, inCombo]
  );
  const choices = classes.filter((c) => c.section && c.section.meeting_days.some(Boolean)).length;
  const termName = terms?.terms.find((t) => t.id === termId)?.name ?? "this term";
  const open = (entry: Timed) =>
    wide ? pick({ subject: entry.subject, catalog: entry.catalog }) : setSheet({ termId: termId!, subject: entry.subject, catalog: entry.catalog, title: entry.title, section: entry.section });
  // Through the app's own tab switch, so a wide window animates the change.
  const find = () => void window.dispatchEvent(new CustomEvent(wide ? "pencil:find" : "pencil:go", { detail: "search" }));

  // Combinations: the link that turns them on, then the bar that steps
  // through them. In a wide window it sits in the week's own card.
  const combosBar = (
    <div className={`combos-group${combosOn ? " is-on" : ""}`}>
          {(choices >= 2 || combosOn) && (
            <div className="combos">
              <button className="switch" role="switch" aria-checked={combosOn} onClick={() => setCombosOn((on) => !on)}>
                <i />Combinations
              </button>
            </div>
          )}
          {combosOn && credits && (
            <div className="combos is-on">
              <div className="combos-step">
                <button aria-label="Previous combination" onClick={() => step(-1)}><Icon name="left" /></button>
                <span>
                  {combos === null ? <Spin /> : combos.list.length === 0 ? "None" : <><b>{comboIndex + 1}</b> of {combos.list.length}{combos.truncated ? "+" : ""}</>}
                </span>
                <button aria-label="Next combination" onClick={() => step(1)}><Icon name="right" /></button>
              </div>
              {combo && (
                <span className="combos-sum">
                  {combo.totalUnits} {combo.totalUnits === 1 ? "credit" : "credits"}
                  {comboRating?.rating != null && <><Sep /><RatingChip rating={comboRating.rating} /></>}
                  {comboRating?.hours != null && <><Sep />about {comboRating.hours.toFixed(0)} hrs a week</>}
                </span>
              )}
              <label>
                Sort
                <select
                  value={sort}
                  onChange={(event) => {
                    const mode = event.target.value as SortMode;
                    setSort(mode);
                    setComboIndex(0);
                    void saveSortMode(mode);
                  }}
                >
                  {(Object.keys(SORT_MODE_LABELS) as SortMode[]).map((mode) => (
                    <option key={mode} value={mode}>{SORT_MODE_LABELS[mode]}</option>
                  ))}
                </select>
              </label>
              <label>
                Credits
                <input
                  type="number" inputMode="decimal" min={0} step={0.5} value={credits.minCredits} aria-label="Fewest credits"
                  onChange={(event) => changeCredits({ ...credits, minCredits: Number(event.target.value) || 0 })}
                />
                to
                <input
                  type="number" inputMode="decimal" min={0.5} step={0.5} value={credits.maxCredits} aria-label="Most credits"
                  onChange={(event) => changeCredits({ ...credits, maxCredits: Number(event.target.value) || 0.5 })}
                />
              </label>
              {combos && combos.list.length === 0 && (
                <p className="note-text is-error">
                  {combos.conflictingPins
                    ? "Your pinned and enrolled classes overlap or go over the credit limit, so nothing fits."
                    : `Nothing fits between ${credits.minCredits} and ${credits.maxCredits} credits.`}
                </p>
              )}
            </div>
          )}
    </div>
  );
  // Registration dates sit under the week, above the class lists.
  const dates = <RegDates termName={terms?.terms.find((t) => t.id === termId)?.name ?? ""} />;
  const notes = (
    <>
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

          {!wide && combosBar}
    </>
  );
  const lists = (
    <>
              {GROUPS.map(([state, title]) => {
                const group = classes.filter((c) => c.state === state);
                // Enrolled and cart always show once signed in, empty or not, so
                // what CAESAR said is plain; an empty Planned list is left out.
                if (group.length === 0 && (state === "planned" || !signedIn)) return null;
                const term = termShort(termName);
                return (
                  <div key={state} data-group={state}>
                  <Section
                    title={title}
                    ctx={
                      state === "planned" ? (
                        syncing ? "Synced across your devices" : `Only on this ${device}`
                      ) : state === "enrolled" ? (
                        busy ? (
                          <><Spin /> Checking CAESAR</>
                        ) : (
                          <>
                            {cartTerm?.refreshedAt ? `Checked ${timeAgo(cartTerm.refreshedAt)}` : null}
                            {cartTerm?.refreshedAt ? <Sep /> : null}
                            <button className="link" onClick={() => void refresh()}>Refresh</button>
                          </>
                        )
                      ) : state === "cart" && group.length > 0 ? (
                        checking ? (
                          <><Spin /> {checking}</>
                        ) : (
                          <button className="link" onClick={() => void checkSeats()}>Check seats</button>
                        )
                      ) : undefined
                    }
                  >
                    <div className="rows">
                      {group.length === 0 && (
                        <p className="row row-empty">
                          {state === "enrolled" ? `Not enrolled in anything for ${term}` : `Nothing in your cart for ${term}`}
                        </p>
                      )}
                      {group.map((entry) => {
                        const section = entry.section;
                        const seats = state === "cart" && entry.classNumber ? seatsOf(entry.classNumber) : null;
                        const ctec = section
                          ? savedCtec({ course_id: "", subject: entry.subject, catalog: entry.catalog, title: entry.title, sections: [] }, section)
                          : null;
                        const rating = overallRating(ctec);
                        const hours = ctec?.metrics.hours?.mean;
                        const pinned = section ? pins.has(section.section_id) : false;
                        return (
                          <Row
                            key={entry.key}
                            faint={Boolean(inCombo && section && !inCombo.has(section.section_id))}
                            actions={
                              combosOn && section && state !== "enrolled" ? (
                                <button className={`link${pinned ? "" : " quiet"}`} onClick={() => togglePin(section.section_id)}>
                                  <Icon name="pin" />{pinned ? "Pinned" : "Pin"}
                                </button>
                              ) : undefined
                            }
                            lead={<span className="swatch" style={colorOf(entry.subject, entry.catalog)} />}
                            code={
                              <>
                                {courseCode(entry.subject, entry.catalog)}
                                <Sep />
                                {section ? `${componentName(section.component)} ${section.section}` : entry.label}
                              </>
                            }
                            title={entry.title || courseCode(entry.subject, entry.catalog)}
                            about={
                              section ? (
                                <>{meetingLines(section).join(", ") || "No set time"}<Sep />{formatInstructors(section)}</>
                              ) : undefined
                            }
                            meta={
                              (rating !== undefined || seats) && (
                                <>
                                  <RatingChip rating={rating} hours={hours} />
                                  {seats && (
                                    <>
                                      <span className={`seats ${seats.open === null ? "" : seats.open <= 0 ? "full" : seats.capacity && seats.open / seats.capacity <= 0.15 ? "tight" : "open"}`}>
                                        {seats.open === null ? "Seats unknown" : seats.open <= 0 ? (seats.waitlist > 0 ? `Full · ${seats.waitlist} waiting` : "Full") : `${seats.open} open`}
                                      </span>
                                      <span>{seats.capacity !== null ? `of ${seats.capacity} · ` : ""}{timeAgo(seats.at)}</span>
                                    </>
                                  )}
                                </>
                              )
                            }
                            onClick={section ? () => open(entry as Timed) : undefined}
                          />
                        );
                      })}
                    </div>
                  </Section>
                  </div>
                );
              })}
    </>
  );
  // Signed out, the cart and enrolled lists can't be read: one line says so.
  const foot = !signedIn && (
    <p className="note-text" style={{ marginTop: 16 }}>
      <button className="link" onClick={() => void signInToCaesar().then((ok) => { if (ok) void refresh(); })}>
        Sign in to Northwestern
      </button>{" "}
      to see your cart and enrolled classes here.
    </p>
  );
  const empty = (
    <Section first bare>
      <Status
        title={`Nothing in ${termName} yet`}
        action={<button className="bc-btn bc-btn--primary" onClick={find}>Find classes</button>}
      >
        Classes you plan, add to your cart or enroll in show up here as one week.
      </Status>
    </Section>
  );

  if (wide) {
    return (
      <IonPage>
        <IonContent scrollY={false}>
          <div className={`split${picked && termId ? " has-course" : ""}`}>
            <div className="split-list" onScroll={search.onScroll}>
              {search.top}
              {search.list}
            </div>
            {/* The class opened from the search or the week, in a panel of its own. */}
            <div className="split-course" style={shown ? colorOf(shown.subject, shown.catalog) : undefined} aria-hidden={!picked}>
              {shown && termId && (
                <div className="split-course-in" key={`${termId}|${shown.subject}|${shown.catalog}`}>
                  <button className="link split-back" onClick={() => setPicked(null)}>
                    <Icon name="close" />Close
                  </button>
                  <CourseView
                    termId={termId}
                    subject={shown.subject}
                    catalog={shown.catalog}
                    onPreview={setPreview}
                    optionColor={(section) =>
                      classes.some((c) => c.section?.section_id === section.section_id)
                        ? colorOf(section.subject, section.catalog)
                        : options.some((o) => o.section_id === section.section_id)
                          ? colorOf(section.subject, optionKey(section))
                          : undefined
                    }
                  />
                </div>
              )}
            </div>
            {/* The schedule: one scrolling panel, week first, the same whether
                or not a class is open beside it. */}
            <div className="split-main">
              <div className="split-week">
                <div className="sec-head">
                  <h2 className="sec-title">Your {terms ? termShort(termName) : "week"}</h2>
                  {combosBar}
                  <span className="sec-ctx">
                    {combosOn
                      ? ""
                      : !picked
                      ? "Click a class to open it"
                      : ghosts.length > 0 && ghosts.every((g) => meetingsOf(g).length === 0)
                        ? `${componentName(ghosts[0]!.component)} ${ghosts[0]!.section} has no day listed in the catalog, so it can’t be drawn here`
                      : ghosts.length > 0
                        ? `Dashed: when ${courseCode(picked.subject, picked.catalog)} is offered, one colour per section`
                        : pickedOnWeek
                          ? "Point at another section to see where it would fall"
                          : "Click another class to see it instead"}
                  </span>
                </div>
                <WeekGrid entries={timed} hourPx={48} ghosts={ghosts} colorOf={colorOf} selected={picked} onOpen={open} />
              </div>
              <div className="split-detail">
                <div className="screen">
                  {dates}
                  {notes}
                  <div className="sched-list">{classes.length === 0 && empty}{lists}</div>
                  {foot}
                </div>
              </div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent>
        <IonRefresher
          slot="fixed"
          disabled={!signedIn}
          onIonRefresh={(event) => void refresh().finally(() => event.detail.complete())}
        >
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen top-level">
          <Head
            title="Schedule"
            right={classes.length > 0 ? <button className="link" onClick={find}>Add classes</button> : undefined}
          />
          <div style={{ marginBottom: 12 }}>
            <TermPills terms={terms} />
          </div>

          {notes}

          {classes.length === 0 ? (
            // The empty week is still drawn, so the screen reads as a schedule.
            <div className="sched">
              <WeekGrid entries={[]} hourPx={wide ? 56 : 44} colorOf={colorOf} />
              <div className="sched-list">
                {dates}
                {empty}
                {lists}
              </div>
            </div>
          ) : (
            <div className="sched">
              <WeekGrid entries={timed} hourPx={wide ? 56 : 44} colorOf={colorOf} onOpen={open} />

              <div className="sched-list">
              {dates}
              {lists}
              </div>
            </div>
          )}

          {foot}
        </div>
        <SectionSheet target={sheet} onClose={() => setSheet(null)} />
      </IonContent>
    </IonPage>
  );
}
