// Shown once, the first time the app opens. First it says that this is
// Pencil's own place to plan and register, not CAESAR or Paper.nu with
// extras added; then it offers to pair the student's other devices.
import { IonContent, IonModal } from "@ionic/react";
import { useEffect, useState } from "react";
import pencilIcon from "@ext/assets/icons/pencil.svg";
import { turnOnSync, useSync } from "../data/sync";
import { device } from "../platform/native";
import { useWide } from "../platform/wide";
import { PlanTransfer } from "./PlanTransfer";
import "./welcome.css";

const KEY = "pencil-app:welcomed";

export function Welcome() {
  const wide = useWide();
  const sync = useSync();
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) === null);
  // `?welcome=devices` opens on the second step and `?welcome=code` presses
  // its first button (launch-route development aids).
  const aid = (window as unknown as { launchParams?: URLSearchParams }).launchParams?.get("welcome");
  const [step, setStep] = useState<"hello" | "devices">(aid ? "devices" : "hello");
  const [pairing, setPairing] = useState(false);
  useEffect(() => {
    if (aid === "code") setTimeout(() => pair(true), 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };
  // Hands over to the sync sheet, which shows the code or takes one.
  const pair = (showCode: boolean) => {
    if (showCode && !sync.secret) turnOnSync();
    close();
    setPairing(true);
  };

  return (
    <>
      <IonModal
        className="sheet welcome"
        isOpen={open}
        onDidDismiss={close}
        {...(wide ? {} : { initialBreakpoint: 0.75, breakpoints: [0, 0.75] })}
      >
        <IonContent>
          {step === "hello" ? (
            <div className="sheet-body welcome-body">
              <img src={pencilIcon} alt="" width="56" height="56" />
              <h1>Welcome to Pencil</h1>
              <p className="text">
                This is something new. Pencil is its own place to plan your quarter, separate from CAESAR and
                Paper.nu: search classes, see seats and CTECs, build your week and fill your cart, all right here.
              </p>
              <p className="text">
                Sign in with Northwestern when you’re ready and Pencil talks to CAESAR for you. Everything stays on
                your device.
              </p>
              <p className="welcome-love">
                Made with love by Kevin Wang &amp; Jason Latz, to make registering as simple as possible.
              </p>
              <button className="bc-btn bc-btn--primary" onClick={() => setStep("devices")}>
                Get started
              </button>
            </div>
          ) : (
            <div className="sheet-body welcome-body">
              <div className="welcome-devices" aria-hidden="true">
                <span>Mac</span>
                <span>iPhone</span>
                <span>Android</span>
                <span>Windows</span>
              </div>
              <h1>Got Pencil somewhere else too?</h1>
              <p className="text">
                Pair your devices and the classes you plan on one show up on the others. Your plan is locked before it
                leaves this {device}, so only your own devices can read it.
              </p>
              <button className="bc-btn bc-btn--primary" onClick={() => pair(true)}>
                Show a code to scan
              </button>
              <button className="bc-btn" onClick={() => pair(false)}>
                I have a code from another device
              </button>
              <button className="link" onClick={close}>
                Not now
              </button>
              <p className="text welcome-later">You can do this any time from You, under Sync your devices.</p>
            </div>
          )}
        </IonContent>
      </IonModal>
      {pairing && <PlanTransfer open onClose={() => setPairing(false)} />}
    </>
  );
}
