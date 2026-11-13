import { useState } from "react";
import { useLocation } from "react-router-dom";
import { IonContent, IonPage, useIonAlert, useIonRouter } from "@ionic/react";
import { Head, OffCampusNote, Row, Section } from "../components/bits";
import { useCourseHistory } from "../data/caesar";
import { useSessionState } from "../platform/session-state";
import { signInToCaesar, signOut } from "../platform/sign-in";
import { appearance, setAppearance } from "../platform/design";
import { device } from "../platform/native";
import { PlanTransfer } from "../components/PlanTransfer";
import { incomingLink } from "../data/share";
import { useStore } from "../data/store";

declare const __APP_VERSION__: string;

export function YouPage() {
  const [look, setLook] = useState(appearance());
  const session = useSessionState();
  const history = useCourseHistory();
  const router = useIonRouter();
  const [alert] = useIonAlert();
  const location = useLocation();
  const incoming = useStore(incomingLink);
  // `?transfer` opens the sheet at launch (development aid).
  const [transfer, setTransfer] = useState(() => new URLSearchParams(location.search).has("transfer"));

  const taken = history?.entries.filter((e) => e.status === "Taken" || e.status === "Transferred").length ?? 0;
  const signedIn = session.caesar === "in";

  return (
    <IonPage>
      <IonContent>
        <div className="screen top-level">
          <Head title="You" />

          <OffCampusNote />

          <Section
            first
            title="Northwestern"
            ctx={
              signedIn ? (
                <button
                  className="link"
                  onClick={() =>
                    void alert({
                      header: "Sign out?",
                      message: `Your schedule and saved data stay on this ${device}.`,
                      buttons: ["Cancel", { text: "Sign out", role: "destructive", handler: () => void signOut() }]
                    })
                  }
                >
                  Sign out
                </button>
              ) : undefined
            }
          >
            <div className="rows">
              <Row
                title="CAESAR"
                about={signedIn ? `Signed in on this ${device}` : "Sign in for live seats, your cart and CTECs"}
                meta={
                  signedIn ? undefined : (
                    <button className="bc-btn bc-btn--primary bc-btn--compact" onClick={() => void signInToCaesar()}>
                      Sign in
                    </button>
                  )
                }
              />
              <Row
                title="Course history"
                about={history?.refreshedAt ? `${taken} completed` : "The classes you’ve taken"}
                meta="›"
                onClick={() => router.push("/you/history")}
              />
            </div>
          </Section>

          <Section title="Your plan">
            <div className="rows">
              <Row
                title="Sync your devices"
                about="Keep planned classes the same on your phone and computer, or bring in a Paper.nu link"
                meta="›"
                onClick={() => setTransfer(true)}
              />
            </div>
          </Section>

          <Section title="Appearance">
            <div className="pills">
              {(["system", "light", "dark"] as const).map((choice) => (
                <button
                  key={choice}
                  className={`pill plain${look === choice ? " is-on" : ""}`}
                  onClick={() => {
                    setAppearance(choice);
                    setLook(choice);
                  }}
                >
                  {choice === "system" ? `Match this ${device}` : choice === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Your data" bare>
            <p className="text">
              Everything stays on this {device}. You sign in on Northwestern’s own pages, and your schedule, cart and
              CTECs are saved only here. If you turn on sync, your planned classes also travel between your devices,
              locked so that nothing in between can read them.
            </p>
            <div className="brand">
              <span className="hand">pencil</span>
              <span>version {__APP_VERSION__} · open source</span>
            </div>
          </Section>
        </div>
        <PlanTransfer open={transfer || incoming !== null} onClose={() => {
            setTransfer(false);
            incomingLink.set(null);
          }} />
      </IonContent>
    </IonPage>
  );
}
