import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonRefresher, IonRefresherContent, IonToolbar, useIonToast } from "@ionic/react";
import { useEffect, useMemo, useState } from "react";
import { Head, OffCampusNote, Row, SeasonIcon, Section, Sep, Spin, Status } from "../components/bits";
import { refreshCourseHistory, useCourseHistory, type CourseHistoryEntry } from "../data/caesar";
import { useSessionState } from "../platform/session-state";
import { describeError, signInToCaesar } from "../platform/sign-in";

function byTerm(entries: CourseHistoryEntry[]): Array<[string, CourseHistoryEntry[]]> {
  const groups = new Map<string, { date: string; rows: CourseHistoryEntry[] }>();
  for (const entry of entries) {
    const group = groups.get(entry.termLabel) ?? { date: entry.termStartDate ?? "", rows: [] };
    group.rows.push(entry);
    groups.set(entry.termLabel, group);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].date.localeCompare(a[1].date))
    .map(([label, group]) => [label, group.rows]);
}

export function HistoryPage() {
  const session = useSessionState();
  const history = useCourseHistory();
  const [toast] = useIonToast();
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    setBusy(true);
    try {
      await refreshCourseHistory();
    } catch (error) {
      void toast({ message: describeError(error), duration: 4000, position: "top" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (session.caesar === "in" && !history?.refreshedAt && !busy) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.caesar]);

  const groups = useMemo(() => byTerm(history?.entries ?? []), [history]);
  const taken = history?.entries.filter((e) => e.status === "Taken" || e.status === "Transferred").length ?? 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/you" text="You" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(event) => void refresh().finally(() => event.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen">
          <Head
            title="Course history"
            meta={groups.length > 0 ? <>{taken} completed<Sep />{groups.length} terms</> : undefined}
            code={groups.length > 0 ? "From CAESAR" : undefined}
            right={busy ? <Spin /> : undefined}
          />
          <OffCampusNote />

          {groups.length === 0 && session.caesar !== "in" && (
            <Section first bare>
              <Status
                title="Not loaded yet"
                action={
                  <button className="bc-btn bc-btn--primary" onClick={() => void signInToCaesar().then((ok) => { if (ok) void refresh(); })}>
                    Sign in to Northwestern
                  </button>
                }
              />
            </Section>
          )}

          {groups.map(([label, rows], index) => {
            const units = rows.reduce((sum, row) => sum + (row.units ?? 0), 0);
            return (
              <Section
                key={label}
                first={index === 0}
                title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><SeasonIcon term={label} size={14} />{label}</span>}
                ctx={<>{rows.length} {rows.length === 1 ? "class" : "classes"}{units > 0 && <><Sep />{Number(units.toFixed(2))} units</>}</>}
              >
                <div className="rows">
                  {rows.map((row) => (
                    <Row
                      key={`${row.catalog}-${row.status}`}
                      code={row.catalog.replace(/_/g, " ").replace(/-0$/, "")}
                      title={row.description}
                      meta={row.grade ? <span className="strong">{row.grade}</span> : row.status}
                    />
                  ))}
                </div>
              </Section>
            );
          })}
        </div>
      </IonContent>
    </IonPage>
  );
}
