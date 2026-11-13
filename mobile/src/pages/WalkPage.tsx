import { IonContent, IonPage } from "@ionic/react";
import { useEffect, useMemo, useState } from "react";
import { courseColors, Head, Section, Status } from "../components/bits";
import { TermPills } from "../components/TermPills";
import { Trail } from "../components/Trail";
import type { Timed } from "../components/WeekGrid";
import { loadTerms, selectedTerm, type Terms } from "../data/catalog";
import { meetingsOf } from "../data/schedule";
import { useStore } from "../data/store";
import { useTermClasses } from "../data/term-classes";

// The term's classes as a walk across campus, a day at a time. The week
// itself stays on Schedule; this screen is only the map and its steps.
export function WalkPage() {
  const termId = useStore(selectedTerm);
  const classes = useTermClasses(termId);
  const [terms, setTerms] = useState<Terms | null>(null);
  useEffect(() => {
    loadTerms().then(setTerms, () => undefined);
  }, []);
  const colorOf = useMemo(() => courseColors(classes), [classes]);
  const timed = useMemo(() => classes.filter((c): c is Timed => c.section !== null && meetingsOf(c.section).length > 0), [classes]);
  const termName = terms?.terms.find((t) => t.id === termId)?.name ?? "this term";

  return (
    <IonPage>
      <IonContent>
        <div className="screen top-level">
          <Head title="Walk" />
          <div style={{ marginBottom: 12 }}>
            <TermPills terms={terms} />
          </div>
          {timed.length === 0 ? (
            <Section first bare>
              <Status title={`No classes with a time in ${termName} yet`}>
                Once you plan, add to your cart or enroll in classes, this shows each day as a walk between their buildings.
              </Status>
            </Section>
          ) : (
            <Trail entries={timed} colorOf={colorOf} />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
