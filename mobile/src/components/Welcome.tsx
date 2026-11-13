// Shown once, the first time the app opens: says that this is Pencil's own
// place to plan and register, not CAESAR or Paper.nu with extras added.
import { IonContent, IonModal } from "@ionic/react";
import { useState } from "react";
import pencilIcon from "@ext/assets/icons/pencil.svg";
import { useWide } from "../platform/wide";
import "./welcome.css";

const KEY = "pencil-app:welcomed";

export function Welcome() {
  const wide = useWide();
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) === null);
  const close = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };
  return (
    <IonModal
      className="sheet welcome"
      isOpen={open}
      onDidDismiss={close}
      {...(wide ? {} : { initialBreakpoint: 0.75, breakpoints: [0, 0.75] })}
    >
      <IonContent>
        <div className="sheet-body welcome-body">
          <img src={pencilIcon} alt="" width="56" height="56" />
          <h1>Welcome to Pencil</h1>
          <p className="text">
            This is something new. Pencil is its own place to plan your quarter, separate from CAESAR and Paper.nu:
            search classes, see seats and CTECs, build your week and fill your cart, all right here.
          </p>
          <p className="text">
            Sign in with Northwestern when you’re ready and Pencil talks to CAESAR for you. Everything stays on your
            device.
          </p>
          <p className="welcome-love hand">Made with love by Kevin Wang &amp; Jason Latz, to make registering as simple as possible.</p>
          <button className="bc-btn bc-btn--primary" onClick={close}>
            Get started
          </button>
        </div>
      </IonContent>
    </IonModal>
  );
}
