import { IonContent, IonModal } from "@ionic/react";
import { useRef } from "react";
import { closeAnalytics, openAnalytics, type AnalyticsModalSource } from "../data/analytics";

// The full CTEC analytics view: the extension's own sheet (terms, ratings,
// hours, comments), drawn inside a full-height page.
export function AnalyticsSheet({ source, onClose }: { source: AnalyticsModalSource | null; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <IonModal
      isOpen={source !== null}
      onDidPresent={() => {
        if (source && host.current) openAnalytics(source, host.current);
      }}
      onWillDismiss={closeAnalytics}
      onDidDismiss={onClose}
    >
      <IonContent>
        <div className="full-sheet-top">
          <button className="link quiet" onClick={onClose}>Done</button>
        </div>
        <div className="full-sheet-host" ref={host} />
      </IonContent>
    </IonModal>
  );
}
